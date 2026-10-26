"""
clean_seed_data.py
Removes fictional seed data and all audit logs from the Legal CaseBook database.
Preserves real user accounts (Sonali, Bavani, Sonal Kumar, Shrusti) and real cases (CIV/2026/001).
"""

import os
import sys
import sqlite3

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "casebook.db"))

SEED_EMAILS = [
    "advocate.rajesh@legalcasebook.test",
    "advocate.neha@legalcasebook.test",
    "staff.priya@legalcasebook.test",
    "staff.amit@legalcasebook.test",
    "client.apex@example.com",
    "kavita.rao@example.com",
    "test.advocate@court.com"
]

SEED_CASES = [
    "LCB-2026-001",
    "LCB-2026-002",
    "LCB-2026-003"
]

SEED_EMP_CODES = [
    "EMP-LCB-001",
    "EMP-LCB-002"
]

def clean_database():
    if not os.path.exists(DB_PATH):
        print(f"[!] Database file not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("[*] Starting clean up of seed data and audit logs...")

        # 1. Clear AUDIT_LOGS completely
        cursor.execute("DELETE FROM AUDIT_LOGS")
        print(f"[+] Cleared AUDIT_LOGS (rows deleted: {cursor.rowcount})")

        # 2. Get Seed Case IDs
        cursor.execute(
            f"SELECT CASE_ID FROM CASES WHERE CASE_NUMBER IN ({','.join(['?']*len(SEED_CASES))})",
            SEED_CASES
        )
        case_ids = [r[0] for r in cursor.fetchall()]
        print(f"[*] Found seed case IDs: {case_ids}")

        # 3. Get Seed User IDs
        cursor.execute(
            f"SELECT USER_ID FROM USERS WHERE EMAIL IN ({','.join(['?']*len(SEED_EMAILS))})",
            SEED_EMAILS
        )
        user_ids = [r[0] for r in cursor.fetchall()]
        print(f"[*] Found seed user IDs: {user_ids}")

        # Delete dependent data for seed cases and seed users
        if case_ids or user_ids:
            case_placeholders = ','.join(['?']*len(case_ids)) if case_ids else 'NULL'
            user_placeholders = ','.join(['?']*len(user_ids)) if user_ids else 'NULL'

            # CHAT_MESSAGES
            cursor.execute(
                f"""
                DELETE FROM CHAT_MESSAGES 
                WHERE SESSION_ID IN (
                    SELECT SESSION_ID FROM CHAT_SESSIONS 
                    WHERE CASE_ID IN ({case_placeholders}) OR USER_ID IN ({user_placeholders})
                )
                """,
                case_ids + user_ids
            )
            print(f"[+] Deleted CHAT_MESSAGES: {cursor.rowcount}")

            # CHAT_SESSIONS
            cursor.execute(
                f"""
                DELETE FROM CHAT_SESSIONS 
                WHERE CASE_ID IN ({case_placeholders}) OR USER_ID IN ({user_placeholders})
                """,
                case_ids + user_ids
            )
            print(f"[+] Deleted CHAT_SESSIONS: {cursor.rowcount}")

            # CLIENT_INQUIRIES
            cursor.execute(
                f"""
                DELETE FROM CLIENT_INQUIRIES 
                WHERE CASE_ID IN ({case_placeholders}) 
                   OR ADVOCATE_ID IN ({user_placeholders})
                   OR CLIENT_ID IN (SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID IN ({user_placeholders}))
                """,
                case_ids + user_ids + user_ids
            )
            print(f"[+] Deleted CLIENT_INQUIRIES: {cursor.rowcount}")

            # DOCUMENT_SUMMARIES
            if case_ids:
                cursor.execute(
                    f"DELETE FROM DOCUMENT_SUMMARIES WHERE CASE_ID IN ({case_placeholders})",
                    case_ids
                )
                print(f"[+] Deleted DOCUMENT_SUMMARIES: {cursor.rowcount}")

            # DOCUMENTS
            cursor.execute(
                f"""
                DELETE FROM DOCUMENTS 
                WHERE CASE_ID IN ({case_placeholders}) OR UPLOADED_BY IN ({user_placeholders})
                """,
                case_ids + user_ids
            )
            print(f"[+] Deleted DOCUMENTS: {cursor.rowcount}")

            # HEARINGS
            if case_ids:
                cursor.execute(
                    f"DELETE FROM HEARINGS WHERE CASE_ID IN ({case_placeholders})",
                    case_ids
                )
                print(f"[+] Deleted HEARINGS: {cursor.rowcount}")

            # RESEARCH_TASKS
            cursor.execute(
                f"""
                DELETE FROM RESEARCH_TASKS 
                WHERE CASE_ID IN ({case_placeholders}) 
                   OR ASSIGNED_BY IN ({user_placeholders})
                   OR STAFF_ID IN (SELECT STAFF_ID FROM STAFF WHERE USER_ID IN ({user_placeholders}))
                """,
                case_ids + user_ids + user_ids
            )
            print(f"[+] Deleted RESEARCH_TASKS: {cursor.rowcount}")

            # CASE_ASSIGNMENTS
            cursor.execute(
                f"""
                DELETE FROM CASE_ASSIGNMENTS 
                WHERE CASE_ID IN ({case_placeholders})
                   OR ASSIGNED_BY IN ({user_placeholders})
                   OR STAFF_ID IN (SELECT STAFF_ID FROM STAFF WHERE USER_ID IN ({user_placeholders}))
                """,
                case_ids + user_ids + user_ids
            )
            print(f"[+] Deleted CASE_ASSIGNMENTS: {cursor.rowcount}")

            # CASE_CLIENTS
            cursor.execute(
                f"""
                DELETE FROM CASE_CLIENTS 
                WHERE CASE_ID IN ({case_placeholders})
                   OR CLIENT_ID IN (SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID IN ({user_placeholders}))
                """,
                case_ids + user_ids
            )
            print(f"[+] Deleted CASE_CLIENTS: {cursor.rowcount}")

            # CASES
            if case_ids:
                cursor.execute(
                    f"DELETE FROM CASES WHERE CASE_ID IN ({case_placeholders})",
                    case_ids
                )
                print(f"[+] Deleted CASES: {cursor.rowcount}")

        # Delete Seed Staff
        cursor.execute(
            f"DELETE FROM STAFF WHERE EMPLOYEE_CODE IN ({','.join(['?']*len(SEED_EMP_CODES))})",
            SEED_EMP_CODES
        )
        print(f"[+] Deleted STAFF: {cursor.rowcount}")

        # Delete Seed Clients
        if user_ids:
            cursor.execute(
                f"DELETE FROM CLIENTS WHERE USER_ID IN ({','.join(['?']*len(user_ids))})",
                user_ids
            )
            print(f"[+] Deleted CLIENTS: {cursor.rowcount}")

        # Delete Seed Users
        cursor.execute(
            f"DELETE FROM USERS WHERE EMAIL IN ({','.join(['?']*len(SEED_EMAILS))})",
            SEED_EMAILS
        )
        print(f"[+] Deleted USERS: {cursor.rowcount}")

        conn.commit()
        cursor.execute("VACUUM")
        print("[+] VACUUM completed successfully.")
        print("[+] Seed data and audit logs successfully wiped!")

    except Exception as exc:
        conn.rollback()
        print(f"[!] Cleanup failed: {exc}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    clean_database()
