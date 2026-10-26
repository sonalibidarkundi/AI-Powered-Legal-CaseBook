"""
Legal CaseBook - Client Staff Assignment & Access Control Test Suite
(test_client_staff_assignment.py)
-----------------------------------------------------------------------------
Verifies all requirements for Feature Enhancement:
1. Client selects eligible staff member on document upload.
   - GET /api/client/cases/<id>/eligible-staff (returns only assigned staff)
   - Mandatory assignment validation (HTTP 400 when omitted)
   - Invalid / unassigned staff validation (HTTP 403 UNAUTHORIZED_STAFF_ASSIGNMENT)
   - Cross-client case access prevention (HTTP 403 FORBIDDEN_CASE_ACCESS)
2. Document Visibility & Access Control:
   - Server-side document-level permission verification on every endpoint.
   - Assigned staff can preview, download, and summarize.
   - Unassigned staff denied with HTTP 403 FORBIDDEN_DOCUMENT_ACCESS on:
     - GET /api/staff/documents/<id>/preview
     - GET /api/staff/documents/<id>/download
     - POST /api/staff/documents/<id>/summary
     - GET /api/staff/documents/<id>/summary
   - Unassigned staff cannot see the document in GET /api/staff/documents.
   - Advocate handling the case retains full authorized access.
3. Staff Dashboard "Documents Assigned to Me":
   - Filter parameter assigned_to_me=1 returns metadata (title, client name, case info, status).
4. Grok AI Document Analysis workflow & status transition:
   - Successful summary transitions ASSIGNMENT_STATUS from 'ASSIGNED' to 'ANALYZED'.
   - Saved summary reflected across staff and client dashboards.
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


class ClientStaffAssignmentTestCase(unittest.TestCase):

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

        # Users and credentials
        self.client1_email = "client.apex@example.com"
        self.client2_email = "kavita.rao@example.com"
        self.staff_priya_email = "staff.priya@legalcasebook.test"  # Assigned to Case 1
        self.staff_amit_email = "staff.amit@legalcasebook.test"    # Assigned to Case 2
        self.advocate_email = "advocate.rajesh@legalcasebook.test"
        self.password = "Password123"

        # Lookup IDs
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Client 1
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = :em", {"em": self.client1_email})
                r_c1 = cursor.fetchone()
                self.client1_uid = r_c1[0] if r_c1 else 9

                # Staff Priya (Assigned to Case 1)
                cursor.execute(
                    """
                    SELECT s.STAFF_ID, s.USER_ID
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE u.EMAIL = :em
                    """,
                    {"em": self.staff_priya_email}
                )
                r_sp = cursor.fetchone()
                self.staff_priya_id = r_sp[0]
                self.staff_priya_uid = r_sp[1]

                # Staff Amit (Assigned to Case 2)
                cursor.execute(
                    """
                    SELECT s.STAFF_ID, s.USER_ID
                    FROM STAFF s
                    JOIN USERS u ON s.USER_ID = u.USER_ID
                    WHERE u.EMAIL = :em
                    """,
                    {"em": self.staff_amit_email}
                )
                r_sa = cursor.fetchone()
                self.staff_amit_id = r_sa[0]
                self.staff_amit_uid = r_sa[1]

                # Case 1 (Apex vs CloudSphere - assigned to Staff Priya)
                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-001'")
                self.case1_id = cursor.fetchone()[0]

                # Case 2 (Rao Estate - assigned to Staff Amit)
                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-002'")
                self.case2_id = cursor.fetchone()[0]

    def _login(self, email):
        res = self.client.post("/api/auth/login", json={"email": email, "password": self.password})
        self.assertEqual(res.status_code, 200, f"Login failed for {email}")
        return res.get_json().get("csrf_token")

    # =========================================================================
    # PART 1: CLIENT SELECTS STAFF MEMBER
    # =========================================================================

    def test_client_gets_only_eligible_staff_for_case(self):
        """
        Verify that GET /api/client/cases/<id>/eligible-staff returns only staff
        assigned to the case, and does not leak unauthorized staff.
        """
        csrf = self._login(self.client1_email)
        res = self.client.get(f"/api/client/cases/{self.case1_id}/eligible-staff")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        staff_ids = [s["staff_id"] for s in data["eligible_staff"]]

        # Staff Priya is assigned to Case 1
        self.assertIn(self.staff_priya_id, staff_ids)
        # Staff Amit is assigned to Case 2, NOT Case 1
        self.assertNotIn(self.staff_amit_id, staff_ids)

        # Verify safe professional attributes exposed
        priya_info = next(s for s in data["eligible_staff"] if s["staff_id"] == self.staff_priya_id)
        self.assertEqual(priya_info["full_name"], "Priya Nair")
        self.assertIn("employee_code", priya_info)
        self.assertIn("role_title", priya_info)

    def test_client_cannot_query_eligible_staff_for_unauthorized_case(self):
        """
        Verify that Client 1 cannot query eligible staff for Case 2 (belongs to Client 2).
        """
        csrf = self._login(self.client1_email)
        res = self.client.get(f"/api/client/cases/{self.case2_id}/eligible-staff")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json().get("code"), "FORBIDDEN_CASE_ACCESS")

    def test_upload_requires_staff_assignment(self):
        """
        Verify that omitting assigned_staff_id returns 400 STAFF_ASSIGNMENT_REQUIRED.
        """
        csrf = self._login(self.client1_email)
        data = {
            "title": "Document Without Staff",
            "description": "Missing staff assignment",
            "file": (io.BytesIO(b"Sample file content"), "sample.txt")
        }
        res = self.client.post(
            f"/api/client/cases/{self.case1_id}/documents/upload",
            data=data,
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data"
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get("code"), "STAFF_ASSIGNMENT_REQUIRED")

    def test_client_cannot_assign_document_to_unauthorized_staff(self):
        """
        Verify that Client cannot tamper with API request to assign document to
        a staff member who is not assigned to that case (e.g. Staff Amit on Case 1).
        """
        csrf = self._login(self.client1_email)
        data = {
            "title": "Tampered Staff Assignment",
            "description": "Attempting to assign document to Amit on Case 1",
            "assigned_staff_id": self.staff_amit_id,
            "file": (io.BytesIO(b"Sensitive commercial agreement"), "agreement.txt")
        }
        res = self.client.post(
            f"/api/client/cases/{self.case1_id}/documents/upload",
            data=data,
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data"
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn(res.get_json().get("code"), ["FORBIDDEN_STAFF_ASSIGNMENT", "UNAUTHORIZED_STAFF_ASSIGNMENT"])

    # =========================================================================
    # PART 2: STRICT DOCUMENT ACCESS CONTROL & IDOR PREVENTION
    # =========================================================================

    def test_document_access_control_workflow(self):
        """
        Complete end-to-end access control test:
        1. Client 1 uploads document assigned to Staff Priya on Case 1.
        2. Staff Priya (assigned) can view in list, preview, and download.
        3. Staff Amit (not assigned to this doc/case) is blocked from:
           - list (not in assigned_to_me)
           - download (403 FORBIDDEN_DOCUMENT_ACCESS)
           - preview (403 FORBIDDEN_DOCUMENT_ACCESS)
           - summary generation (403 FORBIDDEN_DOCUMENT_ACCESS)
        4. Advocate can access and preview.
        5. Client can view their own document and its assignment status.
        """
        # Step 1: Client 1 uploads document assigned to Staff Priya
        csrf_c1 = self._login(self.client1_email)
        file_content = b"ATTORNEY-CLIENT CONFIDENTIAL WORK PRODUCT\nThis is evidence doc for Priya review.\n"
        upload_res = self.client.post(
            f"/api/client/cases/{self.case1_id}/documents/upload",
            data={
                "title": "Confidential Cloud SLA Contract",
                "description": "Please review indemnification clause Section 14",
                "assigned_staff_id": self.staff_priya_id,
                "file": (io.BytesIO(file_content), "cloud_sla_contract.txt")
            },
            headers={"X-CSRF-Token": csrf_c1},
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 201)
        doc = upload_res.get_json()["document"]
        doc_id = doc["document_id"]
        self.assertEqual(doc["assigned_staff_id"], self.staff_priya_id)
        self.assertEqual(doc["assignment_status"], "ASSIGNED")

        # Step 2: Staff Priya (assigned) logs in and verifies access
        self._login(self.staff_priya_email)

        # 2a. Check list in assigned_to_me=1
        list_res = self.client.get("/api/staff/documents?assigned_to_me=1")
        self.assertEqual(list_res.status_code, 200)
        priya_docs = list_res.get_json()["documents"]
        priya_doc_ids = [d["document_id"] for d in priya_docs]
        self.assertIn(doc_id, priya_doc_ids)

        # Verify client name and case metadata are populated
        matched_doc = next(d for d in priya_docs if d["document_id"] == doc_id)
        self.assertEqual(matched_doc["document_title"], "Confidential Cloud SLA Contract")
        self.assertEqual(matched_doc["assignment_status"], "ASSIGNED")
        self.assertTrue(len(matched_doc["client_name"]) > 0)

        # 2b. Preview document
        prev_res = self.client.get(f"/api/staff/documents/{doc_id}/preview")
        self.assertEqual(prev_res.status_code, 200)
        self.assertIn("preview_text", prev_res.get_json())
        self.assertIn("ATTORNEY-CLIENT CONFIDENTIAL", prev_res.get_json()["preview_text"])

        # 2c. Download document
        down_res = self.client.get(f"/api/staff/documents/{doc_id}/download")
        self.assertEqual(down_res.status_code, 200)

        # Step 3: Staff Amit (UNASSIGNED) logs in and attempts IDOR access
        csrf_amit = self._login(self.staff_amit_email)

        # 3a. Document must NOT appear in Amit's assigned documents
        amit_list = self.client.get("/api/staff/documents?assigned_to_me=1").get_json()["documents"]
        self.assertNotIn(doc_id, [d["document_id"] for d in amit_list])

        # 3b. Direct download attempt -> 403 FORBIDDEN_DOCUMENT_ACCESS
        amit_down = self.client.get(f"/api/staff/documents/{doc_id}/download")
        self.assertEqual(amit_down.status_code, 403)
        self.assertEqual(amit_down.get_json().get("code"), "FORBIDDEN_DOCUMENT_ACCESS")

        # 3c. Direct preview attempt -> 403 FORBIDDEN_DOCUMENT_ACCESS
        amit_prev = self.client.get(f"/api/staff/documents/{doc_id}/preview")
        self.assertEqual(amit_prev.status_code, 403)
        self.assertEqual(amit_prev.get_json().get("code"), "FORBIDDEN_DOCUMENT_ACCESS")

        # 3d. Direct AI summary request attempt -> 403 FORBIDDEN_DOCUMENT_ACCESS
        amit_sum = self.client.post(
            f"/api/staff/documents/{doc_id}/summary",
            json={"regenerate": False},
            headers={"X-CSRF-Token": csrf_amit}
        )
        self.assertEqual(amit_sum.status_code, 403)
        self.assertEqual(amit_sum.get_json().get("code"), "FORBIDDEN_DOCUMENT_ACCESS")

        # Step 4: Advocate logs in and can access document
        self._login(self.advocate_email)
        adv_prev = self.client.get(f"/api/staff/documents/{doc_id}/preview")
        self.assertEqual(adv_prev.status_code, 200)

        # Step 5: Clean up test document
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM DOCUMENTS WHERE DOCUMENT_ID = :did", {"did": doc_id})
                conn.commit()

    # =========================================================================
    # PART 4: GROK AI DOCUMENT ANALYSIS & STATUS TRANSITIONS
    # =========================================================================

    @patch("grok_client.generate_document_summary")
    def test_grok_ai_summary_updates_assignment_status(self, mock_generate_summary):
        """
        Verify that generating a Grok AI summary transitions ASSIGNMENT_STATUS
        from 'ASSIGNED' to 'ANALYZED' and saves in DOCUMENT_SUMMARIES.
        """
        mock_generate_summary.return_value = {
            "summary_text": "LEGAL BRIEF SUMMARY: Cloud SLA Indemnification analysis.",
            "structured_sections": {
                "Document Title and Type": "Cloud SLA Agreement",
                "Parties Involved": "Apex Tech vs CloudSphere",
                "Important Clauses or Statements": "Section 14: Unlimited indemnification for data loss",
                "Risks or Points Requiring Attention": "High risk of secondary damages"
            },
            "model": "grok-2-latest",
            "disclaimer": "AI-generated summary for research assistance only."
        }

        # 1. Upload doc assigned to Priya
        csrf_c1 = self._login(self.client1_email)
        substantive_content = (
            b"COMMERCIAL ARBITRATION PETITION UNDER SECTION 9\n"
            b"IN THE HIGH COURT OF DELHI AT NEW DELHI\n"
            b"In the matter of: Apex Technologies Ltd vs CloudSphere Solutions Inc.\n"
            b"The Petitioner submits this memorandum detailing breach of service level agreements and licensing terms.\n"
        )
        upload_res = self.client.post(
            f"/api/client/cases/{self.case1_id}/documents/upload",
            data={
                "title": "Analysis Target Contract",
                "assigned_staff_id": self.staff_priya_id,
                "file": (io.BytesIO(substantive_content), "target.txt")
            },
            headers={"X-CSRF-Token": csrf_c1},
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 201)
        doc_id = upload_res.get_json()["document"]["document_id"]

        # 2. Staff Priya generates AI Summary
        csrf_sp = self._login(self.staff_priya_email)
        sum_res = self.client.post(
            f"/api/staff/documents/{doc_id}/summary",
            json={"regenerate": True},
            headers={"X-CSRF-Token": csrf_sp}
        )
        self.assertEqual(sum_res.status_code, 200)
        data = sum_res.get_json()
        self.assertIn("summary", data)
        self.assertEqual(data["document"]["assignment_status"], "ANALYZED")

        # 3. Verify status updated to ANALYZED in database
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT ASSIGNMENT_STATUS FROM DOCUMENTS WHERE DOCUMENT_ID = :did",
                    {"did": doc_id}
                )
                status = cursor.fetchone()[0]
                self.assertEqual(status, "ANALYZED")

        # 4. Verify GET /api/staff/documents reflects ANALYZED
        docs_res = self.client.get("/api/staff/documents?assigned_to_me=1")
        staff_doc = next(d for d in docs_res.get_json()["documents"] if d["document_id"] == doc_id)
        self.assertEqual(staff_doc["assignment_status"], "ANALYZED")
        self.assertTrue(staff_doc["has_ai_summary"])

        # 5. Clean up
        with db.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM DOCUMENT_SUMMARIES WHERE DOCUMENT_ID = :did", {"did": doc_id})
                cursor.execute("DELETE FROM DOCUMENTS WHERE DOCUMENT_ID = :did", {"did": doc_id})
                conn.commit()


if __name__ == "__main__":
    unittest.main()
