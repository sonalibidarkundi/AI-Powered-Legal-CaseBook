"""
Legal CaseBook - Chatbot & RAG API Blueprint (chat_api.py)
----------------------------------------------------------
Provides secure, role-aware conversational Q&A and Retrieval-Augmented Generation (RAG)
over legal filings, case proceedings, hearings, tasks, and document summaries.

Endpoints:
- GET  /api/chat/cases                 : List authorized cases for chat context selector
- GET  /api/chat/cases/<id>/documents  : List documents in case for focused document Q&A
- GET  /api/chat/sessions              : List active user's chat sessions
- POST /api/chat/sessions              : Create a new chat session
- GET  /api/chat/sessions/<id>         : Load full conversation history for session
- DELETE /api/chat/sessions/<id>       : Delete chat session and messages
- POST /api/chat/query                 : Main RAG Q&A query endpoint
- GET  /api/chat/suggested-prompts     : Dynamic context-aware suggested prompts
"""

import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from flask import Blueprint, jsonify, request, session

import db
import auth
import grok_client
import rag_engine

chat_bp = Blueprint("chat_bp", __name__, url_prefix="/api/chat")


def get_authorized_user_cases(cursor, user_id: int, user_role: str) -> List[Dict[str, Any]]:
    """Fetches list of cases accessible to the user based on RBAC rules."""
    if user_role == "ADVOCATE":
        cursor.execute(
            """
            SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                   COUNT(d.DOCUMENT_ID) AS DOC_COUNT
            FROM CASES c
            LEFT JOIN DOCUMENTS d ON c.CASE_ID = d.CASE_ID
            WHERE c.CREATED_BY = :uid
            GROUP BY c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE
            ORDER BY c.CREATED_AT DESC
            """,
            {"uid": user_id}
        )
    elif user_role == "STAFF":
        cursor.execute("SELECT STAFF_ID FROM STAFF WHERE USER_ID = :uid", {"uid": user_id})
        s_row = cursor.fetchone()
        if not s_row:
            return []
        staff_id = s_row[0]

        cursor.execute(
            """
            SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                   COUNT(d.DOCUMENT_ID) AS DOC_COUNT
            FROM CASES c
            JOIN CASE_ASSIGNMENTS ca ON c.CASE_ID = ca.CASE_ID
            LEFT JOIN DOCUMENTS d ON c.CASE_ID = d.CASE_ID
            WHERE ca.STAFF_ID = :sid AND ca.ASSIGNMENT_STATUS = 'ACTIVE'
            GROUP BY c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE
            ORDER BY c.CREATED_AT DESC
            """,
            {"sid": staff_id}
        )
    elif user_role == "CLIENT":
        cursor.execute("SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid", {"uid": user_id})
        c_row = cursor.fetchone()
        if not c_row:
            return []
        client_id = c_row[0]

        cursor.execute(
            """
            SELECT c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE,
                   COUNT(d.DOCUMENT_ID) AS DOC_COUNT
            FROM CASES c
            JOIN CASE_CLIENTS cc ON c.CASE_ID = cc.CASE_ID
            LEFT JOIN DOCUMENTS d ON c.CASE_ID = d.CASE_ID
            WHERE cc.CLIENT_ID = :clid
            GROUP BY c.CASE_ID, c.CASE_NUMBER, c.TITLE, c.CASE_STATUS, c.CASE_TYPE
            ORDER BY c.CREATED_AT DESC
            """,
            {"clid": client_id}
        )
    else:
        return []

    rows = cursor.fetchall()
    return [
        {
            "case_id": r[0],
            "case_number": r[1],
            "title": r[2],
            "status": r[3],
            "type": r[4],
            "doc_count": r[5]
        }
        for r in rows
    ]


def verify_user_case_access(cursor, user_id: int, user_role: str, case_id: int) -> bool:
    """Checks whether the logged in user has read access to the specified case."""
    if not case_id:
        return True

    if user_role == "ADVOCATE":
        cursor.execute("SELECT 1 FROM CASES WHERE CASE_ID = :cid AND CREATED_BY = :uid", {"cid": case_id, "uid": user_id})
        return cursor.fetchone() is not None
    elif user_role == "STAFF":
        cursor.execute("SELECT STAFF_ID FROM STAFF WHERE USER_ID = :uid", {"uid": user_id})
        s_row = cursor.fetchone()
        if not s_row:
            return False
        staff_id = s_row[0]
        cursor.execute(
            "SELECT 1 FROM CASE_ASSIGNMENTS WHERE CASE_ID = :cid AND STAFF_ID = :sid AND ASSIGNMENT_STATUS = 'ACTIVE'",
            {"cid": case_id, "sid": staff_id}
        )
        return cursor.fetchone() is not None
    elif user_role == "CLIENT":
        cursor.execute("SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid", {"uid": user_id})
        c_row = cursor.fetchone()
        if not c_row:
            return False
        client_id = c_row[0]
        cursor.execute("SELECT 1 FROM CASE_CLIENTS WHERE CASE_ID = :cid AND CLIENT_ID = :clid", {"cid": case_id, "clid": client_id})
        return cursor.fetchone() is not None
    return False


@chat_bp.route("/cases", methods=["GET"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def list_chat_cases():
    """GET /api/chat/cases - Returns cases the user can chat about."""
    user_id = session.get("user_id")
    role = session.get("role")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cases = get_authorized_user_cases(cursor, user_id, role)
            return jsonify({"cases": cases, "total": len(cases)}), 200


@chat_bp.route("/cases/<int:case_id>/documents", methods=["GET"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def list_case_documents(case_id: int):
    """GET /api/chat/cases/<id>/documents - Returns documents in case for focused chat."""
    user_id = session.get("user_id")
    role = session.get("role")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            if not verify_user_case_access(cursor, user_id, role, case_id):
                return jsonify({"error": "Access denied to this case.", "code": "FORBIDDEN_CASE_ACCESS"}), 403

            cursor.execute(
                """
                SELECT DOCUMENT_ID, FILE_NAME, DOCUMENT_TITLE, MIME_TYPE, ASSIGNMENT_STATUS
                FROM DOCUMENTS
                WHERE CASE_ID = :cid
                ORDER BY UPLOADED_AT DESC
                """,
                {"cid": case_id}
            )
            docs = [
                {
                    "document_id": r[0],
                    "file_name": r[1],
                    "title": r[2] or r[1],
                    "mime_type": r[3],
                    "status": r[4]
                }
                for r in cursor.fetchall()
            ]
            return jsonify({"documents": docs, "total": len(docs)}), 200


@chat_bp.route("/sessions", methods=["GET"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def list_chat_sessions():
    """GET /api/chat/sessions - Lists chat sessions for current user."""
    user_id = session.get("user_id")
    case_filter = request.args.get("case_id")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            query = """
                SELECT cs.SESSION_ID, cs.TITLE, cs.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                       cs.DOCUMENT_ID, d.FILE_NAME, cs.PERSPECTIVE,
                       TO_CHAR(cs.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                       TO_CHAR(cs.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT,
                       COUNT(cm.MESSAGE_ID) AS MSG_COUNT
                FROM CHAT_SESSIONS cs
                LEFT JOIN CASES c ON cs.CASE_ID = c.CASE_ID
                LEFT JOIN DOCUMENTS d ON cs.DOCUMENT_ID = d.DOCUMENT_ID
                LEFT JOIN CHAT_MESSAGES cm ON cs.SESSION_ID = cm.SESSION_ID
                WHERE cs.USER_ID = :uid
            """
            params = {"uid": user_id}

            if case_filter:
                try:
                    query += " AND cs.CASE_ID = :cid"
                    params["cid"] = int(case_filter)
                except ValueError:
                    pass

            query += """
                GROUP BY cs.SESSION_ID, cs.TITLE, cs.CASE_ID, c.CASE_NUMBER, c.TITLE,
                         cs.DOCUMENT_ID, d.FILE_NAME, cs.PERSPECTIVE, cs.CREATED_AT, cs.UPDATED_AT
                ORDER BY cs.UPDATED_AT DESC
            """

            cursor.execute(query, params)
            sessions_list = [
                {
                    "session_id": r[0],
                    "title": r[1],
                    "case_id": r[2],
                    "case_number": r[3],
                    "case_title": r[4],
                    "document_id": r[5],
                    "file_name": r[6],
                    "perspective": r[7] or "comprehensive",
                    "created_at": r[8],
                    "updated_at": r[9],
                    "message_count": r[10]
                }
                for r in cursor.fetchall()
            ]
            return jsonify({"sessions": sessions_list, "total": len(sessions_list)}), 200


@chat_bp.route("/sessions", methods=["POST"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def create_chat_session():
    """POST /api/chat/sessions - Creates a new chat session."""
    user_id = session.get("user_id")
    role = session.get("role")
    auth.verify_csrf_token()

    body = request.get_json(silent=True) or {}
    case_id = body.get("case_id")
    document_id = body.get("document_id")
    title = body.get("title", "New Legal Consultation").strip()
    perspective = body.get("perspective", "comprehensive")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            if case_id and not verify_user_case_access(cursor, user_id, role, case_id):
                return jsonify({"error": "Access denied to specified case.", "code": "FORBIDDEN_CASE_ACCESS"}), 403

            cursor.execute(
                """
                INSERT INTO CHAT_SESSIONS (USER_ID, CASE_ID, DOCUMENT_ID, TITLE, PERSPECTIVE, CREATED_AT, UPDATED_AT)
                VALUES (:uid, :cid, :did, :title, :persp, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                {
                    "uid": user_id,
                    "cid": case_id,
                    "did": document_id,
                    "title": title,
                    "persp": perspective
                }
            )
            session_id = cursor.lastrowid
            conn.commit()

            return jsonify({
                "message": "Chat session initialized.",
                "session": {
                    "session_id": session_id,
                    "title": title,
                    "case_id": case_id,
                    "document_id": document_id,
                    "perspective": perspective
                }
            }), 201


@chat_bp.route("/sessions/<int:session_id>", methods=["GET"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def get_chat_session(session_id: int):
    """GET /api/chat/sessions/<id> - Returns session details and full message history."""
    user_id = session.get("user_id")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT cs.SESSION_ID, cs.USER_ID, cs.CASE_ID, c.CASE_NUMBER, c.TITLE AS CASE_TITLE,
                       cs.DOCUMENT_ID, d.FILE_NAME, cs.TITLE, cs.PERSPECTIVE,
                       TO_CHAR(cs.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT
                FROM CHAT_SESSIONS cs
                LEFT JOIN CASES c ON cs.CASE_ID = c.CASE_ID
                LEFT JOIN DOCUMENTS d ON cs.DOCUMENT_ID = d.DOCUMENT_ID
                WHERE cs.SESSION_ID = :sid AND cs.USER_ID = :uid
                """,
                {"sid": session_id, "uid": user_id}
            )
            s_row = cursor.fetchone()
            if not s_row:
                return jsonify({"error": "Session not found or access denied.", "code": "SESSION_NOT_FOUND"}), 404

            session_meta = {
                "session_id": s_row[0],
                "case_id": s_row[2],
                "case_number": s_row[3],
                "case_title": s_row[4],
                "document_id": s_row[5],
                "file_name": s_row[6],
                "title": s_row[7],
                "perspective": s_row[8] or "comprehensive",
                "created_at": s_row[9]
            }

            cursor.execute(
                """
                SELECT MESSAGE_ID, ROLE, CONTENT, CITATIONS_JSON, MODEL_NAME,
                       TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT
                FROM CHAT_MESSAGES
                WHERE SESSION_ID = :sid
                ORDER BY CREATED_AT ASC, MESSAGE_ID ASC
                """,
                {"sid": session_id}
            )
            messages = []
            for m in cursor.fetchall():
                c_json = m[3]
                citations = []
                if c_json:
                    try:
                        citations = json.loads(c_json)
                    except Exception:
                        citations = []
                messages.append({
                    "message_id": m[0],
                    "role": m[1],
                    "content": m[2],
                    "citations": citations,
                    "model": m[4],
                    "created_at": m[5]
                })

            return jsonify({
                "session": session_meta,
                "messages": messages,
                "total_messages": len(messages)
            }), 200


@chat_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def delete_chat_session(session_id: int):
    """DELETE /api/chat/sessions/<id> - Deletes a chat session."""
    user_id = session.get("user_id")
    auth.verify_csrf_token()

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM CHAT_MESSAGES WHERE SESSION_ID IN (SELECT SESSION_ID FROM CHAT_SESSIONS WHERE SESSION_ID = :sid AND USER_ID = :uid)",
                {"sid": session_id, "uid": user_id}
            )
            cursor.execute(
                "DELETE FROM CHAT_SESSIONS WHERE SESSION_ID = :sid AND USER_ID = :uid",
                {"sid": session_id, "uid": user_id}
            )
            conn.commit()
            return jsonify({"message": "Chat session deleted successfully."}), 200


@chat_bp.route("/query", methods=["POST"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def submit_chat_query():
    """
    POST /api/chat/query
    --------------------
    Main RAG Q&A query endpoint.
    1. Validates user input and anti-CSRF token.
    2. Enforces RBAC permissions on target case / document.
    3. Retrieves context from documents, hearings, tasks via hybrid RAG engine.
    4. Generates grounded answer using GroqCloud / xAI Grok API.
    5. Stores user query and assistant response with citations in chat session.
    """
    user_id = session.get("user_id")
    user_role = session.get("role")
    auth.verify_csrf_token()

    body = request.get_json(silent=True) or {}
    user_query = body.get("query", "").strip()
    session_id = body.get("session_id")
    case_id = body.get("case_id")
    document_id = body.get("document_id")
    perspective = body.get("perspective", "comprehensive")

    if not user_query:
        return jsonify({"error": "Query cannot be empty.", "code": "EMPTY_QUERY"}), 400

    if len(user_query) > 4000:
        return jsonify({"error": "Query exceeds maximum limit of 4,000 characters.", "code": "QUERY_TOO_LONG"}), 400

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 1. Resolve or verify session
            if session_id:
                cursor.execute(
                    "SELECT SESSION_ID, CASE_ID, DOCUMENT_ID, PERSPECTIVE FROM CHAT_SESSIONS WHERE SESSION_ID = :sid AND USER_ID = :uid",
                    {"sid": session_id, "uid": user_id}
                )
                s_row = cursor.fetchone()
                if not s_row:
                    return jsonify({"error": "Invalid session or access denied.", "code": "INVALID_SESSION"}), 403
                if not case_id:
                    case_id = s_row[1]
                if not document_id:
                    document_id = s_row[2]
                if not body.get("perspective"):
                    perspective = s_row[3] or "comprehensive"
            else:
                # Generate a short smart title from query
                clean_title = user_query[:45].strip()
                if len(user_query) > 45:
                    clean_title += "..."
                cursor.execute(
                    """
                    INSERT INTO CHAT_SESSIONS (USER_ID, CASE_ID, DOCUMENT_ID, TITLE, PERSPECTIVE, CREATED_AT, UPDATED_AT)
                    VALUES (:uid, :cid, :did, :title, :persp, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    {
                        "uid": user_id,
                        "cid": case_id,
                        "did": document_id,
                        "title": clean_title,
                        "persp": perspective
                    }
                )
                session_id = cursor.lastrowid

            # 2. Authorization check on case / document
            if case_id and not verify_user_case_access(cursor, user_id, user_role, case_id):
                return jsonify({"error": "Access denied to the specified case.", "code": "FORBIDDEN_CASE_ACCESS"}), 403

            # 3. Load recent chat history for session memory
            cursor.execute(
                """
                SELECT ROLE, CONTENT
                FROM CHAT_MESSAGES
                WHERE SESSION_ID = :sid
                ORDER BY CREATED_AT DESC
                LIMIT 6
                """,
                {"sid": session_id}
            )
            history_rows = cursor.fetchall()
            chat_history = [{"role": r[0], "content": r[1]} for r in reversed(history_rows)]

            # 4. Save User Message
            cursor.execute(
                """
                INSERT INTO CHAT_MESSAGES (SESSION_ID, ROLE, CONTENT, CREATED_AT)
                VALUES (:sid, 'user', :content, CURRENT_TIMESTAMP)
                """,
                {"sid": session_id, "content": user_query}
            )
            conn.commit()

    # 5. Execute RAG Query
    try:
        rag_result = rag_engine.query_rag_chatbot(
            query=user_query,
            case_id=case_id,
            document_id=document_id,
            user_id=user_id,
            user_role=user_role,
            perspective=perspective,
            chat_history=chat_history
        )
    except Exception as exc:
        print(f"[RAG Execution Error]: {exc}")
        rag_result = {
            "answer": f"An error occurred while retrieving case intelligence: {str(exc)}\n\n---\n*{grok_client.LEGAL_DISCLAIMER}*",
            "citations": [],
            "model": "Error Fallback",
            "perspective": perspective,
            "status": "ERROR"
        }

    answer_text = rag_result.get("answer", "")
    citations = rag_result.get("citations", [])
    model_used = rag_result.get("model", "grok-2-latest")

    # 6. Save Assistant Response to Database
    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO CHAT_MESSAGES (SESSION_ID, ROLE, CONTENT, CITATIONS_JSON, MODEL_NAME, CREATED_AT)
                VALUES (:sid, 'assistant', :content, :cjson, :model, CURRENT_TIMESTAMP)
                """,
                {
                    "sid": session_id,
                    "content": answer_text,
                    "cjson": json.dumps(citations),
                    "model": model_used
                }
            )
            # Update session timestamp and perspective
            cursor.execute(
                """
                UPDATE CHAT_SESSIONS
                SET UPDATED_AT = CURRENT_TIMESTAMP, PERSPECTIVE = :persp
                WHERE SESSION_ID = :sid
                """,
                {"sid": session_id, "persp": perspective}
            )
            conn.commit()

    return jsonify({
        "session_id": session_id,
        "answer": answer_text,
        "citations": citations,
        "model": model_used,
        "perspective": perspective,
        "status": rag_result.get("status", "SUCCESS")
    }), 200


@chat_bp.route("/suggested-prompts", methods=["GET"])
@auth.role_required(["ADVOCATE", "STAFF", "CLIENT"])
def get_suggested_prompts():
    """GET /api/chat/suggested-prompts - Contextual prompt chips for quick user interaction."""
    case_id = request.args.get("case_id")
    user_role = session.get("role")

    prompts = [
        "What are the core legal disputes and statutory claims in this case?",
        "When is the next court hearing and what are the scheduled court details?",
        "Highlight high-risk contractual clauses or breach liabilities in the filings.",
        "What research tasks and evidentiary filings are currently pending?",
        "Summarize the key parties, roles, and obligations stated in the records.",
        "What cross-examination questions or strategic defenses should counsel prepare?"
    ]

    if user_role == "CLIENT":
        prompts = [
            "What is the current status and summary of my case?",
            "When is our next court hearing scheduled?",
            "What are my required obligations or documents needed?",
            "Can you explain the main legal terms in plain language?"
        ]

    return jsonify({"prompts": prompts}), 200
