"""
Unit Tests for Grok Model Preferences and Cascading Callback Fallbacks
(test_grok_preference_fallbacks.py)
"""

import os
import unittest
from unittest.mock import patch, MagicMock
import grok_client


class GrokPreferenceFallbackTestCase(unittest.TestCase):
    """Tests the Grok preference list resolution and cascading callback fallback mechanisms."""

    def test_01_get_model_preference_list_default(self):
        """Verify default model preference list has primary model and built-in fallbacks."""
        with patch.dict(os.environ, {"XAI_MODEL": "grok-2-latest", "XAI_FALLBACK_MODELS": ""}):
            models = grok_client.get_model_preference_list()
            self.assertEqual(models[0], "grok-2-latest")
            self.assertIn("grok-2", models)
            self.assertIn("grok-beta", models)
            self.assertIn("grok-2-mini", models)

    def test_02_get_model_preference_list_custom_string(self):
        """Verify comma-separated string resolves properly with deduplication."""
        models = grok_client.get_model_preference_list("my-custom-grok, grok-beta, grok-2-mini")
        self.assertEqual(models[0], "my-custom-grok")
        self.assertEqual(models[1], "grok-beta")
        self.assertEqual(models[2], "grok-2-mini")

    def test_03_get_model_preference_list_custom_list(self):
        """Verify explicit list of models is prioritized first."""
        models = grok_client.get_model_preference_list(["custom-model-1", "custom-model-2"])
        self.assertEqual(models[0], "custom-model-1")
        self.assertEqual(models[1], "custom-model-2")

    @patch("requests.post")
    def test_04_cascading_fallback_when_first_model_fails(self, mock_post):
        """
        Verify that if the primary model fails (e.g. HTTP 500), the system
        triggers the fallback callback and succeeds with the second preferred model.
        """
        # Call 1 fails with 500, Call 2 succeeds with 200
        mock_resp_fail = MagicMock()
        mock_resp_fail.ok = False
        mock_resp_fail.status_code = 500
        mock_resp_fail.text = "Internal error on grok-2-latest"

        mock_resp_success = MagicMock()
        mock_resp_success.ok = True
        mock_resp_success.status_code = 200
        mock_resp_success.json.return_value = {
            "choices": [{
                "message": {
                    "content": "### 1. Document Title and Type\nContract Review\n\n### 2. Executive Summary\nValid summary by fallback model."
                }
            }],
            "usage": {"total_tokens": 150}
        }

        mock_post.side_effect = [mock_resp_fail, mock_resp_success]

        fallback_events = []

        def custom_fallback_callback(failed_model, error, next_model):
            fallback_events.append({
                "failed_model": failed_model,
                "error": error,
                "next_model": next_model
            })

        with patch.dict(os.environ, {"XAI_API_KEY": "xai-test-valid-key"}):
            result = grok_client.generate_document_summary(
                doc_text="Sample contract text between Party A and Party B on 15 Jan 2025.",
                file_name="sample_contract.txt",
                case_number="CASE-2025-001",
                preferred_models=["grok-2-latest", "grok-beta"],
                on_model_fallback=custom_fallback_callback,
                dual_preference=False
            )

            # Assertions
            self.assertEqual(result["status"], "SUCCESS")
            self.assertEqual(result["model"], "grok-beta")
            self.assertTrue(result["fallback_occurred"])
            self.assertEqual(len(fallback_events), 1)
            self.assertEqual(fallback_events[0]["failed_model"], "grok-2-latest")
            self.assertEqual(fallback_events[0]["next_model"], "grok-beta")

    @patch("requests.post")
    def test_05_unified_callback_events(self, mock_post):
        """Verify unified callback receives 'attempt', 'fallback', and 'success' events."""
        mock_resp_fail = MagicMock()
        mock_resp_fail.ok = False
        mock_resp_fail.status_code = 429
        mock_resp_fail.text = "Rate limit reached"

        mock_resp_success = MagicMock()
        mock_resp_success.ok = True
        mock_resp_success.status_code = 200
        mock_resp_success.json.return_value = {
            "choices": [{"message": {"content": "### 1. Document Title and Type\nSuccess Doc"}}]
        }

        mock_post.side_effect = [mock_resp_fail, mock_resp_success]

        captured_events = []

        def unified_cb(event_name, data):
            captured_events.append((event_name, data))

        with patch.dict(os.environ, {"XAI_API_KEY": "xai-test-valid-key"}):
            result = grok_client.generate_document_summary(
                doc_text="Legal contract between Company X and Company Y.",
                file_name="agreement.txt",
                case_number="CASE-2025-002",
                preferred_models=["grok-2-latest", "grok-2-mini"],
                callback=unified_cb,
                dual_preference=False
            )

            self.assertEqual(result["model"], "grok-2-mini")
            event_names = [e[0] for e in captured_events]
            self.assertIn("attempt", event_names)
            self.assertIn("fallback", event_names)
            self.assertIn("success", event_names)

    @patch("requests.post")
    def test_06_all_models_fail_invokes_intelligent_engine_callback(self, mock_post):
        """
        Verify that if all remote Grok models fail (e.g. 403 credit exhausted),
        the system notifies callback and gracefully falls back to the Intelligent Legal Engine.
        """
        mock_resp_fail = MagicMock()
        mock_resp_fail.ok = False
        mock_resp_fail.status_code = 403
        mock_resp_fail.text = "permission-denied / credits exhausted"

        mock_post.return_value = mock_resp_fail

        fallback_calls = []

        def track_fallback(failed, err, next_m):
            fallback_calls.append((failed, next_m))

        with patch.dict(os.environ, {"XAI_API_KEY": "xai-test-valid-key"}):
            result = grok_client.generate_document_summary(
                doc_text="Commercial Arbitration Agreement between Apex Ltd and CloudSphere Pvt on 12-Oct-2025.",
                file_name="arbitration_petition.txt",
                case_number="CASE-ARB-2025",
                preferred_models=["grok-2-latest", "grok-beta"],
                on_model_fallback=track_fallback,
                dual_preference=False
            )

            self.assertEqual(result["status"], "SUCCESS")
            self.assertTrue(result["fallback_occurred"])
            self.assertIn("Intelligent Legal Engine fallback", result["model"])
            # Fallback was called for both grok-2-latest and grok-beta
            self.assertEqual(len(fallback_calls), 2)
            self.assertEqual(fallback_calls[0][0], "grok-2-latest")
            self.assertEqual(fallback_calls[1][0], "grok-beta")

    @patch("requests.post")
    def test_07_dual_preference_generation_two_perspectives(self, mock_post):
        """Verify dual preference generates both Preference 1 (Comprehensive) and Preference 2 (Strategic)."""
        mock_resp1 = MagicMock()
        mock_resp1.ok = True
        mock_resp1.status_code = 200
        mock_resp1.json.return_value = {
            "choices": [{"message": {"content": "### 1. Document Title and Type\nComprehensive Brief\n\n### 2. Executive Summary\nObjective factual breakdown."}}],
            "usage": {"total_tokens": 120}
        }

        mock_resp2 = MagicMock()
        mock_resp2.ok = True
        mock_resp2.status_code = 200
        mock_resp2.json.return_value = {
            "choices": [{"message": {"content": "### 1. Document Title and Type\nStrategic Review\n\n### 2. Executive Summary\nRisk and litigation strategy emphasis."}}],
            "usage": {"total_tokens": 140}
        }

        mock_post.side_effect = [mock_resp1, mock_resp2]

        with patch.dict(os.environ, {"XAI_API_KEY": "xai-test-valid-key"}):
            result = grok_client.generate_document_summary(
                doc_text="Sample contract text between Party A and Party B.",
                file_name="sample.pdf",
                case_number="CASE-2025-003",
                preferred_models=["grok-2-latest", "grok-beta"],
                dual_preference=True
            )

            self.assertEqual(result["status"], "SUCCESS")
            self.assertIn("preferences", result)
            self.assertEqual(len(result["preferences"]), 2)
            
            pref1 = result["preferences"][0]
            pref2 = result["preferences"][1]

            self.assertEqual(pref1["id"], "pref_1")
            self.assertEqual(pref1["perspective"], "Comprehensive Legal Brief")
            self.assertIn("Comprehensive Brief", pref1["summary_text"])

            self.assertEqual(pref2["id"], "pref_2")
            self.assertEqual(pref2["perspective"], "Strategic Advocate Review")
            self.assertIn("Strategic Review", pref2["summary_text"])

    def test_08_simulated_dual_preferences(self):
        """Verify simulated engine generates valid dual preferences when offline."""
        sim_prefs = grok_client.generate_simulated_dual_preferences(
            doc_text="Arbitration petition between Apex Ltd and CloudSphere Pvt.",
            file_name="petition.txt",
            case_number="CASE-2025-SIM"
        )
        self.assertEqual(len(sim_prefs), 2)
        self.assertEqual(sim_prefs[0]["id"], "pref_1")
        self.assertEqual(sim_prefs[1]["id"], "pref_2")
        self.assertIn("Arbitration", sim_prefs[0]["summary_text"])
        self.assertIn("Strategic Advocate Review", sim_prefs[1]["perspective"])


if __name__ == "__main__":
    unittest.main()

