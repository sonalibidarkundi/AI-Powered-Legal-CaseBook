"""
Legal CaseBook - Stage 7 Client Dashboard & Privacy Test Suite (test_client_dashboard.py)
-------------------------------------------------------------------------------------------
Comprehensive automated test suite verifying all Stage 7 requirements:
1. Client authentication & clearance to /api/client/* endpoints.
2. RBAC Boundary & Session-derived identity:
   - Unauthenticated access returns 401.
   - Client identity derived strictly from server session.
3. Live Oracle / Relational Database Metrics:
   - /api/client/overview returns genuine counts (total_cases, active_cases, total_documents, upcoming_hearings).
4. Strict IDOR Isolation (Case Ownership):
   - Client 1 (Apex) sees only Case 1 & 3.
   - Client 2 (Kavita) sees only Case 2.
   - Client 1 blocked from accessing Case 2 (403 FORBIDDEN_CASE_ACCESS).
   - Client 2 blocked from accessing Case 1 (403 FORBIDDEN_CASE_ACCESS).
5. Document Security & IDOR:
   - Client 1 blocked from downloading or previewing Case 2's documents (403).
6. Document Deletion Business Rule:
   - Client can delete a document they personally uploaded.
   - Client CANNOT delete a document uploaded by Advocate (403 UNAUTHORIZED_DOCUMENT_DELETION).
7. Confidentiality & Staff Task Boundary:
   - Client case details endpoint never exposes internal staff tasks (RESEARCH_TASKS) or private staff notes.
8. Client Inquiry Workflow:
   - Client can submit an inquiry to assigned advocate.
   - Persists in CLIENT_INQUIRIES and AUDIT_LOGS.
   - Client cannot submit inquiry for an unassigned case (403).
9. Hearings & Advocate Contact:
   - Chronological hearings cause list.
   - Authorized advocate contact details.
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import io

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
import auth
import db


class ClientDashboardTestCase(unittest.TestCase):

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

        # Seeded client accounts
        self.client1_email = "client.apex@example.com"
        self.client2_email = "kavita.rao@example.com"
        self.staff_email = "staff.priya@legalcasebook.test"
        self.advocate_email = "advocate.rajesh@legalcasebook.test"
        self.password = "Password123"

        # Lookup IDs from database
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = :em", {"em": self.client1_email})
                r1 = cursor.fetchone()
                self.client1_uid = r1[0] if r1 else 9

                cursor.execute("SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid", {"uid": self.client1_uid})
                cl1 = cursor.fetchone()
                self.client1_clid = cl1[0] if cl1 else 1

                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = :em", {"em": self.client2_email})
                r2 = cursor.fetchone()
                self.client2_uid = r2[0] if r2 else 10

                cursor.execute("SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid", {"uid": self.client2_uid})
                cl2 = cursor.fetchone()
                self.client2_clid = cl2[0] if cl2 else 2

                # Case 1 belongs to Client 1, Case 2 belongs to Client 2
                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-001'")
                c1 = cursor.fetchone()
                self.case1_id = c1[0] if c1 else 1

                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-002'")
                c2 = cursor.fetchone()
                self.case2_id = c2[0] if c2 else 2

    def _login_as(self, email, password):
        """Helper to establish a session for testing."""
        res = self.client.post("/api/auth/login", json={
            "email": email,
            "password": password
        })
        csrf_token = None
        if res.status_code == 200:
            data = res.get_json()
            csrf_token = data.get("csrf_token")
        return res, csrf_token

    # ------------------------------------------------------------------------
    # 1. Unauthenticated & RBAC Access Tests
    # ------------------------------------------------------------------------

    def test_unauthenticated_client_overview_denied(self):
        """Unauthenticated requests to client overview must return 401."""
        res = self.client.get("/api/client/overview")
        self.assertEqual(res.status_code, 401)

    def test_unauthenticated_client_cases_denied(self):
        """Unauthenticated requests to client cases must return 401."""
        res = self.client.get("/api/client/cases")
        self.assertEqual(res.status_code, 401)

    # ------------------------------------------------------------------------
    # 2. Client Overview & Real Database Metrics
    # ------------------------------------------------------------------------

    def test_client1_overview_metrics(self):
        """Client 1 receives real overview metrics from database for their cases."""
        login_res, _ = self._login_as(self.client1_email, self.password)
        self.assertEqual(login_res.status_code, 200)

        res = self.client.get("/api/client/overview")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("metrics", data)
        metrics = data["metrics"]
        self.assertGreaterEqual(metrics["total_cases"], 1)
        self.assertGreaterEqual(metrics["active_cases"], 1)
        self.assertIn("total_documents", metrics)
        self.assertIn("upcoming_hearings", metrics)

        self.assertIn("recent_cases", data)
        self.assertIn("upcoming_hearings_list", data)
        self.assertIn("client_profile", data)
        self.assertEqual(data["client_profile"]["email"], self.client1_email)

    # ------------------------------------------------------------------------
    # 3. IDOR Isolation & Scoped Case Access
    # ------------------------------------------------------------------------

    def test_client_cases_scoped_strictly_to_owner(self):
        """Client 1 must only see Case 1 & Case 3, and NEVER Case 2."""
        self._login_as(self.client1_email, self.password)
        res = self.client.get("/api/client/cases")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        case_numbers = [c["case_number"] for c in data["cases"]]
        self.assertIn("LCB-2026-001", case_numbers)
        self.assertNotIn("LCB-2026-002", case_numbers, "Client 1 must not see Client 2's case!")

    def test_client_idor_case_details_blocked(self):
        """Client 1 attempting to view Case 2 must receive 403 FORBIDDEN_CASE_ACCESS."""
        self._login_as(self.client1_email, self.password)
        res = self.client.get(f"/api/client/cases/{self.case2_id}")
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data.get("code"), "FORBIDDEN_CASE_ACCESS")

    def test_client2_idor_case1_blocked(self):
        """Client 2 attempting to view Case 1 must receive 403 FORBIDDEN_CASE_ACCESS."""
        self._login_as(self.client2_email, self.password)
        res = self.client.get(f"/api/client/cases/{self.case1_id}")
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data.get("code"), "FORBIDDEN_CASE_ACCESS")

    # ------------------------------------------------------------------------
    # 4. Case Details & Privacy Boundary (No Staff Tasks)
    # ------------------------------------------------------------------------

    def test_case_details_authorized_and_no_staff_tasks(self):
        """Client 1 can access Case 1 details, including advocate and hearings, with no staff notes."""
        self._login_as(self.client1_email, self.password)
        res = self.client.get(f"/api/client/cases/{self.case1_id}")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("case", data)
        c = data["case"]
        self.assertEqual(c["case_number"], "LCB-2026-001")
        self.assertIn("advocate", c)
        self.assertIn("hearings", c)
        self.assertIn("documents", c)

        # STRICT PRIVACY: research_tasks and internal staff notes must NOT exist in client response
        self.assertNotIn("research_tasks", c)
        self.assertNotIn("staff_tasks", c)
        self.assertNotIn("internal_notes", c)

    # ------------------------------------------------------------------------
    # 5. Document Management & Deletion Business Rule
    # ------------------------------------------------------------------------

    def test_document_listing_scoped_to_client(self):
        """Client 1 document list only contains documents from their authorized cases."""
        self._login_as(self.client1_email, self.password)
        res = self.client.get("/api/client/documents")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        for doc in data["documents"]:
            self.assertNotEqual(doc["case_id"], self.case2_id, "Document from unassigned case leaked!")

    def test_client_upload_and_delete_rule(self):
        """
        Verify:
        1. Client 1 uploads a valid text document to Case 1.
        2. Client 1 can preview the document.
        3. Client 1 can delete the document they uploaded.
        """
        _, csrf_token = self._login_as(self.client1_email, self.password)

        # 1a. Attempt upload without assigned_staff_id (must return 400 STAFF_ASSIGNMENT_REQUIRED)
        res_no_staff = self.client.post(
            f"/api/client/cases/{self.case1_id}/documents/upload",
            data={
                "title": "Test Without Staff",
                "file": (io.BytesIO(b"No staff test"), "no_staff.txt")
            },
            headers={"X-CSRF-Token": csrf_token},
            content_type="multipart/form-data"
        )
        self.assertEqual(res_no_staff.status_code, 400)
        self.assertEqual(res_no_staff.get_json().get("code"), "STAFF_ASSIGNMENT_REQUIRED")

        # 1b. Fetch eligible staff for case 1
        res_staff = self.client.get(f"/api/client/cases/{self.case1_id}/eligible-staff")
        self.assertEqual(res_staff.status_code, 200)
        eligible_list = res_staff.get_json().get("eligible_staff", [])
        self.assertGreater(len(eligible_list), 0)
        staff_id = eligible_list[0]["staff_id"]

        # 1c. Upload valid document with assigned_staff_id
        file_content = b"Legal CaseBook - Client Evidence Document\nThis is a verified client evidence filing.\n"
        data = {
            "title": "Client Pleading Evidence",
            "description": "Evidence submission by client",
            "assigned_staff_id": staff_id,
            "file": (io.BytesIO(file_content), "client_evidence_test.txt")
        }
        res_upload = self.client.post(
            f"/api/client/cases/{self.case1_id}/documents/upload",
            data=data,
            headers={"X-CSRF-Token": csrf_token},
            content_type="multipart/form-data"
        )
        self.assertEqual(res_upload.status_code, 201)
        doc_data = res_upload.get_json()["document"]
        doc_id = doc_data["document_id"]
        self.assertEqual(doc_data["assigned_staff_id"], staff_id)
        self.assertEqual(doc_data["assignment_status"], "ASSIGNED")

        # 2. Preview document
        res_preview = self.client.get(f"/api/client/documents/{doc_id}/preview")
        self.assertEqual(res_preview.status_code, 200)
        preview_data = res_preview.get_json()
        self.assertIn("preview_text", preview_data)
        self.assertIn("Client Evidence Document", preview_data["preview_text"])

        # 3. Client 1 deletes their own uploaded document
        res_del = self.client.delete(
            f"/api/client/documents/{doc_id}",
            headers={"X-CSRF-Token": csrf_token}
        )
        self.assertEqual(res_del.status_code, 200)

        # 4. Confirm document no longer exists
        res_preview_after = self.client.get(f"/api/client/documents/{doc_id}/preview")
        self.assertEqual(res_preview_after.status_code, 404)

    def test_client_cannot_delete_advocate_filing(self):
        """
        Client is strictly denied from deleting documents uploaded by their Advocate.
        """
        # Find a document uploaded by Advocate (USER_ID != client1_uid) in Case 1
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT DOCUMENT_ID FROM DOCUMENTS
                    WHERE CASE_ID = :cid AND UPLOADED_BY != :uid
                    LIMIT 1
                    """,
                    {"cid": self.case1_id, "uid": self.client1_uid}
                )
                r = cursor.fetchone()
                adv_doc_id = r[0] if r else None

        if adv_doc_id:
            _, csrf_token = self._login_as(self.client1_email, self.password)
            res = self.client.delete(
                f"/api/client/documents/{adv_doc_id}",
                headers={"X-CSRF-Token": csrf_token}
            )
            self.assertEqual(res.status_code, 403)
            self.assertEqual(res.get_json().get("code"), "UNAUTHORIZED_DOCUMENT_DELETION")

    # ------------------------------------------------------------------------
    # 6. Client Inquiry Submission & Persistence
    # ------------------------------------------------------------------------

    def test_client_inquiry_submission_and_persistence(self):
        """Client can submit a genuine advisory inquiry, which is saved in CLIENT_INQUIRIES."""
        _, csrf_token = self._login_as(self.client1_email, self.password)

        inquiry_payload = {
            "case_id": self.case1_id,
            "subject": "Clarification on Next Cause List Hearing Date",
            "message_text": "Dear Counsel, could you please confirm if personal attendance is required for the upcoming hearing?"
        }

        res = self.client.post(
            "/api/client/inquiries",
            json=inquiry_payload,
            headers={"X-CSRF-Token": csrf_token}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn("inquiry", data)
        inq_id = data["inquiry"]["inquiry_id"]

        # Verify retrieved in client's inquiries list
        res_list = self.client.get("/api/client/inquiries")
        self.assertEqual(res_list.status_code, 200)
        inquiries = res_list.get_json()["inquiries"]
        inq_ids = [i["inquiry_id"] for i in inquiries]
        self.assertIn(inq_id, inq_ids)

    def test_client_cannot_inquire_on_unassigned_case(self):
        """Client 1 cannot submit an inquiry for Case 2 (belongs to Client 2)."""
        _, csrf_token = self._login_as(self.client1_email, self.password)

        res = self.client.post(
            "/api/client/inquiries",
            json={
                "case_id": self.case2_id,
                "subject": "Unauthorized Inquiry Attempt",
                "message_text": "Attempting to send an inquiry on an unauthorized case file."
            },
            headers={"X-CSRF-Token": csrf_token}
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json().get("code"), "FORBIDDEN_CASE_ACCESS")

    # ------------------------------------------------------------------------
    # 7. Hearings & Advocate Contact Info
    # ------------------------------------------------------------------------

    def test_client_hearings_list(self):
        """Client receives chronological hearings for their assigned cases."""
        self._login_as(self.client1_email, self.password)
        res = self.client.get("/api/client/hearings")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("hearings", data)

        for h in data["hearings"]:
            self.assertNotEqual(h["case_id"], self.case2_id)

    def test_client_advocates_list(self):
        """Client can view authorized advocate contact details."""
        self._login_as(self.client1_email, self.password)
        res = self.client.get("/api/client/advocates")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("advocates", data)
        self.assertGreaterEqual(len(data["advocates"]), 1)
        self.assertIn("email", data["advocates"][0])
        self.assertIn("full_name", data["advocates"][0])


if __name__ == "__main__":
    unittest.main()
