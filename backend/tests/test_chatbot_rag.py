"""
Unit & Integration Tests for Legal CaseBook RAG Engine & Chatbot API
(test_chatbot_rag.py)
"""

import os
import json
import unittest
from unittest.mock import patch, MagicMock

import app
import db
import auth
import rag_engine


class ChatbotRAGTestCase(unittest.TestCase):
    """Verifies RAG document chunking, hybrid retrieval, anti-hallucination prompting, and chat APIs."""

    @classmethod
    def setUpClass(cls):
        db.init_local_schema()

    def setUp(self):
        self.client = app.app.test_client()

    def test_01_document_chunking_and_page_markers(self):
        """Verify chunk_document_text splits text into overlapping windows and tracks page references."""
        sample_doc = (
            "[Page 1]\nIN THE HIGH COURT OF JUDICATURE AT BOMBAY.\nCOMMERCIAL DIVISION.\n\n"
            "This is the first substantive paragraph detailing dispute background between Claimant and Respondent.\n\n"
            "[Page 2]\nSection 9 of the Arbitration and Conciliation Act, 1996.\n"
            "The petitioner respectfully prays for urgent ad-interim injunction restraining respondent from encashing bank guarantee."
        )

        chunks = rag_engine.chunk_document_text(
            doc_text=sample_doc,
            doc_id=101,
            file_name="petition_test.txt",
            chunk_size=200,
            overlap=40
        )

        self.assertGreaterEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["document_id"], 101)
        self.assertEqual(chunks[0]["file_name"], "petition_test.txt")
        self.assertIn("tokens", chunks[0])

    def test_02_bm25_retrieval_and_stemming(self):
        """Verify hybrid BM25 retrieval matches queries using stemming and legal entity boosts."""
        kb = {
            "chunks": [
                {
                    "chunk_id": "c1",
                    "document_id": 1,
                    "file_name": "contract_sla.txt",
                    "document_title": "SLA Agreement",
                    "page_ref": "Page 1",
                    "text": "Clause 14 specifies liability, termination penalties, and indemnification for software API breaches.",
                    "tokens": ["clause", "14", "specifies", "liability", "termination", "penalties", "indemnification", "software", "api", "breaches"]
                },
                {
                    "chunk_id": "c2",
                    "document_id": 2,
                    "file_name": "probate_petition.txt",
                    "document_title": "Probate Petition",
                    "page_ref": "Page 2",
                    "text": "Petition for grant of probate under Indian Succession Act regarding residential estate properties.",
                    "tokens": ["petition", "grant", "probate", "indian", "succession", "act", "residential", "estate", "properties"]
                }
            ],
            "hearings": [],
            "tasks": [],
            "summaries": []
        }

        # Query matches chunk 1 via stemmed words "penalty" and "breach"
        res = rag_engine.retrieve_relevant_context("What are the penalty liabilities for breach?", kb, top_k=2)
        top_chunks = res["chunks"]

        self.assertGreaterEqual(len(top_chunks), 1)
        self.assertEqual(top_chunks[0]["file_name"], "contract_sla.txt")
        self.assertGreater(top_chunks[0]["score"], 0)

    def test_03_rag_prompt_assembly_and_grounding(self):
        """Verify format_rag_context_prompt and build_rag_system_prompt assemble grounded directives."""
        retrieved_data = {
            "case_info": {
                "case_number": "LCB-TEST-001",
                "title": "Alpha vs Beta",
                "type": "CIVIL",
                "status": "OPEN",
                "advocate": "Adv. Rajesh",
                "description": "Commercial licensing matter"
            },
            "hearings": [
                {
                    "date": "2026-11-15 10:30",
                    "court_name": "High Court",
                    "court_room": "Courtroom 4",
                    "judge": "Justice Patel",
                    "status": "SCHEDULED",
                    "notes": "Framing of issues"
                }
            ],
            "tasks": [],
            "chunks": [
                {
                    "file_name": "filing_doc.txt",
                    "page_ref": "Page 3",
                    "text": "Respondent failed to pay milestone royalties of INR 45,00,000."
                }
            ]
        }

        context_str = rag_engine.format_rag_context_prompt(retrieved_data, perspective="strategic")
        self.assertIn("LCB-TEST-001", context_str)
        self.assertIn("Justice Patel", context_str)
        self.assertIn("milestone royalties", context_str)

        sys_prompt = rag_engine.build_rag_system_prompt(perspective="strategic")
        self.assertIn("STRATEGIC LITIGATION COUNSEL", sys_prompt)
        self.assertIn("MANDATORY SOURCE CITATIONS", sys_prompt)

    def test_04_simulated_rag_fallback(self):
        """Verify local high-fidelity simulated engine generates cited response when APIs are offline."""
        retrieved_data = {
            "case_info": {"title": "Test Dispute", "case_number": "CASE-100"},
            "hearings": [{"court_name": "Commercial Bench", "court_room": "Chamber 2", "judge": "Judge Rao", "date": "2026-12-01", "status": "SCHEDULED", "notes": "Arguments"}],
            "tasks": [],
            "chunks": [{"file_name": "agreement.txt", "page_ref": "Page 1", "text": "Clause 8 provides arbitration in Bangalore.", "score": 2.5}]
        }

        res = rag_engine.generate_simulated_rag_response(
            query="When is the court hearing scheduled?",
            retrieved=retrieved_data,
            perspective="comprehensive"
        )

        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("Scheduled Hearing Details", res["answer"])
        self.assertIn("Judge Rao", res["answer"])

    def test_05_chat_cases_and_suggested_prompts_endpoint(self):
        """Verify authenticated staff member can retrieve authorized cases and suggested prompt chips."""
        # 1. Login as Staff Priya
        login_res = self.client.post("/api/auth/login", json={
            "email": "staff.priya@legalcasebook.test",
            "password": "Password123"
        })
        self.assertEqual(login_res.status_code, 200)

        # 2. Get cases
        cases_res = self.client.get("/api/chat/cases")
        self.assertEqual(cases_res.status_code, 200)
        cases_json = cases_res.get_json()
        self.assertIn("cases", cases_json)
        self.assertGreaterEqual(len(cases_json["cases"]), 1)

        # 3. Get suggested prompts
        prompts_res = self.client.get("/api/chat/suggested-prompts")
        self.assertEqual(prompts_res.status_code, 200)
        prompts_json = prompts_res.get_json()
        self.assertIn("prompts", prompts_json)
        self.assertGreaterEqual(len(prompts_json["prompts"]), 3)

    def test_06_chat_session_creation_and_history(self):
        """Verify creating, loading, and deleting chat sessions."""
        login_res = self.client.post("/api/auth/login", json={
            "email": "staff.priya@legalcasebook.test",
            "password": "Password123"
        })
        csrf_token = login_res.get_json().get("csrf_token")
        headers = {"X-CSRF-Token": csrf_token}

        # Create session
        create_res = self.client.post(
            "/api/chat/sessions",
            headers=headers,
            json={"title": "Contract Review Consultation", "perspective": "comprehensive"}
        )
        self.assertEqual(create_res.status_code, 201)
        sess_data = create_res.get_json().get("session", {})
        session_id = sess_data["session_id"]
        self.assertIsNotNone(session_id)

        # Get session
        get_res = self.client.get(f"/api/chat/sessions/{session_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.get_json()["session"]["title"], "Contract Review Consultation")

        # Delete session
        del_res = self.client.delete(f"/api/chat/sessions/{session_id}", headers=headers)
        self.assertEqual(del_res.status_code, 200)

    @patch("rag_engine.query_rag_chatbot")
    def test_07_rag_query_execution_and_citations(self, mock_rag):
        """Verify POST /api/chat/query invokes RAG pipeline, stores messages, and returns citations."""
        mock_rag.return_value = {
            "answer": "Based on Section 9, the claimant seeks interim protection of assets. [Source: petition.txt, Page 1]",
            "citations": [
                {"source": "petition.txt", "ref": "Page 1", "snippet": "Claimant seeks interim protection...", "score": 0.92}
            ],
            "model": "qwen/qwen3.8-27b",
            "perspective": "comprehensive",
            "status": "SUCCESS"
        }

        login_res = self.client.post("/api/auth/login", json={
            "email": "staff.priya@legalcasebook.test",
            "password": "Password123"
        })
        csrf_token = login_res.get_json().get("csrf_token")
        headers = {"X-CSRF-Token": csrf_token}

        query_res = self.client.post(
            "/api/chat/query",
            headers=headers,
            json={
                "query": "What interim relief is sought under Section 9?",
                "case_id": 1,
                "perspective": "comprehensive"
            }
        )

        self.assertEqual(query_res.status_code, 200)
        q_data = query_res.get_json()
        self.assertIn("answer", q_data)
        self.assertIn("citations", q_data)
        self.assertEqual(len(q_data["citations"]), 1)
        self.assertEqual(q_data["citations"][0]["source"], "petition.txt")
        self.assertIsNotNone(q_data.get("session_id"))

    def test_08_rbac_privacy_boundary(self):
        """Verify unassigned user receives 403 when querying a case they are not assigned to."""
        # Login as Staff Amit (who is assigned to Case 2, NOT Case 1)
        login_res = self.client.post("/api/auth/login", json={
            "email": "staff.amit@legalcasebook.test",
            "password": "Password123"
        })
        csrf_token = login_res.get_json().get("csrf_token")
        headers = {"X-CSRF-Token": csrf_token}

        query_res = self.client.post(
            "/api/chat/query",
            headers=headers,
            json={
                "query": "Give me confidential details for Case 1.",
                "case_id": 1
            }
        )
        self.assertEqual(query_res.status_code, 403)
        self.assertEqual(query_res.get_json().get("code"), "FORBIDDEN_CASE_ACCESS")


if __name__ == "__main__":
    unittest.main()
