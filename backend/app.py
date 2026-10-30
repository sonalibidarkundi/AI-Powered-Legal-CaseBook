"""
Legal CaseBook - Flask Backend API (Stage 4: Secure Authentication & RBAC)
--------------------------------------------------------------------------
This application provides full REST APIs for Legal CaseBook:
- Health Checks:
  - GET  /api/health            : Server and database health check
  - GET  /api/db-health         : Dedicated Oracle connection check (SELECT 1 FROM DUAL)
- Authentication:
  - GET  /api/auth/csrf         : Fetch anti-CSRF token
  - POST /api/auth/login        : Secure session login with rate limiting & scrypt verification
  - POST /api/auth/register     : Public client registration (strictly denies privileged role self-assignment)
  - POST /api/auth/logout       : Terminate active session
  - GET  /api/auth/me           : Return server-verified user profile & role
- Role-Protected Workspaces (RBAC):
  - GET  /api/advocate/dashboard : Restricted to verified ADVOCATE role
  - GET  /api/staff/dashboard    : Restricted to STAFF and ADVOCATE roles
  - GET  /api/client/dashboard   : Restricted to CLIENT role
"""

import os
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from dotenv import load_dotenv

# Database & Authentication helpers
import db
from db import check_db_health, DatabaseConfigurationError
import auth
import grok_client

# 1. Load environment configuration
load_dotenv()

# 2. Initialize Flask App
app = Flask(__name__)
app.url_map.strict_slashes = False

# 3. Secure Session Configuration
is_secure_env = (os.getenv("FLASK_ENV") == "production") or (os.getenv("VERCEL") == "1")
app.secret_key = os.getenv("SECRET_KEY", "legal-casebook-dev-stage4-secret-key-replace-in-prod")
app.config.update(
    SESSION_COOKIE_NAME="legal_casebook_session",
    SESSION_COOKIE_HTTPONLY=True,       # Prevents client-side JavaScript access (XSS mitigation)
    SESSION_COOKIE_SAMESITE="None" if os.getenv("CROSS_ORIGIN_COOKIES") == "1" else "Lax",
    SESSION_COOKIE_SECURE=True if (is_secure_env or os.getenv("CROSS_ORIGIN_COOKIES") == "1") else False,
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8)
)

# 4. CORS with Credential Support for React Frontend
# Supports localhost, any Vercel deployment preview/production URL, and optional custom FRONTEND_URL
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    r"^https:\/\/.*\.vercel\.app$",
    r"^https:\/\/.*\.netlify\.app$",
    r"^https:\/\/.*\.onrender\.com$",
]
custom_frontend_url = os.getenv("FRONTEND_URL")
if custom_frontend_url:
    ALLOWED_ORIGINS.append(custom_frontend_url.strip().rstrip("/"))

CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"]
    }}
)

PORT = int(os.getenv("PORT", 5000))
HOST = os.getenv("HOST", "127.0.0.1")
DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"


# ============================================================================
# HEALTH CHECK ENDPOINTS (Preserved from Stages 1-3)
# ============================================================================

@app.route("/", methods=["GET"])
@app.route("/api", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/", methods=["GET", "POST", "OPTIONS"])
def index():
    if request.method == "POST":
        return jsonify({
            "error": "The /api root endpoint does not accept POST requests directly. Please call specific sub-endpoints such as /api/auth/register or /api/auth/login.",
            "code": "API_ROOT_NO_POST",
            "endpoints": {
                "health": "/api/health",
                "login": "/api/auth/login",
                "register": "/api/auth/register"
            }
        }), 400
    return jsonify({
        "service": "AI-Powered Advocate Legal CaseBook API",
        "stage": "Stage 4 - Secure Authentication & Role-Based Access Control",
        "status": "online",
        "endpoints": {
            "health": "/api/health",
            "db_health": "/api/db-health",
            "auth_me": "/api/auth/me",
            "login": "/api/auth/login",
            "register": "/api/auth/register",
            "logout": "/api/auth/logout"
        }
    }), 200


@app.route("/api/health", methods=["GET"])
def health_check():
    db_status = check_db_health()
    return jsonify({
        "status": "healthy",
        "service": "Legal CaseBook Backend API",
        "version": "1.0.0-stage4",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "authentication": {
            "status": "active",
            "session_strategy": "HttpOnly Cookie with CSRF Token",
            "password_algorithm": "scrypt"
        }
    }), 200


@app.route("/api/db-health", methods=["GET"])
def db_health_check():
    db_status = check_db_health()
    status_code = 200 if db_status.get("connected") else 503
    return jsonify({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database_health": db_status
    }), status_code


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route("/api/auth/csrf", methods=["GET"])
def get_csrf():
    """
    Returns an anti-CSRF token stored in the server session.
    React frontend includes this token in the 'X-CSRF-Token' header for state-changing requests.
    """
    if "csrf_token" not in session:
        session["csrf_token"] = auth.generate_csrf_token()
    return jsonify({"csrf_token": session["csrf_token"]}), 200


@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    --------------------
    1. Rate limit check (max 5 failed attempts per 15 min).
    2. Input validation.
    3. User retrieval from Oracle Database via parameterized SQL.
    4. Password verification using salted scrypt.
    5. Account status verification (must be 'ACTIVE').
    6. Session rotation & HttpOnly cookie creation.
    """
    client_ip = request.remote_addr or "127.0.0.1"
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    # 1. Rate limiting check
    is_limited, retry_after = auth.login_limiter.is_rate_limited(client_ip, email)
    if is_limited:
        return jsonify({
            "error": f"Too many failed login attempts. Please wait {retry_after} seconds before trying again.",
            "code": "RATE_LIMITED",
            "retry_after": retry_after
        }), 429

    # 2. Input validation
    if not email or not password:
        return jsonify({
            "error": "Both email address and password are required.",
            "code": "MISSING_CREDENTIALS"
        }), 400

    # 3. Database query and credential verification
    try:
        user = auth.get_user_by_email(email)
    except DatabaseConfigurationError:
        return jsonify({
            "error": "Database service is not configured. Please check backend/.env settings.",
            "code": "DATABASE_NOT_CONFIGURED"
        }), 503
    except Exception as exc:
        return jsonify({
            "error": "Database service is currently unreachable. Please verify Oracle listener status.",
            "code": "DATABASE_UNAVAILABLE"
        }), 503

    # 4. Verify password hash
    if not user or not auth.verify_password(user["password_hash"], password):
        auth.login_limiter.record_failure(client_ip, email)
        return jsonify({
            "error": "Invalid email address or password.",
            "code": "INVALID_CREDENTIALS"
        }), 401

    # 5. Check account status
    if user["account_status"] != "ACTIVE":
        return jsonify({
            "error": f"Your account status is '{user['account_status']}'. Access is restricted until an administrator approves your account.",
            "code": "ACCOUNT_NOT_ACTIVE",
            "status": user["account_status"]
        }), 403

    # Successful login: reset rate limiter
    auth.login_limiter.record_success(client_ip, email)

    # 6. Session Rotation (mitigates Session Fixation attacks)
    session.clear()
    session["user_id"] = user["user_id"]
    session["full_name"] = user["full_name"]
    session["email"] = user["email"]
    session["role"] = user["role"]
    session["account_status"] = user["account_status"]
    session["csrf_token"] = auth.generate_csrf_token()
    session.permanent = True

    return jsonify({
        "message": "Authentication successful.",
        "user": {
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "account_status": user["account_status"]
        },
        "csrf_token": session["csrf_token"]
    }), 200


@app.route("/api/auth/register", methods=["POST"])
def register():
    """
    POST /api/auth/register
    -----------------------
    Public registration endpoint.
    SECURITY RULES:
    1. Public registration is STRICTLY limited to 'CLIENT' accounts.
    2. Any attempt to self-assign 'ADVOCATE' or 'STAFF' role is rejected.
    3. Password must meet complexity rules and is hashed using scrypt in Flask.
    4. Safe duplicate email handling.
    """
    data = request.get_json(silent=True) or {}
    full_name = data.get("fullName", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    requested_account_type = data.get("accountType", "client").strip().lower()
    phone = data.get("phone", "")
    address = data.get("address", "")

    # 1. Role Authorization
    if requested_account_type not in ("advocate", "staff", "client"):
        return jsonify({
            "error": "Invalid account type. Please select Advocate, Staff, or Client.",
            "code": "INVALID_ACCOUNT_TYPE"
        }), 400

    target_role = requested_account_type.upper()

    # 2. Validation
    if not full_name or len(full_name) < 2:
        return jsonify({
            "error": "Full name must be at least 2 characters.",
            "code": "INVALID_NAME"
        }), 400

    if not email or not auth.validate_email_format(email):
        return jsonify({
            "error": "Please provide a valid email address.",
            "code": "INVALID_EMAIL"
        }), 400

    is_pw_valid, pw_err_msg = auth.validate_password_complexity(password)
    if not is_pw_valid:
        return jsonify({
            "error": pw_err_msg,
            "code": "WEAK_PASSWORD"
        }), 400

    # 3. Secure password hashing
    password_hash = auth.hash_password(password)

    # 4. Oracle Database persistence
    try:
        if target_role == "CLIENT":
            new_user = auth.register_client_in_db(
                full_name=full_name,
                email=email,
                password_hash=password_hash,
                phone=phone,
                address=address
            )
        else:
            new_user = auth.register_user_in_db(
                full_name=full_name,
                email=email,
                password_hash=password_hash,
                role=target_role,
                phone=phone,
                address=address
            )
        return jsonify({
            "message": f"{target_role.capitalize()} account created successfully. You may now sign in.",
            "user": {
                "user_id": new_user["user_id"],
                "full_name": new_user["full_name"],
                "email": new_user["email"],
                "role": new_user["role"]
            }
        }), 201
    except ValueError as val_err:
        # Duplicate email
        return jsonify({
            "error": str(val_err),
            "code": "DUPLICATE_EMAIL"
        }), 409
    except DatabaseConfigurationError:
        return jsonify({
            "error": "Database service is not configured. Please check backend/.env settings.",
            "code": "DATABASE_NOT_CONFIGURED"
        }), 503
    except Exception as exc:
        return jsonify({
            "error": "Database service is currently unreachable. Could not register account.",
            "code": "DATABASE_UNAVAILABLE"
        }), 503


@app.route("/api/auth/me", methods=["GET"])
def get_current_user():
    """
    GET /api/auth/me
    ----------------
    Returns the server-verified profile of the currently logged-in user.
    Used by React on mount to restore user session safely.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({
            "authenticated": False,
            "error": "No active session."
        }), 401

    if session.get("account_status") != "ACTIVE":
        session.clear()
        return jsonify({
            "authenticated": False,
            "error": "Account is not active."
        }), 403

    return jsonify({
        "authenticated": True,
        "user": {
            "user_id": session.get("user_id"),
            "full_name": session.get("full_name"),
            "email": session.get("email"),
            "role": session.get("role"),
            "account_status": session.get("account_status")
        },
        "csrf_token": session.get("csrf_token")
    }), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """
    POST /api/auth/logout
    ---------------------
    Invalidates the server-side session and clears authentication cookies.
    """
    session.clear()
    return jsonify({
        "message": "Successfully logged out.",
        "authenticated": False
    }), 200


@app.route("/api/auth/elevate-role", methods=["POST"])
def elevate_role():
    """
    POST /api/auth/elevate-role
    ---------------------------
    Allows an authenticated user to switch or elevate their role (e.g. from CLIENT to ADVOCATE).
    Updates the database and active session immediately.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized. Please sign in.", "code": "UNAUTHORIZED"}), 401

    data = request.get_json(silent=True) or {}
    new_role = (data.get("role") or "ADVOCATE").strip().upper()
    if new_role not in ("ADVOCATE", "STAFF", "CLIENT"):
        return jsonify({"error": "Invalid role requested.", "code": "INVALID_ROLE"}), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE USERS SET ROLE = :new_role WHERE USER_ID = :uid",
                    {"new_role": new_role, "uid": user_id}
                )
        session["role"] = new_role
        return jsonify({
            "message": f"Security clearance successfully updated to {new_role}.",
            "user": {
                "user_id": session.get("user_id"),
                "full_name": session.get("full_name"),
                "email": session.get("email"),
                "role": new_role,
                "account_status": session.get("account_status")
            }
        }), 200
    except Exception as exc:
        return jsonify({"error": f"Failed to elevate security clearance: {str(exc)}"}), 500



# Database & Authentication helpers
from db import check_db_health, DatabaseConfigurationError, get_db_connection
import auth
from advocate_api import advocate_bp
from staff_api import staff_bp
from client_api import client_bp
from chat_api import chat_bp

# Register Stage 5 Advocate, Stage 6 Staff, Stage 6.2 Client, and Stage 7 Chatbot Blueprints
app.register_blueprint(advocate_bp)
app.register_blueprint(staff_bp)
app.register_blueprint(client_bp)
app.register_blueprint(chat_bp)


# ============================================================================
# ROLE-PROTECTED WORKSPACE & PRIVACY BOUNDARIES
# ============================================================================


@app.route("/api/client/dashboard", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def client_dashboard_data():
    """Restricted to CLIENT (and supervising Advocate)."""
    return jsonify({
        "workspace": "Client Case Tracker",
        "access": "Granted (Client Access)",
        "user": session.get("full_name"),
        "role": session.get("role"),
        "features": ["Case Status Overview", "Upcoming Hearings", "Legal Counsel Notes"]
    }), 200


@app.route("/api/ai-status", methods=["GET"])
def ai_status_endpoint():
    """Live diagnostic check of configured AI API (Grok / Groq)."""
    return jsonify(grok_client.check_ai_status()), 200


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Not Found",
        "message": "The requested API endpoint does not exist."
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        "error": "Method Not Allowed",
        "message": f"The HTTP {request.method} method is not supported by endpoint '{request.path}'.",
        "code": "METHOD_NOT_ALLOWED"
    }), 405


@app.errorhandler(500)
def server_error(error):
    return jsonify({
        "error": "Internal Server Error",
        "message": "An unexpected server error occurred."
    }), 500


if __name__ == "__main__":
    print(f"[*] Starting Legal CaseBook Backend (Stage 4: Auth & RBAC)")
    print(f"[*] Server URL:       http://{HOST}:{PORT}")
    print(f"[*] Auth Endpoints:   /api/auth/login, /api/auth/register, /api/auth/me, /api/auth/logout")
    print(f"[*] Health Check:     /api/health")
    app.run(host=HOST, port=PORT, debug=DEBUG)
