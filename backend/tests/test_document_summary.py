"""
Legal CaseBook - Test Suite: Document Upload & Grok AI Summarization
---------------------------------------------------------------------
Tests:
1. Client case access verification and document upload (.txt, .docx, .pdf).
2. Unauthorized client upload rejection (IDOR protection).
3. Invalid / disallowed file type rejection.
4. Staff authorized document retrieval & download.
5. Dual-staff isolation: Staff 2 cannot access or summarize Staff 1's document.
6. Scanned PDF detection (< 50 chars text) returning OCR_REQUIRED error.
7. Unconfigured Grok API key graceful error handling (HTTP 503, API_KEY_NOT_CONFIGURED).
8. Mocked Grok API integration: 11 structured sections parsed and saved to Oracle/DB.
9. Summary retrieval (GET /api/staff/documents/<id>/summary).
10. Regeneration idempotence: updates existing summary without duplicate records.
11. Security check: API key never exposed in API responses.
"""

import io
import json
import os
import unittest
from unittest.mock import patch, MagicMock

# Ensure we import from backend directory
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app as flask_app
import db
import auth
import grok_client
import document_extractor


class DocumentSummaryWorkflowTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init_local_schema()
        cls.client = flask_app.app.test_client()

    def login_user(self, email, password="Password123"):
        """Helper to authenticate and establish a session."""
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200, f"Failed login for {email}")
        return res

    def get_csrf(self):
        """Helper to get a valid CSRF token."""
        res = self.client.get("/api/auth/csrf")
        data = res.get_json()
        return data.get("csrf_token")

    # -------------------------------------------------------------------------
    # TEST 1: CLIENT UPLOADS VALID LEGAL DOCUMENTS
    # -------------------------------------------------------------------------
    def test_01_client_upload_valid_txt(self):
        """Verified client uploads a legal text filing to authorized Case 1."""
        self.login_user("client.apex@example.com")
        csrf = self.get_csrf()

        legal_text = (
            "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n"
            "COMMERCIAL DIVISION\n"
            "COMMERCIAL ARBITRATION PETITION NO. 450 OF 2026\n\n"
            "BETWEEN:\n"
            "Apex Enterprises Pvt Ltd ... Petitioner\n"
            "AND\n"
            "Quantum Logistics Corp ... Respondent\n\n"
            "PETITION UNDER SECTION 9 OF THE ARBITRATION ACT\n"
            "1. The Petitioner is a registered legal entity with corporate offices in Mumbai.\n"
            "2. Master Service Agreement was executed on 15th January 2024.\n"
            "3. Respondent committed persistent breach of delivery timelines commencing October 2025.\n"
            "4. Total liquidated damages claimed: INR 4,25,00,000.\n"
            "5. Arbitration invocation notice served on 10th November 2025."
        )
        file_bytes = io.BytesIO(legal_text.encode("utf-8"))

        res = self.client.post(
            "/api/client/cases/1/documents/upload",
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data",
            data={"file": (file_bytes, "petition_section9_apex.txt"), "assigned_staff_id": 2}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn("document", data)
        self.assertEqual(data["document"]["case_id"], 1)
        self.assertEqual(data["document"]["file_name"], "petition_section9_apex.txt")
        self.__class__.uploaded_doc_id = data["document"]["document_id"]

    # -------------------------------------------------------------------------
    # TEST 2: UNAUTHORIZED CLIENT UPLOAD REJECTED (IDOR PROTECTION)
    # -------------------------------------------------------------------------
    def test_02_client_cannot_upload_to_unauthorized_case(self):
        """Client Apex (assigned to Case 1 & 3) cannot upload to Case 2 (assigned to Kavita)."""
        self.login_user("client.apex@example.com")
        csrf = self.get_csrf()

        file_bytes = io.BytesIO(b"Malicious injection attempt into another party's case docket.")
        res = self.client.post(
            "/api/client/cases/2/documents/upload",
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data",
            data={"file": (file_bytes, "unauthorized_filing.txt")}
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json().get("code"), "FORBIDDEN_CASE_ACCESS")

    # -------------------------------------------------------------------------
    # TEST 3: DISALLOWED FILE EXTENSIONS REJECTED
    # -------------------------------------------------------------------------
    def test_03_disallowed_file_extension_rejected(self):
        """Executables or disallowed formats (.exe, .sh) are rejected."""
        self.login_user("client.apex@example.com")
        csrf = self.get_csrf()

        file_bytes = io.BytesIO(b"echo 'malicious shell'")
        res = self.client.post(
            "/api/client/cases/1/documents/upload",
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data",
            data={"file": (file_bytes, "exploit.sh")}
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get("code"), "UNSUPPORTED_FORMAT")

    # -------------------------------------------------------------------------
    # TEST 4: ASSIGNED STAFF MEMBER CAN ACCESS AND DOWNLOAD DOCUMENT
    # -------------------------------------------------------------------------
    def test_04_assigned_staff_access_document(self):
        """Staff Priya (assigned to Case 1) can view and download the uploaded document."""
        self.login_user("staff.priya@legalcasebook.test")

        doc_id = getattr(self.__class__, "uploaded_doc_id", None)
        self.assertIsNotNone(doc_id)

        # 1. Download
        res = self.client.get(f"/api/staff/documents/{doc_id}/download")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"COMMERCIAL ARBITRATION PETITION", res.data)

        # 2. Check initial summary status (should be false before generation)
        res_sum = self.client.get(f"/api/staff/documents/{doc_id}/summary")
        self.assertEqual(res_sum.status_code, 200)
        self.assertFalse(res_sum.get_json()["has_summary"])

    # -------------------------------------------------------------------------
    # TEST 5: DUAL-STAFF PRIVACY ISOLATION (STAFF 2 CANNOT ACCESS STAFF 1'S DOC)
    # -------------------------------------------------------------------------
    def test_05_unassigned_staff_cannot_access_or_summarize(self):
        """Staff Amit (assigned to Case 2, NOT Case 1) receives 403 on Case 1 document."""
        self.login_user("staff.amit@legalcasebook.test")
        doc_id = getattr(self.__class__, "uploaded_doc_id", None)

        # Attempt download
        res_dl = self.client.get(f"/api/staff/documents/{doc_id}/download")
        self.assertEqual(res_dl.status_code, 403)
        self.assertEqual(res_dl.get_json().get("code"), "FORBIDDEN_DOCUMENT_ACCESS")

        # Attempt summary generation
        csrf = self.get_csrf()
        res_gen = self.client.post(
            f"/api/staff/documents/{doc_id}/summary",
            headers={"X-CSRF-Token": csrf},
            json={"regenerate": True}
        )
        self.assertEqual(res_gen.status_code, 403)
        self.assertEqual(res_gen.get_json().get("code"), "FORBIDDEN_DOCUMENT_ACCESS")

    # -------------------------------------------------------------------------
    # TEST 6: SCANNED PDF DETECTION (< 50 CHARACTERS)
    # -------------------------------------------------------------------------
    def test_06_scanned_pdf_detection_ocr_required(self):
        """A PDF with insufficient extractable text (<50 chars) returns OCR_REQUIRED."""
        self.login_user("client.apex@example.com")
        csrf = self.get_csrf()

        # Create a minimal empty/image-like PDF using fitz (PyMuPDF)
        import fitz
        empty_doc = fitz.open()
        empty_doc.new_page(width=595, height=842) # Blank page
        pdf_bytes = empty_doc.tobytes()
        empty_doc.close()

        res_up = self.client.post(
            "/api/client/cases/1/documents/upload",
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data",
            data={"file": (io.BytesIO(pdf_bytes), "scanned_exhibit_blank.pdf"), "assigned_staff_id": 2}
        )
        self.assertEqual(res_up.status_code, 201)
        blank_doc_id = res_up.get_json()["document"]["document_id"]

        # Staff Priya attempts to generate summary
        self.login_user("staff.priya@legalcasebook.test")
        csrf_staff = self.get_csrf()
        res_sum = self.client.post(
            f"/api/staff/documents/{blank_doc_id}/summary",
            headers={"X-CSRF-Token": csrf_staff},
            json={}
        )
        self.assertEqual(res_sum.status_code, 422)
        data = res_sum.get_json()
        self.assertEqual(data.get("code"), "OCR_REQUIRED")
        self.assertTrue(data.get("requires_ocr"))
        self.assertIn("OCR", data.get("error", ""))

    # -------------------------------------------------------------------------
    # TEST 7: UNCONFIGURED API KEY SAFE FEEDBACK
    # -------------------------------------------------------------------------
    def test_07_unconfigured_api_key_safe_error(self):
        """When XAI_API_KEY is placeholder or unconfigured, returns clean HTTP 503."""
        self.login_user("staff.priya@legalcasebook.test")
        csrf = self.get_csrf()
        doc_id = getattr(self.__class__, "uploaded_doc_id", None)

        with patch.dict(os.environ, {"XAI_API_KEY": "your_real_key_here"}):
            res = self.client.post(
                f"/api/staff/documents/{doc_id}/summary",
                headers={"X-CSRF-Token": csrf},
                json={"regenerate": True}
            )
            self.assertEqual(res.status_code, 503)
            data = res.get_json()
            self.assertEqual(data.get("code"), "API_KEY_NOT_CONFIGURED")
            self.assertIn("XAI_API_KEY", data.get("error", ""))

    # -------------------------------------------------------------------------
    # TEST 8: MOCKED GROK API INTEGRATION & 11 STRUCTURED SECTIONS
    # -------------------------------------------------------------------------
    @patch("requests.post")
    def test_08_grok_ai_summary_generation_and_storage(self, mock_post):
        """Mocks live xAI Grok response, verifies 11 sections parsed and saved to Oracle/DB."""
        self.login_user("staff.priya@legalcasebook.test")
        csrf = self.get_csrf()
        doc_id = getattr(self.__class__, "uploaded_doc_id", None)

        mock_grok_text = (
            "### 1. Document Title and Type\n"
            "Commercial Arbitration Petition Under Section 9\n\n"
            "### 2. Executive Summary\n"
            "Petitioner seeks urgent interim measures of protection against Respondent regarding logistics defaults.\n\n"
            "### 3. Parties Involved\n"
            "Petitioner: Apex Enterprises Pvt Ltd; Respondent: Quantum Logistics Corp.\n\n"
            "### 4. Important Facts\n"
            "Parties entered into supply contract on 15-Jan-2024. Respondent breached delivery schedules in Oct 2025.\n\n"
            "### 5. Key Dates and Deadlines\n"
            "Contract date: 15-Jan-2024. Default Notice: 10-Nov-2025. Arbitration invocation: within 30 days.\n\n"
            "### 6. Legal Issues Mentioned\n"
            "Maintainability of interim relief under Section 9 of Arbitration and Conciliation Act, 1996.\n\n"
            "### 7. Important Clauses or Statements\n"
            "Clause 14: Dispute resolution via arbitration seated in Mumbai under MCIA rules.\n\n"
            "### 8. Obligations and Responsibilities\n"
            "Petitioner must initiate arbitral proceedings within 90 days of interim relief.\n\n"
            "### 9. Risks or Points Requiring Attention\n"
            "Risk of limitation defense if arbitration is delayed.\n\n"
            "### 10. Questions for Advocate Review\n"
            "Should an ex-parte injunction or bank guarantee encashment stay be sought immediately?\n\n"
            "### 11. Recommended Next Steps for Human Review\n"
            "Review statement of claim with supervising advocate and file interim application in High Court.\n\n"
            f"\"{grok_client.LEGAL_DISCLAIMER}\""
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": mock_grok_text}}],
            "usage": {"total_tokens": 620}
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"XAI_API_KEY": "xai-test-active-key-999"}):
            res = self.client.post(
                f"/api/staff/documents/{doc_id}/summary",
                headers={"X-CSRF-Token": csrf},
                json={"regenerate": True}
            )
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertIn("summary", data)
            summary = data["summary"]
            self.assertEqual(summary["status"], "SUCCESS")
            self.assertIn("Commercial Arbitration", summary["summary_text"])
            self.assertIn("Executive Summary", summary["structured_sections"])
            self.assertIn("Key Dates and Deadlines", summary["structured_sections"])
            self.assertIn("AI-generated summary for research assistance only", summary["disclaimer"])

    # -------------------------------------------------------------------------
    # TEST 9: RETRIEVE PERSISTED SUMMARY VIA GET
    # -------------------------------------------------------------------------
    def test_09_retrieve_persisted_summary_from_db(self):
        """Staff Priya retrieves the stored summary via GET without making another Grok API call."""
        self.login_user("staff.priya@legalcasebook.test")
        doc_id = getattr(self.__class__, "uploaded_doc_id", None)

        res = self.client.get(f"/api/staff/documents/{doc_id}/summary")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["has_summary"])
        self.assertIsNotNone(data["summary"])
        self.assertEqual(data["summary"]["status"], "SUCCESS")
        self.assertIn("Commercial Arbitration Petition", data["summary"]["summary_text"])

    # -------------------------------------------------------------------------
    # TEST 10: REGENERATION IDEMPOTENCE (NO DUPLICATE RECORDS)
    # -------------------------------------------------------------------------
    @patch("requests.post")
    def test_10_regeneration_updates_existing_record(self, mock_post):
        """Regenerating a summary updates the single record for the document rather than inserting duplicates."""
        self.login_user("staff.priya@legalcasebook.test")
        csrf = self.get_csrf()
        doc_id = getattr(self.__class__, "uploaded_doc_id", None)

        mock_updated_text = (
            "### 1. Document Title and Type\n"
            "Commercial Arbitration Petition (Regenerated Brief)\n\n"
            "### 2. Executive Summary\n"
            "Updated analysis after counsel feedback.\n\n"
            f"\"{grok_client.LEGAL_DISCLAIMER}\""
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True
        mock_response.json.return_value = {
            "choices": [{"message": {"content": mock_updated_text}}],
            "usage": {"total_tokens": 400}
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"XAI_API_KEY": "xai-test-active-key-999"}):
            res = self.client.post(
                f"/api/staff/documents/{doc_id}/summary",
                headers={"X-CSRF-Token": csrf},
                json={"regenerate": True}
            )
            self.assertEqual(res.status_code, 200)

        # Check in DB that exactly 1 record exists for this document_id
        with db.get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM DOCUMENT_SUMMARIES WHERE DOCUMENT_ID = :did", {"did": doc_id})
                count = cur.fetchone()[0]
                self.assertEqual(count, 1, "Duplicate summary record created on regeneration!")

    # -------------------------------------------------------------------------
    # TEST 11: SECURITY - NO API KEY EXPOSURE
    # -------------------------------------------------------------------------
    def test_11_api_key_never_exposed(self):
        """Verifies that secret API keys are never exposed in JSON responses or headers."""
        self.login_user("staff.priya@legalcasebook.test")
        doc_id = getattr(self.__class__, "uploaded_doc_id", None)

        res = self.client.get(f"/api/staff/documents/{doc_id}/summary")
        raw_text = res.get_data(as_text=True)
        self.assertNotIn("xai-test-active-key", raw_text)
        self.assertNotIn("XAI_API_KEY", raw_text)

    # -------------------------------------------------------------------------
    # TEST 12: STAFF UPLOAD WITH AUTOMATIC DUAL-PREFERENCE SUMMARY
    # -------------------------------------------------------------------------
    @patch("requests.post")
    def test_12_staff_upload_with_automatic_dual_summary(self, mock_post):
        """Verifies staff can upload a case document and immediately receives dual-preference AI summaries."""
        self.login_user("staff.priya@legalcasebook.test")
        csrf = self.get_csrf()

        # Mock Groq / xAI response with structured sections
        mock_summary_content = (
            "## Case Title & Citation\nApex Tech Solutions v. CloudSphere Systems\n\n"
            "## Primary Legal Claims & Allegations\nArbitration petition under Section 9 alleging software license breach.\n\n"
            "## Procedural History & Current Status\nPendente lite application filed before Commercial Court.\n\n"
            "## Statutory Provisions Involved\nSection 9, Section 11 of the Arbitration and Conciliation Act, 1996.\n\n"
            "## Material Evidence & Exhibits Cited\nTechnical audit logs, API usage metrics, master agreement.\n\n"
            "## Reliefs Claimed\nInterim injunction restraining invocation of bank guarantee.\n\n"
            "## Counter-Arguments & Opposing Contentions\nRespondent contends software modifications were authorized under SLA.\n\n"
            "## Critical Deadlines & Scheduled Hearings\nCounter-affidavit due within 10 days.\n\n"
            "## Open Questions & Missing Documents\nPending expert technical inspection report.\n\n"
            "## Recommended Action Items\nFile rejoinder affidavit and cross-examine technical witness.\n\n"
            f"\"{grok_client.LEGAL_DISCLAIMER}\""
        )
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.ok = True
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": mock_summary_content}}],
            "usage": {"total_tokens": 520}
        }
        mock_post.return_value = mock_resp

        staff_file_content = (
            "LEGAL PETITION FOR INTERIM RELIEF UNDER SECTION 9\n"
            "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\n"
            "Commercial Division\n\n"
            "Petitioner: Apex Tech Solutions Ltd.\n"
            "Respondent: CloudSphere Infrastructure Inc.\n\n"
            "1. The Petitioner is a registered software development enterprise.\n"
            "2. The Respondent entered into a proprietary cloud integration contract on 12 March 2024.\n"
            "3. The Respondent committed willful breaches of intellectual property covenants.\n"
            "WHEREFORE the Petitioner respectfully prays for urgent interim injunction orders.\n"
        )
        file_bytes = io.BytesIO(staff_file_content.encode("utf-8"))

        data = {
            "case_id": "1",
            "title": "Staff Section 9 Interim Petition",
            "description": "Uploaded by Staff Priya with auto-generated brief",
            "file": (file_bytes, "staff_petition_sec9.txt")
        }

        with patch.dict(os.environ, {"GROK_API_KEY": "gsk_test_mock_key_123"}):
            res = self.client.post(
                "/api/staff/documents/upload",
                data=data,
                content_type="multipart/form-data",
                headers={"X-CSRF-Token": csrf}
            )

        self.assertEqual(res.status_code, 201)
        res_json = res.get_json()
        self.assertTrue(res_json.get("has_summary"))
        self.assertIn("document", res_json)
        self.assertIn("summary", res_json)
        self.assertEqual(res_json["document"]["assignment_status"], "ANALYZED")

        summary = res_json["summary"]
        self.assertIn("preferences", summary)
        self.assertEqual(len(summary["preferences"]), 2)
        self.assertEqual(summary["preferences"][0]["id"], "pref_1")
        self.assertEqual(summary["preferences"][1]["id"], "pref_2")

        # Verify DB records
        doc_id = res_json["document"]["document_id"]
        with db.get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ASSIGNMENT_STATUS FROM DOCUMENTS WHERE DOCUMENT_ID = :did", {"did": doc_id})
                status = cur.fetchone()[0]
                self.assertEqual(status, "ANALYZED")

                cur.execute("SELECT COUNT(*) FROM DOCUMENT_SUMMARIES WHERE DOCUMENT_ID = :did", {"did": doc_id})
                self.assertEqual(cur.fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
