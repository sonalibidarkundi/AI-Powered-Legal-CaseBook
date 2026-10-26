-- ============================================================================
-- SCRIPT: 04_seed_test_data.sql
-- PROJECT: AI-Powered Advocate Legal CaseBook (Stage 3)
-- DESCRIPTION: Populates the schema with strictly FICTIONAL demonstration data.
-- SECURITY NOTE: Passwords are simulated PBKDF2/scrypt cryptographic hashes.
--                Never store plaintext passwords in databases!
-- IDEMPOTENCY: Script removes test seed records before re-inserting to allow
--              safe, repeated execution without duplicate key errors.
-- ============================================================================

-- Clean up any prior test seed records by unique identifiers
DELETE FROM HEARINGS WHERE COURT_NAME IN ('High Court of Delhi - Courtroom 4', 'City Civil Court Mumbai - Bench 2');
DELETE FROM DOCUMENTS WHERE FILE_NAME IN ('Commercial_Agreement_Exhibit_A.pdf', 'Trademark_Notice_Reply.pdf');
DELETE FROM CASE_ASSIGNMENTS WHERE ASSIGNMENT_STATUS = 'ACTIVE' AND CASE_ID IN (SELECT CASE_ID FROM CASES WHERE CASE_NUMBER IN ('LCB-2026-001', 'LCB-2026-002'));
DELETE FROM CASE_CLIENTS WHERE CASE_ID IN (SELECT CASE_ID FROM CASES WHERE CASE_NUMBER IN ('LCB-2026-001', 'LCB-2026-002'));
DELETE FROM CASES WHERE CASE_NUMBER IN ('LCB-2026-001', 'LCB-2026-002');
DELETE FROM CLIENTS WHERE USER_ID IN (SELECT USER_ID FROM USERS WHERE EMAIL IN ('client.apex@example.com', 'kavita.rao@example.com'));
DELETE FROM STAFF WHERE EMPLOYEE_CODE IN ('EMP-LCB-001', 'EMP-LCB-002');
DELETE FROM USERS WHERE EMAIL IN (
    'advocate.rajesh@legalcasebook.test',
    'advocate.neha@legalcasebook.test',
    'staff.priya@legalcasebook.test',
    'staff.amit@legalcasebook.test',
    'client.apex@example.com',
    'kavita.rao@example.com'
);
COMMIT;

DECLARE
    v_advocate1_id   NUMBER;
    v_advocate2_id   NUMBER;
    v_staff1_user_id NUMBER;
    v_staff1_id      NUMBER;
    v_staff2_user_id NUMBER;
    v_staff2_id      NUMBER;
    v_client1_user_id NUMBER;
    v_client1_id     NUMBER;
    v_client2_user_id NUMBER;
    v_client2_id     NUMBER;
    v_case1_id       NUMBER;
    v_case2_id       NUMBER;
    v_assignment_id  NUMBER;
    
    -- Standard test password hash: 'Password123' (scrypt/pbkdf2 hash format)
    v_test_pw_hash   VARCHAR2(255) := 'scrypt:32768:8:1$yX8qjTestSalt$8f14e45fceea167a5a36dedd4bea2543';
BEGIN

    -- ------------------------------------------------------------------------
    -- 1. SEED ADVOCATES (Senior Counsel & Firm Partners)
    -- ------------------------------------------------------------------------
    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT)
    VALUES ('Adv. Rajesh Sharma', 'advocate.rajesh@legalcasebook.test', v_test_pw_hash, 'ADVOCATE', 'ACTIVE', SYSTIMESTAMP)
    RETURNING USER_ID INTO v_advocate1_id;

    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT)
    VALUES ('Adv. Neha Singhania', 'advocate.neha@legalcasebook.test', v_test_pw_hash, 'ADVOCATE', 'ACTIVE', SYSTIMESTAMP)
    RETURNING USER_ID INTO v_advocate2_id;

    -- ------------------------------------------------------------------------
    -- 2. SEED STAFF (Paralegal and Legal Clerk)
    -- ------------------------------------------------------------------------
    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT)
    VALUES ('Priya Nair', 'staff.priya@legalcasebook.test', v_test_pw_hash, 'STAFF', 'ACTIVE', SYSTIMESTAMP)
    RETURNING USER_ID INTO v_staff1_user_id;

    INSERT INTO STAFF (USER_ID, EMPLOYEE_CODE, CREATED_AT)
    VALUES (v_staff1_user_id, 'EMP-LCB-001', SYSTIMESTAMP)
    RETURNING STAFF_ID INTO v_staff1_id;

    INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS, CREATED_AT)
    VALUES ('Amit Patel', 'staff.amit@legalcasebook.test', v_test_pw_hash, 'STAFF', 'ACTIVE', SYSTIMESTAMP)
    RETURNING USER_ID INTO v_staff2_user_id;

    INSERT INTO STAFF (USER_ID, EMPLOYEE_CODE, CREATED_AT)
    VALUES (v_staff2_user_id, 'EMP-LCB-002', SYSTIMESTAMP)
    RETURNING STAFF_ID INTO v_staff2_id;

    -- ------------------------------------------------------------------------
    -- 3. SEED CLIENTS (Corporate Client & Individual Client via Package)
    -- ------------------------------------------------------------------------
    PKG_LEGAL_CASEBOOK.REGISTER_CLIENT(
        p_full_name     => 'Apex Tech Solutions Ltd',
        p_email         => 'client.apex@example.com',
        p_password_hash => v_test_pw_hash,
        p_phone         => '+91 98200 11223',
        p_address       => 'Plot 42, Tech Park, Whitefield, Bangalore 560066',
        o_user_id       => v_client1_user_id,
        o_client_id     => v_client1_id
    );

    PKG_LEGAL_CASEBOOK.REGISTER_CLIENT(
        p_full_name     => 'Dr. Kavita Rao',
        p_email         => 'kavita.rao@example.com',
        p_password_hash => v_test_pw_hash,
        p_phone         => '+91 98450 77889',
        p_address       => '14/B, Richmond Crescent, Bangalore 560025',
        o_user_id       => v_client2_user_id,
        o_client_id     => v_client2_id
    );

    -- ------------------------------------------------------------------------
    -- 4. SEED CASES (Using PL/SQL Package)
    -- ------------------------------------------------------------------------
    PKG_LEGAL_CASEBOOK.CREATE_CASE(
        p_case_number => 'LCB-2026-001',
        p_title       => 'Apex Tech vs CloudSphere: Commercial Licensing Breach',
        p_description => 'Arbitration dispute involving proprietary cloud integration code and unpaid milestones.',
        p_created_by  => v_advocate1_id,
        p_client_id   => v_client1_id,
        o_case_id     => v_case1_id
    );

    PKG_LEGAL_CASEBOOK.CREATE_CASE(
        p_case_number => 'LCB-2026-002',
        p_title       => 'Rao Estate Probate & Testamentary Succession',
        p_description => 'Petition for grant of probate under Section 276 of the Indian Succession Act, 1925.',
        p_created_by  => v_advocate2_id,
        p_client_id   => v_client2_id,
        o_case_id     => v_case2_id
    );

    -- ------------------------------------------------------------------------
    -- 5. SEED CASE ASSIGNMENTS (Delegating Tasks to Staff)
    -- ------------------------------------------------------------------------
    PKG_LEGAL_CASEBOOK.ASSIGN_CASE_STAFF(
        p_case_id       => v_case1_id,
        p_staff_id      => v_staff1_id,
        p_assigned_by   => v_advocate1_id,
        o_assignment_id => v_assignment_id
    );

    PKG_LEGAL_CASEBOOK.ASSIGN_CASE_STAFF(
        p_case_id       => v_case2_id,
        p_staff_id      => v_staff2_id,
        p_assigned_by   => v_advocate2_id,
        o_assignment_id => v_assignment_id
    );

    -- ------------------------------------------------------------------------
    -- 6. SEED DOCUMENTS (Exhibits & Petitions)
    -- ------------------------------------------------------------------------
    INSERT INTO DOCUMENTS (CASE_ID, UPLOADED_BY, FILE_NAME, MIME_TYPE, STORAGE_KEY, UPLOADED_AT)
    VALUES (
        v_case1_id,
        v_advocate1_id,
        'Commercial_Agreement_Exhibit_A.pdf',
        'application/pdf',
        'vault/2026/01/exhibit_a_signed_38472.pdf',
        SYSTIMESTAMP
    );

    INSERT INTO DOCUMENTS (CASE_ID, UPLOADED_BY, FILE_NAME, MIME_TYPE, STORAGE_KEY, UPLOADED_AT)
    VALUES (
        v_case2_id,
        v_advocate2_id,
        'Trademark_Notice_Reply.pdf',
        'application/pdf',
        'vault/2026/01/probate_petition_draft_11204.pdf',
        SYSTIMESTAMP
    );

    -- ------------------------------------------------------------------------
    -- 7. SEED HEARINGS (Court Calendars)
    -- ------------------------------------------------------------------------
    INSERT INTO HEARINGS (CASE_ID, HEARING_DATE, COURT_NAME, NOTES, HEARING_STATUS)
    VALUES (
        v_case1_id,
        SYSTIMESTAMP + INTERVAL '14' DAY,
        'High Court of Delhi - Courtroom 4',
        'Preliminary arguments on application for interim injunction.',
        'SCHEDULED'
    );

    INSERT INTO HEARINGS (CASE_ID, HEARING_DATE, COURT_NAME, NOTES, HEARING_STATUS)
    VALUES (
        v_case2_id,
        SYSTIMESTAMP + INTERVAL '28' DAY,
        'City Civil Court Mumbai - Bench 2',
        'Filing of citations and notice to legal heirs.',
        'SCHEDULED'
    );

    -- Commit all seed data
    COMMIT;
END;
/
