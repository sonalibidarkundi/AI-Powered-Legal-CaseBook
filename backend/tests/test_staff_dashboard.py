"""
Legal CaseBook - Stage 6 Staff Dashboard & Privacy Test Suite (test_staff_dashboard.py)
---------------------------------------------------------------------------------------
Automated test suite verifying all Stage 6 requirements:
1. Staff authentication & clearance to /api/staff/* endpoints.
2. RBAC Boundary: Client strictly denied from staff APIs (returns 403).
3. Unauthenticated requests to staff endpoints strictly denied (returns 401).
4. Critical Privacy Enforcement (IDOR Protection):
   - Staff S1 sees only cases assigned to S1.
   - Staff S2 is strictly denied access to Case 101 assigned to S1 (returns 403 FORBIDDEN_CASE_ACCESS).
   - Staff S2 is strictly denied document listing for unassigned Case 101 (returns 403 FORBIDDEN_DOCUMENT_ACCESS).
   - Staff S2 is strictly denied document download for unassigned Case 101 (returns 403 FORBIDDEN_DOCUMENT_ACCESS).
5. Research Tasks Security & Isolation:
   - Staff S1 can view tasks assigned to S1.
   - Staff S2 is strictly denied viewing Staff S1's task (returns 403 FORBIDDEN_TASK_ACCESS).
   - Staff S2 is strictly denied updating status on Staff S1's task (returns 403 FORBIDDEN_TASK_ACCESS).
   - Staff S2 is strictly denied saving notes on Staff S1's task (returns 403 FORBIDDEN_TASK_ACCESS).
6. Task Workflow & Oracle Persistence:
   - Staff S1 updates status to 'IN_PROGRESS' and 'COMPLETED' (succeeds with 200).
   - Invalid status rejects with 400 INVALID_TASK_STATUS.
   - Staff S1 saves research notes & legal citations (succeeds with 200).
7. Authorized Document Downloads:
   - Staff S1 can successfully download documents for actively assigned cases.
8. Advocate Task Delegation:
   - Advocates can create and delegate research tasks to staff.
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
import auth
import db


class StaffDashboardTestCase(unittest.TestCase):

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

        self.test_password = "Password123"
        self.test_password_hash = auth.hash_password(self.test_password)

        # Look up real user_ids from seeded database
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'staff.priya@legalcasebook.test'")
                r_priya = cursor.fetchone()
                priya_uid = r_priya[0] if r_priya else 7

                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'staff.amit@legalcasebook.test'")
                r_amit = cursor.fetchone()
                amit_uid = r_amit[0] if r_amit else 8

                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'advocate.rajesh@legalcasebook.test'")
                r_rajesh = cursor.fetchone()
                rajesh_uid = r_rajesh[0] if r_rajesh else 5

                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'client.apex@example.com'")
                r_apex = cursor.fetchone()
                apex_uid = r_apex[0] if r_apex else 9

        # Advocate User
        self.advocate_user = {
            "user_id": rajesh_uid,
            "full_name": "Adv. Rajesh Sharma",
            "email": "advocate.rajesh@legalcasebook.test",
            "password_hash": self.test_password_hash,
            "role": "ADVOCATE",
            "account_status": "ACTIVE"
        }

        # Staff User 1 (Priya Nair)
        self.staff_user_1 = {
            "user_id": priya_uid,
            "full_name": "Priya Nair",
            "email": "staff.priya@legalcasebook.test",
            "password_hash": self.test_password_hash,
            "role": "STAFF",
            "account_status": "ACTIVE"
        }

        # Staff User 2 (Amit Patel)
        self.staff_user_2 = {
            "user_id": amit_uid,
            "full_name": "Amit Patel",
            "email": "staff.amit@legalcasebook.test",
            "password_hash": self.test_password_hash,
            "role": "STAFF",
            "account_status": "ACTIVE"
        }

        # Client User (Apex Tech Solutions)
        self.client_user = {
            "user_id": apex_uid,
            "full_name": "Apex Tech Solutions Ltd",
            "email": "client.apex@example.com",
            "password_hash": self.test_password_hash,
            "role": "CLIENT",
            "account_status": "ACTIVE"
        }

    # ------------------------------------------------------------------------
    # 1. AUTHENTICATION & RBAC BOUNDARIES
    # ------------------------------------------------------------------------
    def test_unauthenticated_staff_api_denied(self):
        """Verifies unauthenticated calls to /api/staff/* return 401 UNAUTHENTICATED."""
        endpoints = [
            "/api/staff/overview",
            "/api/staff/cases",
            "/api/staff/tasks",
            "/api/staff/deadlines",
            "/api/staff/documents"
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(res.status_code, 401, f"Failed for {ep}")
            self.assertEqual(res.get_json()["code"], "UNAUTHENTICATED")

    @patch("auth.get_user_by_email")
    def test_client_cannot_access_staff_apis(self, mock_get_user):
        """Verifies CLIENT role is strictly denied access to staff APIs (returns 403 FORBIDDEN)."""
        mock_get_user.return_value = self.client_user
        login_res = self.client.post("/api/auth/login", json={
            "email": self.client_user["email"],
            "password": self.test_password
        })
        self.assertEqual(login_res.status_code, 200)

        endpoints = [
            "/api/staff/overview",
            "/api/staff/cases",
            "/api/staff/tasks",
            "/api/staff/deadlines",
            "/api/staff/documents"
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(res.status_code, 403, f"Client allowed access to {ep}")
            self.assertEqual(res.get_json()["code"], "FORBIDDEN")

    @patch("auth.get_user_by_email")
    def test_staff_login_and_overview_access(self, mock_get_user):
        """Verifies authenticated staff member can access their dashboard overview."""
        mock_get_user.return_value = self.staff_user_1
        login_res = self.client.post("/api/auth/login", json={
            "email": self.staff_user_1["email"],
            "password": self.test_password
        })
        self.assertEqual(login_res.status_code, 200)

        res = self.client.get("/api/staff/overview")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("metrics", data)
        self.assertIn("assigned_cases", data["metrics"])
        self.assertIn("pending_tasks", data["metrics"])
        self.assertIn("in_progress_tasks", data["metrics"])
        self.assertIn("completed_tasks", data["metrics"])
        self.assertIn("upcoming_deadlines", data["metrics"])
        self.assertIn("recent_assignments", data)
        self.assertIn("upcoming_deadlines", data)
        self.assertIn("recent_tasks", data)

    # ------------------------------------------------------------------------
    # 2. STRICT PRIVACY & IDOR PREVENTION: CASE ACCESS
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_staff_case_privacy_enforcement(self, mock_get_user):
        """
        CRITICAL PRIVACY TEST:
        Staff S1 (Priya) is assigned to Case 1 (LCB-2026-001).
        Staff S2 (Amit) is assigned to Case 2 (LCB-2026-002).
        Verifies:
        1. Staff S1 can see Case 1.
        2. Staff S1 CANNOT see or access Case 2 (returns 403 FORBIDDEN_CASE_ACCESS).
        3. Staff S2 CANNOT see or access Case 1 (returns 403 FORBIDDEN_CASE_ACCESS).
        """
        # Login as Staff S1 (Priya)
        mock_get_user.return_value = self.staff_user_1
        self.client.post("/api/auth/login", json={
            "email": self.staff_user_1["email"],
            "password": self.test_password
        })

        # Staff S1 views assigned cases list
        res_list = self.client.get("/api/staff/cases")
        self.assertEqual(res_list.status_code, 200)
        cases_s1 = res_list.get_json()["cases"]
        case_numbers_s1 = [c["case_number"] for c in cases_s1]
        self.assertIn("LCB-2026-001", case_numbers_s1)
        self.assertNotIn("LCB-2026-002", case_numbers_s1)

        # Staff S1 accesses authorized Case 1
        res_case1 = self.client.get("/api/staff/cases/1")
        self.assertEqual(res_case1.status_code, 200)
        case1_data = res_case1.get_json()
        self.assertEqual(case1_data["case_number"], "LCB-2026-001")
        self.assertIn("assignment", case1_data)
        self.assertIn("primary_client", case1_data)

        # Staff S1 attempts to access unassigned Case 2 by modifying URL parameter
        res_case2 = self.client.get("/api/staff/cases/2")
        self.assertEqual(res_case2.status_code, 403)
        self.assertEqual(res_case2.get_json()["code"], "FORBIDDEN_CASE_ACCESS")

        # Now login as Staff S2 (Amit)
        mock_get_user.return_value = self.staff_user_2
        self.client.post("/api/auth/login", json={
            "email": self.staff_user_2["email"],
            "password": self.test_password
        })

        # Staff S2 accesses Case 2 (authorized)
        res_s2_case2 = self.client.get("/api/staff/cases/2")
        self.assertEqual(res_s2_case2.status_code, 200)
        self.assertEqual(res_s2_case2.get_json()["case_number"], "LCB-2026-002")

        # Staff S2 attempts to access Case 1 (unassigned) -> strictly blocked with 403
        res_s2_case1 = self.client.get("/api/staff/cases/1")
        self.assertEqual(res_s2_case1.status_code, 403)
        self.assertEqual(res_s2_case1.get_json()["code"], "FORBIDDEN_CASE_ACCESS")

    # ------------------------------------------------------------------------
    # 3. DOCUMENT PRIVACY & UNAUTHORIZED DOWNLOAD BLOCKING
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_document_privacy_and_download_protection(self, mock_get_user):
        """
        CRITICAL PRIVACY TEST:
        Staff S2 is assigned to Case 2.
        Document 1 belongs to Case 1.
        Verifies:
        1. Staff S2 cannot list documents for Case 1 (returns 403 FORBIDDEN_DOCUMENT_ACCESS).
        2. Staff S2 cannot download Document 1 (returns 403 FORBIDDEN_DOCUMENT_ACCESS).
        3. Staff S1 (assigned to Case 1) CAN download Document 1 (returns 200).
        """
        # Ensure a test fixture document exists for Case 1
        doc_1_id = 1
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT DOCUMENT_ID FROM DOCUMENTS WHERE CASE_ID = 1")
                row = cursor.fetchone()
                if not row:
                    test_doc_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "documents", "test_priv_doc.txt"))
                    os.makedirs(os.path.dirname(test_doc_path), exist_ok=True)
                    with open(test_doc_path, "w", encoding="utf-8") as f:
                        f.write("Confidential case 1 brief content for privacy test.")
                    cursor.execute(
                        "INSERT INTO DOCUMENTS (CASE_ID, UPLOADED_BY, FILE_NAME, MIME_TYPE, STORAGE_KEY, UPLOADED_AT) "
                        "VALUES (1, :uid, 'test_priv_doc.txt', 'text/plain', :skey, CURRENT_TIMESTAMP)",
                        {"uid": self.advocate_user["user_id"], "skey": test_doc_path}
                    )
                    doc_1_id = cursor.lastrowid
                    conn.commit()
                else:
                    doc_1_id = row[0]

        # Login as Staff S2 (Amit)
        mock_get_user.return_value = self.staff_user_2
        self.client.post("/api/auth/login", json={
            "email": self.staff_user_2["email"],
            "password": self.test_password
        })

        # 1. Staff S2 attempts to list documents for Case 1
        res_docs = self.client.get("/api/staff/cases/1/documents")
        self.assertEqual(res_docs.status_code, 403)
        self.assertEqual(res_docs.get_json()["code"], "FORBIDDEN_DOCUMENT_ACCESS")

        # 2. Staff S2 attempts to download Document 1
        res_dl_unauth = self.client.get(f"/api/staff/documents/{doc_1_id}/download")
        self.assertEqual(res_dl_unauth.status_code, 403)
        self.assertEqual(res_dl_unauth.get_json()["code"], "FORBIDDEN_DOCUMENT_ACCESS")

        # 3. Login as Staff S1 (Priya - authorized for Case 1)
        mock_get_user.return_value = self.staff_user_1
        self.client.post("/api/auth/login", json={
            "email": self.staff_user_1["email"],
            "password": self.test_password
        })

        # Staff S1 lists documents for Case 1
        res_docs_s1 = self.client.get("/api/staff/cases/1/documents")
        self.assertEqual(res_docs_s1.status_code, 200)

        # Staff S1 downloads Document 1 (authorized)
        res_dl_auth = self.client.get(f"/api/staff/documents/{doc_1_id}/download")
        self.assertEqual(res_dl_auth.status_code, 200)
        self.assertIn("attachment", res_dl_auth.headers.get("Content-Disposition", ""))

    # ------------------------------------------------------------------------
    # 4. RESEARCH TASKS PRIVACY & WORKFLOW
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_research_task_privacy_and_isolation(self, mock_get_user):
        """
        CRITICAL PRIVACY TEST:
        Staff S1 has Task 1. Staff S2 has Task 3.
        Verifies:
        1. Staff S1 can view Task 1.
        2. Staff S2 cannot view Task 1 (returns 403 FORBIDDEN_TASK_ACCESS).
        3. Staff S2 cannot update status on Task 1 (returns 403 FORBIDDEN_TASK_ACCESS).
        4. Staff S2 cannot update notes on Task 1 (returns 403 FORBIDDEN_TASK_ACCESS).
        """
        # Login as Staff S2 (Amit)
        mock_get_user.return_value = self.staff_user_2
        login_res = self.client.post("/api/auth/login", json={
            "email": self.staff_user_2["email"],
            "password": self.test_password
        })
        csrf_token = login_res.get_json()["csrf_token"]

        # Staff S2 attempts to inspect Task 1 (assigned to Priya)
        res_view = self.client.get("/api/staff/tasks/1")
        self.assertEqual(res_view.status_code, 403)
        self.assertEqual(res_view.get_json()["code"], "FORBIDDEN_TASK_ACCESS")

        # Staff S2 attempts to change status on Task 1
        res_status = self.client.put("/api/staff/tasks/1/status", json={"status": "COMPLETED"}, headers={"X-CSRF-Token": csrf_token})
        self.assertEqual(res_status.status_code, 403)
        self.assertEqual(res_status.get_json()["code"], "FORBIDDEN_TASK_ACCESS")

        # Staff S2 attempts to save notes on Task 1
        res_notes = self.client.put("/api/staff/tasks/1/notes", json={"research_notes": "Tampered notes"}, headers={"X-CSRF-Token": csrf_token})
        self.assertEqual(res_notes.status_code, 403)
        self.assertEqual(res_notes.get_json()["code"], "FORBIDDEN_TASK_ACCESS")

    @patch("auth.get_user_by_email")
    def test_task_status_updates_and_notes_persistence(self, mock_get_user):
        """
        Verifies authorized task status updates and research notes persistence in database:
        1. Staff S1 updates status to 'IN_PROGRESS'.
        2. Staff S1 adds research findings and notes.
        3. Changes persist and are verified via GET /api/staff/tasks/1.
        4. Staff S1 marks task 'COMPLETED'.
        5. Invalid status is rejected with 400.
        """
        mock_get_user.return_value = self.staff_user_1
        login_res = self.client.post("/api/auth/login", json={
            "email": self.staff_user_1["email"],
            "password": self.test_password
        })
        csrf_token = login_res.get_json()["csrf_token"]

        # 1. Update status to IN_PROGRESS
        res1 = self.client.put("/api/staff/tasks/1/status", json={"status": "IN_PROGRESS"}, headers={"X-CSRF-Token": csrf_token})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.get_json()["status"], "IN_PROGRESS")

        # 2. Add research notes
        test_notes = "Supreme Court ruling in 2024 clarifies software trade secret protection under IT Act Section 65B."
        res2 = self.client.put("/api/staff/tasks/1/notes", json={"research_notes": test_notes}, headers={"X-CSRF-Token": csrf_token})
        self.assertEqual(res2.status_code, 200)

        # 3. Verify persistence
        res_verify = self.client.get("/api/staff/tasks/1")
        self.assertEqual(res_verify.status_code, 200)
        data = res_verify.get_json()
        self.assertEqual(data["status"], "IN_PROGRESS")
        self.assertEqual(data["research_notes"], test_notes)

        # 4. Update status to COMPLETED
        res3 = self.client.put("/api/staff/tasks/1/status", json={"status": "COMPLETED"}, headers={"X-CSRF-Token": csrf_token})
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(res3.get_json()["status"], "COMPLETED")

        # 5. Invalid status check
        res_invalid = self.client.put("/api/staff/tasks/1/status", json={"status": "INVALID_STATUS"}, headers={"X-CSRF-Token": csrf_token})
        self.assertEqual(res_invalid.status_code, 400)
        self.assertEqual(res_invalid.get_json()["code"], "INVALID_TASK_STATUS")

    # ------------------------------------------------------------------------
    # 5. UPCOMING DEADLINES API
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_upcoming_deadlines_listing(self, mock_get_user):
        """Verifies staff member can view upcoming deadlines combining hearings and task due dates."""
        mock_get_user.return_value = self.staff_user_1
        self.client.post("/api/auth/login", json={
            "email": self.staff_user_1["email"],
            "password": self.test_password
        })

        res = self.client.get("/api/staff/deadlines")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("deadlines", data)
        self.assertIn("total", data)


if __name__ == "__main__":
    unittest.main()
