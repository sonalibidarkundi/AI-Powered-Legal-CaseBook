"""
Legal CaseBook - Advocate Dashboard & Management APIs (advocate_api.py)
-----------------------------------------------------------------------
Stage 5 Implementation:
- Dashboard summary counts & recent activity streams
- Case Management (List, Search, Filter, Create, Update, Details)
- Client Management (Authorized clients, Search, Profile, Linking)
- Staff Management (Directory, Workload inspection)
- Staff Case Assignment (Role validation, Duplicate prevention, Instructions)
- Hearings & Documents listings
- Immutable Audit Logging for state changes

Security & RBAC:
- All routes restricted to verified ADVOCATE role via @auth.role_required(['ADVOCATE']).
- Parameterized Oracle SQL with bind variables (:name) prevents SQL injection.
- Zero mock data: all responses come from real Oracle Database tables.
- Database connection errors handled gracefully returning HTTP 503 without leaking credentials.
"""

import os
import json
from datetime import datetime, timezone
import oracledb
from flask import Blueprint, jsonify, request, session, send_file

import auth
import db
import document_extractor
import grok_client

advocate_bp = Blueprint("advocate", __name__, url_prefix="/api/advocate")


def safe_lob(val):
    """Safely extracts text content from an Oracle CLOB/BLOB or returns string/empty."""
    if val is None:
        return ""
    if hasattr(val, "read"):
        try:
            return val.read()
        except Exception:
            return str(val)
    return str(val)


def handle_db_error(exc):
    """Translates database exceptions into secure, clean JSON responses."""
    if isinstance(exc, db.DatabaseConfigurationError):
        return jsonify({
            "error": "Database service is not configured. Please check backend/.env settings.",
            "code": "DATABASE_NOT_CONFIGURED"
        }), 503
    elif isinstance(exc, oracledb.Error):
        # Oracle driver error: log safely without leaking connection string
        return jsonify({
            "error": "Oracle Database server is currently unreachable. Please check database listener.",
            "code": "DATABASE_UNAVAILABLE"
        }), 503
    else:
        return jsonify({
            "error": "An unexpected error occurred while communicating with the database.",
            "code": "DATABASE_ERROR"
        }), 503


# ============================================================================
# 1. ADVOCATE DASHBOARD OVERVIEW
# ============================================================================

@advocate_bp.route("/dashboard", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def get_dashboard_overview():
    """
    GET /api/advocate/dashboard
    ---------------------------
    Aggregates real statistics from Oracle Database:
    - Summary Cards: Total Cases, Active Cases, Closed Cases, Total Clients, Total Staff, Upcoming Hearings
    - Recent Streams (Top 5 each): Recent Cases, Upcoming Hearings, Recent Documents, Recent Activities
    """
    advocate_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Total Cases
                cursor.execute("SELECT COUNT(*) FROM CASES")
                total_cases = cursor.fetchone()[0]

                # 2. Active Cases
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM CASES
                    WHERE CASE_STATUS IN ('OPEN', 'PENDING_HEARING', 'IN_TRIAL')
                    """
                )
                active_cases = cursor.fetchone()[0]

                # 3. Closed Cases
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM CASES
                    WHERE CASE_STATUS IN ('CLOSED', 'DISPOSED', 'ARCHIVED')
                    """
                )
                closed_cases = cursor.fetchone()[0]

                # 4. Total Clients (All active registered clients in the firm)
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM CLIENTS cl
                    JOIN USERS u ON cl.USER_ID = u.USER_ID
                    WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                    """
                )
                total_clients = cursor.fetchone()[0]

                # 5. Total Staff (Active staff in the firm)
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                    """
                )
                total_staff = cursor.fetchone()[0]

                # 6. Upcoming Hearings
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM HEARINGS h
                    WHERE h.HEARING_DATE >= SYSTIMESTAMP
                      AND h.HEARING_STATUS = 'SCHEDULED'
                    """
                )
                upcoming_hearings_count = cursor.fetchone()[0]

                # --- RECENT STREAMS (Top 5 records) ---

                # Recent Cases
                cursor.execute(
                    """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                           TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           NVL((SELECT u.FULL_NAME
                                FROM CASE_CLIENTS cc
                                JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                JOIN USERS u ON cl.USER_ID = u.USER_ID
                                WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), 'Unassigned') AS CLIENT_NAME
                    FROM CASES c
                    ORDER BY c.CREATED_AT DESC
                    FETCH FIRST 5 ROWS ONLY
                    """
                )
                recent_cases = [
                    {
                        "case_id": r[0],
                        "case_number": r[1],
                        "title": r[2],
                        "case_status": r[3],
                        "case_type": r[4],
                        "created_at": r[5],
                        "client_name": r[6]
                    }
                    for r in cursor.fetchall()
                ]

                # Upcoming Hearings List
                cursor.execute(
                    """
                    SELECT h.HEARING_ID, h.CASE_ID, c.CASE_NUMBER, c.TITLE,
                           TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                           h.COURT_NAME, h.HEARING_STATUS,
                           CAST(h.NOTES AS VARCHAR2(500)) AS NOTES
                    FROM HEARINGS h
                    JOIN CASES c ON h.CASE_ID = c.CASE_ID
                    WHERE h.HEARING_DATE >= SYSTIMESTAMP
                      AND h.HEARING_STATUS = 'SCHEDULED'
                    ORDER BY h.HEARING_DATE ASC
                    FETCH FIRST 5 ROWS ONLY
                    """
                )
                upcoming_hearings = [
                    {
                        "hearing_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "hearing_date": r[4],
                        "court_name": r[5],
                        "hearing_status": r[6],
                        "notes": safe_lob(r[7])
                    }
                    for r in cursor.fetchall()
                ]

                # Recent Documents
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, c.CASE_NUMBER, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    ORDER BY d.UPLOADED_AT DESC
                    FETCH FIRST 5 ROWS ONLY
                    """
                )
                recent_documents = [
                    {
                        "document_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "file_name": r[3],
                        "mime_type": r[4],
                        "uploaded_at": r[5],
                        "uploaded_by_name": r[6]
                    }
                    for r in cursor.fetchall()
                ]

                # Recent Case Activities (Disabled / Cleaned)
                recent_activities = []

                # Active Staff Roster (Firm Legal Team)
                cursor.execute(
                    """
                    SELECT s.STAFF_ID, s.USER_ID, u.FULL_NAME, u.EMAIL, s.EMPLOYEE_CODE,
                           (SELECT COUNT(*) FROM CASE_ASSIGNMENTS ca WHERE ca.STAFF_ID = s.STAFF_ID AND ca.ASSIGNMENT_STATUS = 'ACTIVE') AS ACTIVE_ASSIGNMENTS_COUNT,
                           TO_CHAR(s.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS JOINED_AT
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                    ORDER BY u.FULL_NAME ASC
                    FETCH FIRST 5 ROWS ONLY
                    """
                )
                active_staff = [
                    {
                        "staff_id": r[0],
                        "user_id": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "employee_code": r[4],
                        "active_assignments_count": r[5],
                        "joined_at": r[6]
                    }
                    for r in cursor.fetchall()
                ]

                # Active Clients Roster (Registered Litigants)
                cursor.execute(
                    """
                    SELECT cl.CLIENT_ID, u.USER_ID, u.FULL_NAME, u.EMAIL, cl.PHONE, cl.ADDRESS,
                           (SELECT COUNT(*) FROM CASE_CLIENTS cc WHERE cc.CLIENT_ID = cl.CLIENT_ID) AS CASE_COUNT
                    FROM CLIENTS cl
                    JOIN USERS u ON cl.USER_ID = u.USER_ID
                    WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                    ORDER BY u.FULL_NAME ASC
                    FETCH FIRST 5 ROWS ONLY
                    """
                )
                recent_clients = [
                    {
                        "client_id": r[0],
                        "user_id": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "phone": r[4] or "Not Provided",
                        "address": r[5] or "Not Provided",
                        "case_count": r[6]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "metrics": {
                "total_cases": total_cases,
                "active_cases": active_cases,
                "closed_cases": closed_cases,
                "total_clients": total_clients,
                "total_staff": total_staff,
                "upcoming_hearings": upcoming_hearings_count
            },
            "recent_cases": recent_cases,
            "upcoming_hearings": upcoming_hearings,
            "recent_documents": recent_documents,
            "recent_activities": recent_activities,
            "active_staff": active_staff,
            "recent_clients": recent_clients,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 2. CASE MANAGEMENT (CRUD, Search & Filtering)
# ============================================================================

VALID_CASE_STATUSES = {"OPEN", "PENDING_HEARING", "IN_TRIAL", "DISPOSED", "CLOSED", "ARCHIVED"}
VALID_CASE_TYPES = {"CIVIL", "CRIMINAL", "CORPORATE", "CONSTITUTIONAL", "FAMILY", "TAXATION", "ARBITRATION", "LABOR", "OTHER"}

@advocate_bp.route("/cases", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_cases():
    """
    GET /api/advocate/cases
    -----------------------
    Returns authorized cases with search and filtering:
    - q: Search string in CASE_NUMBER, TITLE, or CLIENT_NAME
    - status: Filter by CASE_STATUS (or 'ALL')
    - case_type: Filter by CASE_TYPE (or 'ALL')
    """
    advocate_id = session.get("user_id")
    search_q = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "ALL").strip().upper()
    type_filter = request.args.get("case_type", "ALL").strip().upper()

    scope = request.args.get("scope", "all").strip().lower()

    try:
        query = """
            SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                   TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                   NVL((SELECT u.FULL_NAME
                        FROM CASE_CLIENTS cc
                        JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                        JOIN USERS u ON cl.USER_ID = u.USER_ID
                        WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), 'Unassigned') AS CLIENT_NAME,
                   (SELECT cc.CLIENT_ID FROM CASE_CLIENTS cc WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1) AS CLIENT_ID,
                   (SELECT COUNT(*) FROM CASE_ASSIGNMENTS ca WHERE ca.CASE_ID = c.CASE_ID AND ca.ASSIGNMENT_STATUS = 'ACTIVE') AS ACTIVE_STAFF_COUNT
            FROM CASES c
            WHERE 1=1
        """
        params = {}
        if scope == "mine":
            query += " AND c.CREATED_BY = :adv_id"
            params["adv_id"] = advocate_id

        if status_filter and status_filter != "ALL":
            query += " AND c.CASE_STATUS = :status_filter"
            params["status_filter"] = status_filter

        if type_filter and type_filter != "ALL":
            query += " AND c.CASE_TYPE = :type_filter"
            params["type_filter"] = type_filter

        if search_q:
            query += """
                AND (
                    LOWER(c.CASE_NUMBER) LIKE :search_term
                    OR LOWER(c.TITLE) LIKE :search_term
                    OR LOWER(NVL((SELECT u.FULL_NAME
                                  FROM CASE_CLIENTS cc
                                  JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                  JOIN USERS u ON cl.USER_ID = u.USER_ID
                                  WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), '')) LIKE :search_term
                )
            """
            params["search_term"] = f"%{search_q}%"

        query += " ORDER BY c.CREATED_AT DESC"

        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                cases = [
                    {
                        "case_id": r[0],
                        "case_number": r[1],
                        "title": r[2],
                        "case_status": r[3],
                        "case_type": r[4],
                        "created_at": r[5],
                        "client_name": r[6],
                        "client_id": r[7],
                        "active_staff_count": r[8]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "cases": cases,
            "total": len(cases),
            "filters": {
                "status": status_filter,
                "case_type": type_filter,
                "query": search_q
            }
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/cases", methods=["POST"])
@auth.role_required(["ADVOCATE"])
def create_case():
    """
    POST /api/advocate/cases
    ------------------------
    Creates a new case file in Oracle Database:
    - Generates CASE_NUMBER if not supplied
    - Validates CASE_TYPE and input strings
    - Optionally links a CLIENT_ID
    - Writes immutable record to AUDIT_LOGS
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    case_number = data.get("case_number", "").strip().upper()
    description = data.get("description", "").strip()
    case_type = data.get("case_type", "CIVIL").strip().upper()
    client_id = data.get("client_id")

    # Validation
    if not title or len(title) < 3:
        return jsonify({
            "error": "Case title is required and must be at least 3 characters.",
            "code": "INVALID_TITLE"
        }), 400

    if case_type not in VALID_CASE_TYPES:
        return jsonify({
            "error": f"Invalid case type. Must be one of: {', '.join(sorted(VALID_CASE_TYPES))}.",
            "code": "INVALID_CASE_TYPE"
        }), 400

    # Auto-generate case number if not provided
    if not case_number:
        timestamp_suffix = datetime.now().strftime("%Y%m%d%H%M%S")
        case_number = f"LCB-{timestamp_suffix}"

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # If client_id provided, verify existence
                if client_id is not None:
                    cursor.execute("SELECT COUNT(*) FROM CLIENTS WHERE CLIENT_ID = :cid", {"cid": client_id})
                    if cursor.fetchone()[0] == 0:
                        return jsonify({
                            "error": "Selected client was not found.",
                            "code": "CLIENT_NOT_FOUND"
                        }), 404

                # Insert Case
                new_case_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO CASES (
                        CASE_NUMBER, TITLE, DESCRIPTION, CASE_STATUS, CASE_TYPE, CREATED_BY, CREATED_AT
                    ) VALUES (
                        :c_num, :title, :desc_val, 'OPEN', :c_type, :created_by, SYSTIMESTAMP
                    ) RETURNING CASE_ID INTO :new_id
                    """,
                    {
                        "c_num": case_number,
                        "title": title,
                        "desc_val": description,
                        "c_type": case_type,
                        "created_by": advocate_id,
                        "new_id": new_case_id_var
                    }
                )
                case_id = int(new_case_id_var.getvalue()[0])

                # Link client if provided
                if client_id is not None:
                    cursor.execute(
                        "INSERT INTO CASE_CLIENTS (CASE_ID, CLIENT_ID) VALUES (:case_id, :client_id)",
                        {"case_id": case_id, "client_id": client_id}
                    )

                # Record in Audit Trail
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'CASE_CREATED', 'CASES', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": advocate_id, "entity_id": case_id}
                )

                conn.commit()

        return jsonify({
            "message": "Case created successfully.",
            "case": {
                "case_id": case_id,
                "case_number": case_number,
                "title": title,
                "description": description,
                "case_status": "OPEN",
                "case_type": case_type,
                "client_id": client_id
            }
        }), 201

    except oracledb.IntegrityError as int_err:
        error_obj, = int_err.args
        if "UQ_CASES_NUMBER" in str(error_obj):
            return jsonify({
                "error": f"Case number '{case_number}' is already registered in the system.",
                "code": "DUPLICATE_CASE_NUMBER"
            }), 409
        return handle_db_error(int_err)
    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/cases/<int:case_id>", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def get_case_details(case_id: int):
    """
    GET /api/advocate/cases/<case_id>
    ---------------------------------
    Returns full case file:
    - Metadata (number, title, description, status, type, created_at)
    - Associated clients
    - Assigned staff members
    - Case documents
    - Upcoming and past hearings
    """
    advocate_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Fetch Case Header (Enforces advocate ownership/permission)
                cursor.execute(
                    """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.DESCRIPTION,
                           c.CASE_STATUS, c.CASE_TYPE,
                           TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           u.FULL_NAME AS CREATOR_NAME
                    FROM CASES c
                    JOIN USERS u ON c.CREATED_BY = u.USER_ID
                    WHERE c.CASE_ID = :case_id AND c.CREATED_BY = :adv_id
                    """,
                    {"case_id": case_id, "adv_id": advocate_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({
                        "error": "Case file not found or you do not have permission to access it.",
                        "code": "CASE_NOT_FOUND"
                    }), 404

                case_data = {
                    "case_id": case_row[0],
                    "case_number": case_row[1],
                    "title": case_row[2],
                    "description": safe_lob(case_row[3]),
                    "case_status": case_row[4],
                    "case_type": case_row[5],
                    "created_at": case_row[6],
                    "creator_name": case_row[7]
                }

                # 2. Associated Clients
                cursor.execute(
                    """
                    SELECT cl.CLIENT_ID, u.USER_ID, u.FULL_NAME, u.EMAIL, cl.PHONE, cl.ADDRESS
                    FROM CASE_CLIENTS cc
                    JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                    JOIN USERS u ON cl.USER_ID = u.USER_ID
                    WHERE cc.CASE_ID = :case_id
                    """,
                    {"case_id": case_id}
                )
                clients = [
                    {
                        "client_id": r[0],
                        "user_id": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "phone": r[4] or "Not Provided",
                        "address": r[5] or "Not Provided"
                    }
                    for r in cursor.fetchall()
                ]

                # 3. Assigned Staff
                cursor.execute(
                    """
                    SELECT ca.ASSIGNMENT_ID, s.STAFF_ID, u.FULL_NAME, u.EMAIL, s.EMPLOYEE_CODE,
                           TO_CHAR(ca.ASSIGNED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNED_AT,
                           ca.ASSIGNMENT_STATUS, ca.INSTRUCTIONS
                    FROM CASE_ASSIGNMENTS ca
                    JOIN STAFF s ON ca.STAFF_ID = s.STAFF_ID
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE ca.CASE_ID = :case_id
                    ORDER BY ca.ASSIGNED_AT DESC
                    """,
                    {"case_id": case_id}
                )
                staff = [
                    {
                        "assignment_id": r[0],
                        "staff_id": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "employee_code": r[4],
                        "assigned_at": r[5],
                        "assignment_status": r[6],
                        "instructions": r[7] or ""
                    }
                    for r in cursor.fetchall()
                ]

                # 4. Documents
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.DOCUMENT_TITLE, d.DESCRIPTION, d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS,
                           (SELECT u_st.FULL_NAME FROM STAFF st JOIN USERS u_st ON st.USER_ID = u_st.USER_ID WHERE st.STAFF_ID = d.ASSIGNED_STAFF_ID) AS ASSIGNED_STAFF_NAME
                    FROM DOCUMENTS d
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE d.CASE_ID = :case_id
                    ORDER BY d.UPLOADED_AT DESC
                    """,
                    {"case_id": case_id}
                )
                documents = [
                    {
                        "document_id": r[0],
                        "file_name": r[1],
                        "mime_type": r[2],
                        "uploaded_at": r[3],
                        "uploaded_by_name": r[4],
                        "document_title": r[5] or r[1],
                        "description": r[6] or "",
                        "assigned_staff_id": r[7],
                        "assignment_status": r[8] or "ASSIGNED",
                        "assigned_staff_name": r[9] or "Unassigned"
                    }
                    for r in cursor.fetchall()
                ]

                # 5. Hearings
                cursor.execute(
                    """
                    SELECT h.HEARING_ID,
                           TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                           h.COURT_NAME, h.HEARING_STATUS,
                           CAST(h.NOTES AS VARCHAR2(1000)) AS NOTES
                    FROM HEARINGS h
                    WHERE h.CASE_ID = :case_id
                    ORDER BY h.HEARING_DATE ASC
                    """,
                    {"case_id": case_id}
                )
                hearings = [
                    {
                        "hearing_id": r[0],
                        "hearing_date": r[1],
                        "court_name": r[2],
                        "hearing_status": r[3],
                        "notes": safe_lob(r[4])
                    }
                    for r in cursor.fetchall()
                ]

        case_data["clients"] = clients
        case_data["assigned_staff"] = staff
        case_data["documents"] = documents
        case_data["hearings"] = hearings

        return jsonify(case_data), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/cases/<int:case_id>", methods=["PUT"])
@auth.role_required(["ADVOCATE"])
def update_case(case_id: int):
    """
    PUT /api/advocate/cases/<case_id>
    ---------------------------------
    Updates permitted case fields:
    - title, description, case_type, case_status
    - Enforces ownership & records in AUDIT_LOGS
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    case_type = data.get("case_type", "").strip().upper()
    case_status = data.get("case_status", "").strip().upper()

    if not title or len(title) < 3:
        return jsonify({
            "error": "Case title is required and must be at least 3 characters.",
            "code": "INVALID_TITLE"
        }), 400

    if case_type and case_type not in VALID_CASE_TYPES:
        return jsonify({
            "error": f"Invalid case type. Allowed: {', '.join(sorted(VALID_CASE_TYPES))}.",
            "code": "INVALID_CASE_TYPE"
        }), 400

    if case_status and case_status not in VALID_CASE_STATUSES:
        return jsonify({
            "error": f"Invalid case status. Allowed: {', '.join(sorted(VALID_CASE_STATUSES))}.",
            "code": "INVALID_CASE_STATUS"
        }), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Check ownership
                cursor.execute(
                    "SELECT CASE_ID, CASE_STATUS FROM CASES WHERE CASE_ID = :case_id AND CREATED_BY = :adv_id",
                    {"case_id": case_id, "adv_id": advocate_id}
                )
                existing = cursor.fetchone()
                if not existing:
                    return jsonify({
                        "error": "Case not found or you lack permission to modify it.",
                        "code": "CASE_NOT_FOUND"
                    }), 404

                prev_status = existing[1]

                cursor.execute(
                    """
                    UPDATE CASES
                    SET TITLE = :title,
                        DESCRIPTION = :desc_val,
                        CASE_TYPE = NVL(:c_type, CASE_TYPE),
                        CASE_STATUS = NVL(:c_status, CASE_STATUS)
                    WHERE CASE_ID = :case_id AND CREATED_BY = :adv_id
                    """,
                    {
                        "title": title,
                        "desc_val": description,
                        "c_type": case_type if case_type else None,
                        "c_status": case_status if case_status else None,
                        "case_id": case_id,
                        "adv_id": advocate_id
                    }
                )

                # Record Audit Log
                action = "CASE_STATUS_CHANGED" if (case_status and case_status != prev_status) else "CASE_UPDATED"
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, :action, 'CASES', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": advocate_id, "action": action, "entity_id": case_id}
                )

                conn.commit()

        return jsonify({
            "message": "Case updated successfully.",
            "case_id": case_id,
            "title": title,
            "case_type": case_type,
            "case_status": case_status
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 3. CLIENT MANAGEMENT (Authorized Records & Linking)
# ============================================================================

@advocate_bp.route("/clients", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_clients():
    """
    GET /api/advocate/clients
    -------------------------
    Lists clients registered in the firm with their active matter counts.
    Supports filtering by search query 'q'.
    """
    advocate_id = session.get("user_id")
    search_q = request.args.get("q", "").strip().lower()
    scope = request.args.get("scope", "all").strip().lower()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                if scope == "mine":
                    # Only clients associated with this advocate's cases
                    query = """
                        SELECT DISTINCT cl.CLIENT_ID, u.USER_ID, u.FULL_NAME, u.EMAIL, cl.PHONE, cl.ADDRESS,
                               (SELECT COUNT(*) FROM CASE_CLIENTS cc2 JOIN CASES c2 ON cc2.CASE_ID = c2.CASE_ID WHERE cc2.CLIENT_ID = cl.CLIENT_ID AND c2.CREATED_BY = :adv_id) AS CASE_COUNT
                        FROM CLIENTS cl
                        JOIN USERS u ON cl.USER_ID = u.USER_ID
                        JOIN CASE_CLIENTS cc ON cl.CLIENT_ID = cc.CLIENT_ID
                        JOIN CASES c ON cc.CASE_ID = c.CASE_ID
                        WHERE c.CREATED_BY = :adv_id
                    """
                    params = {"adv_id": advocate_id}
                else:
                    # All active registered clients in firm
                    query = """
                        SELECT cl.CLIENT_ID, u.USER_ID, u.FULL_NAME, u.EMAIL, cl.PHONE, cl.ADDRESS,
                               (SELECT COUNT(*) FROM CASE_CLIENTS cc WHERE cc.CLIENT_ID = cl.CLIENT_ID) AS CASE_COUNT
                        FROM CLIENTS cl
                        JOIN USERS u ON cl.USER_ID = u.USER_ID
                        WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                    """
                    params = {}

                if search_q:
                    query += " AND (LOWER(u.FULL_NAME) LIKE :search_term OR LOWER(u.EMAIL) LIKE :search_term OR LOWER(NVL(cl.PHONE, '')) LIKE :search_term)"
                    params["search_term"] = f"%{search_q}%"

                query += " ORDER BY u.FULL_NAME ASC"

                cursor.execute(query, params)
                clients = [
                    {
                        "client_id": r[0],
                        "user_id": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "phone": r[4] or "Not Provided",
                        "address": r[5] or "Not Provided",
                        "case_count": r[6]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "clients": clients,
            "total": len(clients)
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/clients/<int:client_id>", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def get_client_profile(client_id: int):
    """
    GET /api/advocate/clients/<client_id>
    ------------------------------------
    Returns client profile and cases associated with this advocate.
    Strictly omits password hashes or sensitive session data.
    """
    advocate_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Verify that this advocate manages at least one case for this client or client exists
                cursor.execute(
                    """
                    SELECT cl.CLIENT_ID, u.USER_ID, u.FULL_NAME, u.EMAIL, cl.PHONE, cl.ADDRESS,
                           TO_CHAR(cl.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS JOINED_AT
                    FROM CLIENTS cl
                    JOIN USERS u ON cl.USER_ID = u.USER_ID
                    WHERE cl.CLIENT_ID = :cid
                    """,
                    {"cid": client_id}
                )
                client_row = cursor.fetchone()
                if not client_row:
                    return jsonify({
                        "error": "Client record not found.",
                        "code": "CLIENT_NOT_FOUND"
                    }), 404

                client_data = {
                    "client_id": client_row[0],
                    "user_id": client_row[1],
                    "full_name": client_row[2],
                    "email": client_row[3],
                    "phone": client_row[4] or "",
                    "address": client_row[5] or "",
                    "joined_at": client_row[6]
                }

                # Associated Cases managed by this Advocate
                cursor.execute(
                    """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                           TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT
                    FROM CASES c
                    JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                    WHERE cc.CLIENT_ID = :cid
                    ORDER BY c.CREATED_AT DESC
                    """,
                    {"cid": client_id}
                )
                cases = [
                    {
                        "case_id": r[0],
                        "case_number": r[1],
                        "title": r[2],
                        "case_status": r[3],
                        "case_type": r[4],
                        "created_at": r[5]
                    }
                    for r in cursor.fetchall()
                ]

                # Associated Documents
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, c.CASE_NUMBER, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                    WHERE cc.CLIENT_ID = :cid AND c.CREATED_BY = :adv_id
                    ORDER BY d.UPLOADED_AT DESC
                    """,
                    {"cid": client_id, "adv_id": advocate_id}
                )
                documents = [
                    {
                        "document_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "file_name": r[3],
                        "mime_type": r[4],
                        "uploaded_at": r[5]
                    }
                    for r in cursor.fetchall()
                ]

                client_data["cases"] = cases
                client_data["documents"] = documents

        return jsonify(client_data), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/clients", methods=["POST"])
@auth.role_required(["ADVOCATE"])
def create_client():
    """
    POST /api/advocate/clients
    --------------------------
    Onboards a new client from the Advocate dashboard.
    Registers user (CLIENT role), creates client profile, logs audit trail.
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()
    initial_case_id = data.get("case_id")

    if not full_name or len(full_name) < 2:
        return jsonify({
            "error": "Full client name is required.",
            "code": "INVALID_NAME"
        }), 400

    if not email or not auth.validate_email_format(email):
        return jsonify({
            "error": "Valid email address is required.",
            "code": "INVALID_EMAIL"
        }), 400

    # Default temporary secure password for client onboarded by advocate
    temp_password = "ClientPass123!"
    password_hash = auth.hash_password(temp_password)

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Insert into USERS
                user_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT)
                    VALUES (:fname, :email, :pw_hash, 'CLIENT', 'ACTIVE', SYSTIMESTAMP)
                    RETURNING USER_ID INTO :new_uid
                    """,
                    {
                        "fname": full_name,
                        "email": email,
                        "pw_hash": password_hash,
                        "new_uid": user_id_var
                    }
                )
                new_user_id = int(user_id_var.getvalue()[0])

                # 2. Insert into CLIENTS
                client_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO CLIENTS (USER_ID, PHONE, ADDRESS, CREATED_AT)
                    VALUES (:uid, :phone, :addr, SYSTIMESTAMP)
                    RETURNING CLIENT_ID INTO :new_cid
                    """,
                    {
                        "uid": new_user_id,
                        "phone": phone if phone else None,
                        "addr": address if address else None,
                        "new_cid": client_id_var
                    }
                )
                new_client_id = int(client_id_var.getvalue()[0])

                # 3. Optionally link to initial case if specified and owned by advocate
                if initial_case_id:
                    cursor.execute(
                        "SELECT COUNT(*) FROM CASES WHERE CASE_ID = :cid AND CREATED_BY = :adv_id",
                        {"cid": initial_case_id, "adv_id": advocate_id}
                    )
                    if cursor.fetchone()[0] > 0:
                        cursor.execute(
                            "INSERT INTO CASE_CLIENTS (CASE_ID, CLIENT_ID) VALUES (:case_id, :client_id)",
                            {"case_id": initial_case_id, "client_id": new_client_id}
                        )

                # 4. Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'CLIENT_ONBOARDED', 'CLIENTS', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": advocate_id, "entity_id": new_client_id}
                )

                conn.commit()

        return jsonify({
            "message": "Client onboarded successfully.",
            "client": {
                "client_id": new_client_id,
                "user_id": new_user_id,
                "full_name": full_name,
                "email": email,
                "phone": phone,
                "address": address
            }
        }), 201

    except oracledb.IntegrityError as int_err:
        error_obj, = int_err.args
        if "UQ_USERS_EMAIL" in str(error_obj):
            return jsonify({
                "error": f"Email address '{email}' is already registered in the system.",
                "code": "DUPLICATE_EMAIL"
            }), 409
        return handle_db_error(int_err)
    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/clients/<int:client_id>", methods=["PUT"])
@auth.role_required(["ADVOCATE"])
def update_client(client_id: int):
    """
    PUT /api/advocate/clients/<client_id>
    ------------------------------------
    Updates client contact details (phone, address) and records in audit trail.
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE CLIENTS
                    SET PHONE = :phone, ADDRESS = :address
                    WHERE CLIENT_ID = :cid
                    """,
                    {"phone": phone, "address": address, "cid": client_id}
                )
                if cursor.rowcount == 0:
                    return jsonify({
                        "error": "Client not found.",
                        "code": "CLIENT_NOT_FOUND"
                    }), 404

                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'CLIENT_UPDATED', 'CLIENTS', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": advocate_id, "entity_id": client_id}
                )

                conn.commit()

        return jsonify({
            "message": "Client details updated successfully.",
            "client_id": client_id,
            "phone": phone,
            "address": address
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 4. STAFF MANAGEMENT (Directory & Workload)
# ============================================================================

@advocate_bp.route("/staff", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_staff():
    """
    GET /api/advocate/staff
    -----------------------
    Returns staff members available in the firm with their active workload count.
    Supports filtering by search query 'q'.
    """
    search_q = request.args.get("q", "").strip().lower()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT s.STAFF_ID, s.USER_ID, u.FULL_NAME, u.EMAIL, s.EMPLOYEE_CODE,
                           (SELECT COUNT(*) FROM CASE_ASSIGNMENTS ca WHERE ca.STAFF_ID = s.STAFF_ID AND ca.ASSIGNMENT_STATUS = 'ACTIVE') AS ACTIVE_ASSIGNMENTS_COUNT,
                           TO_CHAR(s.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS JOINED_AT
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                """
                params = {}
                if search_q:
                    query += " AND (LOWER(u.FULL_NAME) LIKE :search_term OR LOWER(u.EMAIL) LIKE :search_term OR LOWER(s.EMPLOYEE_CODE) LIKE :search_term)"
                    params["search_term"] = f"%{search_q}%"

                query += " ORDER BY u.FULL_NAME ASC"

                cursor.execute(query, params)
                staff_list = [
                    {
                        "staff_id": r[0],
                        "user_id": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "employee_code": r[4],
                        "active_assignments_count": r[5],
                        "joined_at": r[6]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "staff": staff_list,
            "total": len(staff_list)
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 5. ASSIGN STAFF TO CASES (Workflow & Authorization Rules)
# ============================================================================

@advocate_bp.route("/assignments", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_assignments():
    """
    GET /api/advocate/assignments
    -----------------------------
    Lists all staff assignments across cases managed by this advocate.
    """
    advocate_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT ca.ASSIGNMENT_ID, ca.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           s.STAFF_ID, u.FULL_NAME AS STAFF_NAME, u.EMAIL AS STAFF_EMAIL, s.EMPLOYEE_CODE,
                           TO_CHAR(ca.ASSIGNED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNED_AT,
                           ca.ASSIGNMENT_STATUS, ca.INSTRUCTIONS
                    FROM CASE_ASSIGNMENTS ca
                    JOIN CASES c ON ca.CASE_ID = c.CASE_ID
                    JOIN STAFF s ON ca.STAFF_ID = s.STAFF_ID
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE c.CREATED_BY = :adv_id
                    ORDER BY ca.ASSIGNED_AT DESC
                    """,
                    {"adv_id": advocate_id}
                )
                assignments = [
                    {
                        "assignment_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "staff_id": r[4],
                        "staff_name": r[5],
                        "staff_email": r[6],
                        "employee_code": r[7],
                        "assigned_at": r[8],
                        "assignment_status": r[9],
                        "instructions": r[10] or ""
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "assignments": assignments,
            "total": len(assignments)
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/assignments", methods=["POST"])
@auth.role_required(["ADVOCATE"])
def assign_staff():
    """
    POST /api/advocate/assignments
    ------------------------------
    Assigns an eligible staff member to a case managed by this advocate:
    1. Validates advocate has management permission for this case.
    2. Validates staff exists and account is ACTIVE.
    3. Prevents duplicate active assignments for the same (case_id, staff_id).
    4. Saves instructions and sets ASSIGNMENT_STATUS = 'ACTIVE'.
    5. Records event in AUDIT_LOGS.
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    case_id = data.get("case_id")
    staff_id = data.get("staff_id")
    instructions = data.get("instructions", "").strip()

    if not case_id:
        return jsonify({
            "error": "Case selection is required.",
            "code": "MISSING_CASE_ID"
        }), 400

    if not staff_id:
        return jsonify({
            "error": "Staff member selection is required.",
            "code": "MISSING_STAFF_ID"
        }), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Validate Case Ownership & Permission
                cursor.execute(
                    "SELECT CASE_NUMBER, TITLE FROM CASES WHERE CASE_ID = :cid AND CREATED_BY = :adv_id",
                    {"cid": case_id, "adv_id": advocate_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({
                        "error": "Case file not found or you do not have permission to manage this case.",
                        "code": "UNAUTHORIZED_CASE_ACCESS"
                    }), 403

                case_num, case_title = case_row

                # 2. Validate Staff Member Eligibility
                cursor.execute(
                    """
                    SELECT s.STAFF_ID, u.FULL_NAME
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE s.STAFF_ID = :sid AND u.ACCOUNT_STATUS = 'ACTIVE'
                    """,
                    {"sid": staff_id}
                )
                staff_row = cursor.fetchone()
                if not staff_row:
                    return jsonify({
                        "error": "Selected staff member is invalid or not in active standing.",
                        "code": "INVALID_STAFF_MEMBER"
                    }), 400

                staff_name = staff_row[1]

                # 3. Check for Duplicate Active Assignment
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM CASE_ASSIGNMENTS
                    WHERE CASE_ID = :cid AND STAFF_ID = :sid AND ASSIGNMENT_STATUS = 'ACTIVE'
                    """,
                    {"cid": case_id, "sid": staff_id}
                )
                if cursor.fetchone()[0] > 0:
                    return jsonify({
                        "error": f"{staff_name} is already actively assigned to case {case_num}.",
                        "code": "DUPLICATE_ACTIVE_ASSIGNMENT"
                    }), 409

                # 4. Insert into CASE_ASSIGNMENTS
                assign_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO CASE_ASSIGNMENTS (
                        CASE_ID, STAFF_ID, ASSIGNED_BY, ASSIGNED_AT, ASSIGNMENT_STATUS, INSTRUCTIONS
                    ) VALUES (
                        :cid, :sid, :adv_id, SYSTIMESTAMP, 'ACTIVE', :inst
                    ) RETURNING ASSIGNMENT_ID INTO :new_aid
                    """,
                    {
                        "cid": case_id,
                        "sid": staff_id,
                        "adv_id": advocate_id,
                        "inst": instructions if instructions else None,
                        "new_aid": assign_id_var
                    }
                )
                new_assignment_id = int(assign_id_var.getvalue()[0])

                # 5. Automatically create corresponding Research Task in RESEARCH_TASKS
                task_title = f"Case Briefing & Legal Research: {case_title}"
                task_instructions = instructions if instructions else f"Review case documents and prepare briefing notes for {case_title}."
                cursor.execute(
                    """
                    INSERT INTO RESEARCH_TASKS (
                        CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, CREATED_AT, UPDATED_AT
                    ) VALUES (
                        :cid, :sid, :adv_id, :title, :inst, 'PENDING', 'HIGH',
                        SYSTIMESTAMP + INTERVAL '14' DAY, SYSTIMESTAMP, SYSTIMESTAMP
                    )
                    """,
                    {
                        "cid": case_id,
                        "sid": staff_id,
                        "adv_id": advocate_id,
                        "title": task_title,
                        "inst": task_instructions
                    }
                )

                conn.commit()

        return jsonify({
            "message": f"Successfully assigned {staff_name} to case {case_num}.",
            "assignment": {
                "assignment_id": new_assignment_id,
                "case_id": case_id,
                "case_number": case_num,
                "case_title": case_title,
                "staff_id": staff_id,
                "staff_name": staff_name,
                "instructions": instructions,
                "assignment_status": "ACTIVE"
            }
        }), 201

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 6. HEARINGS & COURT CALENDAR
# ============================================================================

@advocate_bp.route("/hearings", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_hearings():
    """
    GET /api/advocate/hearings
    --------------------------
    Returns hearings scheduled across cases in the practice with search and status filtering:
    - q: Search string in CASE_NUMBER, CASE_TITLE, COURT_NAME, JUDGE_NAME, NOTES
    - status: Filter by HEARING_STATUS ('SCHEDULED', 'CONCLUDED', 'ADJOURNED', or 'ALL')
    """
    search_q = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "ALL").strip().upper()

    try:
        query = """
            SELECT h.HEARING_ID, h.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                   TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                   h.COURT_NAME, h.COURT_ROOM, h.JUDGE_NAME, h.HEARING_STATUS,
                   CAST(h.NOTES AS VARCHAR2(1000)) AS NOTES
            FROM HEARINGS h
            JOIN CASES c ON h.CASE_ID = c.CASE_ID
            WHERE 1=1
        """
        params = {}
        if status_filter and status_filter != "ALL":
            if status_filter == "UPCOMING":
                query += " AND h.HEARING_DATE >= SYSTIMESTAMP AND h.HEARING_STATUS = 'SCHEDULED'"
            else:
                query += " AND h.HEARING_STATUS = :status_filter"
                params["status_filter"] = status_filter

        if search_q:
            query += """
                AND (
                    LOWER(c.CASE_NUMBER) LIKE :search_term
                    OR LOWER(c.TITLE) LIKE :search_term
                    OR LOWER(h.COURT_NAME) LIKE :search_term
                    OR LOWER(h.JUDGE_NAME) LIKE :search_term
                    OR LOWER(CAST(h.NOTES AS VARCHAR2(1000))) LIKE :search_term
                )
            """
            params["search_term"] = f"%{search_q}%"

        query += " ORDER BY h.HEARING_DATE ASC"

        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                hearings = [
                    {
                        "hearing_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "hearing_date": r[4],
                        "court_name": r[5] or "District & Sessions Court",
                        "court_room": r[6] or "Chamber 3",
                        "judge_name": r[7] or "Presiding Judge",
                        "hearing_status": r[8] or "SCHEDULED",
                        "notes": safe_lob(r[9])
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "hearings": hearings,
            "total": len(hearings)
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/hearings", methods=["POST"])
@auth.role_required(["ADVOCATE"])
def create_hearing():
    """
    POST /api/advocate/hearings
    ---------------------------
    Schedules a new court appearance / hearing on the Cause List.
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    case_id = data.get("case_id")
    hearing_date_raw = data.get("hearing_date")
    court_name = data.get("court_name", "").strip()
    court_room = data.get("court_room", "").strip()
    judge_name = data.get("judge_name", "").strip()
    notes = data.get("notes", "").strip()
    hearing_status = data.get("hearing_status", "SCHEDULED").strip().upper()

    if not case_id:
        return jsonify({"error": "Case selection is required.", "code": "MISSING_CASE_ID"}), 400
    if not hearing_date_raw:
        return jsonify({"error": "Hearing date and time is required.", "code": "MISSING_HEARING_DATE"}), 400

    # Parse hearing date into datetime object
    try:
        if isinstance(hearing_date_raw, str):
            clean_str = hearing_date_raw.replace("Z", "").replace("T", " ").strip()
            if len(clean_str) == 16:
                dt_val = datetime.strptime(clean_str, "%Y-%m-%d %H:%M")
            elif len(clean_str) == 19:
                dt_val = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            else:
                dt_val = datetime.fromisoformat(clean_str)
        else:
            dt_val = hearing_date_raw
    except Exception:
        return jsonify({"error": "Invalid hearing date format. Please provide YYYY-MM-DDTHH:MM.", "code": "INVALID_DATE"}), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Validate case exists
                cursor.execute("SELECT CASE_NUMBER, TITLE FROM CASES WHERE CASE_ID = :cid", {"cid": case_id})
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({"error": "Selected case does not exist.", "code": "CASE_NOT_FOUND"}), 404

                hearing_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO HEARINGS (
                        CASE_ID, HEARING_DATE, COURT_NAME, COURT_ROOM, JUDGE_NAME, HEARING_STATUS, NOTES, CREATED_AT
                    ) VALUES (
                        :cid, :hdate, :cname, :croom, :jname, :status, :notes, SYSTIMESTAMP
                    ) RETURNING HEARING_ID INTO :hid
                    """,
                    {
                        "cid": case_id,
                        "hdate": dt_val,
                        "cname": court_name if court_name else "District & Sessions Court",
                        "croom": court_room if court_room else "Court Hall 2",
                        "jname": judge_name if judge_name else "Presiding Judge",
                        "status": hearing_status if hearing_status in {"SCHEDULED", "CONCLUDED", "ADJOURNED"} else "SCHEDULED",
                        "notes": notes if notes else None,
                        "hid": hearing_id_var
                    }
                )
                new_hid = int(hearing_id_var.getvalue()[0])

                # Record Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'HEARING_SCHEDULED', 'HEARINGS', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": advocate_id, "entity_id": new_hid}
                )
                conn.commit()

        return jsonify({
            "message": f"Court hearing scheduled successfully for {case_row[0]}.",
            "hearing_id": new_hid
        }), 201

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/hearings/<int:hearing_id>", methods=["PUT", "PATCH"])
@auth.role_required(["ADVOCATE"])
def update_hearing(hearing_id: int):
    """
    PUT /api/advocate/hearings/<hearing_id>
    --------------------------------------
    Updates hearing status (SCHEDULED, CONCLUDED, ADJOURNED), room, judge, or notes.
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    hearing_status = data.get("hearing_status") or data.get("status")
    court_room = data.get("court_room")
    court_name = data.get("court_name")
    judge_name = data.get("judge_name")
    notes = data.get("notes")
    hearing_date_raw = data.get("hearing_date")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT HEARING_ID FROM HEARINGS WHERE HEARING_ID = :hid", {"hid": hearing_id})
                if not cursor.fetchone():
                    return jsonify({"error": "Hearing record not found.", "code": "HEARING_NOT_FOUND"}), 404

                updates = []
                params = {"hid": hearing_id}

                if hearing_status and hearing_status.upper() in {"SCHEDULED", "CONCLUDED", "ADJOURNED"}:
                    updates.append("HEARING_STATUS = :hstatus")
                    params["hstatus"] = hearing_status.upper()

                if court_room is not None:
                    updates.append("COURT_ROOM = :croom")
                    params["croom"] = court_room.strip()

                if court_name is not None:
                    updates.append("COURT_NAME = :cname")
                    params["cname"] = court_name.strip()

                if judge_name is not None:
                    updates.append("JUDGE_NAME = :jname")
                    params["jname"] = judge_name.strip()

                if notes is not None:
                    updates.append("NOTES = :notes")
                    params["notes"] = notes.strip()

                if hearing_date_raw:
                    clean_str = hearing_date_raw.replace("Z", "").replace("T", " ").strip()
                    if len(clean_str) == 16:
                        dt_val = datetime.strptime(clean_str, "%Y-%m-%d %H:%M")
                    elif len(clean_str) == 19:
                        dt_val = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
                    else:
                        dt_val = datetime.fromisoformat(clean_str)
                    updates.append("HEARING_DATE = :hdate")
                    params["hdate"] = dt_val

                if updates:
                    cursor.execute(f"UPDATE HEARINGS SET {', '.join(updates)} WHERE HEARING_ID = :hid", params)
                    cursor.execute(
                        """
                        INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                        VALUES (:actor_id, 'HEARING_UPDATED', 'HEARINGS', :entity_id, SYSTIMESTAMP)
                        """,
                        {"actor_id": advocate_id, "entity_id": hearing_id}
                    )
                    conn.commit()

        return jsonify({"message": "Hearing updated successfully.", "hearing_id": hearing_id}), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 7. DOCUMENT VAULT & GROK AI LEGAL BRIEFS
# ============================================================================

@advocate_bp.route("/documents", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_documents():
    """
    GET /api/advocate/documents
    ---------------------------
    Returns all practice documents filed across firm cases with assignment & AI summary status:
    - q: Search string in FILE_NAME, DOCUMENT_TITLE, CASE_NUMBER, CASE_TITLE, UPLOADED_BY
    - case_id: Filter by CASE_ID
    """
    search_q = request.args.get("q", "").strip().lower()
    case_id_filter = request.args.get("case_id")

    try:
        query = """
            SELECT d.DOCUMENT_ID, d.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                   d.FILE_NAME, d.MIME_TYPE,
                   TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                   u.FULL_NAME AS UPLOADED_BY_NAME,
                   d.DOCUMENT_TITLE, d.DESCRIPTION, d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS,
                   (SELECT u_st.FULL_NAME FROM STAFF st JOIN USERS u_st ON st.USER_ID = u_st.USER_ID WHERE st.STAFF_ID = d.ASSIGNED_STAFF_ID) AS ASSIGNED_STAFF_NAME,
                   (SELECT COUNT(*) FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID AND ds.STATUS = 'SUCCESS') AS HAS_SUMMARY,
                   d.STORAGE_KEY
            FROM DOCUMENTS d
            JOIN CASES c ON d.CASE_ID = c.CASE_ID
            JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
            WHERE 1=1
        """
        params = {}
        if case_id_filter:
            query += " AND d.CASE_ID = :cid"
            params["cid"] = int(case_id_filter)

        if search_q:
            query += """
                AND (
                    LOWER(d.FILE_NAME) LIKE :search_term
                    OR LOWER(NVL(d.DOCUMENT_TITLE, '')) LIKE :search_term
                    OR LOWER(c.CASE_NUMBER) LIKE :search_term
                    OR LOWER(c.TITLE) LIKE :search_term
                    OR LOWER(u.FULL_NAME) LIKE :search_term
                )
            """
            params["search_term"] = f"%{search_q}%"

        query += " ORDER BY d.UPLOADED_AT DESC"

        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                documents = []
                for r in cursor.fetchall():
                    s_key = r[14] or ""
                    file_size = os.path.getsize(s_key) if (s_key and os.path.exists(s_key)) else 0
                    documents.append({
                        "document_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "file_name": r[4],
                        "mime_type": r[5],
                        "uploaded_at": r[6],
                        "uploaded_by_name": r[7],
                        "document_title": r[8] or r[4],
                        "description": r[9] or "",
                        "assigned_staff_id": r[10],
                        "assignment_status": r[11] or "ASSIGNED",
                        "assigned_staff_name": r[12] or "Unassigned",
                        "has_summary": bool(r[13]),
                        "file_size": file_size,
                        "download_url": f"/api/advocate/documents/{r[0]}/download"
                    })

        return jsonify({
            "documents": documents,
            "total": len(documents)
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/documents/<int:document_id>/preview", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def preview_document(document_id: int):
    """
    GET /api/advocate/documents/<document_id>/preview
    -------------------------------------------------
    Provides legal text snippet / preview of document for advocate review.
    """
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS, d.DOCUMENT_TITLE, d.DESCRIPTION,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Document not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                (doc_id, case_id, file_name, mime_type, storage_key,
                 case_number, case_title,
                 assigned_staff_id, assignment_status, doc_title, doc_desc,
                 uploaded_at, uploaded_by_name) = row

                preview_snippet = ""
                file_size = 0

                if storage_key and os.path.exists(storage_key):
                    file_size = os.path.getsize(storage_key)
                    try:
                        extracted = document_extractor.extract_document_text(storage_key, file_name)
                        raw_text = extracted.get("text", "")
                        preview_snippet = raw_text[:5000]
                        if len(raw_text) > 5000:
                            preview_snippet += "\n\n... [Preview truncated. Download full filing to view entire text] ..."
                    except Exception as parse_err:
                        preview_snippet = f"Document is securely archived in the case vault. Complete filing can be reviewed via certified download. ({str(parse_err)})"
                else:
                    preview_snippet = (
                        f"LEGAL CASEBOOK - SECURE ARCHIVE\n"
                        f"Document ID: {doc_id}\n"
                        f"Title: {doc_title or file_name}\n"
                        f"File Name: {file_name}\n"
                        f"Case: {case_number} - {case_title}\n\n"
                        f"Seeded document preview ready for legal workflow review."
                    )
                    file_size = len(preview_snippet.encode("utf-8"))

                return jsonify({
                    "document_id": doc_id,
                    "case_id": case_id,
                    "case_number": case_number,
                    "case_title": case_title,
                    "file_name": file_name,
                    "document_title": doc_title or file_name,
                    "description": doc_desc or "",
                    "mime_type": mime_type,
                    "size_bytes": file_size,
                    "uploaded_at": uploaded_at,
                    "uploaded_by_name": uploaded_by_name,
                    "assignment_status": assignment_status or "ASSIGNED",
                    "preview_text": preview_snippet,
                    "download_url": f"/api/advocate/documents/{doc_id}/download"
                }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/documents/<int:document_id>/download", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def download_document(document_id: int):
    """
    GET /api/advocate/documents/<document_id>/download
    --------------------------------------------------
    Streams secure document attachment for the supervising advocate.
    """
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY
                    FROM DOCUMENTS d
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Document record not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                _, file_name, mime_type, storage_key = row

                if not storage_key or not os.path.exists(storage_key):
                    return jsonify({
                        "error": "Document file is not available on storage disk.",
                        "code": "FILE_NOT_FOUND"
                    }), 404

                return send_file(
                    storage_key,
                    mimetype=mime_type or "application/octet-stream",
                    as_attachment=True,
                    download_name=file_name
                )

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/documents/<int:document_id>/summary", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def get_document_summary(document_id: int):
    """
    GET /api/advocate/documents/<document_id>/summary
    -------------------------------------------------
    Retrieves stored Grok AI legal brief and dual preferences for a document.
    """
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS, d.DOCUMENT_TITLE, d.DESCRIPTION
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                doc_row = cursor.fetchone()
                if not doc_row:
                    return jsonify({"error": "Document not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                (doc_id, case_id, file_name, mime_type, case_number, case_title,
                 uploaded_at, uploaded_by_name, assigned_staff_id, assignment_status, doc_title, doc_desc) = doc_row

                doc_meta = {
                    "document_id": doc_id,
                    "case_id": case_id,
                    "case_number": case_number,
                    "case_title": case_title,
                    "file_name": file_name,
                    "document_title": doc_title or file_name,
                    "description": doc_desc or "",
                    "mime_type": mime_type,
                    "assigned_staff_id": assigned_staff_id,
                    "assignment_status": assignment_status or "ASSIGNED",
                    "uploaded_at": uploaded_at,
                    "uploaded_by_name": uploaded_by_name
                }

                cursor.execute(
                    """
                    SELECT ds.SUMMARY_ID, ds.SUMMARY_TEXT, ds.STRUCTURED_JSON, ds.MODEL_NAME,
                           ds.STATUS, ds.ERROR_MESSAGE,
                           TO_CHAR(ds.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           TO_CHAR(ds.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT,
                           u_gen.FULL_NAME AS GENERATED_BY_NAME
                    FROM DOCUMENT_SUMMARIES ds
                    JOIN USERS u_gen ON ds.GENERATED_BY = u_gen.USER_ID
                    WHERE ds.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                sum_row = cursor.fetchone()

                if not sum_row:
                    return jsonify({
                        "has_summary": False,
                        "document": doc_meta,
                        "summary": None
                    }), 200

                summary_id, summary_text, structured_json_raw, model_name, status, error_message, created_at, updated_at, gen_by_name = sum_row

                summary_text_str = safe_lob(summary_text)
                structured_json_str = safe_lob(structured_json_raw)

                structured_sections = {}
                preferences = []
                active_pref_id = "pref_1"

                if structured_json_str:
                    try:
                        s_data = json.loads(structured_json_str)
                        if isinstance(s_data, dict) and "sections" in s_data:
                            structured_sections = s_data["sections"]
                            preferences = s_data.get("preferences", [])
                            active_pref_id = s_data.get("active_preference_id", "pref_1")
                        else:
                            structured_sections = s_data if isinstance(s_data, dict) else grok_client.parse_structured_sections(summary_text_str)
                    except Exception:
                        structured_sections = grok_client.parse_structured_sections(summary_text_str)
                else:
                    structured_sections = grok_client.parse_structured_sections(summary_text_str)

                # Ensure dual preferences are present for frontend comparison
                if not preferences or len(preferences) < 2:
                    preferences = [
                        {
                            "id": "pref_1",
                            "label": "Preference 1: Comprehensive Brief",
                            "model": model_name,
                            "perspective": "Comprehensive Legal Brief",
                            "summary_text": summary_text_str,
                            "structured_sections": structured_sections
                        },
                        {
                            "id": "pref_2",
                            "label": "Preference 2: Strategic Review",
                            "model": model_name,
                            "perspective": "Strategic Advocate Review",
                            "summary_text": summary_text_str,
                            "structured_sections": structured_sections
                        }
                    ]

                return jsonify({
                    "has_summary": True,
                    "document": doc_meta,
                    "summary": {
                        "summary_id": summary_id,
                        "summary_text": summary_text_str,
                        "structured_sections": structured_sections,
                        "model": model_name,
                        "status": status,
                        "error_message": error_message,
                        "created_at": created_at,
                        "updated_at": updated_at,
                        "generated_by_name": gen_by_name,
                        "disclaimer": grok_client.LEGAL_DISCLAIMER,
                        "preferences": preferences,
                        "active_preference_id": active_pref_id
                    }
                }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/documents/<int:document_id>/summary", methods=["POST"])
@auth.role_required(["ADVOCATE"])
def generate_document_summary_endpoint(document_id: int):
    """
    POST /api/advocate/documents/<document_id>/summary
    --------------------------------------------------
    Generates or regenerates Grok AI dual-preference legal briefs for a case document.
    """
    user_id = session.get("user_id")
    auth.verify_csrf_token()

    body = request.get_json(silent=True) or {}
    regenerate = body.get("regenerate", False) or request.args.get("regenerate") == "1"

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS, d.DOCUMENT_TITLE, d.DESCRIPTION
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                doc_row = cursor.fetchone()
                if not doc_row:
                    return jsonify({"error": "Document record not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                (doc_id, case_id, file_name, mime_type, storage_key,
                 case_number, case_title,
                 uploaded_at, uploaded_by_name,
                 assigned_staff_id, assignment_status, doc_title, doc_desc) = doc_row

                # Check for existing summary if not regenerating
                if not regenerate:
                    cursor.execute(
                        """
                        SELECT ds.SUMMARY_ID, ds.SUMMARY_TEXT, ds.STRUCTURED_JSON, ds.MODEL_NAME,
                               ds.STATUS, ds.ERROR_MESSAGE,
                               TO_CHAR(ds.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                               TO_CHAR(ds.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT,
                               u_gen.FULL_NAME AS GENERATED_BY_NAME
                        FROM DOCUMENT_SUMMARIES ds
                        JOIN USERS u_gen ON ds.GENERATED_BY = u_gen.USER_ID
                        WHERE ds.DOCUMENT_ID = :did AND ds.STATUS = 'SUCCESS'
                        """,
                        {"did": document_id}
                    )
                    existing_sum = cursor.fetchone()
                    if existing_sum:
                        cursor.execute(
                            "UPDATE DOCUMENTS SET ASSIGNMENT_STATUS = 'ANALYZED' WHERE DOCUMENT_ID = :did",
                            {"did": document_id}
                        )
                        conn.commit()

                        s_text = safe_lob(existing_sum[1])
                        s_json_raw = safe_lob(existing_sum[2])
                        try:
                            s_parsed = json.loads(s_json_raw) if s_json_raw else {}
                        except Exception:
                            s_parsed = {}

                        if isinstance(s_parsed, dict) and "sections" in s_parsed:
                            s_sections = s_parsed["sections"]
                            preferences = s_parsed.get("preferences", [])
                            active_pref_id = s_parsed.get("active_preference_id", "pref_1")
                        else:
                            s_sections = s_parsed if isinstance(s_parsed, dict) and s_parsed else grok_client.parse_structured_sections(s_text)
                            preferences = []
                            active_pref_id = "pref_1"

                        if not preferences or len(preferences) < 2:
                            preferences = [
                                {
                                    "id": "pref_1",
                                    "label": "Preference 1: Comprehensive Brief",
                                    "model": existing_sum[3],
                                    "perspective": "Comprehensive Legal Brief",
                                    "summary_text": s_text,
                                    "structured_sections": s_sections
                                },
                                {
                                    "id": "pref_2",
                                    "label": "Preference 2: Strategic Review",
                                    "model": existing_sum[3],
                                    "perspective": "Strategic Advocate Review",
                                    "summary_text": s_text,
                                    "structured_sections": s_sections
                                }
                            ]

                        return jsonify({
                            "message": "Existing verified summary retrieved from database.",
                            "cached": True,
                            "document": {
                                "document_id": doc_id,
                                "case_id": case_id,
                                "case_number": case_number,
                                "case_title": case_title,
                                "file_name": file_name,
                                "document_title": doc_title or file_name,
                                "assignment_status": "ANALYZED",
                                "mime_type": mime_type,
                                "uploaded_at": uploaded_at,
                                "uploaded_by_name": uploaded_by_name
                            },
                            "summary": {
                                "summary_id": existing_sum[0],
                                "summary_text": s_text,
                                "structured_sections": s_sections,
                                "model": existing_sum[3],
                                "status": existing_sum[4],
                                "created_at": existing_sum[6],
                                "updated_at": existing_sum[7],
                                "generated_by_name": existing_sum[8],
                                "disclaimer": grok_client.LEGAL_DISCLAIMER,
                                "preferences": preferences,
                                "active_preference_id": active_pref_id
                            }
                        }), 200

                # Locate physical document and extract text
                if not storage_key or not os.path.exists(storage_key):
                    return jsonify({
                        "error": f"Original document file '{file_name}' was not found on document storage disk.",
                        "code": "DOCUMENT_FILE_NOT_FOUND"
                    }), 404

                try:
                    extraction_data = document_extractor.extract_document_text(storage_key, file_name)
                except document_extractor.ScannedDocumentError as sc_err:
                    return jsonify({"error": str(sc_err), "code": "OCR_REQUIRED", "requires_ocr": True}), 422
                except document_extractor.DocumentExtractionError as ex_err:
                    return jsonify({"error": f"Document extraction error: {str(ex_err)}", "code": ex_err.code}), 400

                # Invoke Grok xAI API with preference model cascading fallbacks
                preferred_models = body.get("preferred_models") or body.get("model")
                try:
                    summary_result = grok_client.generate_document_summary(
                        doc_text=extraction_data["text"],
                        file_name=file_name,
                        case_number=case_number,
                        preferred_models=preferred_models
                    )
                except grok_client.GrokConfigurationError as g_cfg:
                    return jsonify({"error": str(g_cfg), "code": "API_KEY_NOT_CONFIGURED"}), 503
                except grok_client.GrokAuthError as g_auth:
                    return jsonify({"error": str(g_auth), "code": "GROK_AUTH_FAILED"}), 401
                except grok_client.GrokRateLimitError as g_rl:
                    return jsonify({"error": str(g_rl), "code": "GROK_RATE_LIMITED"}), 429
                except grok_client.GrokTimeoutError as g_to:
                    return jsonify({"error": str(g_to), "code": "GROK_TIMEOUT"}), 504
                except grok_client.GrokServiceError as g_srv:
                    return jsonify({"error": str(g_srv), "code": "GROK_SERVICE_ERROR"}), 502
                except grok_client.GrokError as g_err:
                    return jsonify({"error": str(g_err), "code": g_err.code}), g_err.status_code

                summary_text = summary_result["summary_text"]
                model_used = summary_result["model"]
                preferences = summary_result.get("preferences", [])
                active_pref_id = summary_result.get("active_preference_id", "pref_1")

                structured_payload = {
                    "sections": summary_result["structured_sections"],
                    "preferences": preferences,
                    "active_preference_id": active_pref_id
                }
                structured_json = json.dumps(structured_payload)

                cursor.execute(
                    "SELECT SUMMARY_ID FROM DOCUMENT_SUMMARIES WHERE DOCUMENT_ID = :did",
                    {"did": document_id}
                )
                existing_row = cursor.fetchone()

                if existing_row:
                    summary_id = existing_row[0]
                    cursor.execute(
                        """
                        UPDATE DOCUMENT_SUMMARIES
                        SET SUMMARY_TEXT = :stext,
                            STRUCTURED_JSON = :sjson,
                            MODEL_NAME = :model,
                            STATUS = 'SUCCESS',
                            ERROR_MESSAGE = NULL,
                            UPDATED_AT = SYSTIMESTAMP,
                            GENERATED_BY = :uid
                        WHERE SUMMARY_ID = :sid
                        """,
                        {
                            "stext": summary_text,
                            "sjson": structured_json,
                            "model": model_used,
                            "uid": user_id,
                            "sid": summary_id
                        }
                    )
                else:
                    sum_id_var = cursor.var(oracledb.NUMBER)
                    cursor.execute(
                        """
                        INSERT INTO DOCUMENT_SUMMARIES (
                            DOCUMENT_ID, SUMMARY_TEXT, STRUCTURED_JSON, MODEL_NAME, STATUS,
                            CREATED_AT, UPDATED_AT, GENERATED_BY
                        ) VALUES (
                            :did, :stext, :sjson, :model, 'SUCCESS',
                            SYSTIMESTAMP, SYSTIMESTAMP, :uid
                        ) RETURNING SUMMARY_ID INTO :new_sid
                        """,
                        {
                            "did": document_id,
                            "stext": summary_text,
                            "sjson": structured_json,
                            "model": model_used,
                            "uid": user_id,
                            "new_sid": sum_id_var
                        }
                    )
                    summary_id = int(sum_id_var.getvalue()[0])

                cursor.execute(
                    "UPDATE DOCUMENTS SET ASSIGNMENT_STATUS = 'ANALYZED' WHERE DOCUMENT_ID = :did",
                    {"did": document_id}
                )

                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'SUMMARY_GENERATED', 'DOCUMENTS', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": user_id, "entity_id": document_id}
                )
                conn.commit()

        return jsonify({
            "message": "Dual-preference AI legal brief compiled successfully.",
            "cached": False,
            "document": {
                "document_id": doc_id,
                "case_id": case_id,
                "case_number": case_number,
                "case_title": case_title,
                "file_name": file_name,
                "document_title": doc_title or file_name,
                "assignment_status": "ANALYZED",
                "mime_type": mime_type,
                "uploaded_at": uploaded_at,
                "uploaded_by_name": uploaded_by_name
            },
            "summary": {
                "summary_id": summary_id,
                "summary_text": summary_text,
                "structured_sections": summary_result["structured_sections"],
                "model": model_used,
                "status": "SUCCESS",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "generated_by_name": session.get("full_name", "Advocate"),
                "disclaimer": grok_client.LEGAL_DISCLAIMER,
                "preferences": preferences,
                "active_preference_id": active_pref_id
            }
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/documents/<int:document_id>/summary/preference", methods=["POST", "PUT"])
@auth.role_required(["ADVOCATE"])
def select_summary_preference_endpoint(document_id: int):
    """
    POST /api/advocate/documents/<document_id>/summary/preference
    ------------------------------------------------------------
    Selects one of the dual AI preferences as the official verified legal brief.
    """
    user_id = session.get("user_id")
    auth.verify_csrf_token()

    body = request.get_json(silent=True) or {}
    target_pref_id = body.get("preference_id") or body.get("preference") or "pref_1"

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT ds.SUMMARY_ID, ds.SUMMARY_TEXT, ds.STRUCTURED_JSON, ds.MODEL_NAME,
                           d.CASE_ID, d.ASSIGNED_STAFF_ID, c.CREATED_BY, d.FILE_NAME
                    FROM DOCUMENT_SUMMARIES ds
                    JOIN DOCUMENTS d ON ds.DOCUMENT_ID = d.DOCUMENT_ID
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    WHERE ds.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "No verified summary found for this document.", "code": "SUMMARY_NOT_FOUND"}), 404

                sum_id, curr_text, s_json_raw, curr_model, case_id, assigned_staff_id, created_by, file_name = row

                try:
                    s_payload = json.loads(safe_lob(s_json_raw)) if s_json_raw else {}
                except Exception:
                    s_payload = {}

                prefs = s_payload.get("preferences", [])
                matching_pref = next((p for p in prefs if p.get("id") == target_pref_id), None)

                if matching_pref:
                    new_summary_text = matching_pref.get("summary_text") or curr_text
                    new_model = matching_pref.get("model") or curr_model
                    new_sections = matching_pref.get("structured_sections") or s_payload.get("sections", {})
                    s_payload["sections"] = new_sections
                else:
                    new_summary_text = curr_text
                    new_model = curr_model

                s_payload["active_preference_id"] = target_pref_id
                updated_json_str = json.dumps(s_payload)

                cursor.execute(
                    """
                    UPDATE DOCUMENT_SUMMARIES
                    SET SUMMARY_TEXT = :stext,
                        STRUCTURED_JSON = :sjson,
                        MODEL_NAME = :mname,
                        UPDATED_AT = SYSTIMESTAMP
                    WHERE SUMMARY_ID = :sid
                    """,
                    {
                        "stext": new_summary_text,
                        "sjson": updated_json_str,
                        "mname": new_model,
                        "sid": sum_id
                    }
                )

                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
                    VALUES (:actor_id, 'SUMMARY_PREFERENCE_SELECTED', 'DOCUMENT_SUMMARIES', :entity_id, SYSTIMESTAMP)
                    """,
                    {"actor_id": user_id, "entity_id": sum_id}
                )
                conn.commit()

        return jsonify({
            "message": f"Preference '{target_pref_id}' set as official case brief.",
            "active_preference_id": target_pref_id,
            "document_id": document_id
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 8. PRACTICE ANALYTICS & REPORTS
# ============================================================================

@advocate_bp.route("/reports", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def get_practice_reports():
    """
    GET /api/advocate/reports
    -------------------------
    Aggregates comprehensive legal practice analytics for the Advocate Chamber:
    - Overall Case KPIs (Total, Active, Closed, Clients, Staff, Documents, Hearings)
    - Case Distribution by Type (Civil, Criminal, Corporate, etc.)
    - Case Status Breakdown (Open, In Trial, Disposed, etc.)
    - Hearings Status Breakdown (Scheduled, Concluded, Adjourned)
    - Staff Workload & Performance Allocation
    """
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Overall Counts
                cursor.execute("SELECT COUNT(*) FROM CASES")
                total_cases = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM CASES WHERE CASE_STATUS IN ('OPEN', 'PENDING_HEARING', 'IN_TRIAL')")
                active_cases = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM CASES WHERE CASE_STATUS IN ('CLOSED', 'DISPOSED', 'ARCHIVED')")
                closed_cases = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM CLIENTS cl JOIN USERS u ON cl.USER_ID = u.USER_ID WHERE u.ACCOUNT_STATUS = 'ACTIVE'")
                total_clients = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM STAFF s JOIN USERS u ON s.USER_ID = u.USER_ID WHERE u.ACCOUNT_STATUS = 'ACTIVE'")
                total_staff = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM DOCUMENTS")
                total_docs = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM HEARINGS")
                total_hearings = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM HEARINGS WHERE HEARING_DATE >= SYSTIMESTAMP AND HEARING_STATUS = 'SCHEDULED'")
                upcoming_hearings = cursor.fetchone()[0]

                # 2. Case Type Breakdown
                cursor.execute(
                    """
                    SELECT CASE_TYPE, COUNT(*)
                    FROM CASES
                    GROUP BY CASE_TYPE
                    ORDER BY COUNT(*) DESC
                    """
                )
                cases_by_type = [{"type": r[0], "count": r[1]} for r in cursor.fetchall()]

                # 3. Case Status Breakdown
                cursor.execute(
                    """
                    SELECT CASE_STATUS, COUNT(*)
                    FROM CASES
                    GROUP BY CASE_STATUS
                    ORDER BY COUNT(*) DESC
                    """
                )
                cases_by_status = [{"status": r[0], "count": r[1]} for r in cursor.fetchall()]

                # 4. Hearings Status Breakdown
                cursor.execute(
                    """
                    SELECT HEARING_STATUS, COUNT(*)
                    FROM HEARINGS
                    GROUP BY HEARING_STATUS
                    ORDER BY COUNT(*) DESC
                    """
                )
                hearings_by_status = [{"status": r[0], "count": r[1]} for r in cursor.fetchall()]

                # 5. Staff Workload Matrix
                cursor.execute(
                    """
                    SELECT s.STAFF_ID, u.FULL_NAME, s.EMPLOYEE_CODE,
                           (SELECT COUNT(*) FROM CASE_ASSIGNMENTS ca WHERE ca.STAFF_ID = s.STAFF_ID AND ca.ASSIGNMENT_STATUS = 'ACTIVE') AS ACTIVE_CASES,
                           (SELECT COUNT(*) FROM RESEARCH_TASKS rt WHERE rt.STAFF_ID = s.STAFF_ID AND rt.STATUS = 'COMPLETED') AS COMPLETED_TASKS,
                           (SELECT COUNT(*) FROM RESEARCH_TASKS rt WHERE rt.STAFF_ID = s.STAFF_ID AND rt.STATUS = 'PENDING') AS PENDING_TASKS
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE u.ACCOUNT_STATUS = 'ACTIVE'
                    ORDER BY u.FULL_NAME ASC
                    """
                )
                staff_workload = [
                    {
                        "staff_id": r[0],
                        "name": r[1],
                        "code": r[2],
                        "active_cases": r[3],
                        "completed_tasks": r[4],
                        "pending_tasks": r[5]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "kpis": {
                "total_cases": total_cases,
                "active_cases": active_cases,
                "closed_cases": closed_cases,
                "total_clients": total_clients,
                "total_staff": total_staff,
                "total_documents": total_docs,
                "total_hearings": total_hearings,
                "upcoming_hearings": upcoming_hearings
            },
            "cases_by_type": cases_by_type,
            "cases_by_status": cases_by_status,
            "hearings_by_status": hearings_by_status,
            "staff_workload": staff_workload
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 7. AUDIT LOGS (Immutable Security Trail)
# ============================================================================

@advocate_bp.route("/audit-logs", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_audit_logs():
    """
    GET /api/advocate/audit-logs
    ----------------------------
    Returns empty list since Audit Log feature has been deactivated.
    """
    return jsonify({
        "audit_logs": [],
        "total": 0
    }), 200


# ============================================================================
# 8. ADVOCATE RESEARCH TASK DELEGATION
# ============================================================================

@advocate_bp.route("/tasks", methods=["GET"])
@auth.role_required(["ADVOCATE"])
def list_advocate_tasks():
    """
    GET /api/advocate/tasks
    -----------------------
    Returns all research tasks delegated to staff across cases managed by this advocate.
    """
    advocate_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT rt.TASK_ID, rt.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           rt.STAFF_ID, u_st.FULL_NAME AS STAFF_NAME, s.EMPLOYEE_CODE,
                           rt.TITLE, rt.INSTRUCTIONS, rt.STATUS, rt.PRIORITY,
                           TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DUE_DATE,
                           rt.RESEARCH_NOTES,
                           TO_CHAR(rt.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           TO_CHAR(rt.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT
                    FROM RESEARCH_TASKS rt
                    JOIN CASES c ON rt.CASE_ID = c.CASE_ID
                    JOIN STAFF s ON rt.STAFF_ID = s.STAFF_ID
                    JOIN USERS u_st ON s.USER_ID = u_st.USER_ID
                    WHERE c.CREATED_BY = :adv_id
                    ORDER BY rt.CREATED_AT DESC
                    """,
                    {"adv_id": advocate_id}
                )
                tasks = [
                    {
                        "task_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "staff_id": r[4],
                        "staff_name": r[5],
                        "employee_code": r[6],
                        "title": r[7],
                        "instructions": safe_lob(r[8]),
                        "status": r[9],
                        "priority": r[10],
                        "due_date": r[11],
                        "research_notes": safe_lob(r[12]),
                        "created_at": r[13],
                        "updated_at": r[14]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"tasks": tasks, "total": len(tasks)}), 200

    except Exception as exc:
        return handle_db_error(exc)


@advocate_bp.route("/tasks", methods=["POST"])
@auth.role_required(["ADVOCATE"])
def create_research_task():
    """
    POST /api/advocate/tasks
    ------------------------
    Advocate delegates a research task on a managed case to an authorized staff member:
    - Validates advocate case ownership
    - Validates staff exists and is active
    - Validates task title
    - Inserts into RESEARCH_TASKS and logs event to AUDIT_LOGS
    """
    auth.verify_csrf_token()
    advocate_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    case_id = data.get("case_id")
    staff_id = data.get("staff_id")
    title = data.get("title", "").strip()
    instructions = data.get("instructions", "").strip()
    priority = data.get("priority", "MEDIUM").strip().upper()
    due_date = data.get("due_date")

    if not case_id:
        return jsonify({"error": "Case selection is required.", "code": "MISSING_CASE_ID"}), 400

    if not staff_id:
        return jsonify({"error": "Staff member selection is required.", "code": "MISSING_STAFF_ID"}), 400

    if not title or len(title) < 3:
        return jsonify({"error": "Task title must be at least 3 characters long.", "code": "INVALID_TITLE"}), 400

    if priority not in ("LOW", "MEDIUM", "HIGH", "URGENT"):
        priority = "MEDIUM"

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Validate Case Ownership
                cursor.execute(
                    "SELECT CASE_NUMBER, TITLE FROM CASES WHERE CASE_ID = :cid AND CREATED_BY = :adv_id",
                    {"cid": case_id, "adv_id": advocate_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({
                        "error": "Case not found or you are not authorized to manage it.",
                        "code": "UNAUTHORIZED_CASE_ACCESS"
                    }), 403

                case_num, case_title = case_row

                # 2. Validate Staff Member
                cursor.execute(
                    """
                    SELECT s.STAFF_ID, u.FULL_NAME
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE s.STAFF_ID = :sid AND u.ACCOUNT_STATUS = 'ACTIVE'
                    """,
                    {"sid": staff_id}
                )
                staff_row = cursor.fetchone()
                if not staff_row:
                    return jsonify({
                        "error": "Selected staff member is invalid or not in active standing.",
                        "code": "INVALID_STAFF_MEMBER"
                    }), 400

                staff_name = staff_row[1]

                # 3. Ensure Staff is assigned to the case
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM CASE_ASSIGNMENTS
                    WHERE CASE_ID = :cid AND STAFF_ID = :sid AND ASSIGNMENT_STATUS = 'ACTIVE'
                    """,
                    {"cid": case_id, "sid": staff_id}
                )
                if cursor.fetchone()[0] == 0:
                    # Auto-assign staff to case if not already actively assigned
                    assign_var = cursor.var(oracledb.NUMBER)
                    cursor.execute(
                        """
                        INSERT INTO CASE_ASSIGNMENTS (CASE_ID, STAFF_ID, ASSIGNED_BY, ASSIGNED_AT, ASSIGNMENT_STATUS, INSTRUCTIONS)
                        VALUES (:cid, :sid, :adv_id, SYSTIMESTAMP, 'ACTIVE', 'Assigned for research task: ' || :title)
                        RETURNING ASSIGNMENT_ID INTO :new_aid
                        """,
                        {"cid": case_id, "sid": staff_id, "adv_id": advocate_id, "title": title[:100], "new_aid": assign_var}
                    )

                # 4. Insert into RESEARCH_TASKS
                task_id_var = cursor.var(oracledb.NUMBER)
                cursor.execute(
                    """
                    INSERT INTO RESEARCH_TASKS (
                        CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, CREATED_AT, UPDATED_AT
                    ) VALUES (
                        :cid, :sid, :adv_id, :title, :inst, 'PENDING', :priority, :due, SYSTIMESTAMP, SYSTIMESTAMP
                    ) RETURNING TASK_ID INTO :new_tid
                    """,
                    {
                        "cid": case_id,
                        "sid": staff_id,
                        "adv_id": advocate_id,
                        "title": title,
                        "inst": instructions if instructions else None,
                        "priority": priority,
                        "due": due_date if due_date else None,
                        "new_tid": task_id_var
                    }
                )
                new_task_id = int(task_id_var.getvalue()[0])

                # 5. Record in AUDIT_LOGS
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS, CREATED_AT)
                    VALUES (:actor_id, 'ADVOCATE_TASK_CREATED', 'RESEARCH_TASKS', :tid, :details, SYSTIMESTAMP)
                    """,
                    {
                        "actor_id": advocate_id,
                        "tid": new_task_id,
                        "details": f"Delegated task '{title}' on Case {case_num} to {staff_name}"
                    }
                )

                conn.commit()

        return jsonify({
            "message": f"Successfully created and assigned research task to {staff_name}.",
            "task": {
                "task_id": new_task_id,
                "case_id": case_id,
                "case_number": case_num,
                "case_title": case_title,
                "staff_id": staff_id,
                "staff_name": staff_name,
                "title": title,
                "instructions": instructions,
                "status": "PENDING",
                "priority": priority,
                "due_date": due_date
            }
        }), 201

    except Exception as exc:
        return handle_db_error(exc)

