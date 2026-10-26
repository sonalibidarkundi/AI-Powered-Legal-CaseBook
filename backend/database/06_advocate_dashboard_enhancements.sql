-- ============================================================================
-- SCRIPT: 06_advocate_dashboard_enhancements.sql
-- PROJECT: AI-Powered Advocate Legal CaseBook (Stage 5)
-- DESCRIPTION: Oracle-compatible migration script adding Case Type classification
--              and Staff Assignment instructions to support the Advocate Dashboard.
-- IDEMPOTENT: Safe to run repeatedly without duplicate column or constraint errors.
-- ============================================================================

-- 1. Add CASE_TYPE to CASES table
DECLARE
    v_col_exists NUMBER := 0;
BEGIN
    SELECT COUNT(*) INTO v_col_exists
    FROM user_tab_cols
    WHERE table_name = 'CASES' AND column_name = 'CASE_TYPE';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE CASES ADD (CASE_TYPE VARCHAR2(50) DEFAULT ''CIVIL'' NOT NULL)';
        EXECUTE IMMEDIATE 'ALTER TABLE CASES ADD CONSTRAINT CHK_CASES_TYPE CHECK (CASE_TYPE IN (''CIVIL'', ''CRIMINAL'', ''CORPORATE'', ''CONSTITUTIONAL'', ''FAMILY'', ''TAXATION'', ''ARBITRATION'', ''LABOR'', ''OTHER''))';
        DBMS_OUTPUT.PUT_LINE('Added column CASE_TYPE to CASES table.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Column CASE_TYPE already exists on CASES table.');
    END IF;
END;
/

-- 2. Add INSTRUCTIONS to CASE_ASSIGNMENTS table
DECLARE
    v_col_exists NUMBER := 0;
BEGIN
    SELECT COUNT(*) INTO v_col_exists
    FROM user_tab_cols
    WHERE table_name = 'CASE_ASSIGNMENTS' AND column_name = 'INSTRUCTIONS';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE CASE_ASSIGNMENTS ADD (INSTRUCTIONS VARCHAR2(1000))';
        DBMS_OUTPUT.PUT_LINE('Added column INSTRUCTIONS to CASE_ASSIGNMENTS table.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Column INSTRUCTIONS already exists on CASE_ASSIGNMENTS table.');
    END IF;
END;
/

-- 3. Add index on CASE_TYPE for rapid filtering in Advocate Case Management
DECLARE
    v_idx_exists NUMBER := 0;
BEGIN
    SELECT COUNT(*) INTO v_idx_exists
    FROM user_indexes
    WHERE index_name = 'IDX_CASES_TYPE';

    IF v_idx_exists = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_CASES_TYPE ON CASES(CASE_TYPE)';
        DBMS_OUTPUT.PUT_LINE('Created index IDX_CASES_TYPE.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Index IDX_CASES_TYPE already exists.');
    END IF;
END;
/

COMMIT;
