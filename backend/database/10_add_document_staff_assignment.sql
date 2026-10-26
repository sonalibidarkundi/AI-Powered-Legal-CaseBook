-- ============================================================================
-- SCRIPT: 10_add_document_staff_assignment.sql
-- PROJECT: AI-Powered Advocate Legal CaseBook (Feature Enhancement)
-- DESCRIPTION: Oracle-compatible migration script adding document-level staff
--              assignment, assignment status, title, and description to DOCUMENTS table.
-- IDEMPOTENT: Safe to run repeatedly without duplicate column or constraint errors.
-- COMPATIBILITY: Oracle Database 12c, 18c, 19c, 21c, 23ai
-- ============================================================================

DECLARE
    v_col_exists NUMBER := 0;
BEGIN
    -- 1. Check ASSIGNED_STAFF_ID
    SELECT COUNT(*) INTO v_col_exists
    FROM user_tab_cols
    WHERE table_name = 'DOCUMENTS' AND column_name = 'ASSIGNED_STAFF_ID';

    IF v_col_exists = 0 THEN
        EXECUTE IMMEDIATE '
            ALTER TABLE DOCUMENTS ADD (
                ASSIGNED_STAFF_ID NUMBER,
                ASSIGNMENT_STATUS VARCHAR2(30) DEFAULT ''ASSIGNED'' NOT NULL,
                DOCUMENT_TITLE    VARCHAR2(255),
                DESCRIPTION       VARCHAR2(1000),
                CONSTRAINT FK_DOC_ASSIGNED_STAFF FOREIGN KEY (ASSIGNED_STAFF_ID)
                    REFERENCES STAFF(STAFF_ID) ON DELETE SET NULL,
                CONSTRAINT CHK_DOC_ASSIGN_STATUS CHECK (ASSIGNMENT_STATUS IN (''ASSIGNED'', ''IN_REVIEW'', ''ANALYZED''))
            )
        ';
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_DOC_ASSIGNED_STAFF ON DOCUMENTS(ASSIGNED_STAFF_ID)';
        DBMS_OUTPUT.PUT_LINE('Added ASSIGNED_STAFF_ID and assignment fields to DOCUMENTS table.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Column ASSIGNED_STAFF_ID already exists on DOCUMENTS table.');
    END IF;
END;
/
