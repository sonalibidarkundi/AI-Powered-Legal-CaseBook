import json
import urllib.request
import urllib.parse
import http.cookiejar

BASE_URL = "http://127.0.0.1:5000"

def create_client():
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    return opener

def api_call(opener, method, endpoint, payload=None):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    headers = {"Content-Type": "application/json"} if payload else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        try:
            body = json.loads(err.read().decode("utf-8"))
        except Exception:
            body = {}
        return err.code, body

def test_dual_staff_isolation():
    client1 = create_client()
    client2 = create_client()

    # 1. Login Staff 1 (Priya)
    status1, body1 = api_call(client1, "POST", "/api/auth/login", {
        "email": "staff.priya@legalcasebook.test",
        "password": "Password123"
    })
    assert status1 == 200, f"Priya login failed: {body1}"
    print(f"[+] Staff 1 Logged in: {body1['user']['full_name']} ({body1['user']['email']})")

    # 2. Login Staff 2 (Amit)
    status2, body2 = api_call(client2, "POST", "/api/auth/login", {
        "email": "staff.amit@legalcasebook.test",
        "password": "Password123"
    })
    assert status2 == 200, f"Amit login failed: {body2}"
    print(f"[+] Staff 2 Logged in: {body2['user']['full_name']} ({body2['user']['email']})")

    # 3. Check Priya's cases
    status, res_cases1 = api_call(client1, "GET", "/api/staff/cases")
    priya_case_numbers = [c["case_number"] for c in res_cases1.get("cases", [])]
    print(f"[*] Priya's Assigned Cases: {priya_case_numbers}")

    # 4. Check Amit's cases
    status, res_cases2 = api_call(client2, "GET", "/api/staff/cases")
    amit_case_numbers = [c["case_number"] for c in res_cases2.get("cases", [])]
    print(f"[*] Amit's Assigned Cases: {amit_case_numbers}")

    # Verify disjointness
    assert set(priya_case_numbers).isdisjoint(set(amit_case_numbers)), "Privacy leak: overlapping case numbers!"
    print("[+] Verified: Priya and Amit have isolated, disjoint case assignments.")

    # 5. Cross-boundary Case Access Check
    # Priya tries to access Amit's case (Case ID 2)
    cross_status1, cross_body1 = api_call(client1, "GET", "/api/staff/cases/2")
    assert cross_status1 == 403, f"Expected 403, got {cross_status1}"
    print(f"[+] Verified: Priya denied access to Amit's case (HTTP {cross_status1} {cross_body1.get('code')})")

    # Amit tries to access Priya's case (Case ID 1)
    cross_status2, cross_body2 = api_call(client2, "GET", "/api/staff/cases/1")
    assert cross_status2 == 403, f"Expected 403, got {cross_status2}"
    print(f"[+] Verified: Amit denied access to Priya's case (HTTP {cross_status2} {cross_body2.get('code')})")

    # 6. Cross-boundary Document Check
    status, res_docs1 = api_call(client1, "GET", "/api/staff/documents")
    status, res_docs2 = api_call(client2, "GET", "/api/staff/documents")
    priya_doc_ids = [d["document_id"] for d in res_docs1.get("documents", [])]
    amit_doc_ids = [d["document_id"] for d in res_docs2.get("documents", [])]
    print(f"[*] Priya's Document IDs: {priya_doc_ids}")
    print(f"[*] Amit's Document IDs:  {amit_doc_ids}")
    assert set(priya_doc_ids).isdisjoint(set(amit_doc_ids)), "Document privacy leak!"
    print("[+] Verified: Document isolation is strictly enforced per staff member.")

    # Cleanup logout
    api_call(client1, "POST", "/api/auth/logout")
    api_call(client2, "POST", "/api/auth/logout")
    print("[+] All Dual-Staff Isolation and RBAC Checks PASSED!")

if __name__ == "__main__":
    test_dual_staff_isolation()
