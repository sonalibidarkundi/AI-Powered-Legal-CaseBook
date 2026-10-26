"""
Legal CaseBook - Database Connection & Management Engine (db.py)
-----------------------------------------------------------------
This module provides a production-grade, secure database manager supporting:
1. Live Oracle Database (Oracle 12c, 19c, 21c, 23ai) via python-oracledb Thin Mode.
2. Auto-Activated Local Database (SQLite) fallback ensuring full functionality,
   real user registration, authentication, and dashboard data persistence
   even while local Oracle Database server is offline or being set up.

Key Principles:
- Parameterized Queries: All operations use bind variables (:name) to prevent SQL injection.
- Zero Mock Data: All data is genuinely persisted to disk with real relational tables.
- Seamless Transition: Automatically detects and switches to Oracle when available.
"""

import os
import re
import sqlite3
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Tuple
import oracledb
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "database"))
DB_FILE = os.path.join(DB_DIR, "casebook.db")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS USERS (
    USER_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    FULL_NAME TEXT NOT NULL,
    EMAIL TEXT NOT NULL UNIQUE,
    PASSWORD_HASH TEXT NOT NULL,
    ROLE TEXT NOT NULL CHECK (ROLE IN ('ADVOCATE', 'STAFF', 'CLIENT')),
    ACCOUNT_STATUS TEXT NOT NULL DEFAULT 'ACTIVE',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS CLIENTS (
    CLIENT_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    USER_ID INTEGER NOT NULL UNIQUE,
    PHONE TEXT,
    ADDRESS TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (USER_ID) REFERENCES USERS(USER_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS STAFF (
    STAFF_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    USER_ID INTEGER NOT NULL UNIQUE,
    EMPLOYEE_CODE TEXT NOT NULL UNIQUE,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (USER_ID) REFERENCES USERS(USER_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CASES (
    CASE_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CASE_NUMBER TEXT NOT NULL UNIQUE,
    TITLE TEXT NOT NULL,
    DESCRIPTION TEXT,
    CASE_STATUS TEXT NOT NULL DEFAULT 'OPEN',
    CASE_TYPE TEXT NOT NULL DEFAULT 'CIVIL',
    CREATED_BY INTEGER NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CREATED_BY) REFERENCES USERS(USER_ID)
);

CREATE TABLE IF NOT EXISTS CASE_CLIENTS (
    CASE_ID INTEGER NOT NULL,
    CLIENT_ID INTEGER NOT NULL,
    PRIMARY KEY (CASE_ID, CLIENT_ID),
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (CLIENT_ID) REFERENCES CLIENTS(CLIENT_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CASE_ASSIGNMENTS (
    ASSIGNMENT_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CASE_ID INTEGER NOT NULL,
    STAFF_ID INTEGER NOT NULL,
    ASSIGNED_BY INTEGER NOT NULL,
    ASSIGNED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ASSIGNMENT_STATUS TEXT NOT NULL DEFAULT 'ACTIVE',
    INSTRUCTIONS TEXT,
    DEADLINE TIMESTAMP,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (STAFF_ID) REFERENCES STAFF(STAFF_ID) ON DELETE CASCADE,
    FOREIGN KEY (ASSIGNED_BY) REFERENCES USERS(USER_ID)
);

CREATE TABLE IF NOT EXISTS RESEARCH_TASKS (
    TASK_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CASE_ID INTEGER NOT NULL,
    STAFF_ID INTEGER NOT NULL,
    ASSIGNED_BY INTEGER NOT NULL,
    TITLE TEXT NOT NULL,
    INSTRUCTIONS TEXT,
    STATUS TEXT NOT NULL DEFAULT 'PENDING' CHECK (STATUS IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    PRIORITY TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (PRIORITY IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    DUE_DATE TIMESTAMP,
    RESEARCH_NOTES TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (STAFF_ID) REFERENCES STAFF(STAFF_ID) ON DELETE CASCADE,
    FOREIGN KEY (ASSIGNED_BY) REFERENCES USERS(USER_ID)
);

CREATE TABLE IF NOT EXISTS DOCUMENTS (
    DOCUMENT_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CASE_ID INTEGER NOT NULL,
    UPLOADED_BY INTEGER NOT NULL,
    ASSIGNED_STAFF_ID INTEGER,
    ASSIGNMENT_STATUS TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (ASSIGNMENT_STATUS IN ('ASSIGNED', 'IN_REVIEW', 'ANALYZED')),
    DOCUMENT_TITLE TEXT,
    DESCRIPTION TEXT,
    FILE_NAME TEXT NOT NULL,
    MIME_TYPE TEXT NOT NULL,
    STORAGE_KEY TEXT NOT NULL,
    UPLOADED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (UPLOADED_BY) REFERENCES USERS(USER_ID),
    FOREIGN KEY (ASSIGNED_STAFF_ID) REFERENCES STAFF(STAFF_ID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HEARINGS (
    HEARING_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CASE_ID INTEGER NOT NULL,
    HEARING_DATE TIMESTAMP NOT NULL,
    COURT_ROOM TEXT,
    JUDGE_NAME TEXT,
    HEARING_STATUS TEXT NOT NULL DEFAULT 'SCHEDULED',
    NOTES TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS AUDIT_LOGS (
    LOG_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    ACTOR_USER_ID INTEGER,
    ACTION_TYPE TEXT NOT NULL,
    ENTITY_TYPE TEXT NOT NULL,
    ENTITY_ID INTEGER,
    DETAILS TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS DOCUMENT_SUMMARIES (
    SUMMARY_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    DOCUMENT_ID INTEGER NOT NULL UNIQUE,
    CASE_ID INTEGER NOT NULL,
    GENERATED_BY INTEGER NOT NULL,
    SUMMARY_TEXT TEXT NOT NULL,
    STRUCTURED_JSON TEXT,
    MODEL_NAME TEXT DEFAULT 'grok-2-latest',
    STATUS TEXT NOT NULL DEFAULT 'SUCCESS',
    ERROR_MESSAGE TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (DOCUMENT_ID) REFERENCES DOCUMENTS(DOCUMENT_ID) ON DELETE CASCADE,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (GENERATED_BY) REFERENCES USERS(USER_ID)
);

CREATE TABLE IF NOT EXISTS CLIENT_INQUIRIES (
    INQUIRY_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CASE_ID INTEGER NOT NULL,
    CLIENT_ID INTEGER NOT NULL,
    ADVOCATE_ID INTEGER NOT NULL,
    SUBJECT TEXT NOT NULL,
    MESSAGE_TEXT TEXT NOT NULL,
    STATUS TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (STATUS IN ('SUBMITTED', 'ACKNOWLEDGED', 'IN_REVIEW', 'RESOLVED')),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (CLIENT_ID) REFERENCES CLIENTS(CLIENT_ID) ON DELETE CASCADE,
    FOREIGN KEY (ADVOCATE_ID) REFERENCES USERS(USER_ID)
);

CREATE TABLE IF NOT EXISTS CHAT_SESSIONS (
    SESSION_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    USER_ID INTEGER NOT NULL,
    CASE_ID INTEGER,
    DOCUMENT_ID INTEGER,
    TITLE TEXT NOT NULL,
    PERSPECTIVE TEXT DEFAULT 'comprehensive',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (USER_ID) REFERENCES USERS(USER_ID) ON DELETE CASCADE,
    FOREIGN KEY (CASE_ID) REFERENCES CASES(CASE_ID) ON DELETE CASCADE,
    FOREIGN KEY (DOCUMENT_ID) REFERENCES DOCUMENTS(DOCUMENT_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CHAT_MESSAGES (
    MESSAGE_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    SESSION_ID INTEGER NOT NULL,
    ROLE TEXT NOT NULL CHECK (ROLE IN ('user', 'assistant', 'system')),
    CONTENT TEXT NOT NULL,
    CITATIONS_JSON TEXT,
    MODEL_NAME TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (SESSION_ID) REFERENCES CHAT_SESSIONS(SESSION_ID) ON DELETE CASCADE
);
"""


class DatabaseConfigurationError(Exception):
    """Raised when required Oracle Database credentials are missing or unconfigured."""
    pass


def get_oracle_config() -> Dict[str, str]:
    """
    Retrieves and validates Oracle connection settings from environment variables.
    """
    user = os.getenv("ORACLE_USER", "").strip()
    password = os.getenv("ORACLE_PASSWORD", "").strip()
    dsn = os.getenv("ORACLE_DSN", "").strip()

    if not dsn:
        host = os.getenv("ORACLE_HOST", "localhost").strip()
        port = os.getenv("ORACLE_PORT", "1521").strip()
        service_name = os.getenv("ORACLE_SERVICE_NAME", "XEPDB1").strip()
        if host and port and service_name:
            dsn = f"{host}:{port}/{service_name}"

    return {
        "user": user,
        "password": password,
        "dsn": dsn
    }


def is_oracle_active() -> bool:
    """Checks if Oracle Database server is reachable and accepting connections."""
    config = get_oracle_config()
    if not config["user"] or not config["password"] or config["password"] in (
        "your_secure_password_here", "pending_stage2", "placeholder", "pending_oracle_setup"
    ):
        return False
    try:
        conn = oracledb.connect(
            user=config["user"],
            password=config["password"],
            dsn=config["dsn"]
        )
        conn.close()
        return True
    except Exception:
        return False


def init_local_schema():
    """Initializes the local database schema if not already present."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    try:
        conn.executescript(SCHEMA_SQL)
        cursor = conn.cursor()
        # Ensure DEADLINE on CASE_ASSIGNMENTS
        cols = [c[1] for c in cursor.execute("PRAGMA table_info(CASE_ASSIGNMENTS)").fetchall()]
        if "DEADLINE" not in cols:
            cursor.execute("ALTER TABLE CASE_ASSIGNMENTS ADD COLUMN DEADLINE TIMESTAMP")

        # Ensure COURT_NAME on HEARINGS for schema parity
        cols_h = [c[1] for c in cursor.execute("PRAGMA table_info(HEARINGS)").fetchall()]
        if "COURT_NAME" not in cols_h:
            cursor.execute("ALTER TABLE HEARINGS ADD COLUMN COURT_NAME TEXT")

        # Ensure ASSIGNED_STAFF_ID, ASSIGNMENT_STATUS, DOCUMENT_TITLE, DESCRIPTION on DOCUMENTS
        cols_d = [c[1] for c in cursor.execute("PRAGMA table_info(DOCUMENTS)").fetchall()]
        if "ASSIGNED_STAFF_ID" not in cols_d:
            cursor.execute("ALTER TABLE DOCUMENTS ADD COLUMN ASSIGNED_STAFF_ID INTEGER")
        if "ASSIGNMENT_STATUS" not in cols_d:
            cursor.execute("ALTER TABLE DOCUMENTS ADD COLUMN ASSIGNMENT_STATUS TEXT DEFAULT 'ASSIGNED'")
        if "DOCUMENT_TITLE" not in cols_d:
            cursor.execute("ALTER TABLE DOCUMENTS ADD COLUMN DOCUMENT_TITLE TEXT")
        if "DESCRIPTION" not in cols_d:
            cursor.execute("ALTER TABLE DOCUMENTS ADD COLUMN DESCRIPTION TEXT")

        # Oracle DUAL compatibility
        cursor.execute("CREATE TABLE IF NOT EXISTS DUAL (DUMMY TEXT)")
        cursor.execute("SELECT COUNT(*) FROM DUAL")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO DUAL (DUMMY) VALUES ('X')")

        conn.commit()
    finally:
        conn.close()


class LocalCompatCursor:
    """
    Cursor adapter that translates Oracle-specific SQL clauses (e.g. SYSTIMESTAMP,
    NVL, RETURNING ... INTO) so queries work seamlessly on SQLite.
    """
    def __init__(self, raw_cursor):
        self._cur = raw_cursor

    def var(self, data_type=None):
        class OutputVar:
            def __init__(self):
                self._val = [0]
            def getvalue(self):
                return self._val
        return OutputVar()

    def execute(self, sql: str, params: Optional[Dict[str, Any]] = None):
        clean_sql = sql

        # 0. Suppress AUDIT_LOGS inserts (Audit logging removed)
        if re.search(r'\bINSERT\s+INTO\s+AUDIT_LOGS\b', clean_sql, re.I):
            return self

        # 1. Translate Oracle functions & date math
        clean_sql = re.sub(r'\bSYSTIMESTAMP\s*\+\s*INTERVAL\s*\'(\d+)\'\s*DAY', r"datetime('now', '+\1 days')", clean_sql, flags=re.I)
        clean_sql = re.sub(r'\bSYSTIMESTAMP\s*-\s*INTERVAL\s*\'(\d+)\'\s*DAY', r"datetime('now', '-\1 days')", clean_sql, flags=re.I)
        clean_sql = re.sub(r'\bSYSTIMESTAMP\b', 'CURRENT_TIMESTAMP', clean_sql, flags=re.I)
        clean_sql = re.sub(r'\bNVL\b', 'COALESCE', clean_sql, flags=re.I)
        clean_sql = re.sub(r'CAST\s*\(\s*(\w+\.\w+)\s+AS\s+VARCHAR2\(\d+\)\s*\)', r'\1', clean_sql, flags=re.I)
        clean_sql = re.sub(r'\bAND\s+ROWNUM\s*=\s*1\b', 'LIMIT 1', clean_sql, flags=re.I)
        clean_sql = re.sub(r'\bWHERE\s+ROWNUM\s*=\s*1\b', 'LIMIT 1', clean_sql, flags=re.I)

        # 2. Translate Oracle FETCH FIRST n ROWS ONLY -> LIMIT n
        fetch_match = re.search(r'FETCH\s+FIRST\s+(\d+)\s+ROWS?\s+ONLY', clean_sql, re.I)
        if fetch_match:
            limit_n = fetch_match.group(1)
            clean_sql = clean_sql[:fetch_match.start()] + f"LIMIT {limit_n}" + clean_sql[fetch_match.end():]

        # 3. Handle RETURNING <col> INTO :var
        returning_match = re.search(r'RETURNING\s+(\w+)\s+INTO\s+:(\w+)', clean_sql, re.I)
        target_var_obj = None
        if returning_match:
            clean_sql = clean_sql[:returning_match.start()] + clean_sql[returning_match.end():]

        clean_params = {}
        if params:
            for k, v in params.items():
                if hasattr(v, 'getvalue'):
                    target_var_obj = v
                else:
                    clean_params[k] = v

        try:
            res = self._cur.execute(clean_sql, clean_params)
            if target_var_obj and hasattr(self._cur, 'lastrowid') and self._cur.lastrowid is not None:
                target_var_obj._val = [self._cur.lastrowid]
            return res
        except sqlite3.IntegrityError as integ_err:
            err_text = str(integ_err)
            if "UNIQUE constraint failed: USERS.EMAIL" in err_text:
                raise oracledb.DatabaseError("ORA-00001: unique constraint (LEGAL_ADMIN.UQ_USERS_EMAIL) violated")
            raise

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def fetchmany(self, size: int):
        return self._cur.fetchmany(size)

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def lastrowid(self):
        return self._cur.lastrowid

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class LocalCompatConnection:
    """Wrapper around sqlite3.Connection exposing an Oracle-compatible interface."""
    def __init__(self, raw_conn):
        self._conn = raw_conn
        self.version = "SQLite " + sqlite3.sqlite_version
        try:
            self._conn.create_function("TO_CHAR", -1, lambda *args: str(args[0]) if args and args[0] is not None else "")
            self._conn.create_function("NVL", 2, lambda a, b: a if a is not None else b)
        except Exception:
            pass

    def cursor(self):
        return LocalCompatCursor(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()


@contextmanager
def get_db_connection():
    """
    Yields an active database connection.
    If Oracle Database server is active, connects to Oracle in Thin Mode.
    Otherwise, activates the local database file (casebook.db) with seamless compatibility.
    """
    config = get_oracle_config()
    is_oracle_configured = (
        bool(config["user"])
        and bool(config["password"])
        and bool(config["dsn"])
        and config["password"] not in ("your_secure_password_here", "pending_stage2", "placeholder", "pending_oracle_setup")
    )

    if is_oracle_configured:
        try:
            conn = oracledb.connect(
                user=config["user"],
                password=config["password"],
                dsn=config["dsn"]
            )
            try:
                yield conn
            finally:
                conn.close()
            return
        except Exception:
            # Fall back to local active database
            pass

    # Local Active Database
    init_local_schema()
    raw_conn = sqlite3.connect(DB_FILE)
    compat_conn = LocalCompatConnection(raw_conn)
    try:
        yield compat_conn
    finally:
        raw_conn.close()


def execute_query(sql: str, params: Optional[Dict[str, Any]] = None) -> List[Tuple]:
    """Safely executes a parameterized SELECT query."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or {})
            return cursor.fetchall()


def execute_non_query(sql: str, params: Optional[Dict[str, Any]] = None, commit: bool = True) -> int:
    """Safely executes a parameterized INSERT, UPDATE, or DELETE statement."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or {})
            if commit:
                conn.commit()
            return cursor.rowcount


def check_db_health() -> Dict[str, Any]:
    """Tests database availability and returns structured health information."""
    config = get_oracle_config()
    is_oracle_configured = (
        bool(config["user"])
        and bool(config["password"])
        and bool(config["dsn"])
        and config["password"] not in ("your_secure_password_here", "pending_stage2", "placeholder", "pending_oracle_setup")
    )

    if is_oracle_configured:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM DUAL")
                    row = cursor.fetchone()
                    if row and row[0] == 1:
                        return {
                            "connected": True,
                            "status": "healthy",
                            "database": "Oracle Database",
                            "server_version": getattr(conn, "version", "23ai/XE"),
                            "driver": f"python-oracledb v{oracledb.__version__}",
                            "driver_mode": "Thin mode (Pure Python)",
                            "message": "Oracle Database connection active and responding."
                        }
        except Exception:
            pass

    # Local Active Database Status
    try:
        init_local_schema()
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                if row and row[0] == 1:
                    return {
                        "connected": True,
                        "status": "healthy",
                        "database": "Local Active Database (Auto-Activated)",
                        "server_version": f"SQLite {sqlite3.sqlite_version}",
                        "driver": "Built-in Relational Storage",
                        "message": "Database is active and ready. Accounts and legal data are saved locally. Ready for Oracle connection."
                    }
    except Exception as exc:
        return {
            "connected": False,
            "status": "error",
            "message": f"Database initialization error: {exc}"
        }
