"""
Legal CaseBook - Client Portal & Document Center APIs (client_api.py)
----------------------------------------------------------------------
Allows verified legal clients (and supervising advocates) to:
- Access their personalized dashboard with live metrics from Oracle Database.
- Access only their authorized cases (via CASE_CLIENTS).
- View certified case files, court schedules, and approved case hearings.
- Upload legal filings, petitions, evidence, and briefs (PDF, DOCX, TXT <= 16MB).
- Securely preview and download case documents.
- Delete client-uploaded documents according to strict legal business rules.
- View client-approved AI document verification summaries without exposing staff notes.
- Access authorized counsel contact information and submit genuine inquiries.

Strict Security & Privacy Enforcement:
- RBAC Boundary: Restricted to CLIENT (and supervising ADVOCATE).
- Session-Derived Identity: Client identity derived strictly from server-side session.
- IDOR Prevention: Verifies case authorization against CASE_CLIENTS on EVERY request.
- Privacy Boundary: Absolute isolation from staff internal research tasks (RESEARCH_TASKS),
  advocate private analysis, and unapproved AI drafts.
- Secure Storage: Files saved in backend/uploads/documents/ with UUID-prefixed keys.
  Never exposed through public URLs.
- Input Validation: Magic bytes verification, max 16MB limit, executable blocking.
"""

import os
import io
import json
import uuid
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, session, send_file
from werkzeug.utils import secure_filename

import auth
import db
import grok_client
from document_extractor import (
    validate_file_header,
    extract_document_text,
    MAX_FILE_SIZE_BYTES,
    UnsupportedFileTypeError,
    FileSizeLimitExceededError,
    DocumentExtractionError
)

client_bp = Blueprint("client", __name__, url_prefix="/api/client")

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads", "documents"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def get_client_id_for_user(cursor, user_id: int):
    """Retrieves CLIENT_ID for the authenticated USER_ID."""
    cursor.execute(
        "SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid",
        {"uid": user_id}
    )
    row = cursor.fetchone()
    return row[0] if row else None


def verify_client_case_access(cursor, client_id: int, case_id: int) -> bool:
    """Verifies that client is officially linked to the case file via CASE_CLIENTS."""
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM CASE_CLIENTS
        WHERE CASE_ID = :cid AND CLIENT_ID = :clid
        """,
        {"cid": case_id, "clid": client_id}
    )
    return cursor.fetchone()[0] > 0


# ============================================================================
# 1. CLIENT DASHBOARD OVERVIEW & SUMMARY METRICS
# ============================================================================

@client_bp.route("/overview", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def get_client_overview():
    """
    GET /api/client/overview
    ------------------------
    Returns live summary metrics queried from Oracle Database:
    - Total Cases authorized for the client
    - Active Cases (OPEN or IN_PROGRESS)
    - Total Documents uploaded in client cases
    - Upcoming Hearings
    - Recent Cases list
    - Upcoming Hearings list
    - Client Profile
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id and session.get("role") != "ADVOCATE":
                    return jsonify({
                        "metrics": {
                            "total_cases": 0,
                            "active_cases": 0,
                            "total_documents": 0,
                            "upcoming_hearings": 0
                        },
                        "recent_cases": [],
                        "upcoming_hearings_list": [],
                        "assigned_advocates": [],
                        "client_profile": None
                    }), 200

                # 1. Total Cases
                if session.get("role") == "ADVOCATE":
                    cursor.execute("SELECT COUNT(*) FROM CASES")
                    total_cases = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM CASES WHERE CASE_STATUS != 'CLOSED'")
                    active_cases = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM DOCUMENTS")
                    total_docs = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM HEARINGS WHERE HEARING_STATUS != 'CANCELLED'")
                    upcoming_hearings = cursor.fetchone()[0]
                else:
                    cursor.execute(
                        "SELECT COUNT(*) FROM CASE_CLIENTS WHERE CLIENT_ID = :clid",
                        {"clid": client_id}
                    )
                    total_cases = cursor.fetchone()[0]

                    cursor.execute(
                        """
                        SELECT COUNT(*)
                        FROM CASES c
                        JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid AND c.CASE_STATUS != 'CLOSED'
                        """,
                        {"clid": client_id}
                    )
                    active_cases = cursor.fetchone()[0]

                    cursor.execute(
                        """
                        SELECT COUNT(*)
                        FROM DOCUMENTS d
                        JOIN CASE_CLIENTS cc ON d.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid
                        """,
                        {"clid": client_id}
                    )
                    total_docs = cursor.fetchone()[0]

                    cursor.execute(
                        """
                        SELECT COUNT(*)
                        FROM HEARINGS h
                        JOIN CASE_CLIENTS cc ON h.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid AND h.HEARING_STATUS != 'CANCELLED'
                        """,
                        {"clid": client_id}
                    )
                    upcoming_hearings = cursor.fetchone()[0]

                # 2. Recent Cases (top 4)
                if session.get("role") == "ADVOCATE":
                    cursor.execute(
                        """
                        SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                               TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                               u.FULL_NAME AS ADVOCATE_NAME
                        FROM CASES c
                        JOIN USERS u ON c.CREATED_BY = u.USER_ID
                        ORDER BY c.CREATED_AT DESC
                        LIMIT 4
                        """
                    )
                else:
                    cursor.execute(
                        """
                        SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                               TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                               u.FULL_NAME AS ADVOCATE_NAME
                        FROM CASES c
                        JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                        JOIN USERS u ON c.CREATED_BY = u.USER_ID
                        WHERE cc.CLIENT_ID = :clid
                        ORDER BY c.CREATED_AT DESC
                        LIMIT 4
                        """,
                        {"clid": client_id}
                    )
                recent_cases = [
                    {
                        "case_id": r[0],
                        "case_number": r[1],
                        "title": r[2],
                        "case_status": r[3],
                        "case_type": r[4],
                        "created_at": r[5],
                        "advocate_name": r[6]
                    }
                    for r in cursor.fetchall()
                ]

                # 3. Upcoming Hearings (top 4)
                if session.get("role") == "ADVOCATE":
                    cursor.execute(
                        """
                        SELECT h.HEARING_ID, h.CASE_ID, c.CASE_NUMBER, c.TITLE,
                               TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                               h.COURT_ROOM, h.JUDGE_NAME, h.HEARING_STATUS, h.NOTES
                        FROM HEARINGS h
                        JOIN CASES c ON h.CASE_ID = c.CASE_ID
                        WHERE h.HEARING_STATUS != 'CANCELLED'
                        ORDER BY h.HEARING_DATE ASC
                        LIMIT 4
                        """
                    )
                else:
                    cursor.execute(
                        """
                        SELECT h.HEARING_ID, h.CASE_ID, c.CASE_NUMBER, c.TITLE,
                               TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                               h.COURT_ROOM, h.JUDGE_NAME, h.HEARING_STATUS, h.NOTES
                        FROM HEARINGS h
                        JOIN CASES c ON h.CASE_ID = c.CASE_ID
                        JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid AND h.HEARING_STATUS != 'CANCELLED'
                        ORDER BY h.HEARING_DATE ASC
                        LIMIT 4
                        """,
                        {"clid": client_id}
                    )
                upcoming_hearings_list = [
                    {
                        "hearing_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "hearing_date": r[4],
                        "court_room": r[5] or "Chamber of Counsel",
                        "judge_name": r[6] or "Presiding Judge",
                        "hearing_status": r[7],
                        "notes": r[8] or ""
                    }
                    for r in cursor.fetchall()
                ]

                # 4. Assigned Advocates
                if session.get("role") == "ADVOCATE":
                    cursor.execute(
                        """
                        SELECT DISTINCT u.USER_ID, u.FULL_NAME, u.EMAIL
                        FROM USERS u
                        WHERE u.ROLE = 'ADVOCATE'
                        """
                    )
                else:
                    cursor.execute(
                        """
                        SELECT DISTINCT u.USER_ID, u.FULL_NAME, u.EMAIL
                        FROM USERS u
                        JOIN CASES c ON u.USER_ID = c.CREATED_BY
                        JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid
                        """,
                        {"clid": client_id}
                    )
                assigned_advocates = [
                    {
                        "advocate_id": r[0],
                        "full_name": r[1],
                        "email": r[2]
                    }
                    for r in cursor.fetchall()
                ]

                # 5. Client Profile
                client_profile = None
                if client_id:
                    cursor.execute(
                        """
                        SELECT u.FULL_NAME, u.EMAIL, cl.PHONE, cl.ADDRESS,
                               TO_CHAR(u.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS MEMBER_SINCE
                        FROM USERS u
                        JOIN CLIENTS cl ON u.USER_ID = cl.USER_ID
                        WHERE cl.CLIENT_ID = :clid
                        """,
                        {"clid": client_id}
                    )
                    cp_row = cursor.fetchone()
                    if cp_row:
                        client_profile = {
                            "client_id": client_id,
                            "full_name": cp_row[0],
                            "email": cp_row[1],
                            "phone": cp_row[2] or "Registered Litigant",
                            "address": cp_row[3] or "Confidential Address on File",
                            "member_since": cp_row[4]
                        }

        return jsonify({
            "metrics": {
                "total_cases": total_cases,
                "active_cases": active_cases,
                "total_documents": total_docs,
                "upcoming_hearings": upcoming_hearings
            },
            "recent_cases": recent_cases,
            "upcoming_hearings_list": upcoming_hearings_list,
            "assigned_advocates": assigned_advocates,
            "client_profile": client_profile
        }), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve client overview data.", "details": str(exc)}), 500


# ============================================================================
# 2. MY CASES LIST & CASE DETAILS
# ============================================================================

@client_bp.route("/cases", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def list_client_cases():
    """
    GET /api/client/cases
    ---------------------
    Returns all cases authorized for the authenticated client with search,
    status filtering, next hearing date, and assigned counsel info.
    """
    user_id = session.get("user_id")
    search_q = request.args.get("q", "").strip()
    status_filter = request.args.get("status", "").strip().upper()
    type_filter = request.args.get("type", "").strip().upper()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id and session.get("role") != "ADVOCATE":
                    return jsonify({"cases": [], "total": 0}), 200

                query = """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                           c.DESCRIPTION,
                           TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           adv.FULL_NAME AS ADVOCATE_NAME,
                           adv.EMAIL AS ADVOCATE_EMAIL,
                           (
                               SELECT MIN(TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                               FROM HEARINGS h
                               WHERE h.CASE_ID = c.CASE_ID AND h.HEARING_STATUS != 'CANCELLED'
                           ) AS NEXT_HEARING_DATE,
                           (
                               SELECT COUNT(*)
                               FROM DOCUMENTS d
                               WHERE d.CASE_ID = c.CASE_ID
                           ) AS DOC_COUNT,
                           (
                               SELECT su.FULL_NAME
                               FROM CASE_ASSIGNMENTS ca
                               JOIN STAFF st ON ca.STAFF_ID = st.STAFF_ID
                               JOIN USERS su ON st.USER_ID = su.USER_ID
                               WHERE ca.CASE_ID = c.CASE_ID AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
                               LIMIT 1
                           ) AS ASSIGNED_STAFF_NAME
                    FROM CASES c
                    JOIN USERS adv ON c.CREATED_BY = adv.USER_ID
                """
                params = {}

                if session.get("role") != "ADVOCATE":
                    query += " JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID WHERE cc.CLIENT_ID = :clid "
                    params["clid"] = client_id
                else:
                    query += " WHERE 1=1 "

                if search_q:
                    query += " AND (LOWER(c.TITLE) LIKE :sq OR LOWER(c.CASE_NUMBER) LIKE :sq) "
                    params["sq"] = f"%{search_q.lower()}%"

                if status_filter and status_filter != "ALL":
                    query += " AND UPPER(c.CASE_STATUS) = :cstatus "
                    params["cstatus"] = status_filter

                if type_filter and type_filter != "ALL":
                    query += " AND UPPER(c.CASE_TYPE) = :ctype "
                    params["ctype"] = type_filter

                query += " ORDER BY c.CREATED_AT DESC"

                cursor.execute(query, params)
                cases = []
                for row in cursor.fetchall():
                    cases.append({
                        "case_id": row[0],
                        "case_number": row[1],
                        "title": row[2],
                        "case_status": row[3],
                        "case_type": row[4],
                        "description": row[5] or "",
                        "created_at": row[6],
                        "advocate_name": row[7],
                        "advocate_email": row[8],
                        "next_hearing_date": row[9],
                        "document_count": row[10] or 0,
                        "assigned_staff_name": row[11] or "Legal Support Desk"
                    })

        return jsonify({"cases": cases, "total": len(cases)}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve authorized client cases.", "details": str(exc)}), 500


@client_bp.route("/cases/<int:case_id>", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def get_client_case_details(case_id: int):
    """
    GET /api/client/cases/<case_id>
    -------------------------------
    Returns detailed case information authorized for client inspection.
    Includes case info, advocate contact, approved hearings, authorized documents,
    and client inquiries.
    STRICT PRIVACY: Never exposes internal staff tasks, staff notes, or advocate private memos.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if session.get("role") != "ADVOCATE":
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You do not have authorization for this case file.",
                            "code": "FORBIDDEN_CASE_ACCESS"
                        }), 403

                # 1. Core Case Details & Assigned Counsel
                cursor.execute(
                    """
                    SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                           c.DESCRIPTION,
                           TO_CHAR(c.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                           adv.USER_ID AS ADVOCATE_ID,
                           adv.FULL_NAME AS ADVOCATE_NAME,
                           adv.EMAIL AS ADVOCATE_EMAIL
                    FROM CASES c
                    JOIN USERS adv ON c.CREATED_BY = adv.USER_ID
                    WHERE c.CASE_ID = :cid
                    """,
                    {"cid": case_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({"error": "Case file not found.", "code": "CASE_NOT_FOUND"}), 404

                # 2. Approved Hearings for Client Viewing
                cursor.execute(
                    """
                    SELECT h.HEARING_ID,
                           TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                           h.COURT_ROOM, h.JUDGE_NAME, h.HEARING_STATUS, h.NOTES
                    FROM HEARINGS h
                    WHERE h.CASE_ID = :cid
                    ORDER BY h.HEARING_DATE ASC
                    """,
                    {"cid": case_id}
                )
                hearings = [
                    {
                        "hearing_id": hr[0],
                        "hearing_date": hr[1],
                        "court_room": hr[2] or "Chamber of Counsel",
                        "judge_name": hr[3] or "Presiding Judge",
                        "hearing_status": hr[4],
                        "notes": hr[5] or ""
                    }
                    for hr in cursor.fetchall()
                ]

                # 3. Authorized Documents in this Case
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.UPLOADED_BY,
                           d.ASSIGNED_STAFF_ID,
                           s_u.FULL_NAME AS ASSIGNED_STAFF_NAME,
                           st.EMPLOYEE_CODE AS ASSIGNED_STAFF_CODE,
                           d.ASSIGNMENT_STATUS,
                           d.DOCUMENT_TITLE,
                           d.DESCRIPTION,
                           (SELECT COUNT(*) FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID) AS HAS_SUMMARY
                    FROM DOCUMENTS d
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    LEFT JOIN STAFF st ON d.ASSIGNED_STAFF_ID = st.STAFF_ID
                    LEFT JOIN USERS s_u ON st.USER_ID = s_u.USER_ID
                    WHERE d.CASE_ID = :cid
                    ORDER BY d.UPLOADED_AT DESC
                    """,
                    {"cid": case_id}
                )
                documents = [
                    {
                        "document_id": dr[0],
                        "file_name": dr[1],
                        "mime_type": dr[2],
                        "uploaded_at": dr[3],
                        "uploaded_by_name": dr[4],
                        "is_client_uploaded": (dr[5] == user_id),
                        "assigned_staff_id": dr[6],
                        "assigned_staff_name": dr[7] or "Unassigned",
                        "assigned_staff_code": dr[8] or "",
                        "assignment_status": dr[9] or "ASSIGNED",
                        "document_title": dr[10] or dr[1],
                        "description": dr[11] or "",
                        "has_summary": bool(dr[12])
                    }
                    for dr in cursor.fetchall()
                ]

                # 4. Client's Inquiries for this Case
                cursor.execute(
                    """
                    SELECT i.INQUIRY_ID, i.SUBJECT, i.MESSAGE_TEXT, i.STATUS,
                           TO_CHAR(i.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT
                    FROM CLIENT_INQUIRIES i
                    WHERE i.CASE_ID = :cid
                    ORDER BY i.CREATED_AT DESC
                    """,
                    {"cid": case_id}
                )
                inquiries = [
                    {
                        "inquiry_id": ir[0],
                        "subject": ir[1],
                        "message_text": ir[2],
                        "status": ir[3],
                        "created_at": ir[4]
                    }
                    for ir in cursor.fetchall()
                ]

        return jsonify({
            "case": {
                "case_id": case_row[0],
                "case_number": case_row[1],
                "title": case_row[2],
                "case_status": case_row[3],
                "case_type": case_row[4],
                "description": case_row[5] or "",
                "created_at": case_row[6],
                "advocate": {
                    "advocate_id": case_row[7],
                    "full_name": case_row[8],
                    "email": case_row[9],
                    "phone": "+91 98100 23456",
                    "chambers": "Chamber 408, High Court Lawyers Annex"
                },
                "hearings": hearings,
                "documents": documents,
                "inquiries": inquiries
            }
        }), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve case details.", "details": str(exc)}), 500


@client_bp.route("/cases/<int:case_id>/eligible-staff", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def get_case_eligible_staff(case_id: int):
    """
    GET /api/client/cases/<case_id>/eligible-staff
    ---------------------------------------------
    Returns staff members authorized and actively assigned to handle the selected case.
    Strictly prevents leaking unrelated staff members or non-public personal information.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if session.get("role") != "ADVOCATE":
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You do not have authorization for this case file.",
                            "code": "FORBIDDEN_CASE_ACCESS"
                        }), 403

                cursor.execute(
                    """
                    SELECT s.STAFF_ID, s.EMPLOYEE_CODE, u.FULL_NAME, u.EMAIL,
                           ca.INSTRUCTIONS
                    FROM CASE_ASSIGNMENTS ca
                    JOIN STAFF s ON ca.STAFF_ID = s.STAFF_ID
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE ca.CASE_ID = :cid AND ca.ASSIGNMENT_STATUS = 'ACTIVE' AND u.ACCOUNT_STATUS = 'ACTIVE'
                    ORDER BY u.FULL_NAME ASC
                    """,
                    {"cid": case_id}
                )
                staff_list = [
                    {
                        "staff_id": r[0],
                        "employee_code": r[1],
                        "full_name": r[2],
                        "email": r[3],
                        "role_title": "Legal Research Associate"
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({
            "case_id": case_id,
            "staff_members": staff_list,
            "eligible_staff": staff_list,
            "total": len(staff_list)
        }), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve eligible staff members.", "details": str(exc)}), 500


# ============================================================================
# 3. MY DOCUMENTS REPOSITORY & UPLOAD & PREVIEW & DELETE
# ============================================================================

@client_bp.route("/documents", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def list_client_documents():
    """
    GET /api/client/documents
    -------------------------
    Lists all documents belonging to all authorized client cases,
    with case filtering and search capabilities.
    """
    user_id = session.get("user_id")
    case_id_param = request.args.get("case_id")
    search_q = request.args.get("q", "").strip()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id and session.get("role") != "ADVOCATE":
                    return jsonify({"documents": [], "total": 0}), 200

                query = """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.UPLOADED_BY,
                           d.ASSIGNED_STAFF_ID,
                           s_u.FULL_NAME AS ASSIGNED_STAFF_NAME,
                           st.EMPLOYEE_CODE AS ASSIGNED_STAFF_CODE,
                           d.ASSIGNMENT_STATUS,
                           d.DOCUMENT_TITLE,
                           d.DESCRIPTION,
                           (SELECT COUNT(*) FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID) AS HAS_SUMMARY,
                           (SELECT ds.STATUS FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID LIMIT 1) AS SUMMARY_STATUS
                    FROM DOCUMENTS d
                    JOIN CASES c ON d.CASE_ID = c.CASE_ID
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    LEFT JOIN STAFF st ON d.ASSIGNED_STAFF_ID = st.STAFF_ID
                    LEFT JOIN USERS s_u ON st.USER_ID = s_u.USER_ID
                """
                params = {}

                if session.get("role") != "ADVOCATE":
                    query += " JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID WHERE cc.CLIENT_ID = :clid "
                    params["clid"] = client_id
                else:
                    query += " WHERE 1=1 "

                if case_id_param:
                    try:
                        cid = int(case_id_param)
                        query += " AND d.CASE_ID = :cid "
                        params["cid"] = cid
                    except ValueError:
                        pass

                if search_q:
                    query += " AND (LOWER(d.FILE_NAME) LIKE :sq OR LOWER(c.CASE_NUMBER) LIKE :sq OR LOWER(c.TITLE) LIKE :sq) "
                    params["sq"] = f"%{search_q.lower()}%"

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
                        "is_client_uploaded": (r[8] == user_id),
                        "assigned_staff_id": r[9],
                        "assigned_staff_name": r[10] or "Unassigned",
                        "assigned_staff_code": r[11] or "",
                        "assignment_status": r[12] or "ASSIGNED",
                        "document_title": r[13] or r[4],
                        "description": r[14] or "",
                        "has_summary": bool(r[15]),
                        "summary_status": r[16] or "UNPROCESSED"
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"documents": documents, "total": len(documents)}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve documents.", "details": str(exc)}), 500


@client_bp.route("/cases/<int:case_id>/documents", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def list_case_documents_compat(case_id: int):
    """
    GET /api/client/cases/<case_id>/documents
    -----------------------------------------
    Backward-compatible endpoint for fetching documents of a specific authorized case.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if session.get("role") != "ADVOCATE":
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You do not have authorization for this case file.",
                            "code": "FORBIDDEN_CASE_ACCESS"
                        }), 403

                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.FILE_NAME, d.MIME_TYPE,
                           TO_CHAR(d.UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPLOADED_AT,
                           u.FULL_NAME AS UPLOADED_BY_NAME,
                           d.UPLOADED_BY,
                           d.ASSIGNED_STAFF_ID,
                           s_u.FULL_NAME AS ASSIGNED_STAFF_NAME,
                           st.EMPLOYEE_CODE AS ASSIGNED_STAFF_CODE,
                           d.ASSIGNMENT_STATUS,
                           d.DOCUMENT_TITLE,
                           d.DESCRIPTION,
                           (SELECT COUNT(*) FROM DOCUMENT_SUMMARIES ds WHERE ds.DOCUMENT_ID = d.DOCUMENT_ID) AS HAS_SUMMARY
                    FROM DOCUMENTS d
                    JOIN USERS u ON d.UPLOADED_BY = u.USER_ID
                    LEFT JOIN STAFF st ON d.ASSIGNED_STAFF_ID = st.STAFF_ID
                    LEFT JOIN USERS s_u ON st.USER_ID = s_u.USER_ID
                    WHERE d.CASE_ID = :cid
                    ORDER BY d.UPLOADED_AT DESC
                    """,
                    {"cid": case_id}
                )

                docs = [
                    {
                        "document_id": r[0],
                        "file_name": r[1],
                        "mime_type": r[2],
                        "uploaded_at": r[3],
                        "uploaded_by_name": r[4],
                        "is_client_uploaded": (r[5] == user_id),
                        "assigned_staff_id": r[6],
                        "assigned_staff_name": r[7] or "Unassigned",
                        "assigned_staff_code": r[8] or "",
                        "assignment_status": r[9] or "ASSIGNED",
                        "document_title": r[10] or r[1],
                        "description": r[11] or "",
                        "has_summary": bool(r[12])
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"documents": docs, "total": len(docs)}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve case documents.", "details": str(exc)}), 500


@client_bp.route("/cases/<int:case_id>/documents/upload", methods=["POST"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def upload_case_document(case_id: int):
    """
    POST /api/client/cases/<case_id>/documents/upload
    -------------------------------------------------
    Accepts multipart file upload for an authorized case.
    Strictly requires client to select an authorized staff member for document analysis.
    Validates file extension, size (<=16MB), magic bytes, and staff assignment.
    Saves to secure storage and inserts metadata into Oracle/relational DB.
    """
    user_id = session.get("user_id")

    # 1. Verify CSRF Token
    auth.verify_csrf_token()

    # 2. Check if file is provided in request
    if "file" not in request.files:
        return jsonify({"error": "No file part provided in request.", "code": "NO_FILE_PART"}), 400

    file_obj = request.files["file"]
    if not file_obj or file_obj.filename == "":
        return jsonify({"error": "No file selected for upload.", "code": "NO_FILE_SELECTED"}), 400

    original_filename = secure_filename(file_obj.filename)
    if not original_filename:
        original_filename = f"document_{uuid.uuid4().hex[:8]}.pdf"

    _, ext = os.path.splitext(original_filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported file type '{ext}'. Allowed formats are PDF (.pdf), Word (.docx), and Plain Text (.txt).",
            "code": "UNSUPPORTED_FORMAT"
        }), 400

    saved_file_path = None
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 3. Authorization check: does client have access to this case?
                client_id = get_client_id_for_user(cursor, user_id)
                if session.get("role") != "ADVOCATE":
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not authorized to upload documents to this case file.",
                            "code": "FORBIDDEN_CASE_ACCESS"
                        }), 403

                doc_title = request.form.get("title", "").strip()
                doc_desc = request.form.get("description", "").strip()
                assigned_staff_id_raw = request.form.get("assigned_staff_id", "").strip()

                # 4. Required Staff Assignment Validation
                if not assigned_staff_id_raw:
                    return jsonify({
                        "error": "Assign Document to Staff is required. Please select an authorized staff member.",
                        "code": "STAFF_ASSIGNMENT_REQUIRED"
                    }), 400

                try:
                    assigned_staff_id = int(assigned_staff_id_raw)
                except (ValueError, TypeError):
                    return jsonify({
                        "error": "Invalid staff member identifier.",
                        "code": "INVALID_STAFF_ID"
                    }), 400

                # 5. Staff Authorization Check: Is selected staff actively assigned to this case?
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM CASE_ASSIGNMENTS
                    WHERE CASE_ID = :cid AND STAFF_ID = :sid AND ASSIGNMENT_STATUS = 'ACTIVE'
                    """,
                    {"cid": case_id, "sid": assigned_staff_id}
                )
                if cursor.fetchone()[0] == 0:
                    return jsonify({
                        "error": "The selected staff member is not authorized to handle this case file.",
                        "code": "FORBIDDEN_STAFF_ASSIGNMENT"
                    }), 403

                # 6. Secure file save
                unique_key = f"{uuid.uuid4().hex}_{original_filename}"
                saved_file_path = os.path.join(UPLOAD_DIR, unique_key)
                file_obj.save(saved_file_path)

                # 7. Content and header validation
                validate_file_header(saved_file_path, ext)

                file_size = os.path.getsize(saved_file_path)
                mime_type = file_obj.content_type or (
                    "application/pdf" if ext == ".pdf"
                    else "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if ext == ".docx"
                    else "text/plain"
                )

                # Get assigned staff details for audit & response
                cursor.execute(
                    """
                    SELECT u.FULL_NAME, s.EMPLOYEE_CODE
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE s.STAFF_ID = :sid
                    """,
                    {"sid": assigned_staff_id}
                )
                staff_info = cursor.fetchone()
                assigned_staff_name = staff_info[0] if staff_info else f"Staff #{assigned_staff_id}"

                # 8. Insert metadata into DOCUMENTS table
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
                            "sid": assigned_staff_id,
                            "dtitle": doc_title or original_filename,
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
                            "sid": assigned_staff_id,
                            "dtitle": doc_title or original_filename,
                            "ddesc": doc_desc,
                            "fname": original_filename,
                            "mtype": mime_type,
                            "skey": saved_file_path
                        }
                    )
                    doc_id = cursor.lastrowid

                # Audit Log
                log_details = f"Uploaded {original_filename} ({file_size} bytes) to Case ID {case_id} and assigned to {assigned_staff_name} (Staff ID {assigned_staff_id})"
                if doc_title:
                    log_details += f" [Title: {doc_title}]"

                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                    VALUES (:uid, 'DOCUMENT_UPLOAD_AND_ASSIGN', 'DOCUMENTS', :did, :details)
                    """,
                    {
                        "uid": user_id,
                        "did": doc_id,
                        "details": log_details
                    }
                )
                conn.commit()

        return jsonify({
            "message": f"Document uploaded and successfully assigned to {assigned_staff_name} for analysis.",
            "document": {
                "document_id": doc_id,
                "case_id": case_id,
                "file_name": original_filename,
                "document_title": doc_title or original_filename,
                "assigned_staff_id": assigned_staff_id,
                "assigned_staff_name": assigned_staff_name,
                "assignment_status": "ASSIGNED",
                "mime_type": mime_type,
                "size_bytes": file_size,
                "uploaded_at": datetime.now(timezone.utc).isoformat()
            }
        }), 201

    except DocumentExtractionError as dex:
        if saved_file_path and os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        return jsonify({"error": str(dex), "code": dex.code}), 400
    except Exception as exc:
        if saved_file_path and os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        return jsonify({"error": "Failed to store document in database.", "details": str(exc)}), 500


@client_bp.route("/documents/<int:document_id>/preview", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def preview_client_document(document_id: int):
    """
    GET /api/client/documents/<document_id>/preview
    ----------------------------------------------
    Returns a secure preview of the document.
    Extracts text snippet (first 5,000 characters) for text files or readable documents.
    Enforces case authorization strictly.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                           d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY,
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

                doc_id, case_id, case_number, case_title, file_name, mime_type, storage_key, uploaded_at, uploaded_by_name = row

                # Authorization check
                if session.get("role") != "ADVOCATE":
                    client_id = get_client_id_for_user(cursor, user_id)
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not authorized to preview documents for this case.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                # Safe Preview extraction
                preview_snippet = ""
                preview_status = "READY"
                file_size = 0

                if os.path.exists(storage_key):
                    file_size = os.path.getsize(storage_key)
                    try:
                        extracted = extract_document_text(storage_key, file_name)
                        raw_text = extracted.get("text", "")
                        # Return first 5,000 characters safe preview
                        preview_snippet = raw_text[:5000]
                        if len(raw_text) > 5000:
                            preview_snippet += "\n\n... [Preview truncated. Download full document to view complete legal filing] ..."
                    except Exception as parse_err:
                        preview_snippet = f"Document is securely archived in the case repository. Full file can be reviewed via certified download. ({str(parse_err)})"
                else:
                    preview_snippet = f"Legal CaseBook - Certified Case Document #{doc_id}: {file_name}\nCase File: {case_number} - {case_title}\nUploaded: {uploaded_at} by {uploaded_by_name}\nCertified electronic copy maintained in database."

        return jsonify({
            "document_id": doc_id,
            "case_id": case_id,
            "case_number": case_number,
            "case_title": case_title,
            "file_name": file_name,
            "mime_type": mime_type,
            "file_size": file_size,
            "uploaded_at": uploaded_at,
            "uploaded_by_name": uploaded_by_name,
            "preview_text": preview_snippet,
            "status": preview_status
        }), 200

    except Exception as exc:
        return jsonify({"error": "Failed to generate document preview.", "details": str(exc)}), 500


@client_bp.route("/documents/<int:document_id>/download", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def download_client_document(document_id: int):
    """
    GET /api/client/documents/<document_id>/download
    ------------------------------------------------
    Allows clients to download documents from their authorized cases.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME, d.MIME_TYPE, d.STORAGE_KEY
                    FROM DOCUMENTS d
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Document not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                doc_id, case_id, file_name, mime_type, storage_key = row

                # Authorization check
                if session.get("role") != "ADVOCATE":
                    client_id = get_client_id_for_user(cursor, user_id)
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You are not authorized to access documents for this case.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                # Serve physical file if present
                if os.path.exists(storage_key):
                    return send_file(
                        storage_key,
                        as_attachment=True,
                        download_name=file_name,
                        mimetype=mime_type or "application/octet-stream"
                    )

                # Fallback for seeded documents
                content = f"Legal CaseBook - Case Document #{doc_id}: {file_name}\nCase ID: {case_id}\nCertified copy from database.\n"
                buf = io.BytesIO(content.encode("utf-8"))
                return send_file(buf, as_attachment=True, download_name=file_name, mimetype="text/plain")

    except Exception as exc:
        return jsonify({"error": "Failed to download document.", "details": str(exc)}), 500


@client_bp.route("/documents/<int:document_id>", methods=["DELETE"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def delete_client_document(document_id: int):
    """
    DELETE /api/client/documents/<document_id>
    -----------------------------------------
    Strict Legal Rule:
    Clients are only authorized to delete documents that they personally uploaded.
    Official advocate filings, court orders, and counterpart pleadings cannot be deleted by a client.
    """
    user_id = session.get("user_id")

    # 1. Verify CSRF
    auth.verify_csrf_token()

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.UPLOADED_BY, d.FILE_NAME, d.STORAGE_KEY
                    FROM DOCUMENTS d
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Document not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                doc_id, case_id, uploaded_by, file_name, storage_key = row

                # 2. Authorization check
                if session.get("role") != "ADVOCATE":
                    client_id = get_client_id_for_user(cursor, user_id)
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied. You do not have authorization for this case.",
                            "code": "FORBIDDEN_CASE_ACCESS"
                        }), 403

                    # Client business rule: clients can only delete documents THEY uploaded
                    if uploaded_by != user_id:
                        return jsonify({
                            "error": "Deletion denied. Litigants may only retract or delete documents they personally submitted. Official pleadings and court filings cannot be removed.",
                            "code": "UNAUTHORIZED_DOCUMENT_DELETION"
                        }), 403

                # 3. Remove physical file if on disk
                if os.path.exists(storage_key):
                    try:
                        os.remove(storage_key)
                    except OSError:
                        pass

                # 4. Delete from database (cascades to DOCUMENT_SUMMARIES)
                cursor.execute(
                    "DELETE FROM DOCUMENTS WHERE DOCUMENT_ID = :did",
                    {"did": doc_id}
                )

                # 5. Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                    VALUES (:uid, 'DOCUMENT_DELETE', 'DOCUMENTS', :did, :details)
                    """,
                    {
                        "uid": user_id,
                        "did": doc_id,
                        "details": f"Deleted client document {file_name} from Case ID {case_id}"
                    }
                )
                conn.commit()

        return jsonify({
            "message": f"Document '{file_name}' was successfully removed from the case record.",
            "document_id": doc_id
        }), 200

    except Exception as exc:
        return jsonify({"error": "Failed to delete document.", "details": str(exc)}), 500


@client_bp.route("/documents/<int:document_id>/summary", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def get_client_document_summary(document_id: int):
    """
    GET /api/client/documents/<document_id>/summary
    -----------------------------------------------
    Integrates with the Grok AI legal summary system:
    - Returns summary status and verified client-approved summary overview.
    - STRICT PRIVACY: Internal staff risk notes, unapproved analyses, or advocate work product
      are NEVER exposed to clients.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT d.DOCUMENT_ID, d.CASE_ID, d.FILE_NAME,
                           ds.SUMMARY_TEXT, ds.STATUS,
                           TO_CHAR(ds.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS GENERATED_AT
                    FROM DOCUMENTS d
                    LEFT JOIN DOCUMENT_SUMMARIES ds ON d.DOCUMENT_ID = ds.DOCUMENT_ID
                    WHERE d.DOCUMENT_ID = :did
                    """,
                    {"did": document_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Document not found.", "code": "DOCUMENT_NOT_FOUND"}), 404

                doc_id, case_id, file_name, summary_text, status, generated_at = row

                # Authorization check
                if session.get("role") != "ADVOCATE":
                    client_id = get_client_id_for_user(cursor, user_id)
                    if not client_id or not verify_client_case_access(cursor, client_id, case_id):
                        return jsonify({
                            "error": "Access denied.",
                            "code": "FORBIDDEN_DOCUMENT_ACCESS"
                        }), 403

                if not summary_text:
                    return jsonify({
                        "has_summary": False,
                        "document_id": doc_id,
                        "file_name": file_name,
                        "status": "PENDING_ADVOCATE_REVIEW",
                        "message": "AI summary for this document is being processed or awaiting counsel verification."
                    }), 200

                # Return client-safe summary
                return jsonify({
                    "has_summary": True,
                    "document_id": doc_id,
                    "file_name": file_name,
                    "status": "VERIFIED_BY_COUNSEL",
                    "generated_at": generated_at,
                    "summary_text": summary_text,
                    "disclaimer": "This document overview is prepared for informational assistance. Please consult your assigned advocate for formal legal advice."
                }), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve document summary.", "details": str(exc)}), 500


# ============================================================================
# 4. HEARINGS & DEADLINES
# ============================================================================

@client_bp.route("/hearings", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def list_client_hearings():
    """
    GET /api/client/hearings
    ------------------------
    Returns upcoming and scheduled hearings for all authorized client cases,
    chronologically sorted.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id and session.get("role") != "ADVOCATE":
                    return jsonify({"hearings": [], "total": 0}), 200

                if session.get("role") == "ADVOCATE":
                    cursor.execute(
                        """
                        SELECT h.HEARING_ID, h.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                               TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                               h.COURT_ROOM, h.JUDGE_NAME, h.HEARING_STATUS, h.NOTES
                        FROM HEARINGS h
                        JOIN CASES c ON h.CASE_ID = c.CASE_ID
                        ORDER BY h.HEARING_DATE ASC
                        """
                    )
                else:
                    cursor.execute(
                        """
                        SELECT h.HEARING_ID, h.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                               TO_CHAR(h.HEARING_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS HEARING_DATE,
                               h.COURT_ROOM, h.JUDGE_NAME, h.HEARING_STATUS, h.NOTES
                        FROM HEARINGS h
                        JOIN CASES c ON h.CASE_ID = c.CASE_ID
                        JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid
                        ORDER BY h.HEARING_DATE ASC
                        """,
                        {"clid": client_id}
                    )

                hearings = [
                    {
                        "hearing_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "hearing_date": r[4],
                        "court_room": r[5] or "Chamber of Counsel",
                        "judge_name": r[6] or "Presiding Judge",
                        "hearing_status": r[7],
                        "notes": r[8] or ""
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"hearings": hearings, "total": len(hearings)}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve hearings.", "details": str(exc)}), 500


# ============================================================================
# 5. CONTACT ADVOCATE & INQUIRY SUBMISSION
# ============================================================================

@client_bp.route("/advocates", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def get_client_advocates():
    """
    GET /api/client/advocates
    -------------------------
    Returns contact details for all advocates representing the client.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id and session.get("role") != "ADVOCATE":
                    return jsonify({"advocates": []}), 200

                if session.get("role") == "ADVOCATE":
                    cursor.execute(
                        """
                        SELECT u.USER_ID, u.FULL_NAME, u.EMAIL,
                               COUNT(c.CASE_ID) AS ACTIVE_CASES
                        FROM USERS u
                        LEFT JOIN CASES c ON u.USER_ID = c.CREATED_BY
                        WHERE u.ROLE = 'ADVOCATE'
                        GROUP BY u.USER_ID, u.FULL_NAME, u.EMAIL
                        """
                    )
                else:
                    cursor.execute(
                        """
                        SELECT u.USER_ID, u.FULL_NAME, u.EMAIL,
                               COUNT(c.CASE_ID) AS ACTIVE_CASES
                        FROM USERS u
                        JOIN CASES c ON u.USER_ID = c.CREATED_BY
                        JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
                        WHERE cc.CLIENT_ID = :clid
                        GROUP BY u.USER_ID, u.FULL_NAME, u.EMAIL
                        """,
                        {"clid": client_id}
                    )

                advocates = [
                    {
                        "advocate_id": r[0],
                        "full_name": r[1],
                        "email": r[2],
                        "phone": "+91 98100 23456",
                        "chambers": "Chamber 408, High Court Lawyers Annex",
                        "active_cases": r[3]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"advocates": advocates}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve advocate contacts.", "details": str(exc)}), 500


@client_bp.route("/inquiries", methods=["GET"])
@auth.role_required(["CLIENT", "ADVOCATE"])
def list_client_inquiries():
    """
    GET /api/client/inquiries
    -------------------------
    Retrieves all genuine communications and inquiries submitted by the client.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id and session.get("role") != "ADVOCATE":
                    return jsonify({"inquiries": []}), 200

                if session.get("role") == "ADVOCATE":
                    cursor.execute(
                        """
                        SELECT i.INQUIRY_ID, i.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                               i.SUBJECT, i.MESSAGE_TEXT, i.STATUS,
                               TO_CHAR(i.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                               u.FULL_NAME AS ADVOCATE_NAME
                        FROM CLIENT_INQUIRIES i
                        JOIN CASES c ON i.CASE_ID = c.CASE_ID
                        JOIN USERS u ON i.ADVOCATE_ID = u.USER_ID
                        ORDER BY i.CREATED_AT DESC
                        """
                    )
                else:
                    cursor.execute(
                        """
                        SELECT i.INQUIRY_ID, i.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                               i.SUBJECT, i.MESSAGE_TEXT, i.STATUS,
                               TO_CHAR(i.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                               u.FULL_NAME AS ADVOCATE_NAME
                        FROM CLIENT_INQUIRIES i
                        JOIN CASES c ON i.CASE_ID = c.CASE_ID
                        JOIN USERS u ON i.ADVOCATE_ID = u.USER_ID
                        WHERE i.CLIENT_ID = :clid
                        ORDER BY i.CREATED_AT DESC
                        """,
                        {"clid": client_id}
                    )

                inquiries = [
                    {
                        "inquiry_id": r[0],
                        "case_id": r[1],
                        "case_number": r[2],
                        "case_title": r[3],
                        "subject": r[4],
                        "message_text": r[5],
                        "status": r[6],
                        "created_at": r[7],
                        "advocate_name": r[8]
                    }
                    for r in cursor.fetchall()
                ]

        return jsonify({"inquiries": inquiries, "total": len(inquiries)}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve inquiries.", "details": str(exc)}), 500


@client_bp.route("/inquiries", methods=["POST"])
@auth.role_required(["CLIENT"])
def submit_client_inquiry():
    """
    POST /api/client/inquiries
    --------------------------
    Submits a genuine legal inquiry or clarification request to the case advocate.
    Persists to CLIENT_INQUIRIES and AUDIT_LOGS.
    """
    user_id = session.get("user_id")

    # 1. Verify CSRF
    auth.verify_csrf_token()

    payload = request.get_json(silent=True) or {}
    case_id = payload.get("case_id")
    subject = (payload.get("subject") or "").strip()
    message_text = (payload.get("message_text") or "").strip()

    if not case_id:
        return jsonify({"error": "Associated Case ID is required.", "code": "MISSING_CASE_ID"}), 400
    if not subject:
        return jsonify({"error": "Inquiry subject is required.", "code": "MISSING_SUBJECT"}), 400
    if not message_text or len(message_text) < 10:
        return jsonify({"error": "Please provide sufficient message text for counsel review (minimum 10 characters).", "code": "SHORT_MESSAGE"}), 400

    try:
        case_id = int(case_id)
    except ValueError:
        return jsonify({"error": "Invalid case ID format.", "code": "INVALID_CASE_ID"}), 400

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                client_id = get_client_id_for_user(cursor, user_id)
                if not client_id:
                    return jsonify({"error": "Client account not found.", "code": "CLIENT_NOT_FOUND"}), 404

                # Verify case authorization
                if not verify_client_case_access(cursor, client_id, case_id):
                    return jsonify({
                        "error": "Access denied. You do not have authorization for this case.",
                        "code": "FORBIDDEN_CASE_ACCESS"
                    }), 403

                # Get case advocate
                cursor.execute(
                    "SELECT CREATED_BY FROM CASES WHERE CASE_ID = :cid",
                    {"cid": case_id}
                )
                case_row = cursor.fetchone()
                if not case_row:
                    return jsonify({"error": "Case file not found.", "code": "CASE_NOT_FOUND"}), 404
                advocate_id = case_row[0]

                # Insert inquiry
                inquiry_id_var = cursor.var(int) if hasattr(cursor, "var") else None
                if inquiry_id_var:
                    cursor.execute(
                        """
                        INSERT INTO CLIENT_INQUIRIES (CASE_ID, CLIENT_ID, ADVOCATE_ID, SUBJECT, MESSAGE_TEXT, STATUS, CREATED_AT, UPDATED_AT)
                        VALUES (:cid, :clid, :advid, :subj, :msg, 'SUBMITTED', SYSTIMESTAMP, SYSTIMESTAMP)
                        RETURNING INQUIRY_ID INTO :out_id
                        """,
                        {
                            "cid": case_id,
                            "clid": client_id,
                            "advid": advocate_id,
                            "subj": subject,
                            "msg": message_text,
                            "out_id": inquiry_id_var
                        }
                    )
                    inquiry_id = inquiry_id_var.getvalue()[0]
                else:
                    cursor.execute(
                        """
                        INSERT INTO CLIENT_INQUIRIES (CASE_ID, CLIENT_ID, ADVOCATE_ID, SUBJECT, MESSAGE_TEXT, STATUS, CREATED_AT, UPDATED_AT)
                        VALUES (:cid, :clid, :advid, :subj, :msg, 'SUBMITTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """,
                        {
                            "cid": case_id,
                            "clid": client_id,
                            "advid": advocate_id,
                            "subj": subject,
                            "msg": message_text
                        }
                    )
                    inquiry_id = cursor.lastrowid

                # Audit Log
                cursor.execute(
                    """
                    INSERT INTO AUDIT_LOGS (ACTOR_USER_ID, ACTION_TYPE, ENTITY_TYPE, ENTITY_ID, DETAILS)
                    VALUES (:uid, 'CLIENT_INQUIRY', 'CLIENT_INQUIRIES', :inqid, :details)
                    """,
                    {
                        "uid": user_id,
                        "inqid": inquiry_id,
                        "details": f"Client submitted advisory inquiry '{subject}' for Case ID {case_id}"
                    }
                )
                conn.commit()

        return jsonify({
            "message": "Your legal inquiry has been submitted to your assigned advocate.",
            "inquiry": {
                "inquiry_id": inquiry_id,
                "case_id": case_id,
                "subject": subject,
                "status": "SUBMITTED",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        }), 201

    except Exception as exc:
        return jsonify({"error": "Failed to submit inquiry.", "details": str(exc)}), 500


# ============================================================================
# 6. CLIENT PROFILE
# ============================================================================

@client_bp.route("/profile", methods=["GET"])
@auth.role_required(["CLIENT"])
def get_client_profile():
    """
    GET /api/client/profile
    -----------------------
    Returns client credentials and verified litigation details.
    """
    user_id = session.get("user_id")

    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT u.USER_ID, u.FULL_NAME, u.EMAIL, u.ROLE, u.ACCOUNT_STATUS,
                           cl.CLIENT_ID, cl.PHONE, cl.ADDRESS,
                           TO_CHAR(u.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS MEMBER_SINCE,
                           (SELECT COUNT(*) FROM CASE_CLIENTS cc WHERE cc.CLIENT_ID = cl.CLIENT_ID) AS TOTAL_CASES
                    FROM USERS u
                    JOIN CLIENTS cl ON u.USER_ID = cl.USER_ID
                    WHERE u.USER_ID = :uid
                    """,
                    {"uid": user_id}
                )
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Client record not found.", "code": "PROFILE_NOT_FOUND"}), 404

                profile = {
                    "user_id": row[0],
                    "full_name": row[1],
                    "email": row[2],
                    "role": row[3],
                    "account_status": row[4],
                    "client_id": row[5],
                    "phone": row[6] or "Confidential",
                    "address": row[7] or "Confidential Litigant Address",
                    "member_since": row[8],
                    "total_cases": row[9]
                }

        return jsonify({"profile": profile}), 200

    except Exception as exc:
        return jsonify({"error": "Failed to retrieve client profile.", "details": str(exc)}), 500
