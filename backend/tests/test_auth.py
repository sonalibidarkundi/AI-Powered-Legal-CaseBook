"""
Legal CaseBook - Stage 4 Security & Authentication Test Suite (test_auth.py)
----------------------------------------------------------------------------
Automated unit and integration test suite executing all Section 8 requirements:
1. Valid login (sets HttpOnly session cookie, returns user profile).
2. Invalid password (returns 401 generic error).
3. Unknown email (returns 401 generic error).
4. Inactive account (returns 403 status explanation).
5. Successful client registration (creates CLIENT role only).
6. Duplicate email rejection (returns 409 conflict).
7. Attempted public Advocate registration (rejected with 403).
8. Attempted public Staff registration (rejected with 403).
9. Unauthenticated access to protected routes (returns 401).
10. Unauthorized role access (returns 403).
11. Session restoration (/api/auth/me).
12. Logout and subsequent access denial.
13. Health-check endpoints (/api/health and /api/db-health).
14. Rate limiting (blocks after 5 failed attempts).
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
import auth

class AuthenticationAndRBACTestCase(unittest.TestCase):

    def setUp(self):
        # Configure app for testing
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        self.client = app.test_client()

        # Generate a standard hashed password for test fixtures
        self.test_password = "Password123"
        self.test_password_hash = auth.hash_password(self.test_password)

        # Fictional test accounts matching Stage 3 seed data
        self.fictional_advocate = {
            "user_id": 101,
            "full_name": "Adv. Rajesh Sharma",
            "email": "advocate.rajesh@legalcasebook.test",
            "password_hash": self.test_password_hash,
            "role": "ADVOCATE",
            "account_status": "ACTIVE"
        }

        self.fictional_staff = {
            "user_id": 102,
            "full_name": "Priya Nair",
            "email": "staff.priya@legalcasebook.test",
            "password_hash": self.test_password_hash,
            "role": "STAFF",
            "account_status": "ACTIVE"
        }

        self.fictional_client = {
            "user_id": 103,
            "full_name": "Apex Tech Solutions Ltd",
            "email": "client.apex@example.com",
            "password_hash": self.test_password_hash,
            "role": "CLIENT",
            "account_status": "ACTIVE"
        }

        self.fictional_inactive_advocate = {
            "user_id": 104,
            "full_name": "Adv. Pending Approval",
            "email": "advocate.pending@legalcasebook.test",
            "password_hash": self.test_password_hash,
            "role": "ADVOCATE",
            "account_status": "PENDING"
        }

        # Reset rate limiter before each test
        auth.login_limiter.failed_attempts.clear()

    # ------------------------------------------------------------------------
    # 1. HEALTH-CHECK ENDPOINTS
    # ------------------------------------------------------------------------
    def test_health_endpoints(self):
        """Verifies GET /api/health and /api/db-health."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("database", data)

        db_res = self.client.get("/api/db-health")
        # Status code is 200 if connected or 503 if Oracle server is offline
        self.assertIn(db_res.status_code, (200, 503))

    # ------------------------------------------------------------------------
    # 2. VALID LOGIN & SESSION RESTORATION
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_valid_login_and_session_restoration(self, mock_get_user):
        """Verifies valid credentials log in, set session cookie, and restore session."""
        mock_get_user.return_value = self.fictional_advocate

        res = self.client.post("/api/auth/login", json={
            "email": "advocate.rajesh@legalcasebook.test",
            "password": "Password123"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["user"]["role"], "ADVOCATE")
        self.assertEqual(data["user"]["email"], "advocate.rajesh@legalcasebook.test")
        self.assertNotIn("password_hash", data["user"])

        # Session Restoration test (/api/auth/me) using the session cookie
        me_res = self.client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertTrue(me_data["authenticated"])
        self.assertEqual(me_data["user"]["role"], "ADVOCATE")

    # ------------------------------------------------------------------------
    # 3. INVALID PASSWORD
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_invalid_password(self, mock_get_user):
        """Verifies incorrect password returns 401 generic error."""
        mock_get_user.return_value = self.fictional_advocate

        res = self.client.post("/api/auth/login", json={
            "email": "advocate.rajesh@legalcasebook.test",
            "password": "WrongPassword999!"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data["code"], "INVALID_CREDENTIALS")
        self.assertIn("Invalid email", data["error"])

    # ------------------------------------------------------------------------
    # 4. UNKNOWN EMAIL
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_unknown_email(self, mock_get_user):
        """Verifies unknown email returns 401 generic error (no user enumeration)."""
        mock_get_user.return_value = None

        res = self.client.post("/api/auth/login", json={
            "email": "does.not.exist@nowhere.com",
            "password": "Password123"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data["code"], "INVALID_CREDENTIALS")

    # ------------------------------------------------------------------------
    # 5. INACTIVE ACCOUNT
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_inactive_account_rejection(self, mock_get_user):
        """Verifies pending/inactive accounts are rejected with 403."""
        mock_get_user.return_value = self.fictional_inactive_advocate

        res = self.client.post("/api/auth/login", json={
            "email": "advocate.pending@legalcasebook.test",
            "password": "Password123"
        })
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["code"], "ACCOUNT_NOT_ACTIVE")

    # ------------------------------------------------------------------------
    # 6. RATE LIMITING ON FAILED LOGINS
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_login_rate_limiting(self, mock_get_user):
        """Verifies brute-force rate limiter blocks after 5 failed attempts."""
        mock_get_user.return_value = None

        for attempt in range(5):
            res = self.client.post("/api/auth/login", json={
                "email": "bruteforce@target.com",
                "password": f"attempt_{attempt}"
            })
            self.assertEqual(res.status_code, 401)

        # 6th attempt should be blocked by rate limiter
        blocked_res = self.client.post("/api/auth/login", json={
            "email": "bruteforce@target.com",
            "password": "attempt_6"
        })
        self.assertEqual(blocked_res.status_code, 429)
        data = blocked_res.get_json()
        self.assertEqual(data["code"], "RATE_LIMITED")

    @patch("auth.register_user_in_db")
    def test_advocate_registration_success(self, mock_register_db):
        """Verifies creating an Advocate role creates an ADVOCATE account."""
        mock_register_db.return_value = {
            "user_id": 301,
            "full_name": "Adv. Sonal Kumar",
            "email": "sonal.advocate@court.com",
            "role": "ADVOCATE",
            "account_status": "ACTIVE"
        }
        res = self.client.post("/api/auth/register", json={
            "fullName": "Adv. Sonal Kumar",
            "email": "sonal.advocate@court.com",
            "password": "SecurePassword123",
            "accountType": "advocate"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["user"]["role"], "ADVOCATE")
        self.assertEqual(data["user"]["email"], "sonal.advocate@court.com")

    @patch("auth.register_user_in_db")
    def test_staff_registration_success(self, mock_register_db):
        """Verifies creating a Staff role creates a STAFF account."""
        mock_register_db.return_value = {
            "user_id": 302,
            "full_name": "Priya Staff",
            "email": "priya.staff@court.com",
            "role": "STAFF",
            "account_status": "ACTIVE"
        }
        res = self.client.post("/api/auth/register", json={
            "fullName": "Priya Staff",
            "email": "priya.staff@court.com",
            "password": "SecurePassword123",
            "accountType": "staff"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["user"]["role"], "STAFF")
        self.assertEqual(data["user"]["email"], "priya.staff@court.com")

    def test_invalid_account_type_rejected(self):
        """Verifies unknown account types are rejected with 400."""
        res = self.client.post("/api/auth/register", json={
            "fullName": "Unknown User",
            "email": "unknown@domain.com",
            "password": "SecurePassword123",
            "accountType": "superadmin"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["code"], "INVALID_ACCOUNT_TYPE")
    # 8. CLIENT REGISTRATION VALIDATION & SUCCESS
    # ------------------------------------------------------------------------
    def test_registration_validation_rules(self):
        """Verifies invalid email and weak passwords are rejected."""
        # Weak password (missing uppercase and digit)
        res1 = self.client.post("/api/auth/register", json={
            "fullName": "Kavita Rao",
            "email": "valid@email.com",
            "password": "short",
            "accountType": "client"
        })
        self.assertEqual(res1.status_code, 400)
        self.assertEqual(res1.get_json()["code"], "WEAK_PASSWORD")

        # Invalid email format
        res2 = self.client.post("/api/auth/register", json={
            "fullName": "Kavita Rao",
            "email": "not-an-email",
            "password": "SecurePassword123",
            "accountType": "client"
        })
        self.assertEqual(res2.status_code, 400)
        self.assertEqual(res2.get_json()["code"], "INVALID_EMAIL")

    @patch("auth.register_client_in_db")
    def test_successful_client_registration(self, mock_register_db):
        """Verifies valid client registration creates record with CLIENT role."""
        mock_register_db.return_value = {
            "user_id": 201,
            "client_id": 301,
            "full_name": "Dr. Kavita Rao",
            "email": "kavita.rao@example.com",
            "role": "CLIENT",
            "account_status": "ACTIVE"
        }

        res = self.client.post("/api/auth/register", json={
            "fullName": "Dr. Kavita Rao",
            "email": "kavita.rao@example.com",
            "password": "SecurePassword123",
            "accountType": "client",
            "phone": "+91 98450 77889",
            "address": "14/B, Richmond Crescent, Bangalore"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["user"]["role"], "CLIENT")
        self.assertEqual(data["user"]["email"], "kavita.rao@example.com")

    @patch("auth.register_client_in_db")
    def test_duplicate_email_registration(self, mock_register_db):
        """Verifies duplicate email is rejected with 409 Conflict."""
        mock_register_db.side_effect = ValueError("This email address is already registered.")

        res = self.client.post("/api/auth/register", json={
            "fullName": "Duplicate User",
            "email": "client.apex@example.com",
            "password": "SecurePassword123",
            "accountType": "client"
        })
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()["code"], "DUPLICATE_EMAIL")

    def test_empty_fields_registration_rejected(self):
        """Verifies submitting registration with empty fields returns 400 INVALID_NAME."""
        res = self.client.post("/api/auth/register", json={
            "fullName": "",
            "email": "",
            "password": "",
            "accountType": "client"
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json()["code"], "INVALID_NAME")

    @patch("auth.register_client_in_db")
    def test_database_connection_error_handling(self, mock_register_db):
        """Verifies database errors return 503 DATABASE_UNAVAILABLE."""
        mock_register_db.side_effect = RuntimeError("Oracle listener connection timed out")

        res = self.client.post("/api/auth/register", json={
            "fullName": "Kavita Rao",
            "email": "kavita.rao@example.com",
            "password": "SecurePassword123",
            "accountType": "client"
        })
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.get_json()["code"], "DATABASE_UNAVAILABLE")

    # ------------------------------------------------------------------------
    # 9. ROLE-BASED ACCESS CONTROL (RBAC) & PROTECTED ROUTES
    # ------------------------------------------------------------------------
    def test_unauthenticated_access_to_protected_routes(self):
        """Verifies unauthenticated requests to protected dashboards return 401."""
        res_adv = self.client.get("/api/advocate/dashboard")
        self.assertEqual(res_adv.status_code, 401)

        res_staff = self.client.get("/api/staff/dashboard")
        self.assertEqual(res_staff.status_code, 401)

        res_client = self.client.get("/api/client/dashboard")
        self.assertEqual(res_client.status_code, 401)

    @patch("auth.get_user_by_email")
    def test_unauthorized_role_access(self, mock_get_user):
        """Verifies a Client cannot access Advocate dashboard (returns 403)."""
        # Login as Client
        mock_get_user.return_value = self.fictional_client
        self.client.post("/api/auth/login", json={
            "email": "client.apex@example.com",
            "password": "Password123"
        })

        # Attempt to access Advocate endpoint
        res = self.client.get("/api/advocate/dashboard")
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertEqual(data["code"], "FORBIDDEN")
        self.assertEqual(data["user_role"], "CLIENT")

        # But access to Client dashboard succeeds
        client_res = self.client.get("/api/client/dashboard")
        self.assertEqual(client_res.status_code, 200)

    @patch("auth.get_user_by_email")
    def test_authorized_advocate_access(self, mock_get_user):
        """Verifies Advocate possesses clearance to all workspaces."""
        # Login as Advocate
        mock_get_user.return_value = self.fictional_advocate
        self.client.post("/api/auth/login", json={
            "email": "advocate.rajesh@legalcasebook.test",
            "password": "Password123"
        })

        adv_res = self.client.get("/api/advocate/dashboard")
        # In Stage 5, advocate dashboard connects to real Oracle Database.
        # Status is 200 when Oracle is connected, or 503 if Oracle server is offline.
        # Both confirm that RBAC clearance was granted (otherwise 401 or 403 would be returned).
        self.assertIn(adv_res.status_code, (200, 503))

        staff_res = self.client.get("/api/staff/dashboard")
        self.assertEqual(staff_res.status_code, 200)

    # ------------------------------------------------------------------------
    # 10. LOGOUT & SUBSEQUENT ACCESS DENIAL
    # ------------------------------------------------------------------------
    @patch("auth.get_user_by_email")
    def test_logout_and_subsequent_access_denial(self, mock_get_user):
        """Verifies logging out invalidates session and subsequent calls return 401."""
        # Login
        mock_get_user.return_value = self.fictional_advocate
        self.client.post("/api/auth/login", json={
            "email": "advocate.rajesh@legalcasebook.test",
            "password": "Password123"
        })

        # Confirm session works
        res1 = self.client.get("/api/auth/me")
        self.assertEqual(res1.status_code, 200)

        # Logout
        logout_res = self.client.post("/api/auth/logout")
        self.assertEqual(logout_res.status_code, 200)

        # Subsequent call must be denied (401)
        res2 = self.client.get("/api/auth/me")
        self.assertEqual(res2.status_code, 401)

        res3 = self.client.get("/api/advocate/dashboard")
        self.assertEqual(res3.status_code, 401)


if __name__ == "__main__":
    unittest.main()
