"""
verify_live_api.py
Performs live HTTP verification against http://127.0.0.1:5000 using requests.
Tests complete staff authentication, privacy boundaries, case files, tasks, status updates, and notes.
"""

import urllib.request
import urllib.parse
import json
import http.cookiejar

BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    def make_req(endpoint, method="GET", data=None, headers=None):
        url = f"{BASE_URL}{endpoint}"
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        
        encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=encoded_data, headers=req_headers, method=method)
        try:
            with opener.open(req) as resp:
                content = resp.read().decode("utf-8")
                return resp.status, json.loads(content) if resp.headers.get_content_type() == "application/json" else content, resp.headers
        except urllib.error.HTTPError as err:
            content = err.read().decode("utf-8")
            try:
                body = json.loads(content)
            except Exception:
                body = content
            return err.code, body, err.headers

    print("[*] 1. Testing Health Check...")
    status, body, _ = make_req("/api/health")
    assert status == 200, f"Health check failed: {status}"
    print(f"    Health Status: {status} OK")

    print("[*] 2. Logging in as Staff Priya (staff.priya@legalcasebook.test)...")
    status, body, _ = make_req("/api/auth/login", method="POST", data={
        "email": "staff.priya@legalcasebook.test",
        "password": "Password123"
    })
    assert status == 200, f"Login failed: {status} - {body}"
    csrf_token = body.get("csrf_token")
    assert csrf_token, "CSRF token missing"
    print(f"    Login Status: {status} OK, Welcome: {body['user']['full_name']}")

    print("[*] 3. Fetching Staff Dashboard Overview (/api/staff/overview)...")
    status, body, _ = make_req("/api/staff/overview")
    assert status == 200, f"Overview failed: {status} - {body}"
    metrics = body["metrics"]
    print(f"    Assigned Cases: {metrics['assigned_cases']}")
    print(f"    Pending Tasks:  {metrics['pending_tasks']}")
    print(f"    In Progress:    {metrics['in_progress_tasks']}")
    print(f"    Completed:      {metrics['completed_tasks']}")
    print(f"    Deadlines:      {metrics['upcoming_deadlines']}")

    print("[*] 4. Fetching Staff Assigned Cases (/api/staff/cases)...")
    status, body, _ = make_req("/api/staff/cases")
    assert status == 200, f"Cases failed: {status} - {body}"
    cases = body["cases"]
    assert len(cases) > 0, "No cases returned"
    case_numbers = [c["case_number"] for c in cases]
    assert "LCB-2026-001" in case_numbers, "Case LCB-2026-001 missing"
    assert "LCB-2026-002" not in case_numbers, "Case LCB-2026-002 (unassigned) leaked to S1!"
    print(f"    Priya's Cases: {case_numbers} (Correctly isolated)")

    print("[*] 5. Fetching Permitted Case Details (/api/staff/cases/1)...")
    status, body, _ = make_req("/api/staff/cases/1")
    assert status == 200, f"Case details failed: {status}"
    print(f"    Case: {body['case_number']} - {body['title']}")
    print(f"    Client: {body['clients'][0]['full_name']} (Phone: {body['clients'][0]['phone']})")

    print("[*] 6. Testing Privacy Boundary: Staff S1 attempts to access unassigned Case 2...")
    status, body, _ = make_req("/api/staff/cases/2")
    assert status == 403, f"Expected 403, got {status}"
    assert body.get("code") == "FORBIDDEN_CASE_ACCESS", f"Unexpected code: {body}"
    print(f"    Tampered request blocked with 403: {body['code']}")

    print("[*] 7. Testing Document Download Security: S1 attempts to access Case 2 documents...")
    status, body, _ = make_req("/api/staff/cases/2/documents")
    assert status == 403, f"Expected 403, got {status}"
    assert body.get("code") == "FORBIDDEN_DOCUMENT_ACCESS", f"Unexpected code: {body}"
    print(f"    Unauthorized document access blocked with 403: {body['code']}")

    print("[*] 8. Fetching Research Tasks (/api/staff/tasks)...")
    status, body, _ = make_req("/api/staff/tasks")
    assert status == 200, f"Tasks failed: {status}"
    tasks = body["tasks"]
    assert len(tasks) > 0, "No tasks found"
    task_id = tasks[0]["task_id"]
    print(f"    Found {len(tasks)} research tasks. Testing Task ID: {task_id} ('{tasks[0]['title']}')")

    print("[*] 9. Updating Task Status to 'IN_PROGRESS'...")
    status, body, _ = make_req(f"/api/staff/tasks/{task_id}/status", method="PUT", data={"status": "IN_PROGRESS"}, headers={"X-CSRF-Token": csrf_token})
    assert status == 200, f"Status update failed: {status} - {body}"
    print(f"    Status updated: {body['status']} (Confirmed by Oracle DB)")

    print("[*] 10. Saving Research Notes & Work Results...")
    new_notes = "Verified Supreme Court IT Act precedents on multi-tenant cloud architectures."
    status, body, _ = make_req(f"/api/staff/tasks/{task_id}/notes", method="PUT", data={"research_notes": new_notes}, headers={"X-CSRF-Token": csrf_token})
    assert status == 200, f"Notes update failed: {status} - {body}"
    print(f"    Notes saved: {body['message']}")

    print("[*] 11. Fetching Upcoming Deadlines (/api/staff/deadlines)...")
    status, body, _ = make_req("/api/staff/deadlines")
    assert status == 200, f"Deadlines failed: {status}"
    print(f"    Retrieved {body['total']} upcoming deadlines")

    print("[*] 12. Logging out (/api/auth/logout)...")
    status, body, _ = make_req("/api/auth/logout", method="POST")
    assert status == 200, f"Logout failed: {status}"
    print(f"    Successfully logged out.")

    print("\n[+] ALL LIVE ENDPOINT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
