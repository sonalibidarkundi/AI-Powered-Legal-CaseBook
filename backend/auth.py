"""
Legal CaseBook - Authentication & Authorization Module (auth.py)
----------------------------------------------------------------
This module implements enterprise security controls for Stage 4:
1. Password Hashing: Uses Werkzeug's scrypt implementation with secure random salts.
2. Rate Limiting: In-memory tracker mitigating brute-force and credential-stuffing attacks.
3. Session Security: Decorators enforcing server-side session checks and role validation.
4. CSRF Protection: Validates anti-CSRF tokens for state-changing requests.
5. Role-Based Access Control (RBAC): Enforces Advocate, Staff, and Client boundaries.
"""

import functools
import re
import secrets
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
from flask import abort, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import db

# ============================================================================
# 1. PASSWORD CRYPTOGRAPHY
# ============================================================================

def hash_password(plaintext_password: str) -> str:
    """
    Hashes a password using salted scrypt.
    Passwords are NEVER stored in plaintext or logged.
    """
    if not plaintext_password or len(plaintext_password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    return generate_password_hash(plaintext_password, method="scrypt")


def verify_password(stored_hash: str, candidate_password: str) -> bool:
    """
    Verifies candidate plaintext against the stored cryptographic hash.
    Safe against timing attacks.
    """
    if not stored_hash or not candidate_password:
        return False
    return check_password_hash(stored_hash, candidate_password)


def validate_password_complexity(password: str) -> Tuple[bool, Optional[str]]:
    """
    Enforces password complexity rules:
    - Minimum 8 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A-Z)."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter (a-z)."
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number (0-9)."
    return True, None


def validate_email_format(email: str) -> bool:
    """Validates standard email address format."""
    email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    return bool(re.match(email_regex, email.strip()))


# ============================================================================
# 2. LOGIN RATE LIMITING (Brute-Force Protection)
# ============================================================================

class LoginRateLimiter:
    """
    In-memory rate limiter to prevent automated brute-force attacks on login.
    Limits failed login attempts per (IP, Email) pair.
    Default: Max 5 failed attempts per 15-minute window.
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 900):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        # Maps key -> list of failure timestamps
        self.failed_attempts: Dict[str, List[float]] = defaultdict(list)

    def _get_key(self, ip: str, email: str) -> str:
        clean_email = email.strip().lower() if email else "unknown"
        clean_ip = ip.strip() if ip else "unknown_ip"
        return f"{clean_ip}:{clean_email}"

    def is_rate_limited(self, ip: str, email: str) -> Tuple[bool, int]:
        """
        Returns (is_limited, remaining_seconds_to_wait).
        """
        now = time.time()
        key = self._get_key(ip, email)
        cutoff = now - self.window_seconds

        # Clean up timestamps older than the window
        self.failed_attempts[key] = [t for t in self.failed_attempts[key] if t > cutoff]

        if len(self.failed_attempts[key]) >= self.max_attempts:
            oldest = self.failed_attempts[key][0]
            retry_after = int(self.window_seconds - (now - oldest))
            return True, max(retry_after, 1)

        return False, 0

    def record_failure(self, ip: str, email: str):
        """Records a failed authentication attempt."""
        now = time.time()
        key = self._get_key(ip, email)
        self.failed_attempts[key].append(now)

    def record_success(self, ip: str, email: str):
        """Clears failed attempts upon successful login."""
        key = self._get_key(ip, email)
        if key in self.failed_attempts:
            del self.failed_attempts[key]


# Global rate limiter instance for login attempts
login_limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)


# ============================================================================
# 3. CSRF PROTECTION
# ============================================================================

def generate_csrf_token() -> str:
    """Generates a cryptographically strong anti-CSRF token."""
    return secrets.token_hex(32)


def verify_csrf_token():
    """
    Validates anti-CSRF token for state-changing HTTP methods (POST, PUT, DELETE).
    Reads token from request headers ('X-CSRF-Token', 'X-CSRFToken', etc.).
    """
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        session_token = session.get("csrf_token")
        request_token = (
            request.headers.get("X-CSRF-Token")
            or request.headers.get("X-CSRFToken")
            or request.headers.get("X-CSRF_Token")
            or request.headers.get("X-XSRF-TOKEN")
        )

        # In testing or development, if session_token is present, ensure request_token matches
        if session_token:
            if not request_token or not secrets.compare_digest(session_token, request_token):
                abort(403, description="CSRF validation failed. Missing or invalid X-CSRF-Token header.")


# ============================================================================
# 4. ROLE-BASED ACCESS CONTROL (RBAC) DECORATORS
# ============================================================================

def login_required(f):
    """
    Decorator requiring an active authenticated user session.
    Verifies that the account is in 'ACTIVE' status.
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")
        account_status = session.get("account_status")

        if not user_id:
            return jsonify({
                "error": "Authentication required. Please sign in to continue.",
                "code": "UNAUTHENTICATED"
            }), 401

        if account_status != "ACTIVE":
            session.clear()
            return jsonify({
                "error": "Your account is not active or is pending approval.",
                "code": "ACCOUNT_INACTIVE"
            }), 403

        return f(*args, **kwargs)
    return decorated_function


def role_required(allowed_roles: List[str]):
    """
    Decorator enforcing server-verified role-based access.
    The role is read strictly from trusted session data, NEVER from client input.
    """
    def decorator(f):
        @functools.wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            user_role = session.get("role")
            if user_role not in allowed_roles:
                return jsonify({
                    "error": f"Access denied. This workspace requires one of the following roles: {', '.join(allowed_roles)}.",
                    "code": "FORBIDDEN",
                    "user_role": user_role
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ============================================================================
# 5. ORACLE DATABASE USER OPERATIONS
# ============================================================================

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves user record from Oracle USERS table using parameterized SQL.
    Returns safe dictionary or None if not found.
    """
    clean_email = email.strip().lower()
    sql = """
        SELECT USER_ID, FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS
        FROM USERS
        WHERE LOWER(EMAIL) = :email
    """
    try:
        rows = db.execute_query(sql, {"email": clean_email})
        if rows and len(rows) > 0:
            row = rows[0]
            return {
                "user_id": int(row[0]),
                "full_name": str(row[1]),
                "email": str(row[2]),
                "password_hash": str(row[3]),
                "role": str(row[4]).upper(),
                "account_status": str(row[5]).upper()
            }
        return None
    except db.DatabaseConfigurationError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Database query error during user lookup: {exc}")


def register_user_in_db(full_name: str, email: str, password_hash: str, role: str = "ADVOCATE", phone: Optional[str] = None, address: Optional[str] = None) -> Dict[str, Any]:
    """
    Registers a new user (ADVOCATE, STAFF, or CLIENT) in Oracle Database.
    Inserts into USERS, sets status to 'ACTIVE', creates role-specific profile records,
    and logs event in AUDIT_LOGS.
    """
    clean_email = email.strip().lower()
    clean_name = full_name.strip()
    clean_phone = phone.strip() if phone else None
    clean_address = address.strip() if address else None
    normalized_role = role.strip().upper() if role else "ADVOCATE"

    if normalized_role not in ("ADVOCATE", "STAFF", "CLIENT"):
        raise ValueError(f"Invalid account role '{role}'. Allowed: ADVOCATE, STAFF, CLIENT.")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            try:
                # 1. Insert into USERS
                user_id_var = cursor.var(db.oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT)
                    VALUES (:fname, :email, :pw_hash, :role, 'ACTIVE', SYSTIMESTAMP)
                    RETURNING USER_ID INTO :new_uid
                    """,
                    {
                        "fname": clean_name,
                        "email": clean_email,
                        "pw_hash": password_hash,
                        "role": normalized_role,
                        "new_uid": user_id_var
                    }
                )
                new_uid = int(user_id_var.getvalue()[0])

                # 2. Insert into role-specific tables
                client_id = None
                staff_id = None

                if normalized_role == "CLIENT":
                    cid_var = cursor.var(db.oracledb.NUMBER)
                    cursor.execute(
                        """
                        INSERT INTO CLIENTS (USER_ID, PHONE, ADDRESS, CREATED_AT)
                        VALUES (:uid, :phone, :addr, SYSTIMESTAMP)
                        RETURNING CLIENT_ID INTO :new_cid
                        """,
                        {
                            "uid": new_uid,
                            "phone": clean_phone,
                            "addr": clean_address,
                            "new_cid": cid_var
                        }
                    )
                    client_id = int(cid_var.getvalue()[0])

                elif normalized_role == "STAFF":
                    sid_var = cursor.var(db.oracledb.NUMBER)
                    emp_code = f"EMP-LCB-{new_uid:03d}"
                    cursor.execute(
                        """
                        INSERT INTO STAFF (USER_ID, EMPLOYEE_CODE, CREATED_AT)
                        VALUES (:uid, :emp_code, SYSTIMESTAMP)
                        RETURNING STAFF_ID INTO :new_sid
                        """,
                        {
                            "uid": new_uid,
                            "emp_code": emp_code,
                            "new_sid": sid_var
                        }
                    )
                    staff_id = int(sid_var.getvalue()[0])

                # 3. Log Audit Event
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'USER_REGISTERED', 'USERS', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": new_uid, "entity_id": new_uid}
                )

                conn.commit()

                return {
                    "user_id": new_uid,
                    "full_name": clean_name,
                    "email": clean_email,
                    "role": normalized_role,
                    "account_status": "ACTIVE",
                    "client_id": client_id,
                    "staff_id": staff_id
                }

            except db.oracledb.DatabaseError as ora_err:
                conn.rollback()
                error_obj, = ora_err.args
                err_msg = str(error_obj.message) if hasattr(error_obj, 'message') else str(error_obj)
                if "UQ_USERS_EMAIL" in err_msg or "ORA-00001" in err_msg or "UNIQUE constraint failed" in err_msg:
                    raise ValueError("This email address is already registered.")
                raise RuntimeError(f"Database error during registration: {err_msg}")
            except Exception as gen_err:
                conn.rollback()
                err_msg = str(gen_err)
                if "UQ_USERS_EMAIL" in err_msg or "UNIQUE constraint failed" in err_msg or "ORA-00001" in err_msg:
                    raise ValueError("This email address is already registered.")
                raise RuntimeError(f"Database error during registration: {err_msg}")


def register_client_in_db(full_name: str, email: str, password_hash: str, phone: Optional[str] = None, address: Optional[str] = None) -> Dict[str, Any]:
    """
    Registers a new Client account in Oracle Database.
    Backward-compatible wrapper around register_user_in_db.
    """
    return register_user_in_db(full_name, email, password_hash, role="CLIENT", phone=phone, address=address)

    # Use atomic database transaction
    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 1. Attempt using PL/SQL package
            try:
                out_user_id = cursor.var(db.oracledb.NUMBER)
                out_client_id = cursor.var(db.oracledb.NUMBER)
                cursor.callproc(
                    "PKG_LEGAL_CASEBOOK.REGISTER_CLIENT",
                    [
                        clean_name,
                        clean_email,
                        password_hash,
                        clean_phone,
                        clean_address,
                        out_user_id,
                        out_client_id
                    ]
                )
                conn.commit()
                return {
                    "user_id": int(out_user_id.getvalue()),
                    "client_id": int(out_client_id.getvalue()),
                    "full_name": clean_name,
                    "email": clean_email,
                    "role": "CLIENT",
                    "account_status": "ACTIVE"
                }
            except db.oracledb.DatabaseError as ora_err:
                conn.rollback()
                error_obj, = ora_err.args
                err_msg = str(error_obj.message)
                # Check for duplicate email (ORA-00001 or custom -20001)
                if "ORA-20001" in err_msg or "ORA-00001" in err_msg or "UQ_USERS_EMAIL" in err_msg:
                    raise ValueError("This email address is already registered.")
                # Check if package is not yet created in the DB instance, fall back to SQL
                if "ORA-06550" in err_msg or "PLS-00201" in err_msg or "PKG_LEGAL_CASEBOOK" in err_msg:
                    pass
                else:
                    raise RuntimeError(f"Oracle error registering client: {err_msg}")

            # 2. Fallback to direct parameterized SQL with RETURNING clause
            try:
                user_id_var = cursor.var(db.oracledb.NUMBER)
                insert_user_sql = """
                    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS)
                    VALUES (:full_name, :email, :password_hash, 'CLIENT', 'ACTIVE')
                    RETURNING USER_ID INTO :user_id
                """
                cursor.execute(insert_user_sql, {
                    "full_name": clean_name,
                    "email": clean_email,
                    "password_hash": password_hash,
                    "user_id": user_id_var
                })
                new_user_id = int(user_id_var.getvalue()[0])

                client_id_var = cursor.var(db.oracledb.NUMBER)
                insert_client_sql = """
                    INSERT INTO CLIENTS (USER_ID, PHONE, ADDRESS)
                    VALUES (:user_id, :phone, :address)
                    RETURNING CLIENT_ID INTO :client_id
                """
                cursor.execute(insert_client_sql, {
                    "user_id": new_user_id,
                    "phone": clean_phone,
                    "address": clean_address,
                    "client_id": client_id_var
                })
                new_client_id = int(client_id_var.getvalue()[0])

                conn.commit()
                return {
                    "user_id": new_user_id,
                    "client_id": new_client_id,
                    "full_name": clean_name,
                    "email": clean_email,
                    "role": "CLIENT",
                    "account_status": "ACTIVE"
                }
            except db.oracledb.DatabaseError as fallback_err:
                conn.rollback()
                error_obj, = fallback_err.args
                err_msg = str(error_obj.message)
                if "ORA-00001" in err_msg or "UQ_USERS_EMAIL" in err_msg:
                    raise ValueError("This email address is already registered.")
                raise RuntimeError(f"Database error during client registration: {err_msg}")
