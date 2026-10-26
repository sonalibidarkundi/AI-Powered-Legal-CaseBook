# AI-Powered Advocate Legal CaseBook (Stages 1, 2, 3 & 4)

Welcome to the **AI-Powered Advocate Legal CaseBook**! This repository is designed specifically for advocates, legal staff, and clients to provide a secure, confidential workspace for managing legal matters.

---

## 🎯 Progress & Milestones

- **Stage 1 (Completed)**:
  - Professional legal-tech **Login Page** with client-side validation and password visibility toggle.
  - Minimal **Python Flask API** with operational health check (`GET /api/health`).
  - Foundational design system (Navy Blue `#172B4D`, Muted Gold `#B99A5B`, White `#FFFFFF`).
- **Stage 2 (Completed)**:
  - Professional **Registration Page** (`/register`) matching the existing aesthetic.
  - Accessible radio cards for roles (**Advocate**, **Staff**, **Client**).
  - Strict password validation rules with live criteria indicators.
  - Role security policy safeguards and explanation.
  - Seamless two-way navigation between Login and Registration via **React Router**.
- **Stage 3 (Completed)**:
  - Enterprise **Oracle Database Schema** (`backend/database/01_create_tables.sql` & `02_create_indexes.sql`).
  - Business logic in **PL/SQL Package** `PKG_LEGAL_CASEBOOK` (`03_create_packages.sql`).
  - Safe, idempotent test seed data (`04_seed_test_data.sql`).
  - Automated schema verification test suite (`05_verify_schema.sql`).
  - Oracle connection manager in Python using `python-oracledb` Thin Mode (`backend/db.py`).
  - Dedicated database health-check endpoint (`GET /api/db-health`).
- **Stage 4 (Completed)**:
  - **Secure Authentication Endpoints**:
    - `POST /api/auth/login` (Rate limited, scrypt hash verification, session rotation)
    - `POST /api/auth/register` (Public Client registration only; rejects privileged Advocate/Staff self-assignment)
    - `POST /api/auth/logout` (Server session termination)
    - `GET  /api/auth/me` (Session restoration & profile retrieval)
    - `GET  /api/auth/csrf` (Anti-CSRF token provider)
  - **Session Management**: Server-managed HttpOnly, SameSite cookies with CSRF validation.
  - **Role-Based Access Control (RBAC)**: Server-side `@login_required` and `@role_required` decorators protecting workspaces.
- **Stage 5 (Completed)**:
  - **Advocate Dashboard Workspace**:
    - Complete 11-item sidebar navigation (Dashboard, Case Management, Client Management, Staff Management, Assign Staff, Documents, Hearings & Calendar, Reports, Audit Logs, Profile, Logout).
    - Top navigation bar with verified advocate identity chip, notification bell with popover, and secure sign-out confirmation dialog.
    - 6 Real Summary Metric Cards: Total Cases, Active Cases, Closed Cases, Total Clients, Total Staff, Upcoming Hearings.
    - 4 Live Activity Streams: Recent Cases, Upcoming Hearings, Recent Documents, and Recent Activities.
    - Genuine database error states (HTTP 503) with retry action instead of false zeros or mock values.
  - **Case Management**:
    - Filter cases by Status (`OPEN`, `PENDING_HEARING`, `IN_TRIAL`, `DISPOSED`, `CLOSED`, `ARCHIVED`) and Case Type (`CIVIL`, `CRIMINAL`, `CORPORATE`, etc.).
    - Search by case number, title, or client name.
    - Full case details modal with associated clients, assigned staff, documents, and hearings.
    - New case creation modal with client linking and audit logging.
    - Case edit modal for title, synopsis, type, and status updates.
  - **Client Management**:
    - Client directory with contact details and active matter counts.
    - Client profile inspection modal with associated matters and documents (never exposing sensitive password hashes or session data).
    - Client onboarding modal and contact update workflows.
  - **Staff Management & Workload**:
    - Staff roster with employee codes, emails, and active case assignment workload counts.
  - **Assign Staff to Cases**:
    - Guided 3-step assignment workflow (Case selection, Staff selection, Instructions).
    - Backend validation of case management rights and staff eligibility.
    - Duplicate active assignment prevention returning HTTP 409 Conflict.
    - Active staff delegations ledger.
  - **Critical Privacy & Staff Boundary Enforcement**:
    - Staff S1 only sees assigned cases on their portal.
    - Staff S2 strictly denied access (HTTP 403) to Case 101 or its documents assigned to S1.
  - **Database & PL/SQL Migration**:
    - `06_advocate_dashboard_enhancements.sql`: Added `CASE_TYPE` and `INSTRUCTIONS` columns plus performance index `IDX_CASES_TYPE`.
  - **Automated Test Suite**:
    - Expanded to 24 tests covering RBAC boundaries, staff privacy isolation, duplicate assignment prevention, and input validation with 100% pass rate.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend UI** | React 19 + Vite | Component-based interface with `AuthContext` and `ProtectedRoute` |
| **Navigation** | React Router v7 (`react-router-dom`) | Client-side routing between `/login`, `/register`, and role dashboards |
| **Styling** | Vanilla CSS | Custom legal-tech design tokens (`Login.css`, `Register.css`, `Dashboard.css`) |
| **Icons** | Lucide React | High-quality icons (Scales of justice, Briefcase, Users, Calendar, Shield) |
| **Backend API**| Python Flask 3 + Flask-CORS | REST API handling sessions, rate limiting, and RBAC |
| **Advocate API**| Flask Blueprint (`advocate_bp`) | Parameterized Oracle SQL endpoints under `/api/advocate/*` |
| **Password Security** | Werkzeug (`scrypt`) | Cryptographic one-way salted password hashing |
| **Oracle Driver**| `python-oracledb` (Thin Mode) | Pure Python driver connecting directly without Oracle Instant Client |
| **Database** | Oracle Database (19c/21c/23ai) | Enterprise relational legal casebook schema & PL/SQL packages |

---

## 📁 Project Structure

```text
legal-casebook/
├── backend/
│   ├── database/                      # Oracle SQL & PL/SQL Scripts (Stages 3 & 5)
│   │   ├── 01_create_tables.sql       # 9 Relational tables with strict constraints
│   │   ├── 02_create_indexes.sql      # Performance and foreign-key indexes
│   │   ├── 03_create_packages.sql     # PKG_LEGAL_CASEBOOK (Registration, Cases, Auditing)
│   │   ├── 04_seed_test_data.sql      # Idempotent fictional test data
│   │   ├── 05_verify_schema.sql       # Automated integrity test suite
│   │   └── 06_advocate_dashboard_enhancements.sql # Stage 5 Case Type & Assignment Instructions
│   ├── tests/                         # Automated Unit & Integration Tests (Stages 4 & 5)
│   │   ├── test_auth.py               # 15 Test cases for Auth, Sessions, Rate Limiting & RBAC
│   │   └── test_advocate_dashboard.py # 9 Test cases for Advocate Dashboard, Privacy & Assignments
│   ├── advocate_api.py                # Stage 5 Advocate REST API Blueprint
│   ├── app.py                         # Flask API with /api/auth, /api/advocate, and /api/health
│   ├── auth.py                        # Cryptography, rate limiting, CSRF & RBAC decorators
│   ├── db.py                          # Reusable Oracle connection manager (Thin Mode)
│   ├── requirements.txt               # Python dependencies
│   ├── .env                           # Local environment configuration
│   └── .env.example                   # Configuration template
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InfoModal.jsx          # Reusable modal for alerts and notices
│   │   │   ├── LegalIllustration.jsx  # Bespoke legal vector illustration
│   │   │   └── ProtectedRoute.jsx     # Route guard enforcing authentication & roles
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Auth state, login, register, and session restoration
│   │   ├── pages/
│   │   │   ├── Login.jsx              # Connected Login Page
│   │   │   ├── Register.jsx           # Connected Registration Page
│   │   │   ├── AdvocateDashboard.jsx  # Stage 5 Advocate Management Command Center
│   │   │   ├── StaffDashboard.jsx     # Protected Staff Workspace
│   │   │   ├── ClientDashboard.jsx    # Protected Client Workspace
│   │   │   └── Forbidden.jsx          # 403 Access Denied View
│   │   ├── styles/
│   │   │   ├── Login.css              # Login page styling
│   │   │   ├── Register.css           # Registration page styling
│   │   │   └── Dashboard.css          # Stage 5 Advocate Workspace & Dashboard styling
│   │   ├── App.jsx                    # Router setup & AuthProvider wrapper
│   │   ├── index.css                  # Global design tokens and reset
│   │   └── main.jsx                   # React DOM mount point
│   ├── index.html                     # HTML document with Google Fonts (Inter & Cinzel)
│   ├── package.json                   # Node dependencies
│   └── vite.config.js                 # Vite build config & proxy to Flask backend
└── README.md                          # This guide
```

---

## 🚀 Running the Project (Windows)

### Terminal 1: Python Flask Backend
```powershell
cd d:\legal-casebook\backend
.\venv\Scripts\python.exe app.py
```
> Endpoints:
> - Server health: `http://127.0.0.1:5000/api/health`
> - Oracle DB health: `http://127.0.0.1:5000/api/db-health`
> - Auth endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout`
> - Advocate Dashboard: `GET /api/advocate/dashboard`
> - Advocate Cases: `GET /api/advocate/cases`, `POST /api/advocate/cases`
> - Advocate Clients: `GET /api/advocate/clients`, `POST /api/advocate/clients`
> - Advocate Staff & Assignments: `GET /api/advocate/staff`, `POST /api/advocate/assignments`

### Terminal 2: React + Vite Frontend
```powershell
cd d:\legal-casebook\frontend
npm run dev
```
> Running at: `http://localhost:5173/`

### Terminal 3: Run the Complete Automated Test Suite
```powershell
cd d:\legal-casebook\backend
.\venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```
> Executes 24 comprehensive automated test cases validating rate limiting, password complexity, public registration security, session cookies, RBAC boundaries, advocate dashboard queries, staff assignment workflow, and critical privacy boundaries.
