-- ============================================================================
-- SCRIPT: 03_create_packages.sql
-- PROJECT: AI-Powered Advocate Legal CaseBook (Stage 3)
-- DESCRIPTION: PL/SQL Package Specification & Body for Legal CaseBook.
-- PACKAGE NAME: PKG_LEGAL_CASEBOOK
-- PROCEDURES:
--   1. REGISTER_CLIENT: Registers a verified client into USERS and CLIENTS.
--   2. CREATE_CASE: Creates a legal case file (requires Advocate authorization).
--   3. ASSIGN_CASE_STAFF: Assigns a staff member to an existing case file.
--   4. RECORD_AUDIT: Autonomous transaction audit logging for security events.
-- ============================================================================

-- ============================================================================
-- 1. PACKAGE SPECIFICATION
-- ============================================================================
CREATE OR REPLACE PACKAGE PKG_LEGAL_CASEBOOK AS

    -- Custom Application Error Codes:
    -- -20001: Duplicate Email Violation
    -- -20002: Missing or Invalid Input Parameter
    -- -20003: Unauthorized Role / Security Violation
    -- -20004: Entity Not Found
    -- -20005: State / Status Constraint Violation

    /**
     * Registers a new legal client into the system.
     * Enforces that public self-registration can ONLY create 'CLIENT' accounts.
     * Passwords must already be cryptographically hashed by Flask before calling.
     * Transaction: Does NOT commit internally; caller controls COMMIT or ROLLBACK.
     */
    PROCEDURE REGISTER_CLIENT (
        p_full_name       IN  VARCHAR2,
        p_email           IN  VARCHAR2,
        p_password_hash   IN  VARCHAR2,
        p_phone           IN  VARCHAR2 DEFAULT NULL,
        p_address         IN  VARCHAR2 DEFAULT NULL,
        o_user_id         OUT NUMBER,
        o_client_id       OUT NUMBER
    );

    /**
     * Creates a new case file.
     * Enforces that ONLY users with the role 'ADVOCATE' may initiate legal cases.
     * Transaction: Does NOT commit internally; caller controls COMMIT or ROLLBACK.
     */
    PROCEDURE CREATE_CASE (
        p_case_number     IN  VARCHAR2,
        p_title           IN  VARCHAR2,
        p_description     IN  CLOB DEFAULT NULL,
        p_created_by      IN  NUMBER,
        p_client_id       IN  NUMBER DEFAULT NULL,
        o_case_id         OUT NUMBER
    );

    /**
     * Assigns a staff member (paralegal/clerk) to a case.
     * Requires the assigner to be an authorized Advocate.
     */
    PROCEDURE ASSIGN_CASE_STAFF (
        p_case_id         IN  NUMBER,
        p_staff_id        IN  NUMBER,
        p_assigned_by     IN  NUMBER,
        o_assignment_id   OUT NUMBER
    );

    /**
     * Autonomous audit logging procedure.
     * Uses PRAGMA AUTONOMOUS_TRANSACTION to ensure audit records are permanently
     * written even if the calling business transaction later encounters an error.
     */
    PROCEDURE RECORD_AUDIT (
        p_actor_user_id   IN  NUMBER,
        p_action_type     IN  VARCHAR2,
        p_entity_type     IN  VARCHAR2,
        p_entity_id       IN  NUMBER
    );

END PKG_LEGAL_CASEBOOK;
/

-- ============================================================================
-- 2. PACKAGE BODY
-- ============================================================================
CREATE OR REPLACE PACKAGE BODY PKG_LEGAL_CASEBOOK AS

    ---------------------------------------------------------------------------
    -- PROCEDURE: RECORD_AUDIT (Autonomous Transaction)
    ---------------------------------------------------------------------------
    PROCEDURE RECORD_AUDIT (
        p_actor_user_id   IN  NUMBER,
        p_action_type     IN  VARCHAR2,
        p_entity_type     IN  VARCHAR2,
        p_entity_id       IN  NUMBER
    ) IS
        PRAGMA AUTONOMOUS_TRANSACTION;
    BEGIN
        INSERT INTO AUDIT_LOGS (
            ACTOR_USER_ID,
            ACTION_TYPE,
            ENTITY_TYPE,
            ENTITY_ID,
            CREATED_AT
        ) VALUES (
            p_actor_user_id,
            SUBSTR(TRIM(p_action_type), 1, 50),
            SUBSTR(TRIM(p_entity_type), 1, 50),
            p_entity_id,
            SYSTIMESTAMP
        );
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            -- In an audit procedure, avoid crashing the caller if audit fails,
            -- but rollback the autonomous transaction cleanly.
            ROLLBACK;
    END RECORD_AUDIT;

    ---------------------------------------------------------------------------
    -- PROCEDURE: REGISTER_CLIENT
    ---------------------------------------------------------------------------
    PROCEDURE REGISTER_CLIENT (
        p_full_name       IN  VARCHAR2,
        p_email           IN  VARCHAR2,
        p_password_hash   IN  VARCHAR2,
        p_phone           IN  VARCHAR2 DEFAULT NULL,
        p_address         IN  VARCHAR2 DEFAULT NULL,
        o_user_id         OUT NUMBER,
        o_client_id       OUT NUMBER
    ) IS
        v_clean_email     VARCHAR2(255);
        v_clean_name      VARCHAR2(150);
    BEGIN
        -- 1. Validate mandatory inputs
        IF TRIM(p_full_name) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Full name is required for registration.');
        END IF;

        IF TRIM(p_email) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Email address is required for registration.');
        END IF;

        IF TRIM(p_password_hash) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Password hash is required for registration.');
        END IF;

        v_clean_email := LOWER(TRIM(p_email));
        v_clean_name  := TRIM(p_full_name);

        -- Basic email sanity check
        IF INSTR(v_clean_email, '@') = 0 OR INSTR(v_clean_email, '.') = 0 THEN
            RAISE_APPLICATION_ERROR(-20002, 'Invalid email format provided.');
        END IF;

        -- 2. Insert into USERS table
        -- SECURITY RULE: Public self-registration ALWAYS creates 'CLIENT' role with 'ACTIVE' status.
        -- It can NEVER create 'ADVOCATE' or 'STAFF' accounts.
        INSERT INTO USERS (
            FULL_NAME,
            EMAIL,
            PASSWORD_HASH,
            ROLE,
            ACCOUNT_STATUS,
            CREATED_AT
        ) VALUES (
            v_clean_name,
            v_clean_email,
            p_password_hash,
            'CLIENT',
            'ACTIVE',
            SYSTIMESTAMP
        )
        RETURNING USER_ID INTO o_user_id;

        -- 3. Insert into CLIENTS table
        INSERT INTO CLIENTS (
            USER_ID,
            PHONE,
            ADDRESS,
            CREATED_AT
        ) VALUES (
            o_user_id,
            TRIM(p_phone),
            TRIM(p_address),
            SYSTIMESTAMP
        )
        RETURNING CLIENT_ID INTO o_client_id;

        -- 4. Log Audit Event
        RECORD_AUDIT(
            p_actor_user_id => o_user_id,
            p_action_type   => 'USER_REGISTERED',
            p_entity_type   => 'USERS',
            p_entity_id     => o_user_id
        );

    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            RAISE_APPLICATION_ERROR(-20001, 'Email address is already registered in Legal CaseBook.');
        WHEN OTHERS THEN
            IF SQLCODE BETWEEN -20999 AND -20000 THEN
                RAISE;
            ELSE
                RAISE_APPLICATION_ERROR(-20000, 'Database error during registration: ' || SQLERRM);
            END IF;
    END REGISTER_CLIENT;

    ---------------------------------------------------------------------------
    -- PROCEDURE: CREATE_CASE
    ---------------------------------------------------------------------------
    PROCEDURE CREATE_CASE (
        p_case_number     IN  VARCHAR2,
        p_title           IN  VARCHAR2,
        p_description     IN  CLOB DEFAULT NULL,
        p_created_by      IN  NUMBER,
        p_client_id       IN  NUMBER DEFAULT NULL,
        o_case_id         OUT NUMBER
    ) IS
        v_creator_role    VARCHAR2(20);
        v_client_exists   NUMBER := 0;
    BEGIN
        -- 1. Validate mandatory fields
        IF TRIM(p_case_number) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Case filing number is required.');
        END IF;

        IF TRIM(p_title) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Case title is required.');
        END IF;

        IF p_created_by IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Creator User ID is required.');
        END IF;

        -- 2. Verify creator exists and has ADVOCATE role
        BEGIN
            SELECT ROLE INTO v_creator_role
            FROM USERS
            WHERE USER_ID = p_created_by AND ACCOUNT_STATUS = 'ACTIVE';
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20004, 'Creator user not found or account is not active.');
        END;

        IF v_creator_role <> 'ADVOCATE' THEN
            RAISE_APPLICATION_ERROR(-20003, 'Unauthorized: Only an Advocate may create a case file.');
        END IF;

        -- 3. If client ID provided, verify client exists
        IF p_client_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_client_exists
            FROM CLIENTS
            WHERE CLIENT_ID = p_client_id;
            
            IF v_client_exists = 0 THEN
                RAISE_APPLICATION_ERROR(-20004, 'Associated client ID does not exist.');
            END IF;
        END IF;

        -- 4. Insert into CASES
        INSERT INTO CASES (
            CASE_NUMBER,
            TITLE,
            DESCRIPTION,
            CASE_STATUS,
            CREATED_BY,
            CREATED_AT
        ) VALUES (
            UPPER(TRIM(p_case_number)),
            TRIM(p_title),
            p_description,
            'OPEN',
            p_created_by,
            SYSTIMESTAMP
        )
        RETURNING CASE_ID INTO o_case_id;

        -- 5. Associate client if provided
        IF p_client_id IS NOT NULL THEN
            INSERT INTO CASE_CLIENTS (CASE_ID, CLIENT_ID)
            VALUES (o_case_id, p_client_id);
        END IF;

        -- 6. Log Audit Event
        RECORD_AUDIT(
            p_actor_user_id => p_created_by,
            p_action_type   => 'CASE_CREATED',
            p_entity_type   => 'CASES',
            p_entity_id     => o_case_id
        );

    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            RAISE_APPLICATION_ERROR(-20001, 'Case number already exists in system.');
        WHEN OTHERS THEN
            IF SQLCODE BETWEEN -20999 AND -20000 THEN
                RAISE;
            ELSE
                RAISE_APPLICATION_ERROR(-20000, 'Database error creating case: ' || SQLERRM);
            END IF;
    END CREATE_CASE;

    ---------------------------------------------------------------------------
    -- PROCEDURE: ASSIGN_CASE_STAFF
    ---------------------------------------------------------------------------
    PROCEDURE ASSIGN_CASE_STAFF (
        p_case_id         IN  NUMBER,
        p_staff_id        IN  NUMBER,
        p_assigned_by     IN  NUMBER,
        o_assignment_id   OUT NUMBER
    ) IS
        v_assigner_role   VARCHAR2(20);
        v_case_count      NUMBER := 0;
        v_staff_count     NUMBER := 0;
    BEGIN
        -- 1. Validate mandatory fields
        IF p_case_id IS NULL OR p_staff_id IS NULL OR p_assigned_by IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Case ID, Staff ID, and Assigner ID are all required.');
        END IF;

        -- 2. Verify assigner is an active Advocate
        BEGIN
            SELECT ROLE INTO v_assigner_role
            FROM USERS
            WHERE USER_ID = p_assigned_by AND ACCOUNT_STATUS = 'ACTIVE';
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20004, 'Assigner user not found or inactive.');
        END;

        IF v_assigner_role <> 'ADVOCATE' THEN
            RAISE_APPLICATION_ERROR(-20003, 'Unauthorized: Only an Advocate may assign staff to a case.');
        END IF;

        -- 3. Verify case exists
        SELECT COUNT(*) INTO v_case_count FROM CASES WHERE CASE_ID = p_case_id;
        IF v_case_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20004, 'Target case does not exist.');
        END IF;

        -- 4. Verify staff exists
        SELECT COUNT(*) INTO v_staff_count FROM STAFF WHERE STAFF_ID = p_staff_id;
        IF v_staff_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20004, 'Target staff member does not exist.');
        END IF;

        -- 5. Insert into CASE_ASSIGNMENTS
        INSERT INTO CASE_ASSIGNMENTS (
            CASE_ID,
            STAFF_ID,
            ASSIGNED_BY,
            ASSIGNED_AT,
            ASSIGNMENT_STATUS
        ) VALUES (
            p_case_id,
            p_staff_id,
            p_assigned_by,
            SYSTIMESTAMP,
            'ACTIVE'
        )
        RETURNING ASSIGNMENT_ID INTO o_assignment_id;

        -- 6. Log Audit Event
        RECORD_AUDIT(
            p_actor_user_id => p_assigned_by,
            p_action_type   => 'STAFF_ASSIGNED',
            p_entity_type   => 'CASE_ASSIGNMENTS',
            p_entity_id     => o_assignment_id
        );

    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE BETWEEN -20999 AND -20000 THEN
                RAISE;
            ELSE
                RAISE_APPLICATION_ERROR(-20000, 'Database error assigning staff: ' || SQLERRM);
            END IF;
    END ASSIGN_CASE_STAFF;

END PKG_LEGAL_CASEBOOK;
/

COMMIT;
