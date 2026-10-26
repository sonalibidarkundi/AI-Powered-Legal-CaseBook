"""
seed_staff_data.py
Populates real database records for Staff Dashboard testing and demonstration.
Ensures Staff users have assigned cases, research tasks, documents, and upcoming deadlines.
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import db
import auth

def seed():
    db.init_local_schema()
    pw_hash = auth.hash_password("Password123")

    with db.get_db_connection() as conn:
        with conn.cursor() as cursor:
            # 1. Ensure Advocate Rajesh
            cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'advocate.rajesh@legalcasebook.test'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT) "
                    "VALUES ('Adv. Rajesh Sharma', 'advocate.rajesh@legalcasebook.test', :pw, 'ADVOCATE', 'ACTIVE', CURRENT_TIMESTAMP)",
                    {"pw": pw_hash}
                )
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'advocate.rajesh@legalcasebook.test'")
                adv1_uid = cursor.fetchone()[0]
            else:
                adv1_uid = row[0]

            # 2. Ensure Advocate Neha
            cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'advocate.neha@legalcasebook.test'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT) "
                    "VALUES ('Adv. Neha Singhania', 'advocate.neha@legalcasebook.test', :pw, 'ADVOCATE', 'ACTIVE', CURRENT_TIMESTAMP)",
                    {"pw": pw_hash}
                )
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'advocate.neha@legalcasebook.test'")
                adv2_uid = cursor.fetchone()[0]
            else:
                adv2_uid = row[0]

            # 3. Ensure Staff Priya
            cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'staff.priya@legalcasebook.test'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT) "
                    "VALUES ('Priya Nair', 'staff.priya@legalcasebook.test', :pw, 'STAFF', 'ACTIVE', CURRENT_TIMESTAMP)",
                    {"pw": pw_hash}
                )
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'staff.priya@legalcasebook.test'")
                staff1_uid = cursor.fetchone()[0]
                cursor.execute(
                    "INSERT INTO STAFF (USER_ID, EMPLOYEE_CODE, CREATED_AT) VALUES (:uid, 'EMP-LCB-001', CURRENT_TIMESTAMP)",
                    {"uid": staff1_uid}
                )
            else:
                staff1_uid = row[0]

            cursor.execute("SELECT STAFF_ID FROM STAFF WHERE USER_ID = :uid", {"uid": staff1_uid})
            staff1_id = cursor.fetchone()[0]

            # 4. Ensure Staff Amit
            cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'staff.amit@legalcasebook.test'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT) "
                    "VALUES ('Amit Patel', 'staff.amit@legalcasebook.test', :pw, 'STAFF', 'ACTIVE', CURRENT_TIMESTAMP)",
                    {"pw": pw_hash}
                )
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'staff.amit@legalcasebook.test'")
                staff2_uid = cursor.fetchone()[0]
                cursor.execute(
                    "INSERT INTO STAFF (USER_ID, EMPLOYEE_CODE, CREATED_AT) VALUES (:uid, 'EMP-LCB-002', CURRENT_TIMESTAMP)",
                    {"uid": staff2_uid}
                )
            else:
                staff2_uid = row[0]

            cursor.execute("SELECT STAFF_ID FROM STAFF WHERE USER_ID = :uid", {"uid": staff2_uid})
            staff2_id = cursor.fetchone()[0]

            # 5. Check if user 4 (Sonali) exists and get staff_id
            cursor.execute("SELECT STAFF_ID FROM STAFF WHERE USER_ID = 4")
            row = cursor.fetchone()
            sonali_staff_id = row[0] if row else None

            # 6. Ensure Client Apex
            cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'client.apex@example.com'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT) "
                    "VALUES ('Apex Tech Solutions Ltd', 'client.apex@example.com', :pw, 'CLIENT', 'ACTIVE', CURRENT_TIMESTAMP)",
                    {"pw": pw_hash}
                )
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'client.apex@example.com'")
                client1_uid = cursor.fetchone()[0]
                cursor.execute(
                    "INSERT INTO CLIENTS (USER_ID, PHONE, ADDRESS, CREATED_AT) VALUES (:uid, '+91 98200 11223', 'Plot 42, Tech Park, Whitefield, Bangalore', CURRENT_TIMESTAMP)",
                    {"uid": client1_uid}
                )
            else:
                client1_uid = row[0]

            cursor.execute("SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid", {"uid": client1_uid})
            client1_id = cursor.fetchone()[0]

            # 7. Ensure Client Kavita
            cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'kavita.rao@example.com'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT) "
                    "VALUES ('Dr. Kavita Rao', 'kavita.rao@example.com', :pw, 'CLIENT', 'ACTIVE', CURRENT_TIMESTAMP)",
                    {"pw": pw_hash}
                )
                cursor.execute("SELECT USER_ID FROM USERS WHERE EMAIL = 'kavita.rao@example.com'")
                client2_uid = cursor.fetchone()[0]
                cursor.execute(
                    "INSERT INTO CLIENTS (USER_ID, PHONE, ADDRESS, CREATED_AT) VALUES (:uid, '+91 98450 77889', '14/B, Richmond Crescent, Bangalore', CURRENT_TIMESTAMP)",
                    {"uid": client2_uid}
                )
            else:
                client2_uid = row[0]

            cursor.execute("SELECT CLIENT_ID FROM CLIENTS WHERE USER_ID = :uid", {"uid": client2_uid})
            client2_id = cursor.fetchone()[0]

            # 8. Ensure Cases
            # Case 1
            cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-001'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO CASES (CASE_NUMBER, TITLE, DESCRIPTION, CASE_STATUS, CASE_TYPE, CREATED_BY, CREATED_AT) "
                    "VALUES ('LCB-2026-001', 'Apex Tech vs CloudSphere: Commercial Licensing Breach', "
                    "'Arbitration dispute involving proprietary cloud integration code, API reverse-engineering, and unpaid licensing milestone royalties.', "
                    "'OPEN', 'CIVIL', :adv_id, CURRENT_TIMESTAMP)",
                    {"adv_id": adv1_uid}
                )
                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-001'")
                case1_id = cursor.fetchone()[0]
                cursor.execute("INSERT INTO CASE_CLIENTS (CASE_ID, CLIENT_ID) VALUES (:cid, :clid)", {"cid": case1_id, "clid": client1_id})
            else:
                case1_id = row[0]

            # Case 2
            cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-002'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO CASES (CASE_NUMBER, TITLE, DESCRIPTION, CASE_STATUS, CASE_TYPE, CREATED_BY, CREATED_AT) "
                    "VALUES ('LCB-2026-002', 'Rao Estate Probate & Testamentary Succession', "
                    "'Petition for grant of probate under Section 276 of the Indian Succession Act, 1925 for ancestral properties located in Bangalore and Mysore.', "
                    "'PENDING_HEARING', 'FAMILY', :adv_id, CURRENT_TIMESTAMP)",
                    {"adv_id": adv2_uid}
                )
                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-002'")
                case2_id = cursor.fetchone()[0]
                cursor.execute("INSERT INTO CASE_CLIENTS (CASE_ID, CLIENT_ID) VALUES (:cid, :clid)", {"cid": case2_id, "clid": client2_id})
            else:
                case2_id = row[0]

            # Case 3
            cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-003'")
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO CASES (CASE_NUMBER, TITLE, DESCRIPTION, CASE_STATUS, CASE_TYPE, CREATED_BY, CREATED_AT) "
                    "VALUES ('LCB-2026-003', 'Spectrum Allocation Regulatory Dispute', "
                    "'Proceedings before Telecom Disputes Settlement and Appellate Tribunal regarding adjusted gross revenue (AGR) demands and license fee offsets.', "
                    "'IN_TRIAL', 'CORPORATE', :adv_id, CURRENT_TIMESTAMP)",
                    {"adv_id": adv1_uid}
                )
                cursor.execute("SELECT CASE_ID FROM CASES WHERE CASE_NUMBER = 'LCB-2026-003'")
                case3_id = cursor.fetchone()[0]
                cursor.execute("INSERT INTO CASE_CLIENTS (CASE_ID, CLIENT_ID) VALUES (:cid, :clid)", {"cid": case3_id, "clid": client1_id})
            else:
                case3_id = row[0]

            # 9. Case Assignments
            now = datetime.now()
            # Staff Priya -> Case 1
            cursor.execute("SELECT COUNT(*) FROM CASE_ASSIGNMENTS WHERE CASE_ID = :cid AND STAFF_ID = :sid", {"cid": case1_id, "sid": staff1_id})
            if cursor.fetchone()[0] == 0:
                d1 = (now + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute(
                    "INSERT INTO CASE_ASSIGNMENTS (CASE_ID, STAFF_ID, ASSIGNED_BY, ASSIGNED_AT, ASSIGNMENT_STATUS, INSTRUCTIONS, DEADLINE) "
                    "VALUES (:cid, :sid, :adv_id, CURRENT_TIMESTAMP, 'ACTIVE', 'Review cloud service agreements, extract IP licensing clauses, and draft exhibit verification affidavit.', :dl)",
                    {"cid": case1_id, "sid": staff1_id, "adv_id": adv1_uid, "dl": d1}
                )

            # Staff Amit -> Case 2
            cursor.execute("SELECT COUNT(*) FROM CASE_ASSIGNMENTS WHERE CASE_ID = :cid AND STAFF_ID = :sid", {"cid": case2_id, "sid": staff2_id})
            if cursor.fetchone()[0] == 0:
                d2 = (now + timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute(
                    "INSERT INTO CASE_ASSIGNMENTS (CASE_ID, STAFF_ID, ASSIGNED_BY, ASSIGNED_AT, ASSIGNMENT_STATUS, INSTRUCTIONS, DEADLINE) "
                    "VALUES (:cid, :sid, :adv_id, CURRENT_TIMESTAMP, 'ACTIVE', 'Verify attesting witness affidavits for probate petition under Section 276 of Indian Succession Act.', :dl)",
                    {"cid": case2_id, "sid": staff2_id, "adv_id": adv2_uid, "dl": d2}
                )

            # Sonali (Staff ID 1) -> Case 1 & Case 3
            if sonali_staff_id:
                cursor.execute("SELECT COUNT(*) FROM CASE_ASSIGNMENTS WHERE CASE_ID = :cid AND STAFF_ID = :sid", {"cid": case1_id, "sid": sonali_staff_id})
                if cursor.fetchone()[0] == 0:
                    d_sonali1 = (now + timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S")
                    cursor.execute(
                        "INSERT INTO CASE_ASSIGNMENTS (CASE_ID, STAFF_ID, ASSIGNED_BY, ASSIGNED_AT, ASSIGNMENT_STATUS, INSTRUCTIONS, DEADLINE) "
                        "VALUES (:cid, :sid, :adv_id, CURRENT_TIMESTAMP, 'ACTIVE', 'Analyze cross-border jurisdiction clauses and draft exhibit verification table.', :dl)",
                        {"cid": case1_id, "sid": sonali_staff_id, "adv_id": adv1_uid, "dl": d_sonali1}
                    )

                cursor.execute("SELECT COUNT(*) FROM CASE_ASSIGNMENTS WHERE CASE_ID = :cid AND STAFF_ID = :sid", {"cid": case3_id, "sid": sonali_staff_id})
                if cursor.fetchone()[0] == 0:
                    d_sonali3 = (now + timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S")
                    cursor.execute(
                        "INSERT INTO CASE_ASSIGNMENTS (CASE_ID, STAFF_ID, ASSIGNED_BY, ASSIGNED_AT, ASSIGNMENT_STATUS, INSTRUCTIONS, DEADLINE) "
                        "VALUES (:cid, :sid, :adv_id, CURRENT_TIMESTAMP, 'ACTIVE', 'Prepare comparative analysis of telecom tribunal precedents on spectrum license fee computation.', :dl)",
                        {"cid": case3_id, "sid": sonali_staff_id, "adv_id": adv1_uid, "dl": d_sonali3}
                    )

            # 10. Research Tasks
            cursor.execute("SELECT COUNT(*) FROM RESEARCH_TASKS")
            if cursor.fetchone()[0] == 0:
                due_in_5 = (now + timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S")
                due_in_8 = (now + timedelta(days=8)).strftime("%Y-%m-%d %H:%M:%S")
                due_in_4 = (now + timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S")
                due_in_3 = (now + timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
                due_in_6 = (now + timedelta(days=6)).strftime("%Y-%m-%d %H:%M:%S")

                # Priya's tasks
                cursor.execute(
                    "INSERT INTO RESEARCH_TASKS (CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, RESEARCH_NOTES, CREATED_AT, UPDATED_AT) "
                    "VALUES (:cid, :sid, :adv_id, 'Precedent Analysis on Cloud API Licensing Breach', "
                    "'Analyze recent Delhi High Court and Supreme Court precedents regarding software IP theft, trade secret misappropriation, and unilateral termination of SaaS multi-tenant licensing agreements.', "
                    "'IN_PROGRESS', 'HIGH', :due, 'Examined 2024 SC decision in Techcorp v. DataGrid: Court held that API schema unauthorized replication constitutes breach of Section 65B and copyright under Section 14(b) of Copyright Act.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    {"cid": case1_id, "sid": staff1_id, "adv_id": adv1_uid, "due": due_in_5}
                )

                cursor.execute(
                    "INSERT INTO RESEARCH_TASKS (CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, RESEARCH_NOTES, CREATED_AT, UPDATED_AT) "
                    "VALUES (:cid, :sid, :adv_id, 'Draft Affidavit of Admission/Denial for Technical Exhibits', "
                    "'Prepare itemized verification table for Exhibits A1 through A14 including server log timestamps and cryptographic hash verification.', "
                    "'PENDING', 'MEDIUM', :due, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    {"cid": case1_id, "sid": staff1_id, "adv_id": adv1_uid, "due": due_in_8}
                )

                # Amit's tasks
                cursor.execute(
                    "INSERT INTO RESEARCH_TASKS (CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, RESEARCH_NOTES, CREATED_AT, UPDATED_AT) "
                    "VALUES (:cid, :sid, :adv_id, 'Verify Attesting Witness Affidavits for Probate Petition', "
                    "'Coordinate with medical officer who certified testator testamentary capacity on 14 Jan 2025. Verify original signature against hospital register.', "
                    "'PENDING', 'HIGH', :due, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    {"cid": case2_id, "sid": staff2_id, "adv_id": adv2_uid, "due": due_in_4}
                )

                # Sonali's tasks
                if sonali_staff_id:
                    cursor.execute(
                        "INSERT INTO RESEARCH_TASKS (CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, RESEARCH_NOTES, CREATED_AT, UPDATED_AT) "
                        "VALUES (:cid, :sid, :adv_id, 'Examine Cross-Border Jurisdiction Clauses in Cloud Contracts', "
                        "'Review Singapore International Arbitration Centre (SIAC) clause vs Delhi Seat clause in CloudSphere Master Agreement Clause 24.3.', "
                        "'PENDING', 'URGENT', :due, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                        {"cid": case1_id, "sid": sonali_staff_id, "adv_id": adv1_uid, "due": due_in_3}
                    )

                    cursor.execute(
                        "INSERT INTO RESEARCH_TASKS (CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, RESEARCH_NOTES, CREATED_AT, UPDATED_AT) "
                        "VALUES (:cid, :sid, :adv_id, 'Prepare Hearing Brief for Telecom Tribunal Preliminary Arguments', "
                        "'Summarize appellate tribunal decisions on deductions of spectrum usage charges under 2016 NTP rules.', "
                        "'IN_PROGRESS', 'HIGH', :due, 'Drafted 4-page synopsis of TDSAT rulings on spectrum usage charge adjustments and bank guarantee exemptions.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                        {"cid": case3_id, "sid": sonali_staff_id, "adv_id": adv1_uid, "due": due_in_6}
                    )

                    cursor.execute(
                        "INSERT INTO RESEARCH_TASKS (CASE_ID, STAFF_ID, ASSIGNED_BY, TITLE, INSTRUCTIONS, STATUS, PRIORITY, DUE_DATE, RESEARCH_NOTES, CREATED_AT, UPDATED_AT) "
                        "VALUES (:cid, :sid, :adv_id, 'Statutory Compliance Audit on Notice of Motion', "
                        "'Verify service of notice of motion on Ministry of Communications and Union of India Standing Counsel.', "
                        "'COMPLETED', 'MEDIUM', :due, 'Service executed on 21 Oct 2026. Acknowledgment receipt uploaded to registry case bundle.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                        {"cid": case3_id, "sid": sonali_staff_id, "adv_id": adv1_uid, "due": due_in_8}
                    )

            # 11. Documents - Clean slate (real uploads only)
            pass

            # 12. Hearings
            cursor.execute("SELECT COUNT(*) FROM HEARINGS")
            if cursor.fetchone()[0] == 0:
                h1_date = (now + timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S")
                h2_date = (now + timedelta(days=28)).strftime("%Y-%m-%d %H:%M:%S")
                h3_date = (now + timedelta(days=12)).strftime("%Y-%m-%d %H:%M:%S")

                cursor.execute(
                    "INSERT INTO HEARINGS (CASE_ID, HEARING_DATE, COURT_ROOM, JUDGE_NAME, HEARING_STATUS, NOTES, CREATED_AT) "
                    "VALUES (:cid, :hdate, 'Courtroom 4 - High Court of Delhi', 'Hon. Justice R. K. Bansal', 'SCHEDULED', 'Preliminary arguments on application for interim injunction under Section 9 of Arbitration Act.', CURRENT_TIMESTAMP)",
                    {"cid": case1_id, "hdate": h1_date}
                )
                cursor.execute(
                    "INSERT INTO HEARINGS (CASE_ID, HEARING_DATE, COURT_ROOM, JUDGE_NAME, HEARING_STATUS, NOTES, CREATED_AT) "
                    "VALUES (:cid, :hdate, 'Bench 2 - City Civil Court Mumbai', 'Hon. Judge P. S. Kulkarni', 'SCHEDULED', 'Filing of citations and notice to legal heirs.', CURRENT_TIMESTAMP)",
                    {"cid": case2_id, "hdate": h2_date}
                )
                cursor.execute(
                    "INSERT INTO HEARINGS (CASE_ID, HEARING_DATE, COURT_ROOM, JUDGE_NAME, HEARING_STATUS, NOTES, CREATED_AT) "
                    "VALUES (:cid, :hdate, 'Bench 1 - TDSAT Court New Delhi', 'Hon. Chairperson Justice D. N. Patel', 'SCHEDULED', 'Hearing on maintainability of AGR demand waiver petition.', CURRENT_TIMESTAMP)",
                    {"cid": case3_id, "hdate": h3_date}
                )

            conn.commit()
            print("[+] Seed completed successfully!")

if __name__ == "__main__":
    seed()
