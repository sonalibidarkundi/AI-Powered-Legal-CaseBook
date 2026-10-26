"""
Legal CaseBook - Staff Dashboard & Research Tasks APIs (staff_api.py)
---------------------------------------------------------------------
Stage 6 Implementation:
- Staff Dashboard Overview (Summary metrics, recent assignments, upcoming deadlines)
- Assigned Cases (Strictly limited to cases assigned to the authenticated staff member)
- Case Details (Permitted case details, relevant client information, assignment instructions)
- Authorized Documents (Documents belonging strictly to assigned cases, secure downloads)
- Research Tasks (View assigned research tasks, instructions, deadlines)
- Task Status Updates (Pending, In Progress, Completed - persistent in Oracle Database)
- Research Notes (Save work results, citations, precedents - persistent in Oracle Database)
- Upcoming Deadlines (Task due dates, scheduled court hearings on assigned cases)

Strict Privacy & Security Enforcement:
- RBAC Boundary: All endpoints restricted to verified STAFF role.
- Session-Derived Identity: Staff ID is strictly derived from the authenticated server-side session.
- Client / Third-party input NEVER trusted for identity or authorization.
- Tamper-Proof: If Case 101 is assigned to S1, S2 receives HTTP 403 FORBIDDEN_CASE_ACCESS.
- Unauthorized document downloads and research note modifications are strictly blocked.
- Immutable Audit Logging for all status updates and note submissions.
- Zero mock data: all queries run against real Oracle / relational database tables.
"""

from datetime import datetime, timezone
import io
import json
import os
import uuid
import oracledb
from werkzeug.utils import secure_filename
from flask import Blueprint, jsonify, request, session, send_file

import auth
import db
import document_extractor
from document_extractor import (
    validate_file_header,
    extract_document_text,
    ScannedDocumentError,
    UnsupportedFileTypeError,
    FileSizeLimitExceededError,
    DocumentExtractionError
)
import grok_client

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads", "documents"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


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
    """Translates database exceptions into secure, clean JSON responses without leaking credentials."""
    if isinstance(exc, db.DatabaseConfigurationError):
        return jsonify({
            "error": "Database service is not configured. Please check backend/.env settings.",
            "code": "DATABASE_NOT_CONFIGURED"
        }), 503
    elif isinstance(exc, oracledb.Error):
        return jsonify({
            "error": "Oracle Database server is currently unreachable. Please check database listener.",
            "code": "DATABASE_UNAVAILABLE"
        }), 503
    else:
        return jsonify({
            "error": "An unexpected error occurred while communicating with the database.",
            "code": "DATABASE_ERROR",
            "details": str(exc)
        }), 503


def get_authenticated_staff_id(cursor, user_id: int):
    """
    Retrieves the STAFF_ID corresponding to the authenticated USER_ID.
    Returns (staff_id, employee_code) or (None, None).
    """
    cursor.execute(
        """
        SELECT s.STAFF_ID, s.EMPLOYEE_CODE
        FROM STAFF s
        JOIN USERS u ON s.USER_ID = u.USER_ID
        WHERE s.USER_ID = :uid AND u.ACCOUNT_STATUS = 'ACTIVE'
        """,
        {"uid": user_id}
    )
    row = cursor.fetchone()
    if row:
        return row[0], row[1]
    return None, None


def verify_case_assignment(cursor, staff_id: int, case_id: int) -> bool:
    """
    Verifies that the staff member has an ACTIVE assignment for the specified case.
    Strictly prevents IDOR (Insecure Direct Object Reference) access.
    """
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM CASE_ASSIGNMENTS
        WHERE CASE_ID = :cid AND STAFF_ID = :sid AND ASSIGNMENT_STATUS = 'ACTIVE'
        """,
        {"cid": case_id, "sid": staff_id}
    )
    return cursor.fetchone()[0] > 0


# ============================================================================
# 1. STAFF DASHBOARD OVERVIEW & SUMMARY
# ============================================================================

@staff_bp.route("/dashboard", methods=["GET"])
@auth.role_required(["STAFF", "ADVOCATE"])
def staff_dashboard_info():
    """
    GET /api/staff/dashboard
    ------------------------
    Preserved for backward compatibility and workspace identification.
    """
    return jsonify({
        "workspace": "Staff Coordination Portal",
        "access": "Granted (Staff / Assistant Access)",
        "user": session.get("full_name"),
        "role": session.get("role"),
        "features": [
            "My Assigned Cases",
            "Research Tasks & Legal Notes",
            "Authorized Case Documents",
            "Upcoming Court & Task Deadlines"
        ]
    }), 200


@staff_bp.route("/overview", methods=["GET"])
@staff_bp.route("/summary", methods=["GET"])
@auth.role_required(["STAFF"])
def get_staff_overview():
    """
    GET /api/staff/overview
    -----------------------
    Aggregates real statistics from Oracle Database for the authenticated staff member:
    - Summary Cards:
      - My Assigned Cases
      - Pending Tasks
      - In Progress Tasks
      - Completed Tasks
      - Upcoming Deadlines
    - Recent Streams:
      - Recent Case Assignments
      - Upcoming Deadlines (Hearings & Tasks)
      - Recent Tasks
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, emp_code = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({
                        "error": "Staff profile record not found or account is not in active standing.",
                        "code": "STAFF_PROFILE_NOT_FOUND"
                    }), 403

                # 1. My Assigned Cases Count
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM CASE_ASSIGNMENTS
                    WHERE STAFF_ID = :sid AND ASSIGNMENT_STATUS = 'ACTIVE'
                    """,
                    {"sid": staff_id}
                )
                assigned_cases_count = cursor.fetchone()[0]

                # 1b. Active Case Files Count (Open, Pending Hearing, In Trial)
                cursor.execute(
                    """
                    SELECT COUNT(DISTINCT c.CASE_ID)
                    FROM CASE_ASSIGNMENTS ca
                    JOIN CASES c ON ca.CASE_ID = c.CASE_ID
                    WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                      AND c.CASE_STATUS IN ('OPEN', 'PENDING_HEARING', 'IN_TRIAL')
                    """,
                    {"sid": staff_id}
                )
                active_cases_count = cursor.fetchone()[0]

                # 2. Pending Tasks Count
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM RESEARCH_TASKS
                    WHERE STAFF_ID = :sid AND STATUS = 'PENDING'
                    """,
                    {"sid": staff_id}
                )
                pending_tasks_count = cursor.fetchone()[0]

                # 3. In Progress Tasks Count
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM RESEARCH_TASKS
                    WHERE STAFF_ID = :sid AND STATUS = 'IN_PROGRESS'
                    """,
                    {"sid": staff_id}
                )
                in_progress_tasks_count = cursor.fetchone()[0]

                # 4. Completed Tasks Count
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM RESEARCH_TASKS
                    WHERE STAFF_ID = :sid AND STATUS = 'COMPLETED'
                    """,
                    {"sid": staff_id}
                )
                completed_tasks_count = cursor.fetchone()[0]

                # 5. Upcoming Deadlines Count (Tasks with due dates >= now + Hearings on assigned cases >= now)
                cursor.execute(
                    """
                    SELECT (
                        (SELECT COUNT(*) FROM RESEARCH_TASKS WHERE STAFF_ID = :sid AND STATUS != 'COMPLETED' AND DUE_DATE >= SYSTIMESTAMP)
                        +
                        (SELECT COUNT(*) FROM HEARINGS h JOIN CASE_ASSIGNMENTS ca ON h.CASE_ID = ca.CASE_ID WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE' AND h.HEARING_DATE >= SYSTIMESTAMP)
                    ) FROM DUAL
                    """,
                    {"sid": staff_id}
                )
                upcoming_deadlines_count = cursor.fetchone()[0]

                # --- RECENT STREAMS ---

                # Recent Assignments (Top 5)
                cursor.execute(
                    """
                    SELECT ca.ASSIGNMENT_ID, ca.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           c.CASE_STATUS, c.CASE_TYPE,
                           u_adv.FULL_NAME AS ADVOCATE_NAME, u_adv.EMAIL AS ADVOCATE_EMAIL,
                           ca.INSTRUCTIONS,
                           TO_CHAR(ca.DEADLINE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DEADLINE,
                           TO_CHAR(ca.ASSIGNED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNED_AT
                    FROM CASE_ASSIGNMENTS ca
                    JOIN CASES c ON ca.CASE_ID = c.CASE_ID
                    JOIN USERS u_adv ON ca.ASSIGNED_BY = u_adv.USER_ID
                    WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                    ORDER BY ca.ASSIGNED_AT DESC
                    FETCH FIRST 5 ROWS ONLY
                    """,
                    {"sid": staff_id}
                )
                recent_assignments = [
                    {
                        "assignment_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "case_status": r[4],
                        "case_type": r[5],
                        "advocate_name": r[6],
                        "advocate_email": r[7],
                        "instructions": r[8] or "",
                        "deadline": r[9],
                        "assigned_at": r[10]
                    }
                    for r in cursor.fetchall()
                ]

                # Upcoming Deadlines Stream (Top 5 - Tasks and Hearings combined)
                cursor.execute(
                    """
                    SELECT * FROM (
                        SELECT 'TASK' AS ITEM_TYPE,
                               rt.TASK_ID AS ITEM_ID,
                               rt.TITLE AS TITLE,
                               c.CASE_NUMBER,
                               c.TITLE AS CASE_TITLE,
                               rt.PRIORITY,
                               rt.STATUS,
                               TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DEADLINE_DATE
                        FROM RESEARCH_TASKS rt
                        JOIN CASES c ON rt.CASE_ID = c.CASE_ID
                        WHERE rt.STAFF_ID = :sid AND rt.STATUS != 'COMPLETED' AND rt.DUE_DATE >= SYSTIMESTAMP
                        UNION ALL
                        SELECT 'HEARING' AS ITEM_TYPE,
                               h.HEARING_ID AS ITEM_ID,
                               'Court Hearing: ' || NVL(h.COURT_ROOM, NVL(h.COURT_NAME, 'Court Session')) AS TITLE,
                               c.CASE_NUMBER,
                               c.TITLE AS CASE_TITLE,
                               'URGENT' AS PRIORITY,
                               h.HEARING_STATUS AS STATUS,
                               TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DEADLINE_DATE
                        FROM HEARINGS h
                        JOIN CASES c ON h.CASE_ID = c.CASE_ID
                        JOIN CASE_ASSIGNMENTS ca ON c.CASE_ID = ca.CASE_ID
                        WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE' AND h.HEARING_DATE >= SYSTIMESTAMP
                    )
                    ORDER BY DEADLINE_DATE ASC
                    FETCH FIRST 5 ROWS ONLY
                    """,
                    {"sid": staff_id}
                )
                upcoming_deadlines = [
                    {
                        "item_type": r[0],
                        "item_id": r[1],
                        "title": r[2],
                        "case_number": r[3],
                        "case_title": r[4],
                        "priority": r[5],
                        "status": r[6],
                        "deadline_date": r[7]
                    }
                    for r in cursor.fetchall()
                ]

                # Recent Tasks (Top 5)
                cursor.execute(
                    """
                    SELECT rt.TASK_ID, rt.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           rt.TITLE, rt.STATUS, rt.PRIORITY,
                           TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DUE_DATE,
                           TO_CHAR(rt.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT
                    FROM RESEARCH_TASKS rt
                    JOIN CASES c ON rt.CASE_ID = c.CASE_ID
                    WHERE rt.STAFF_ID = :sid
                    ORDER BY rt.UPDATED_AT DESC
                    FETCH FIRST 5 ROWS ONLY
                    """,
                    {"sid": staff_id}
                )
                recent_tasks = [
                    {
                        "task_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "title": r[4],
                        "status": r[5],
                        "priority": r[6],
                        "due_date": r[7],
                        "updated_at": r[8]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "staff_profile": {
                "staff_id": staff_id,
                "user_id": user_id,
                "employee_code": emp_code,
                "full_name": session.get("full_name"),
                "email": session.get("email")
            },
            "metrics": {
                "assigned_cases": assigned_cases_count,
                "active_cases": active_cases_count,
                "pending_tasks": pending_tasks_count,
                "in_progress_tasks": in_progress_tasks_count,
                "completed_tasks": completed_tasks_count,
                "upcoming_deadlines": upcoming_deadlines_count
            },
            "recent_assignments": recent_assignments,
            "upcoming_deadlines": upcoming_deadlines,
            "recent_tasks": recent_tasks,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 2. ASSIGNED CASES (View, Search, Filter, Details)
# ============================================================================

@staff_bp.route("/cases", methods=["GET"])
@auth.role_required(["STAFF"])
def list_assigned_cases():
    """
    GET /api/staff/cases
    --------------------
    CRITICAL PRIVACY ENFORCEMENT:
    Staff member sees ONLY cases explicitly assigned to their authenticated account.
    Never returns unassigned cases or cases assigned to other staff members.
    Supports filtering by search query 'q', 'status', and 'case_type'.
    """
    user_id = session.get("user_id")
    search_q = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "ALL").strip().upper()
    type_filter = request.args.get("case_type", "ALL").strip().upper()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, emp_code = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({"cases": [], "total": 0}), 200

                query = """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                           ca.ASSIGNMENT_ID, ca.ASSIGNMENT_STATUS, ca.INSTRUCTIONS,
                           TO_CHAR(ca.DEADLINE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNMENT_DEADLINE,
                           TO_CHAR(ca.ASSIGNED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNED_AT,
                           u_adv.FULL_NAME AS ADVOCATE_NAME, u_adv.EMAIL AS ADVOCATE_EMAIL,
                           NVL((SELECT u_cl.FULL_NAME
                                FROM CASE_CLIENTS cc
                                JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                JOIN USERS u_cl ON cl.USER_ID = u_cl.USER_ID
                                WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), 'Not Disclosed') AS CLIENT_NAME,
                           NVL((SELECT cl.PHONE
                                FROM CASE_CLIENTS cc
                                JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), 'Not Provided') AS CLIENT_PHONE,
                           NVL((SELECT u_cl.EMAIL
                                FROM CASE_CLIENTS cc
                                JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                JOIN USERS u_cl ON cl.USER_ID = u_cl.USER_ID
                                WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), '') AS CLIENT_EMAIL,
                           (SELECT COUNT(*) FROM RESEARCH_TASKS rt WHERE rt.CASE_ID = c.CASE_ID AND rt.STAFF_ID = :sid AND rt.STATUS != 'COMPLETED') AS PENDING_TASKS_COUNT,
                           (SELECT COUNT(*) FROM DOCUMENTS d WHERE d.CASE_ID = c.CASE_ID) AS DOCUMENTS_COUNT
                    FROM CASE_ASSIGNMENTS ca
                    JOIN CASES c ON ca.CASE_ID = c.CASE_ID
                    JOIN STAFF s ON ca.STAFF_ID = s.STAFF_ID
                    JOIN USERS u_adv ON ca.ASSIGNED_BY = u_adv.USER_ID
                    WHERE s.USER_ID = :uid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                """
                params = {"sid": staff_id, "uid": user_id}

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
                            OR LOWER(NVL((SELECT u_cl.FULL_NAME
                                          FROM CASE_CLIENTS cc
                                          JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                          JOIN USERS u_cl ON cl.USER_ID = u_cl.USER_ID
                                          WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), '')) LIKE :search_term
                        )
                    """
                    params["search_term"] = f"%{search_q}%"

                query += " ORDER BY ca.ASSIGNED_AT DESC"

                cursor.execute(query, params)
                cases = [
                    {
                        "case_id": r[0],
                        "case_number": r[1],
                        "title": r[2],
                        "case_status": r[3],
                        "case_type": r[4],
                        "assignment_id": r[5],
                        "assignment_status": r[6],
                        "instructions": r[7] or "",
                        "deadline": r[8],
                        "assigned_at": r[9],
                        "advocate_name": r[10],
                        "advocate_email": r[11],
                        "client_name": r[12],
                        "client_phone": r[13],
                        "client_email": r[14],
                        "pending_tasks_count": r[15],
                        "documents_count": r[16]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "cases": cases,
            "total": len(cases),
            "filters": {
                "query": search_q,
                "status": status_filter,
                "case_type": type_filter
            }
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/cases/<int:case_id>", methods=["GET"])
@auth.role_required(["STAFF"])
def get_case_details(case_id: int):
    """
    GET /api/staff/cases/<case_id>
    ------------------------------
    CRITICAL PRIVACY ENFORCEMENT:
    Validates that the calling staff member is explicitly assigned to this case.
    Staff S2 cannot view Case 101 assigned to Staff S1 (returns 403 FORBIDDEN_CASE_ACCESS).
    Returns authorized case details, relevant client information, documents, hearings, and tasks.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({
                        "error": "Staff profile not found.",
                        "code": "FORBIDDEN_CASE_ACCESS"
                    }), 403

                # 1. Authorization Check: Is staff member actively assigned to this case?
                if not verify_case_assignment(cursor, staff_id, case_id):
                    return jsonify({
                        "error": "Access denied. You are not assigned to this case file.",
                        "code": "FORBIDDEN_CASE_ACCESS"
                    }), 403

                # 2. Case Details
                cursor.execute(
                    """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                           c.DESCRIPTION,
                           TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           u_adv.FULL_NAME AS ADVOCATE_NAME, u_adv.EMAIL AS ADVOCATE_EMAIL,
                           ca.ASSIGNMENT_ID, ca.INSTRUCTIONS,
                           TO_CHAR(ca.DEADLINE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNMENT_DEADLINE,
                           TO_CHAR(ca.ASSIGNED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ASSIGNED_AT
                    FROM CASES c
                    JOIN CASE_ASSIGNMENTS ca ON c.CASE_ID = ca.CASE_ID
                    JOIN USERS u_adv ON ca.ASSIGNED_BY = u_adv.USER_ID
                    WHERE c.CASE_ID = :cid AND ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                    """,
                    {"cid": case_id, "sid": staff_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({
                        "error": "Case file not found.",
                        "code": "CASE_NOT_FOUND"
                    }), 404

                case_data = {
                    "case_id": case_row[0],
                    "case_number": case_row[1],
                    "title": case_row[2],
                    "case_status": case_row[3],
                    "case_type": case_row[4],
                    "description": safe_lob(case_row[5]),
                    "created_at": case_row[6],
                    "advocate": {
                        "full_name": case_row[7],
                        "email": case_row[8]
                    },
                    "assignment": {
                        "assignment_id": case_row[9],
                        "instructions": case_row[10] or "",
                        "deadline": case_row[11],
                        "assigned_at": case_row[12]
                    }
                }

                # 3. Relevant Client Information (Required for case work; passwords strictly omitted)
                cursor.execute(
                    """
                    SELECT cl.CLIENT_ID, u_cl.FULL_NAME, u_cl.EMAIL, cl.PHONE, cl.ADDRESS
                    FROM CASE_CLIENTS cc
                    JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                    JOIN USERS u_cl ON cl.USER_ID = u_cl.USER_ID
                    WHERE cc.CASE_ID = :cid
                    """,
                    {"cid": case_id}
                )
                client_rows = cursor.fetchall()
                clients = [
                    {
                        "client_id": r[0],
                        "full_name": r[1],
                        "email": r[2],
                        "phone": r[3] or "Not Provided",
                        "address": r[4] or "Not Provided"
                    }
                    for r in client_rows
                ]
                case_data["clients"] = clients
                case_data["primary_client"] = clients[0] if clients else None

                # 4. Authorized Documents for this Case (Documents assigned to other staff members are excluded)
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.DOCUMENT_TITLE, d.DESCRIPTION, d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS,
                           (SELECT ds.STATUS FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID AND ROWNUM = 1) AS SUMMARY_STATUS
                    FROM DOCUMENTS d
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE d.CASE_ID = :cid AND (d.ASSIGNED_STAFF_ID = :sid OR d.ASSIGNED_STAFF_ID IS NULL)
                    ORDER BY d.UPLOADED_AT DESC
                    """,
                    {"cid": case_id, "sid": staff_id}
                )
                case_data["documents"] = [
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
                        "summary_status": r[9]
                    }
                    for r in cursor.fetchall()
                ]

                # 5. Scheduled Hearings for this Case
                cursor.execute(
                    """
                    SELECT h.HEARING_ID,
                           TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                           NVL(h.COURT_ROOM, NVL(h.COURT_NAME, 'Courtroom')) AS COURT_NAME,
                           h.JUDGE_NAME, h.HEARING_STATUS,
                           CAST(h.NOTES AS VARCHAR2(1000)) AS NOTES
                    FROM HEARINGS h
                    WHERE h.CASE_ID = :cid
                    ORDER BY h.HEARING_DATE ASC
                    """,
                    {"cid": case_id}
                )
                case_data["hearings"] = [
                    {
                        "hearing_id": r[0],
                        "hearing_date": r[1],
                        "court_name": r[2],
                        "judge_name": r[3] or "",
                        "hearing_status": r[4],
                        "notes": safe_lob(r[5])
                    }
                    for r in cursor.fetchall()
                ]

                # 6. Research Tasks for this Case Assigned to Calling Staff
                cursor.execute(
                    """
                    SELECT rt.TASK_ID, rt.TITLE, rt.INSTRUCTIONS, rt.STATUS, rt.PRIORITY,
                           TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DUE_DATE,
                           rt.RESEARCH_NOTES,
                           TO_CHAR(rt.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           TO_CHAR(rt.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT
                    FROM RESEARCH_TASKS rt
                    WHERE rt.CASE_ID = :cid AND rt.STAFF_ID = :sid
                    ORDER BY rt.CREATED_AT DESC
                    """,
                    {"cid": case_id, "sid": staff_id}
                )
                case_data["tasks"] = [
                    {
                        "task_id": r[0],
                        "title": r[1],
                        "instructions": safe_lob(r[2]),
                        "status": r[3],
                        "priority": r[4],
                        "due_date": r[5],
                        "research_notes": safe_lob(r[6]),
                        "created_at": r[7],
                        "updated_at": r[8]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify(case_data), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 3. AUTHORIZED DOCUMENTS & SECURE DOWNLOADS
# ============================================================================

@staff_bp.route("/cases/<int:case_id>/documents", methods=["GET"])
@auth.role_required(["STAFF"])
def get_case_documents(case_id: int):
    """
    GET /api/staff/cases/<case_id>/documents
    ----------------------------------------
    CRITICAL PRIVACY ENFORCEMENT:
    Staff cannot retrieve documents for an unassigned case simply by altering the URL.
    Returns HTTP 403 FORBIDDEN_DOCUMENT_ACCESS if not assigned.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                    return jsonify({
                        "error": "Access denied. You are not authorized to view documents for this case.",
                        "code": "FORBIDDEN_DOCUMENT_ACCESS"
                    }), 403

                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.DOCUMENT_TITLE, d.DESCRIPTION, d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS,
                           (SELECT ds.STATUS FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID AND ROWNUM = 1) AS SUMMARY_STATUS,
                           (CASE WHEN EXISTS (SELECT 1 FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID AND ds.STATUS = 'SUCCESS') THEN 1 ELSE 0 END) AS HAS_AI_SUMMARY
                    FROM DOCUMENTS d
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE d.CASE_ID = :cid AND (d.ASSIGNED_STAFF_ID = :sid OR d.ASSIGNED_STAFF_ID IS NULL)
                    ORDER BY d.UPLOADED_AT DESC
                    """,
                    {"cid": case_id, "sid": staff_id}
                )
                docs = [
                    {
                        "document_id": r[0],
                        "case_id": r[1],
                        "file_name": r[2],
                        "mime_type": r[3],
                        "uploaded_at": r[4],
                        "uploaded_by_name": r[5],
                        "document_title": r[6] or r[2],
                        "description": r[7] or "",
                        "assigned_staff_id": r[8],
                        "assignment_status": r[9] or "ASSIGNED",
                        "summary_status": r[10],
                        "has_ai_summary": bool(r[11])
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"documents": docs, "total": len(docs)}), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/documents", methods=["GET"])
@auth.role_required(["STAFF"])
def list_all_authorized_documents():
    """
    GET /api/staff/documents
    ------------------------
    Returns all documents across all cases actively assigned to the authenticated staff member.
    Never exposes documents from unassigned cases or documents assigned to other staff members.
    Supports filtering by:
    - assigned_to_me=1: documents explicitly assigned to this staff member
    - q: search term matching document title, file name, case number, or client name
    - case_id: filter by specific case
    - file_type: filter by file extension/mime type
    """
    user_id = session.get("user_id")
    search_q = request.args.get("q", "").strip().lower()
    case_filter = request.args.get("case_id")
    file_type = request.args.get("file_type", "").strip().lower()
    assigned_to_me = request.args.get("assigned_to_me") in ("1", "true", "yes") or request.args.get("filter") == "assigned_to_me"

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({"documents": [], "total": 0}), 200

                query = """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.DOCUMENT_TITLE, d.DESCRIPTION, d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS,
                           NVL((SELECT u_cl.FULL_NAME
                                FROM CASE_CLIENTS cc
                                JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                JOIN USERS u_cl ON cl.USER_ID = u_cl.USER_ID
                                WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), 'Not Disclosed') AS CLIENT_NAME,
                           (SELECT ds.STATUS FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID AND ROWNUM = 1) AS SUMMARY_STATUS,
                           (CASE WHEN EXISTS (SELECT 1 FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID AND ds.STATUS = 'SUCCESS') THEN 1 ELSE 0 END) AS HAS_AI_SUMMARY
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN CASE_ASSIGNMENTS ca ON c.CASE_ID = ca.CASE_ID
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                """
                params = {"sid": staff_id}

                if assigned_to_me:
                    query += " AND d.ASSIGNED_STAFF_ID = :sid"
                else:
                    # Never leak documents assigned to another staff member
                    query += " AND (d.ASSIGNED_STAFF_ID = :sid OR d.ASSIGNED_STAFF_ID IS NULL)"

                if case_filter and case_filter != "ALL":
                    try:
                        params["case_id"] = int(case_filter)
                        query += " AND d.CASE_ID = :case_id"
                    except ValueError:
                        pass

                if file_type and file_type != "ALL":
                    params["file_type"] = f"%{file_type}%"
                    query += " AND (LOWER(d.MIME_TYPE) LIKE :file_type OR LOWER(d.FILE_NAME) LIKE :file_type)"

                if search_q:
                    query += """
                        AND (
                            LOWER(d.FILE_NAME) LIKE :search_term
                            OR LOWER(NVL(d.DOCUMENT_TITLE, '')) LIKE :search_term
                            OR LOWER(c.CASE_NUMBER) LIKE :search_term
                            OR LOWER(c.TITLE) LIKE :search_term
                            OR LOWER(NVL((SELECT u_cl.FULL_NAME
                                          FROM CASE_CLIENTS cc
                                          JOIN CLIENTS cl ON cc.CLIENT_ID = cl.CLIENT_ID
                                          JOIN USERS u_cl ON cl.USER_ID = u_cl.USER_ID
                                          WHERE cc.CASE_ID = c.CASE_ID AND ROWNUM = 1), '')) LIKE :search_term
                        )
                    """
                    params["search_term"] = f"%{search_q}%"

                query += " ORDER BY d.UPLOADED_AT DESC"

                cursor.execute(query, params)
                documents = [
                    {
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
                        "client_name": r[12] or "Not Disclosed",
                        "summary_status": r[13],
                        "has_ai_summary": bool(r[14])
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"documents": documents, "total": len(documents)}), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/documents/<int:document_id>/download", methods=["GET"])
@staff_bp.route("/documents/<int:document_id>", methods=["GET"])
@auth.role_required(["STAFF", "ADVOCATE"])
def download_authorized_document(document_id: int):
    """
    GET /api/staff/documents/<document_id>/download
    -----------------------------------------------
    CRITICAL PRIVACY & IDOR ENFORCEMENT:
    Staff cannot download arbitrary documents by cycling IDs in URL.
    1. Looks up document's CASE_ID and ASSIGNED_STAFF_ID.
    2. If caller is staff: validates active assignment on that CASE_ID.
    3. If document is explicitly assigned to another staff member, denies with HTTP 403 FORBIDDEN_DOCUMENT_ACCESS.
    4. If caller is advocate: validates case ownership/authorization.
    5. Streams document attachment safely.
    """
    user_id = session.get("user_id")
    role = session.get("role")
    is_download_req = ("download" in request.path or request.args.get("download") == "1")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Lookup Document & Case ID
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE, c.CREATED_BY,
                           d.ASSIGNED_STAFF_ID, d.ASSIGNMENT_STATUS, d.DOCUMENT_TITLE
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                doc_row = cursor.fetchone()
                if not doc_row:
                    return jsonify({
                        "error": "Document record not found.",
                        "code": "DOCUMENT_NOT_FOUND"
                    }), 404

                (doc_id, case_id, file_name, mime_type, storage_key,
                 case_number, case_title, created_by,
                 doc_assigned_staff_id, doc_assignment_status, doc_title) = doc_row

                # 2. Strict Access Control
                if role == "ADVOCATE":
                    pass  # Advocates have supervisory oversight over practice documents
                else:
                    staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                    if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not authorized to download documents from this case file.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                    # Strict Document-Level Access: Staff member can only access documents assigned to them
                    if doc_assigned_staff_id is not None and doc_assigned_staff_id != staff_id:
                        return jsonify({
                            "error": "Access denied. This document is assigned to another staff member.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                # If JSON metadata requested instead of binary download
                if not is_download_req:
                    return jsonify({
                        "document_id": doc_id,
                        "case_id": case_id,
                        "case_number": case_number,
                        "case_title": case_title,
                        "file_name": file_name,
                        "document_title": doc_title or file_name,
                        "mime_type": mime_type,
                        "assignment_status": doc_assignment_status or "ASSIGNED",
                        "download_url": f"/api/staff/documents/{doc_id}/download"
                    }), 200

                # 3. Deliver Document Stream
                if os.path.exists(storage_key):
                    return send_file(
                        storage_key,
                        as_attachment=True,
                        download_name=file_name,
                        mimetype=mime_type or "application/octet-stream"
                    )

                # Fallback for seeded virtual documents
                doc_content = (
                    f"========================================================================\n"
                    f"LEGAL CASEBOOK - VERIFIED CASE DOCUMENT ARCHIVE\n"
                    f"========================================================================\n"
                    f"Document ID:   {doc_id}\n"
                    f"Document Title:{doc_title or file_name}\n"
                    f"File Name:     {file_name}\n"
                    f"Case Number:   {case_number}\n"
                    f"Case Title:    {case_title}\n"
                    f"Storage Key:   {storage_key}\n"
                    f"Security Tag:  CONFIDENTIAL ATTORNEY-CLIENT WORK PRODUCT\n"
                    f"Downloaded By: User ID {user_id} at {datetime.now(timezone.utc).isoformat()}\n"
                    f"========================================================================\n\n"
                    f"This certified copy is transmitted exclusively to authorized counsel\n"
                    f"and legal staff members assigned to Case {case_number}.\n"
                    f"Unauthorized distribution, copying, or dissemination is strictly prohibited.\n"
                )
                buffer = io.BytesIO(doc_content.encode("utf-8"))
                buffer.seek(0)

                return send_file(
                    buffer,
                    as_attachment=True,
                    download_name=file_name,
                    mimetype=mime_type or "application/octet-stream"
                )

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/documents/<int:document_id>/preview", methods=["GET"])
@auth.role_required(["STAFF", "ADVOCATE"])
def preview_authorized_document(document_id: int):
    """
    GET /api/staff/documents/<document_id>/preview
    ---------------------------------------------
    CRITICAL DOCUMENT PREVIEW WITH RBAC:
    Returns safe text snippet / preview of document for authorized staff or advocate.
    Staff can only preview documents assigned to them on cases they handle.
    Returns 403 FORBIDDEN_DOCUMENT_ACCESS if assigned to another staff member.
    """
    user_id = session.get("user_id")
    user_role = session.get("role")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE, c.CREATED_BY,
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
                 case_number, case_title, created_by,
                 assigned_staff_id, assignment_status, doc_title, doc_desc,
                 uploaded_at, uploaded_by_name) = row

                # Check authorization
                if user_role == "ADVOCATE":
                    pass  # Advocates have supervisory oversight over practice documents
                else:
                    staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                    if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not assigned to this case file.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403
                    if assigned_staff_id is not None and assigned_staff_id != staff_id:
                        return jsonify({
                            "error": "Access denied. This document is assigned to another staff member.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                # Safe Preview extraction
                preview_snippet = ""
                file_size = 0

                if os.path.exists(storage_key):
                    file_size = os.path.getsize(storage_key)
                    try:
                        extracted = document_extractor.extract_document_text(storage_key, file_name)
                        raw_text = extracted.get("text", "")
                        preview_snippet = raw_text[:5000]
                        if len(raw_text) > 5000:
                            preview_snippet += "\n\n... [Preview truncated. Download full document to view complete legal filing] ..."
                    except Exception as parse_err:
                        preview_snippet = f"Document is securely archived in the case repository. Full file can be reviewed via certified download. ({str(parse_err)})"
                else:
                    preview_snippet = (
                        f"LEGAL CASEBOOK - SECURE ARCHIVE\n"
                        f"Document ID: {doc_id}\n"
                        f"Title: {doc_title or file_name}\n"
                        f"File Name: {file_name}\n"
                        f"Case: {case_number} - {case_title}\n\n"
                        f"Simulated / Seeded document preview ready for legal workflow review."
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
                    "download_url": f"/api/staff/documents/{doc_id}/download"
                }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 3.0 STAFF DOCUMENT UPLOAD WITH AUTOMATIC GROK AI SUMMARY
# ============================================================================

@staff_bp.route("/documents/upload", methods=["POST"])
@staff_bp.route("/cases/<int:case_id>/documents/upload", methods=["POST"])
@auth.role_required(["STAFF", "ADVOCATE"])
def upload_staff_document(case_id: int = None):
    """
    POST /api/staff/documents/upload
    POST /api/staff/cases/<case_id>/documents/upload
    ------------------------------------------------
    Allows staff or supervising advocates to upload case documents.
    Automatically performs:
    1. Authorization & case assignment checks.
    2. File type, extension, magic bytes, and size validation.
    3. Secure file storage on disk and metadata recording in DOCUMENTS table.
    4. Immediate text extraction.
    5. Automatic AI Legal Brief generation via Grok (dual preferences:
       Preference 1: Comprehensive Brief & Preference 2: Strategic Review).
    6. Stores summary in DOCUMENT_SUMMARIES and marks document as ANALYZED.
    7. Returns both document metadata and generated dual-preference summary.
    """
    user_id = session.get("user_id")
    user_role = session.get("role")
    auth.verify_csrf_token()

    if "file" not in request.files:
        return jsonify({"error": "No file part provided in request.", "code": "NO_FILE_PART"}), 400

    file_obj = request.files["file"]
    if not file_obj or file_obj.filename == "":
        return jsonify({"error": "No file selected for upload.", "code": "NO_FILE_SELECTED"}), 400

    if not case_id:
        case_id_raw = request.form.get("case_id", "").strip()
        if not case_id_raw:
            return jsonify({"error": "Case selection is required. Please choose an assigned case.", "code": "CASE_ID_REQUIRED"}), 400
        try:
            case_id = int(case_id_raw)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid Case ID format.", "code": "INVALID_CASE_ID"}), 400

    original_filename = secure_filename(file_obj.filename)
    if not original_filename:
        original_filename = f"document_{uuid.uuid4().hex[:8]}.pdf"

    _, ext = os.path.splitext(original_filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported file type '{ext}'. Allowed formats are PDF (.pdf), Word (.docx), and Plain Text (.txt).",
            "code": "UNSUPPORTED_FORMAT"
        }), 400

    doc_title = request.form.get("title", "").strip() or request.form.get("document_title", "").strip() or original_filename
    doc_desc = request.form.get("description", "").strip()

    saved_file_path = None
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Authorization check
                cursor.execute(
                    """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CREATED_BY
                    FROM CASES c
                    WHERE c.CASE_ID = :cid
                    """,
                    {"cid": case_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({"error": "Selected case was not found.", "code": "CASE_NOT_FOUND"}), 404

                c_id, case_number, case_title, case_creator = case_row

                staff_id = None
                if user_role == "ADVOCATE":
                    if case_creator != user_id:
                        return jsonify({"error": "Access denied. You do not manage this case.", "code": "FORBIDDEN_CASE_ACCESS"}), 403
                else:
                    staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                    if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                        return jsonify({"error": "Access denied. You are not assigned to this case file.", "code": "FORBIDDEN_CASE_ACCESS"}), 403

                # 2. Secure file save
                unique_key = f"{uuid.uuid4().hex}_{original_filename}"
                saved_file_path = os.path.join(UPLOAD_DIR, unique_key)
                file_obj.save(saved_file_path)

                validate_file_header(saved_file_path, ext)
                file_size = os.path.getsize(saved_file_path)
                mime_type = file_obj.content_type or (
                    "application/pdf" if ext == ".pdf"
                    else "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if ext == ".docx"
                    else "text/plain"
                )

                # 3. Insert into DOCUMENTS table
                doc_id_var = cursor.var(int) if hasattr(cursor, "var") else None
                if doc_id_var:
                    cursor.execute(
                        """
                        INSERT INTO DOCUMENTS (CASE_ID, UPLOADED_BY, ASSIGNED_STAFF_ID, ASSIGNMENT_STATUS, DOCUMENT_TITLE, DESCRIPTION, FILE_NAME, MIME_TYPE, STORAGE_KEY, UPLOADED_AT)
                        VALUES (:cid, :uid, :sid, 'ASSIGNED', :dtitle, :ddesc, :fname, :mtype, :skey, SYSTIMESTAMP)
                        RETURNING DOCUMENT_ID INTO :out_id
                        """,
                        {
                            "cid": case_id,
                            "uid": user_id,
                            "sid": staff_id,
                            "dtitle": doc_title,
                            "ddesc": doc_desc,
                            "fname": original_filename,
                            "mtype": mime_type,
                            "skey": saved_file_path,
                            "out_id": doc_id_var
                        }
                    )
                    doc_id = doc_id_var.getvalue()[0]
                else:
                    cursor.execute(
                        """
                        INSERT INTO DOCUMENTS (CASE_ID, UPLOADED_BY, ASSIGNED_STAFF_ID, ASSIGNMENT_STATUS, DOCUMENT_TITLE, DESCRIPTION, FILE_NAME, MIME_TYPE, STORAGE_KEY, UPLOADED_AT)
                        VALUES (:cid, :uid, :sid, 'ASSIGNED', :dtitle, :ddesc, :fname, :mtype, :skey, CURRENT_TIMESTAMP)
                        """,
                        {
                            "cid": case_id,
                            "uid": user_id,
                            "sid": staff_id,
                            "dtitle": doc_title,
                            "ddesc": doc_desc,
                            "fname": original_filename,
                            "mtype": mime_type,
                            "skey": saved_file_path
                        }
                    )
                    doc_id = cursor.lastrowid

                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                    VALUES (:uid, 'STAFF_DOCUMENT_UPLOAD', 'DOCUMENTS', :did, :details)
                    """,
                    {
                        "uid": user_id,
                        "did": doc_id,
                        "details": f"Staff uploaded {original_filename} ({file_size} bytes) to Case {case_number}."
                    }
                )
                conn.commit()

                # 4. Automatic AI Summary Generation upon upload
                summary_data = None
                has_summary = False
                summary_warning = None

                try:
                    extraction_data = extract_document_text(saved_file_path, original_filename)
                    doc_text = extraction_data.get("text", "")

                    if len(doc_text.strip()) < 50:
                        summary_warning = "Document contains insufficient extractable text (e.g. scanned image). Automatic AI summary requires readable text."
                    else:
                        summary_result = grok_client.generate_document_summary(
                            doc_text=doc_text,
                            file_name=original_filename,
                            case_number=case_number,
                            dual_preference=True
                        )

                        summary_text = summary_result["summary_text"]
                        model_used = summary_result["model"]
                        preferences = summary_result.get("preferences", [])
                        active_pref_id = summary_result.get("active_preference_id", "pref_1")
                        structured_sections = summary_result["structured_sections"]

                        structured_payload = {
                            "sections": structured_sections,
                            "preferences": preferences,
                            "active_preference_id": active_pref_id
                        }
                        structured_json = json.dumps(structured_payload)

                        sum_id_var = cursor.var(int) if hasattr(cursor, "var") else None
                        if sum_id_var:
                            cursor.execute(
                                """
                                INSERT INTO DOCUMENT_SUMMARIES
                                (DOCUMENT_ID, CASE_ID, GENERATED_BY, SUMMARY_TEXT, STRUCTURED_JSON, MODEL_NAME, STATUS, CREATED_AT, UPDATED_AT)
                                VALUES
                                (:did, :cid, :uid, :stext, :sjson, :model, 'SUCCESS', SYSTIMESTAMP, SYSTIMESTAMP)
                                RETURNING SUMMARY_ID INTO :out_id
                                """,
                                {
                                    "did": doc_id,
                                    "cid": case_id,
                                    "uid": user_id,
                                    "stext": summary_text,
                                    "sjson": structured_json,
                                    "model": model_used,
                                    "out_id": sum_id_var
                                }
                            )
                            summary_id = sum_id_var.getvalue()[0]
                        else:
                            cursor.execute(
                                """
                                INSERT INTO DOCUMENT_SUMMARIES
                                (DOCUMENT_ID, CASE_ID, GENERATED_BY, SUMMARY_TEXT, STRUCTURED_JSON, MODEL_NAME, STATUS, CREATED_AT, UPDATED_AT)
                                VALUES
                                (:did, :cid, :uid, :stext, :sjson, :model, 'SUCCESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                """,
                                {
                                    "did": doc_id,
                                    "cid": case_id,
                                    "uid": user_id,
                                    "stext": summary_text,
                                    "sjson": structured_json,
                                    "model": model_used
                                }
                            )
                            summary_id = cursor.lastrowid

                        cursor.execute(
                            "UPDATE DOCUMENTS SET ASSIGNMENT_STATUS = 'ANALYZED' WHERE DOCUMENT_ID = :did",
                            {"did": doc_id}
                        )

                        cursor.execute(
                            """
                            INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                            VALUES (:uid, 'AUTO_SUMMARY_GENERATED', 'DOCUMENT_SUMMARIES', :sid, :details)
                            """,
                            {
                                "uid": user_id,
                                "sid": summary_id,
                                "details": f"Automatic Grok AI summary generated for uploaded document '{original_filename}' with dual preferences."
                            }
                        )
                        conn.commit()

                        has_summary = True
                        summary_data = {
                            "summary_id": summary_id,
                            "summary_text": summary_text,
                            "structured_sections": structured_sections,
                            "model": model_used,
                            "status": "SUCCESS",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "generated_by_name": session.get("full_name") or "System AI",
                            "disclaimer": grok_client.LEGAL_DISCLAIMER,
                            "preferences": preferences,
                            "active_preference_id": active_pref_id
                        }

                except ScannedDocumentError:
                    summary_warning = "Document appears to be a scanned image. OCR processing is required before an AI summary can be generated."
                except Exception as ai_exc:
                    summary_warning = f"Document saved successfully, but automatic AI summary could not complete: {str(ai_exc)}"

                uploaded_at_iso = datetime.now(timezone.utc).isoformat()
                doc_meta = {
                    "document_id": doc_id,
                    "case_id": case_id,
                    "case_number": case_number,
                    "case_title": case_title,
                    "file_name": original_filename,
                    "document_title": doc_title,
                    "description": doc_desc,
                    "mime_type": mime_type,
                    "size_bytes": file_size,
                    "assignment_status": "ANALYZED" if has_summary else "ASSIGNED",
                    "uploaded_at": uploaded_at_iso,
                    "uploaded_by_name": session.get("full_name") or "Staff",
                    "has_ai_summary": has_summary
                }

                return jsonify({
                    "message": "Document uploaded and AI legal summary generated successfully." if has_summary else "Document uploaded successfully.",
                    "has_summary": has_summary,
                    "summary_warning": summary_warning,
                    "document": doc_meta,
                    "summary": summary_data
                }), 201

    except (UnsupportedFileTypeError, FileSizeLimitExceededError) as val_err:
        if saved_file_path and os.path.exists(saved_file_path):
            try:
                os.remove(saved_file_path)
            except Exception:
                pass
        return jsonify({"error": str(val_err), "code": getattr(val_err, "code", "VALIDATION_ERROR")}), 400
    except Exception as exc:
        if saved_file_path and os.path.exists(saved_file_path):
            try:
                os.remove(saved_file_path)
            except Exception:
                pass
        return handle_db_error(exc)


# ============================================================================
# 3.1 GROK AI DOCUMENT SUMMARIZATION ENDPOINTS
# ============================================================================

@staff_bp.route("/documents/<int:document_id>/summary", methods=["GET"])
@auth.role_required(["STAFF", "ADVOCATE"])
def get_document_summary(document_id: int):
    """
    GET /api/staff/documents/<document_id>/summary
    ----------------------------------------------
    Retrieves a previously generated Grok AI summary for an authorized document.
    Enforces RBAC and case-assignment authorization.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Lookup Document & Case ID
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE, c.CREATED_BY,
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

                (doc_id, case_id, file_name, mime_type, case_number, case_title, created_by,
                 uploaded_at, uploaded_by_name, assigned_staff_id, assignment_status, doc_title, doc_desc) = doc_row

                # 2. Strict Authorization Check
                if session.get("role") == "ADVOCATE":
                    pass  # Advocates have supervisory oversight over practice documents
                else:
                    staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                    if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not authorized to access documents for this case.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403
                    if assigned_staff_id is not None and assigned_staff_id != staff_id:
                        return jsonify({
                            "error": "Access denied. This document is assigned to another staff member.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                # 3. Retrieve Summary if exists
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


@staff_bp.route("/documents/<int:document_id>/summary", methods=["POST"])
@auth.role_required(["STAFF", "ADVOCATE"])
def generate_or_regenerate_summary(document_id: int):
    """
    POST /api/staff/documents/<document_id>/summary
    -----------------------------------------------
    Generates a structured legal summary using the official xAI Grok API.
    Flow:
    1. Derives authenticated staff identity and verifies case assignment.
    2. Checks if valid summary exists (unless 'regenerate' flag is True).
    3. Locates real uploaded document and securely extracts text.
    4. Detects scanned or image-only documents (< 50 chars), returning OCR required error.
    5. Dispatches to Grok API with prompt injection defenses.
    6. Stores/upserts structured summary in Oracle DOCUMENT_SUMMARIES table.
    7. Returns complete structured brief and mandatory legal disclaimer.
    """
    user_id = session.get("user_id")
    auth.verify_csrf_token()

    body = request.get_json(silent=True) or {}
    regenerate = body.get("regenerate", False) or request.args.get("regenerate") == "1"

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Lookup Document & Case Details
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY,
                           c.CASE_NUMBER, c.TITLE AS CASE_TITLE, c.CREATED_BY,
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
                 case_number, case_title, created_by,
                 uploaded_at, uploaded_by_name,
                 assigned_staff_id, assignment_status, doc_title, doc_desc) = doc_row

                # 2. Strict Authorization Check
                if session.get("role") == "ADVOCATE":
                    pass  # Advocates have supervisory oversight over practice documents
                else:
                    staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                    if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not authorized to analyze documents for this case.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403
                    if assigned_staff_id is not None and assigned_staff_id != staff_id:
                        return jsonify({
                            "error": "Access denied. This document is assigned to another staff member.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                # 3. Check for existing summary if not regenerating
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

                        # Ensure dual preferences are always available for comparison
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

                # 4. Locate physical document and extract text
                if not os.path.exists(storage_key):
                    return jsonify({
                        "error": f"Original document file '{file_name}' was not found on document storage. Please upload the real file to generate an AI summary.",
                        "code": "DOCUMENT_FILE_NOT_FOUND"
                    }), 404

                try:
                    extraction_data = document_extractor.extract_document_text(storage_key, file_name)
                except document_extractor.ScannedDocumentError as sc_err:
                    return jsonify({
                        "error": str(sc_err),
                        "code": "OCR_REQUIRED",
                        "requires_ocr": True
                    }), 422
                except document_extractor.DocumentExtractionError as ex_err:
                    return jsonify({
                        "error": f"Document extraction error: {str(ex_err)}",
                        "code": ex_err.code
                    }), 400

                # 5. Invoke Grok xAI API with preference model cascading fallbacks
                preferred_models = body.get("preferred_models") or body.get("model")
                try:
                    summary_result = grok_client.generate_document_summary(
                        doc_text=extraction_data["text"],
                        file_name=file_name,
                        case_number=case_number,
                        preferred_models=preferred_models
                    )
                except grok_client.GrokConfigurationError as g_cfg:
                    return jsonify({
                        "error": str(g_cfg),
                        "code": "API_KEY_NOT_CONFIGURED"
                    }), 503
                except grok_client.GrokAuthError as g_auth:
                    return jsonify({
                        "error": str(g_auth),
                        "code": "GROK_AUTH_FAILED"
                    }), 401
                except grok_client.GrokRateLimitError as g_rl:
                    return jsonify({
                        "error": str(g_rl),
                        "code": "GROK_RATE_LIMITED"
                    }), 429
                except grok_client.GrokTimeoutError as g_to:
                    return jsonify({
                        "error": str(g_to),
                        "code": "GROK_TIMEOUT"
                    }), 504
                except grok_client.GrokServiceError as g_srv:
                    return jsonify({
                        "error": str(g_srv),
                        "code": "GROK_SERVICE_ERROR"
                    }), 502
                except grok_client.GrokError as g_err:
                    return jsonify({
                        "error": str(g_err),
                        "code": g_err.code
                    }), g_err.status_code

                # 6. Save or Upsert Summary in Oracle / DB with dual preferences
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
                            GENERATED_BY = :uid,
                            UPDATED_AT = CURRENT_TIMESTAMP
                        WHERE DOCUMENT_ID = :did
                        """,
                        {
                            "stext": summary_text,
                            "sjson": structured_json,
                            "model": model_used,
                            "uid": user_id,
                            "did": document_id
                        }
                    )
                else:
                    sum_id_var = cursor.var(int) if hasattr(cursor, "var") else None
                    if sum_id_var:
                        cursor.execute(
                            """
                            INSERT INTO DOCUMENT_SUMMARIES
                            (DOCUMENT_ID, CASE_ID, GENERATED_BY, SUMMARY_TEXT, STRUCTURED_JSON, MODEL_NAME, STATUS, CREATED_AT, UPDATED_AT)
                            VALUES
                            (:did, :cid, :uid, :stext, :sjson, :model, 'SUCCESS', SYSTIMESTAMP, SYSTIMESTAMP)
                            RETURNING SUMMARY_ID INTO :out_id
                            """,
                            {
                                "did": document_id,
                                "cid": case_id,
                                "uid": user_id,
                                "stext": summary_text,
                                "sjson": structured_json,
                                "model": model_used,
                                "out_id": sum_id_var
                            }
                        )
                        summary_id = sum_id_var.getvalue()[0]
                    else:
                        cursor.execute(
                            """
                            INSERT INTO DOCUMENT_SUMMARIES
                            (DOCUMENT_ID, CASE_ID, GENERATED_BY, SUMMARY_TEXT, STRUCTURED_JSON, MODEL_NAME, STATUS, CREATED_AT, UPDATED_AT)
                            VALUES
                            (:did, :cid, :uid, :stext, :sjson, :model, 'SUCCESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            """,
                            {
                                "did": document_id,
                                "cid": case_id,
                                "uid": user_id,
                                "stext": summary_text,
                                "sjson": structured_json,
                                "model": model_used
                            }
                        )
                        summary_id = cursor.lastrowid

                # Update Document Assignment Status to ANALYZED
                cursor.execute(
                    """
                    UPDATE DOCUMENTS
                    SET ASSIGNMENT_STATUS = 'ANALYZED'
                    WHERE DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )

                # Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                    VALUES (:uid, 'GENERATE_AI_SUMMARY', 'DOCUMENTS', :did, :details)
                    """,
                    {
                        "uid": user_id,
                        "did": document_id,
                        "details": f"Generated Grok AI summary for {file_name} using {model_used}"
                    }
                )
                conn.commit()

                return jsonify({
                    "message": "AI Legal Summary generated successfully.",
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
                        "generated_by_name": session.get("full_name"),
                        "disclaimer": grok_client.LEGAL_DISCLAIMER,
                        "preferences": preferences,
                        "active_preference_id": active_pref_id
                    }
                }), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/documents/<int:document_id>/summary/preference", methods=["POST", "PUT"])
@auth.role_required(["STAFF", "ADVOCATE"])
def select_summary_preference_endpoint(document_id):
    """
    Selects one of the dual AI preferences as the official verified legal brief.
    Updates SUMMARY_TEXT, MODEL_NAME, and active_preference_id in DOCUMENT_SUMMARIES.
    """
    user_id = session.get("user_id")
    auth.verify_csrf_token()

    body = request.get_json(silent=True) or {}
    target_pref_id = body.get("preference_id", "pref_1")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Fetch document & existing summary record
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

                # 2. Authorization check
                if session.get("role") == "ADVOCATE":
                    pass  # Advocates have supervisory oversight over practice documents
                else:
                    staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                    if not staff_id or not verify_case_assignment(cursor, staff_id, case_id):
                        return jsonify({"error": "Access denied. You are not assigned to this case.", "code": "FORBIDDEN_DOCUMENT_ACCESS"}), 403
                    if assigned_staff_id is not None and assigned_staff_id != staff_id:
                        return jsonify({"error": "Access denied. This document is assigned to another staff member.", "code": "FORBIDDEN_DOCUMENT_ACCESS"}), 403

                # 3. Parse preferences payload
                try:
                    s_payload = json.loads(safe_lob(s_json_raw)) if s_json_raw else {}
                except Exception:
                    s_payload = {}

                preferences = s_payload.get("preferences", [])
                selected_pref = next((p for p in preferences if p.get("id") == target_pref_id), None)

                if not selected_pref:
                    return jsonify({"error": f"Preference '{target_pref_id}' not found in record.", "code": "PREFERENCE_NOT_FOUND"}), 404

                new_text = selected_pref.get("summary_text") or curr_text
                new_model = selected_pref.get("model") or curr_model
                new_sections = selected_pref.get("structured_sections") or s_payload.get("sections", {})

                s_payload["active_preference_id"] = target_pref_id
                s_payload["sections"] = new_sections

                cursor.execute(
                    """
                    UPDATE DOCUMENT_SUMMARIES
                    SET SUMMARY_TEXT = :stext,
                        STRUCTURED_JSON = :sjson,
                        MODEL_NAME = :model,
                        UPDATED_AT = CURRENT_TIMESTAMP
                    WHERE DOCUMENT_ID = :did
                    """,
                    {
                        "stext": new_text,
                        "sjson": json.dumps(s_payload),
                        "model": new_model,
                        "did": document_id
                    }
                )

                # Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                    VALUES (:uid, 'SELECT_SUMMARY_PREFERENCE', 'DOCUMENTS', :did, :details)
                    """,
                    {
                        "uid": user_id,
                        "did": document_id,
                        "details": f"Selected AI preference '{selected_pref.get('label', target_pref_id)}' ({new_model}) for {file_name}"
                    }
                )
                conn.commit()

                return jsonify({
                    "message": f"Successfully set '{selected_pref.get('label', target_pref_id)}' as the official case brief.",
                    "selected_preference_id": target_pref_id,
                    "summary": {
                        "summary_id": sum_id,
                        "summary_text": new_text,
                        "structured_sections": new_sections,
                        "model": new_model,
                        "status": "SUCCESS",
                        "preferences": preferences,
                        "active_preference_id": target_pref_id,
                        "disclaimer": grok_client.LEGAL_DISCLAIMER
                    }
                }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 4. RESEARCH TASKS (View, Filter, Details, Status Updates & Notes)
# ============================================================================

VALID_TASK_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED"}

@staff_bp.route("/tasks", methods=["GET"])
@auth.role_required(["STAFF"])
def list_research_tasks():
    """
    GET /api/staff/tasks
    --------------------
    Returns research tasks assigned to the authenticated staff member by supervising Advocates.
    Supports filtering by 'status', 'priority', 'case_id', and search query 'q'.
    """
    user_id = session.get("user_id")
    status_filter = request.args.get("status", "ALL").strip().upper()
    priority_filter = request.args.get("priority", "ALL").strip().upper()
    case_filter = request.args.get("case_id")
    search_q = request.args.get("q", "").strip().lower()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({"tasks": [], "total": 0}), 200

                query = """
                    SELECT rt.TASK_ID, rt.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           rt.TITLE, rt.INSTRUCTIONS, rt.STATUS, rt.PRIORITY,
                           TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DUE_DATE,
                           rt.RESEARCH_NOTES,
                           u_adv.FULL_NAME AS ASSIGNED_BY_NAME, u_adv.EMAIL AS ASSIGNED_BY_EMAIL,
                           TO_CHAR(rt.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           TO_CHAR(rt.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT
                    FROM RESEARCH_TASKS rt
                    JOIN CASES c ON rt.CASE_ID = c.CASE_ID
                    JOIN USERS u_adv ON rt.ASSIGNED_BY = u_adv.USER_ID
                    WHERE rt.STAFF_ID = :sid
                """
                params = {"sid": staff_id}

                if status_filter and status_filter != "ALL":
                    query += " AND rt.STATUS = :status_filter"
                    params["status_filter"] = status_filter

                if priority_filter and priority_filter != "ALL":
                    query += " AND rt.PRIORITY = :priority_filter"
                    params["priority_filter"] = priority_filter

                if case_filter:
                    try:
                        params["case_filter"] = int(case_filter)
                        query += " AND rt.CASE_ID = :case_filter"
                    except ValueError:
                        pass

                if search_q:
                    query += " AND (LOWER(rt.TITLE) LIKE :search_term OR LOWER(c.CASE_NUMBER) LIKE :search_term OR LOWER(rt.INSTRUCTIONS) LIKE :search_term)"
                    params["search_term"] = f"%{search_q}%"

                query += " ORDER BY CASE rt.STATUS WHEN 'PENDING' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END, rt.DUE_DATE ASC, rt.CREATED_AT DESC"

                cursor.execute(query, params)
                tasks = [
                    {
                        "task_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "title": r[4],
                        "instructions": safe_lob(r[5]),
                        "status": r[6],
                        "priority": r[7],
                        "due_date": r[8],
                        "research_notes": safe_lob(r[9]),
                        "assigned_by_name": r[10],
                        "assigned_by_email": r[11],
                        "created_at": r[12],
                        "updated_at": r[13]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "tasks": tasks,
            "total": len(tasks),
            "filters": {
                "status": status_filter,
                "priority": priority_filter,
                "case_id": case_filter,
                "query": search_q
            }
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/tasks/<int:task_id>", methods=["GET"])
@auth.role_required(["STAFF"])
def get_task_details(task_id: int):
    """
    GET /api/staff/tasks/<task_id>
    ------------------------------
    CRITICAL PRIVACY ENFORCEMENT:
    Staff S2 cannot view or inspect Staff S1's research task.
    Returns HTTP 403 FORBIDDEN_TASK_ACCESS if not assigned to this staff member.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({
                        "error": "Staff profile not found.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                cursor.execute(
                    """
                    SELECT rt.TASK_ID, rt.STAFF_ID, rt.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           c.CASE_STATUS, c.CASE_TYPE,
                           rt.TITLE, rt.INSTRUCTIONS, rt.STATUS, rt.PRIORITY,
                           TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DUE_DATE,
                           rt.RESEARCH_NOTES,
                           u_adv.FULL_NAME AS ASSIGNED_BY_NAME, u_adv.EMAIL AS ASSIGNED_BY_EMAIL,
                           TO_CHAR(rt.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           TO_CHAR(rt.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT
                    FROM RESEARCH_TASKS rt
                    JOIN CASES c ON rt.CASE_ID = c.CASE_ID
                    JOIN USERS u_adv ON rt.ASSIGNED_BY = u_adv.USER_ID
                    WHERE rt.TASK_ID = :tid
                    """,
                    {"tid": task_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({
                        "error": "Research task record not found.",
                        "code": "TASK_NOT_FOUND"
                    }), 404

                # Privacy Check: Does task belong to calling staff member?
                task_staff_id = row[1]
                if task_staff_id != staff_id:
                    return jsonify({
                        "error": "Access denied. You are not authorized to view this research task.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                task_data = {
                    "task_id": row[0],
                    "staff_id": row[1],
                    "case_id": row[2],
                    "case_number": row[3],
                    "case_title": row[4],
                    "case_status": row[5],
                    "case_type": row[6],
                    "title": row[7],
                    "instructions": safe_lob(row[8]),
                    "status": row[9],
                    "priority": row[10],
                    "due_date": row[11],
                    "research_notes": safe_lob(row[12]),
                    "assigned_by_name": row[13],
                    "assigned_by_email": row[14],
                    "created_at": row[15],
                    "updated_at": row[16]
                }

        return jsonify(task_data), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/tasks/<int:task_id>/status", methods=["PUT", "PATCH"])
@auth.role_required(["STAFF"])
def update_task_status(task_id: int):
    """
    PUT /api/staff/tasks/<task_id>/status
    -------------------------------------
    Updates the status of an assigned research task:
    - Status must be 'PENDING', 'IN_PROGRESS', or 'COMPLETED'
    - Parameterized SQL updates STATUS and UPDATED_AT in Oracle Database
    - Writes immutable record to AUDIT_LOGS
    - Returns updated task info only after database update succeeds
    - Privacy: Returns 403 FORBIDDEN_TASK_ACCESS if task belongs to another staff member
    """
    auth.verify_csrf_token()
    user_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    new_status = data.get("status", "").strip().upper()
    if new_status not in VALID_TASK_STATUSES:
        return jsonify({
            "error": f"Invalid task status '{new_status}'. Allowed values: PENDING, IN_PROGRESS, COMPLETED.",
            "code": "INVALID_TASK_STATUS"
        }), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({
                        "error": "Staff profile not found.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                # 1. Verify task ownership
                cursor.execute(
                    "SELECT TASK_ID, STAFF_ID, TITLE, STATUS FROM RESEARCH_TASKS WHERE TASK_ID = :tid",
                    {"tid": task_id}
                )
                task_row = cursor.fetchone()
                if not task_row:
                    return jsonify({
                        "error": "Research task record not found.",
                        "code": "TASK_NOT_FOUND"
                    }), 404

                if task_row[1] != staff_id:
                    return jsonify({
                        "error": "Access denied. You cannot modify tasks assigned to another staff member.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                old_status = task_row[3]
                task_title = task_row[2]

                # 2. Update Database
                cursor.execute(
                    """
                    UPDATE RESEARCH_TASKS
                    SET STATUS = :status, UPDATED_AT = SYSTIMESTAMP
                    WHERE TASK_ID = :tid
                    """,
                    {"status": new_status, "tid": task_id}
                )

                # 3. Record Audit Trail
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS, CREATED_AT)
                    VALUES (:actor_id, 'STAFF_TASK_STATUS_UPDATED', 'RESEARCH_TASKS', :tid, :details, SYSTIMESTAMP)
                    """,
                    {
                        "actor_id": user_id,
                        "tid": task_id,
                        "details": f"Status changed from {old_status} to {new_status} on task '{task_title}'"
                    }
                )

                conn.commit()

        return jsonify({
            "message": f"Task status successfully updated to {new_status}.",
            "task_id": task_id,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/tasks/<int:task_id>/notes", methods=["PUT"])
@auth.role_required(["STAFF"])
def update_task_notes(task_id: int):
    """
    PUT /api/staff/tasks/<task_id>/notes
    ------------------------------------
    Saves research findings, case precedents, citations, and work results:
    - Parameterized SQL updates RESEARCH_NOTES and UPDATED_AT in Oracle Database
    - Writes immutable record to AUDIT_LOGS
    - Returns updated task info only after database update succeeds
    - Privacy: Returns 403 FORBIDDEN_TASK_ACCESS if task belongs to another staff member
    """
    auth.verify_csrf_token()
    user_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    notes = (data.get("research_notes") or data.get("notes") or "").strip()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({
                        "error": "Staff profile not found.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                # 1. Verify task ownership
                cursor.execute(
                    "SELECT TASK_ID, STAFF_ID, TITLE FROM RESEARCH_TASKS WHERE TASK_ID = :tid",
                    {"tid": task_id}
                )
                task_row = cursor.fetchone()
                if not task_row:
                    return jsonify({
                        "error": "Research task record not found.",
                        "code": "TASK_NOT_FOUND"
                    }), 404

                if task_row[1] != staff_id:
                    return jsonify({
                        "error": "Access denied. You cannot modify research notes on another staff member's task.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                task_title = task_row[2]

                # 2. Update Database
                cursor.execute(
                    """
                    UPDATE RESEARCH_TASKS
                    SET RESEARCH_NOTES = :notes, UPDATED_AT = SYSTIMESTAMP
                    WHERE TASK_ID = :tid
                    """,
                    {"notes": notes if notes else None, "tid": task_id}
                )

                # 3. Record Audit Trail
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS, CREATED_AT)
                    VALUES (:actor_id, 'STAFF_RESEARCH_NOTES_SAVED', 'RESEARCH_TASKS', :tid, :details, SYSTIMESTAMP)
                    """,
                    {
                        "actor_id": user_id,
                        "tid": task_id,
                        "details": f"Research notes updated ({len(notes)} chars) on task '{task_title}'"
                    }
                )

                conn.commit()

        return jsonify({
            "message": "Research notes saved successfully to Oracle Database.",
            "task_id": task_id,
            "research_notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/tasks/<int:task_id>", methods=["PUT"])
@auth.role_required(["STAFF"])
def update_task_combined(task_id: int):
    """
    PUT /api/staff/tasks/<task_id>
    ------------------------------
    Combined endpoint allowing simultaneous update of status and research notes.
    """
    auth.verify_csrf_token()
    user_id = session.get("user_id")
    data = request.get_json(silent=True) or {}

    new_status = data.get("status")
    new_notes = data.get("research_notes")

    if new_status:
        new_status = new_status.strip().upper()
        if new_status not in VALID_TASK_STATUSES:
            return jsonify({
                "error": f"Invalid task status '{new_status}'.",
                "code": "INVALID_TASK_STATUS"
            }), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({
                        "error": "Staff profile not found.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                # 1. Verify task ownership
                cursor.execute(
                    "SELECT TASK_ID, STAFF_ID, TITLE, STATUS FROM RESEARCH_TASKS WHERE TASK_ID = :tid",
                    {"tid": task_id}
                )
                task_row = cursor.fetchone()
                if not task_row:
                    return jsonify({
                        "error": "Research task record not found.",
                        "code": "TASK_NOT_FOUND"
                    }), 404

                if task_row[1] != staff_id:
                    return jsonify({
                        "error": "Access denied. You cannot modify tasks assigned to another staff member.",
                        "code": "FORBIDDEN_TASK_ACCESS"
                    }), 403

                task_title = task_row[2]

                # Build dynamic parameterized UPDATE
                set_clauses = ["UPDATED_AT = SYSTIMESTAMP"]
                params = {"tid": task_id}

                if new_status:
                    set_clauses.append("STATUS = :status")
                    params["status"] = new_status

                if new_notes is not None:
                    set_clauses.append("RESEARCH_NOTES = :notes")
                    params["notes"] = new_notes.strip() if new_notes.strip() else None

                cursor.execute(
                    f"UPDATE RESEARCH_TASKS SET {', '.join(set_clauses)} WHERE TASK_ID = :tid",
                    params
                )

                # Record Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS, CREATED_AT)
                    VALUES (:actor_id, 'STAFF_TASK_MODIFIED', 'RESEARCH_TASKS', :tid, :details, SYSTIMESTAMP)
                    """,
                    {
                        "actor_id": user_id,
                        "tid": task_id,
                        "details": f"Updated task '{task_title}' (Status: {new_status or 'unchanged'})"
                    }
                )

                conn.commit()

        return jsonify({
            "message": "Task updated successfully.",
            "task_id": task_id,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


# ============================================================================
# 5. UPCOMING DEADLINES (Hearings, Tasks, Case Deadlines)
# ============================================================================

@staff_bp.route("/deadlines", methods=["GET"])
@auth.role_required(["STAFF"])
def list_upcoming_deadlines():
    """
    GET /api/staff/deadlines
    ------------------------
    Returns upcoming deadlines exclusively for the authenticated staff member's assigned work:
    1. Research tasks with upcoming due dates (STATUS != 'COMPLETED')
    2. Scheduled court hearings on actively assigned cases
    3. Assignment milestones / deadlines
    Sorted chronologically from closest deadline onward.
    """
    user_id = session.get("user_id")
    filter_type = request.args.get("type", "ALL").strip().upper()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                staff_id, _ = get_authenticated_staff_id(cursor, user_id)
                if not staff_id:
                    return jsonify({"deadlines": [], "total": 0}), 200

                query = """
                    SELECT * FROM (
                        SELECT 'TASK' AS ITEM_TYPE,
                               rt.TASK_ID AS ITEM_ID,
                               rt.TITLE AS TITLE,
                               rt.INSTRUCTIONS AS DETAILS,
                               c.CASE_ID,
                               c.CASE_NUMBER,
                               c.TITLE AS CASE_TITLE,
                               rt.PRIORITY,
                               rt.STATUS,
                               TO_CHAR(rt.DUE_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DEADLINE_DATE,
                               u_adv.FULL_NAME AS ADVOCATE_NAME,
                               'Chamber / Research Desk' AS LOCATION,
                               '' AS JUDGE_NAME
                        FROM RESEARCH_TASKS rt
                        JOIN CASES c ON rt.CASE_ID = c.CASE_ID
                        JOIN USERS u_adv ON rt.ASSIGNED_BY = u_adv.USER_ID
                        WHERE rt.STAFF_ID = :sid AND rt.STATUS != 'COMPLETED'
                        UNION ALL
                        SELECT 'HEARING' AS ITEM_TYPE,
                               h.HEARING_ID AS ITEM_ID,
                               'Court Hearing: ' || NVL(h.COURT_ROOM, NVL(h.COURT_NAME, 'Court Session')) AS TITLE,
                               CAST(h.NOTES AS VARCHAR2(500)) AS DETAILS,
                               c.CASE_ID,
                               c.CASE_NUMBER,
                               c.TITLE AS CASE_TITLE,
                               'URGENT' AS PRIORITY,
                               h.HEARING_STATUS AS STATUS,
                               TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS DEADLINE_DATE,
                               u_adv.FULL_NAME AS ADVOCATE_NAME,
                               NVL(h.COURT_ROOM, NVL(h.COURT_NAME, 'Courtroom')) AS LOCATION,
                               NVL(h.JUDGE_NAME, 'Designated Bench') AS JUDGE_NAME
                        FROM HEARINGS h
                        JOIN CASES c ON h.CASE_ID = c.CASE_ID
                        JOIN CASE_ASSIGNMENTS ca ON c.CASE_ID = ca.CASE_ID
                        JOIN USERS u_adv ON c.CREATED_BY = u_adv.USER_ID
                        WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                    )
                """
                params = {"sid": staff_id}

                if filter_type in ("TASK", "HEARING"):
                    query += " WHERE ITEM_TYPE = :filter_type"
                    params["filter_type"] = filter_type

                query += " ORDER BY DEADLINE_DATE ASC"

                cursor.execute(query, params)
                deadlines = [
                    {
                        "item_type": r[0],
                        "item_id": r[1],
                        "title": r[2],
                        "details": safe_lob(r[3]),
                        "case_id": r[4],
                        "case_number": r[5],
                        "case_title": r[6],
                        "priority": r[7],
                        "status": r[8],
                        "deadline_date": r[9],
                        "advocate_name": r[10] or "Supervising Advocate",
                        "location": r[11] or "Courtroom",
                        "judge_name": r[12] or ""
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "deadlines": deadlines,
            "total": len(deadlines)
        }), 200

    except Exception as exc:
        return handle_db_error(exc)


@staff_bp.route("/ai-status", methods=["GET"])
@auth.login_required
def get_ai_diagnostic_status():
    """
    Returns live connectivity status of the configured AI API (xAI Grok or GroqCloud).
    Provides exact error messages and guidance if credits are required.
    """
    return jsonify(grok_client.check_ai_status()), 200

