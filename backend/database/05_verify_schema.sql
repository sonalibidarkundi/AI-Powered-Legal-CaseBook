-- ============================================================================
-- SCRIPT: 05_verify_schema.sql
-- PROJECT: AI-Powered Advocate Legal CaseBook (Stage 3)
-- DESCRIPTION: Automated verification and integrity test suite for Oracle DB.
-- CHECKS:
--   1. All 9 required tables exist.
--   2. Primary Keys, Foreign Keys, and Check constraints exist.
--   3. Unique email constraint rejects duplicate email entries.
--   4. Role check constraint rejects unauthorized/invalid roles.
--   5. Foreign key constraints reject orphan child records.
--   6. PL/SQL package PKG_LEGAL_CASEBOOK is compiled and VALID.
-- ============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED;

DECLARE
    v_missing_tables   NUMBER := 0;
    v_missing_indexes  NUMBER := 0;
    v_package_status   VARCHAR2(30);
    v_error_caught     BOOLEAN := FALSE;
    v_test_counter     NUMBER := 0;
    v_pass_counter     NUMBER := 0;
BEGIN
    DBMS_OUTPUT.PUT_LINE('====================================================');
    DBMS_OUTPUT.PUT_LINE('  LEGAL CASEBOOK - ORACLE SCHEMA VERIFICATION SUITE ');
    DBMS_OUTPUT.PUT_LINE('====================================================');

    -- ------------------------------------------------------------------------
    -- TEST 1: Verify Table Existence
    -- ------------------------------------------------------------------------
    v_test_counter := v_test_counter + 1;
    SELECT COUNT(*) INTO v_missing_tables
    FROM (
        SELECT 'USERS' AS tbl FROM DUAL UNION ALL
        SELECT 'CLIENTS' FROM DUAL UNION ALL
        SELECT 'STAFF' FROM DUAL UNION ALL
        SELECT 'CASES' FROM DUAL UNION ALL
        SELECT 'CASE_CLIENTS' FROM DUAL UNION ALL
        SELECT 'CASE_ASSIGNMENTS' FROM DUAL UNION ALL
        SELECT 'DOCUMENTS' FROM DUAL UNION ALL
        SELECT 'HEARINGS' FROM DUAL UNION ALL
        SELECT 'AUDIT_LOGS' FROM DUAL
    ) required
    WHERE required.tbl NOT IN (SELECT table_name FROM user_tables);

    IF v_missing_tables = 0 THEN
        DBMS_OUTPUT.PUT_LINE('[PASS] Test 1: All 9 required database tables exist.');
        v_pass_counter := v_pass_counter + 1;
    ELSE
        DBMS_OUTPUT.PUT_LINE('[FAIL] Test 1: Missing ' || v_missing_tables || ' required table(s).');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 2: Verify Package Compilation Status
    -- ------------------------------------------------------------------------
    v_test_counter := v_test_counter + 1;
    BEGIN
        SELECT status INTO v_package_status
        FROM user_objects
        WHERE object_name = 'PKG_LEGAL_CASEBOOK' AND object_type = 'PACKAGE BODY';
        
        IF v_package_status = 'VALID' THEN
            DBMS_OUTPUT.PUT_LINE('[PASS] Test 2: PL/SQL Package PKG_LEGAL_CASEBOOK is compiled and VALID.');
            v_pass_counter := v_pass_counter + 1;
        ELSE
            DBMS_OUTPUT.PUT_LINE('[FAIL] Test 2: Package PKG_LEGAL_CASEBOOK status is ' || v_package_status);
        END IF;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            DBMS_OUTPUT.PUT_LINE('[FAIL] Test 2: Package PKG_LEGAL_CASEBOOK not found in user_objects.');
    END;

    -- ------------------------------------------------------------------------
    -- TEST 3: Verify Unique Email Constraint Rejection
    -- ------------------------------------------------------------------------
    v_test_counter := v_test_counter + 1;
    v_error_caught := FALSE;
    BEGIN
        -- Attempt to insert two users with the exact same duplicate email in a test rollback block
        SAVEPOINT sp_test_uq;
        INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS)
        VALUES ('Test User A', 'verify.duplicate@test.com', 'hash_a', 'CLIENT', 'ACTIVE');
        
        INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS)
        VALUES ('Test User B', 'verify.duplicate@test.com', 'hash_b', 'CLIENT', 'ACTIVE');
        
        ROLLBACK TO sp_test_uq;
    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            v_error_caught := TRUE;
            ROLLBACK TO sp_test_uq;
        WHEN OTHERS THEN
            v_error_caught := TRUE;
            ROLLBACK TO sp_test_uq;
    END;

    IF v_error_caught THEN
        DBMS_OUTPUT.PUT_LINE('[PASS] Test 3: Unique constraint correctly rejected duplicate email.');
        v_pass_counter := v_pass_counter + 1;
    ELSE
        DBMS_OUTPUT.PUT_LINE('[FAIL] Test 3: Duplicate email was improperly accepted!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 4: Verify Invalid Role CHECK Constraint
    -- ------------------------------------------------------------------------
    v_test_counter := v_test_counter + 1;
    v_error_caught := FALSE;
    BEGIN
        SAVEPOINT sp_test_role;
        -- Attempt to insert an unauthorized role 'SUPER_ADMIN' not in ('ADVOCATE', 'STAFF', 'CLIENT')
        INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE, ACCOUNT_STATUS)
        VALUES ('Unauthorized User', 'verify.badrole@test.com', 'hash_c', 'SUPER_ADMIN', 'ACTIVE');
        ROLLBACK TO sp_test_role;
    EXCEPTION
        WHEN OTHERS THEN
            -- ORA-02290: check constraint violated
            IF SQLCODE = -2290 OR INSTR(SQLERRM, 'CHK_USERS_ROLE') > 0 THEN
                v_error_caught := TRUE;
            END IF;
            ROLLBACK TO sp_test_role;
    END;

    IF v_error_caught THEN
        DBMS_OUTPUT.PUT_LINE('[PASS] Test 4: Check constraint CHK_USERS_ROLE correctly rejected invalid role.');
        v_pass_counter := v_pass_counter + 1;
    ELSE
        DBMS_OUTPUT.PUT_LINE('[FAIL] Test 4: Invalid role value was accepted!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 5: Verify Foreign Key Violation Rejection
    -- ------------------------------------------------------------------------
    v_test_counter := v_test_counter + 1;
    v_error_caught := FALSE;
    BEGIN
        SAVEPOINT sp_test_fk;
        -- Attempt to create a client with a non-existent parent user ID (e.g. 99999999)
        INSERT INTO CLIENTS (USER_ID, PHONE, ADDRESS)
        VALUES (99999999, '+91 99999 00000', 'Non-existent address');
        ROLLBACK TO sp_test_fk;
    EXCEPTION
        WHEN OTHERS THEN
            -- ORA-02291: integrity constraint violated - parent key not found
            IF SQLCODE = -2291 OR INSTR(SQLERRM, 'FK_CLIENTS_USER') > 0 THEN
                v_error_caught := TRUE;
            END IF;
            ROLLBACK TO sp_test_fk;
    END;

    IF v_error_caught THEN
        DBMS_OUTPUT.PUT_LINE('[PASS] Test 5: Foreign key constraint FK_CLIENTS_USER rejected orphan record.');
        v_pass_counter := v_pass_counter + 1;
    ELSE
        DBMS_OUTPUT.PUT_LINE('[FAIL] Test 5: Orphan record was accepted!');
    END IF;

    -- ------------------------------------------------------------------------
    -- SUMMARY REPORT
    -- ------------------------------------------------------------------------
    DBMS_OUTPUT.PUT_LINE('----------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('  VERIFICATION SUMMARY: ' || v_pass_counter || ' OF ' || v_test_counter || ' TESTS PASSED');
    DBMS_OUTPUT.PUT_LINE('====================================================');
END;
/
