# StackX SkillTrack

### Project-Based Student Skill Profiling & Tracking System

> A comprehensive full-stack web platform for engineering and academic institutions to manage project-based learning, Kanban task tracking, rule-based technology-to-skill mapping ($R \subseteq T \times S$), faculty verification of student competencies, and verifiable placement readiness talent matching.

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [How It Aligns with the Research Paper](#how-it-aligns-with-the-research-paper)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Core Features & Workflows](#core-features--workflows)
  - [1. Faculty Verification Lifecycle](#1-faculty-verification-lifecycle)
  - [2. Technology-to-Skill Rule Engine](#2-technology-to-skill-rule-engine-r--t--s)
  - [3. Student Project Creation & Collaboration](#3-student-project-creation--collaboration)
  - [4. Verified vs. Project-Derived Skill Profiling](#4-verified-vs-project-derived-skill-profiling)
  - [5. Digital Skill Passport & Portfolio Generation](#5-digital-skill-passport--portfolio-generation)
  - [6. Placement Readiness Talent Search](#6-placement-readiness-talent-search)
- [OWASP Top 10 Security Architecture](#owasp-top-10-security-architecture)
- [Automated Testing Suite](#automated-testing-suite)
- [User Roles & Permissions](#user-roles--permissions)
- [Database Schema (Prisma)](#database-schema-prisma)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Implementation Status Checklist](#implementation-status-checklist)

---

## About the Project

In engineering and computing curricula, practical skills are developed primarily through hands-on project work. However, conventional credentials rely almost exclusively on self-reported resumes or fragmented course spreadsheets, leaving recruiters and faculty unable to verify technical claims.

**StackX SkillTrack** provides a centralized, role-based platform that unites:
- **Project execution & Kanban workflow**
- **Student technology & tool logging** ($T$)
- **Formal rule-based competency mapping** ($R \subseteq T \times S$)
- **Faculty guide verification and oversight** ($S \to \text{VERIFIED}$)
- **Digital Skill Passport / Placement Portfolio generation**
- **Admin job-role talent search with verified proficiency metrics**

---

## How It Aligns with the Research Paper

The implementation directly satisfies the foundational equations and principles outlined in the research paper:

1. **Technology & Tool Submission ($T$):** Students log tools, languages, and frameworks used in their projects.
2. **Rule-Based Mapping Engine ($R \subseteq T \times S$):** Maps submitted tools ($t \in T$) and project textual context to catalogue competencies ($s \in S$), going beyond basic keyword search to account for framework synonyms and parent disciplines.
3. **Faculty Verification Requirement (Paper Eq. 3–4):** A student skill claim originates as `PENDING`. Only when the faculty supervisor verifies the student deliverable does the skill state transition to `VERIFIED`.
4. **Verified Student Skill Profile:** The verified profile comprises strictly verified skills, while the project dashboard retains exposure evidence.
5. **Job-Role Talent Search:** Matches candidates against industry job roles, ranking by skill coverage and highlighting verified competencies with linked project deliverables.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React, TypeScript, Vite | React 19, TS 5.9, Vite 7 | Role-based reactive UI & single-page application |
| **Routing** | React Router | v7 | Protected route handling and role redirection |
| **Styling** | TailwindCSS, FontAwesome | Tailwind 4, FA 7 | Responsive design, modal overlays, print stylesheets |
| **Backend** | Node.js, Express | Express 5, TS 5.9 | REST API endpoints, auth middleware, rule engine |
| **ORM** | Prisma | v6 | Schema definition, relations, migrations, query building |
| **Database** | PostgreSQL | v16+ | Normalized relational storage with cascading foreign keys |
| **Authentication** | JWT, bcryptjs | jsonwebtoken 9, bcryptjs 3 | Secure session tokens (7-day), salted password hashing |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│   React 19 + TypeScript + Vite + Tailwind CSS + FontAwesome  │
│                                                             │
│   ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│   │ Student Dashboard│  │Faculty Dashboard │  │Admin Tools│ │
│   │ + Skill Passport │  │+ Oversight Panel │  │+ Search   │ │
│   └────────┬─────────┘  └────────┬─────────┘  └─────┬─────┘ │
└────────────┼─────────────────────┼──────────────────┼───────┘
             │                     │                  │
             │ HTTP REST / Bearer JWT (Port 4300)     │
             ▼                     ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       Server Layer                          │
│               Node.js + Express 5 (TypeScript)              │
│                                                             │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │     Auth Middleware     │  │  Rule Engine (R ⊆ T × S) │  │
│  │ (Role & Project Access) │  │  50+ Tech-Skill Rules    │  │
│  └────────────┬────────────┘  └────────────┬─────────────┘  │
│               │                            │                │
│  ┌────────────┴────────────────────────────┴─────────────┐  │
│  │ Routes: /auth, /projects, /student-skills, /columns,  │  │
│  │         /tasks, /skills, /job-roles, /talent-search   │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                         │
│               PostgreSQL + Prisma 6 ORM                     │
│                                                             │
│   User (STUDENT/FACULTY/ADMIN) ─── Project ─── Column ── Task│
│    │                                   │                    │
│   StudentSkill ── StudentSkillEvidence ┴─ ProjectSkill      │
│    │                                          │             │
│   Skill ────────────────────────────── JobRoleSkill         │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Features & Workflows

### 1. Faculty Verification Lifecycle
- **Claim Submission:** Students submit skill claims backed by projects they belong to (`POST /api/student-skills/submit`). The claim is created with `verification: PENDING` and linked to `StudentSkillEvidence`.
- **Faculty Review Panel:** Faculty guides view all pending claims from students in their supervised projects (`GET /api/student-skills/pending`).
- **Approve & Verify:** Faculty click "Approve & Verify" (`PATCH /api/student-skills/:id/verify`), which sets `verification = VERIFIED`, `verifiedById = req.user.id`, and `verifiedAt = new Date()`.
- **Reject:** Faculty can reject invalid claims (`PATCH /api/student-skills/:id/reject`), deleting the unverified record and its evidence link.

### 2. Technology-to-Skill Rule Engine ($R \subseteq T \times S$)
Implemented in `backend/src/services/ruleEngine.ts`:
- Maintains a knowledge base mapping 50+ programming languages, frameworks, libraries, databases, and DevOps tools to official competency categories (e.g. `React` $\to$ `Frontend Development`, `Docker` $\to$ `DevOps / Containerization`, `PostgreSQL` $\to$ `Database Management / SQL`).
- When students or faculty log technologies or create a project, the engine combines:
  1. **Direct Technology Matching**
  2. **Rule-Based Expansion ($R \subseteq T \times S$)**
  3. **Contextual Keyword Matching**
- Automatically links active catalogue skills to the project and initiates pending skill claims for students.

### 3. Student Project Creation & Collaboration
- Students can initiate their own academic or capstone projects (`POST /api/projects`).
- Students are automatically enrolled in `ProjectStudent`.
- Students can optionally select a **Faculty Guide** from the institution's faculty roster (`GET /api/projects/faculty-list`).
- Projects include a Kanban board with default columns (`To Do`, `In Progress`, `In Review`, `Completed`).

### 4. Verified vs. Project-Derived Skill Profiling
- **Verified Skills:** Satisfies paper Eq. (3)–(4). Only skills that have passed faculty approval appear with the verified status, level badge, and verification timestamp.
- **Project Exposure Skills:** Shows technical exposure accumulated across all assigned projects.
- **Student Dashboard:** Features a **Claim a Skill** modal, allowing students to select a skill and associate it with any enrolled project.

### 5. Digital Skill Passport & Portfolio Generation
- Dedicated page at `/student/portfolio` (`PortfolioPage.tsx`).
- Provides a placement-ready, verified academic resume summary:
  - Student identity & institution branding
  - Total verified skills, total projects, and competency count
  - Verified competencies with level, date, and project links
  - Project portfolio showcase with tech stacks
  - **Export / Print to PDF:** Integrated `@media print` CSS formats the document cleanly for printing or saving as an A4 PDF.

### 6. Placement Readiness Talent Search
- Available to Admins at `/admin/talent-search`.
- Select any active job role (e.g. "Full Stack Developer").
- Calculates match percentage:
  $$\text{Match } \% = \left(\frac{\text{Matched Required Skills}}{\text{Total Required Skills}}\right) \times 100$$
- Displays **Verified Skills Count** alongside project-supported matches.
- Shows side-by-side comparison of **Matched Skills** (with project evidence) and **Skills to Develop**.

---

## OWASP Top 10 Security Architecture

The platform incorporates comprehensive defenses aligned with the **OWASP Top 10** standards to safeguard student records, RBAC boundaries, and institutional project repositories:

| OWASP Vulnerability | Mitigation Implemented |
|---|---|
| **A01: Broken Access Control** | **Eliminated Privilege Escalation:** Public registration (`POST /api/auth/register`) strictly ignores client-supplied `role` and forces `STUDENT`. Role promotion is restricted to authenticated Administrators via `PATCH /api/users/:id/role`. Multi-layer project authorization (`authorizeProjectAccess`) enforces data boundaries per role. |
| **A02: Cryptographic Failures** | Passwords hashed using `bcrypt` with 12 salt rounds. Enforces strict password complexity (min 8 chars, mixed case, numbers, special characters). JWT sessions signed with 256-bit secret and 7-day expiration. |
| **A03: Injection** | Strict Prisma ORM parameterized queries prevent SQL injection. Custom input sanitizer (`sanitizeString`) strips HTML/script tags, null bytes, and `javascript:` pseudo-protocols to prevent XSS. |
| **A04: Insecure Design** | Rate limiting applied across auth endpoints. Body size caps (1MB) prevent payload flooding and resource exhaustion. |
| **A05: Security Misconfiguration** | Strict CORS policy reading `CLIENT_ORIGIN` with no unvalidated `undefined` origin bypass. Security headers enforced: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Strict-Transport-Security`, and Content Security Policy. `X-Powered-By` Express header disabled. |
| **A07: Identification & Auth Failures** | Brute-force protection via sliding-window rate limiters: **5 attempts per 15 minutes** on `/api/auth/login`, and **10 registrations per hour** on `/api/auth/register`. Generic authentication errors prevent account enumeration. |
| **A09: Security Logging & Monitoring** | Audit logging on role modifications, unauthorized CORS attempts, and failed authentication events. |

---

## Automated Testing Suite

The repository includes an automated test suite verifying unit, integration, and security controls:

```bash
# Run tests from project root
npm test

# Or run tests directly within backend
npm --prefix backend test
```

### Test Coverage (27 Automated Assertions)
- **Password Complexity Engine:** Verifies rejection of weak, short (<8 chars), missing uppercase/lowercase/digit/symbol, and common dictionary passwords; verifies acceptance of OWASP-compliant passwords.
- **Email Validation:** RFC 5322 regex checks, subdomain validation, and SQL injection attempt rejection.
- **Input Sanitization (XSS):** Strips `<script>` tags, null bytes, and script pseudo-protocols.
- **Rule-Based Mapping Engine ($R \subseteq T \times S$):** Knowledge-base coverage, multi-skill inference, and catalog linking for frontend, backend, database, and cloud tools.
- **Cryptography & JWT:** Bcrypt salt verification, token decoding, and signature tampering rejection.

---

| Role | Access & Capabilities |
|---|---|
| **STUDENT** | View assigned projects & Kanban boards; create new academic projects; log tools & technologies; submit skill verification claims; view verified skill profile; access & print Digital Skill Passport / Portfolio; comment on tasks. |
| **FACULTY** | Supervise student projects; create & manage projects; approve or reject student skill verification requests; track pending task reviews; manage Kanban columns & tasks. |
| **ADMIN** | System-wide oversight; manage global skills catalogue (add/edit/deactivate); create & configure job roles with required skills; execute talent search across all students; view platform analytics. |

---

## Database Schema (Prisma)

### Key Models

- `User`: Accounts with roles (`STUDENT`, `FACULTY`, `ADMIN`).
- `Project`: Project details, status (`ACTIVE`, `COMPLETED`), creator, assigned faculty, and timestamps.
- `ProjectStudent`: M:N join between `Project` and `User` (student).
- `ProjectAdmin`: M:N join between `Project` and `User` (admin).
- `Column`: Kanban swimlanes (`title`, `colorClass`, `order`).
- `Task`: Task cards (`title`, `description`, `priority`, `dueDate`).
- `Comment`: Task comment threads (`content`, `userName`, `createdAt`).
- `Skill`: Catalogue of skills (`name`, `category`, `description`, `isActive`).
- `ProjectSkill`: M:N join between `Project` and `Skill`.
- `StudentSkill`: Student skill claim (`level`: BEGINNER/INTERMEDIATE/ADVANCED, `verification`: PENDING/VERIFIED, `verifiedById`, `verifiedAt`).
- `StudentSkillEvidence`: M:N join between `StudentSkill` and `Project`.
- `JobRole`: Industry placement profile (`title`, `description`, `isActive`).
- `JobRoleSkill`: M:N join between `JobRole` and `Skill`.

---

## API Reference

All endpoints are mounted on port `4300` under `/api`. Protected endpoints require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register new user (student, faculty, admin) |
| `POST` | `/login` | Public | Login with email/password; returns 7-day JWT |

### Projects (`/api/projects`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | All Authenticated | Get projects visible to the authenticated user |
| `POST` | `/` | STUDENT, FACULTY, ADMIN | Create a project; runs rule engine on technologies |
| `GET` | `/:id` | Project Members | Get project details, team, columns, and tasks |
| `PATCH` | `/:id` | Project Creator / Faculty | Update project details |
| `DELETE` | `/:id` | ADMIN | Delete project |
| `GET` | `/faculty-list` | All Authenticated | Get list of active faculty guides |
| `POST` | `/:id/technologies` | Project Members | Log tools & technologies; executes rule engine |
| `GET` | `/admin/overview` | ADMIN | Platform-wide project & user statistics |
| `GET` | `/admin/projects` | ADMIN | Detailed project overview for admin |

### Skills & Verifications (`/api/student-skills`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/me` | STUDENT | Get student's verified skills & project skills |
| `POST` | `/submit` | STUDENT | Submit a skill claim backed by a project |
| `GET` | `/pending` | FACULTY, ADMIN | Get pending skill claims for review |
| `PATCH` | `/:id/verify` | FACULTY, ADMIN | Approve & verify student skill claim |
| `PATCH` | `/:id/reject` | FACULTY, ADMIN | Reject and delete student skill claim |
| `GET` | `/portfolio` | STUDENT | Get digital skill passport & portfolio data |
| `GET` | `/portfolio/:studentId` | FACULTY, ADMIN | View any student's digital portfolio |

### Skills Catalogue (`/api/skills`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | All Authenticated | List active catalogue skills (admin sees all) |
| `POST` | `/` | ADMIN | Add new skill to master catalogue |
| `PATCH` | `/:id` | ADMIN | Update skill details |
| `DELETE` | `/:id` | ADMIN | Soft-deactivate a skill |

### Job Roles & Talent Search (`/api/job-roles`, `/api/talent-search`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/job-roles` | All Authenticated | List active job roles |
| `POST` | `/api/job-roles` | ADMIN | Create a job role and assign required skills |
| `PATCH` | `/api/job-roles/:id` | ADMIN | Update job role and skills |
| `DELETE` | `/api/job-roles/:id` | ADMIN | Deactivate job role |
| `GET` | `/api/talent-search?jobRoleId=` | ADMIN | Rank students against a job role |

---

## Project Structure

```
project-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # Data models and relations
│   │   └── migrations/                # Historical SQL migration steps
│   ├── src/
│   │   ├── server.ts                  # Express application setup
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts      # JWT, RBAC, and project access guards
│   │   ├── services/
│   │   │   └── ruleEngine.ts          # Rule-Based Mapping Engine (R ⊆ T × S)
│   │   └── routes/
│   │       ├── authRoutes.ts
│   │       ├── projectRoutes.ts       # Project CRUD, faculty list, tech submission
│   │       ├── studentSkillsRoutes.ts # Verification lifecycle, submit, portfolio
│   │       ├── skillRoutes.ts
│   │       ├── jobRoleRoutes.ts
│   │       ├── talentSearchRoutes.ts  # Talent search matching engine
│   │       ├── columnRoutes.ts
│   │       ├── taskRoutes.ts
│   │       ├── commentRoutes.ts
│   │       ├── userRoutes.ts          # User management, profile updates, self-deletion
│   │       ├── attachmentRoutes.ts    # Secure file uploads & task attachments
│   │       ├── invitationRoutes.ts    # Project collaboration & supervisor invitations
│   │       ├── notificationRoutes.ts  # In-app notifications & read state
│   │       └── activityRoutes.ts      # Project audit log & history
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx                    # Route definitions & guards
    │   ├── main.tsx
    │   ├── auth.css                   # Custom styles, modal overlays, print CSS
    │   ├── pages/
    │   │   ├── StudentDashboard.tsx   # Student view, claim modal, submitted claims
    │   │   ├── FacultyDashboard.tsx   # Faculty view, skill verification requests
    │   │   ├── PortfolioPage.tsx      # Digital Skill Passport & printable portfolio
    │   │   ├── AdminDashboard.tsx     # Admin overview & system statistics
    │   │   ├── AdminUsersPage.tsx     # User management roster & role administration
    │   │   ├── AdminProjectsPage.tsx  # Global project oversight
    │   │   ├── AdminSkillsPage.tsx    # Master skills catalogue management
    │   │   ├── AdminJobRolesPage.tsx  # Industry job role competency profiles
    │   │   ├── AdminTalentSearchPage.tsx # Talent search with verified badges
    │   │   ├── ProjectsPage.tsx       # Student & faculty project management
    │   │   ├── ProjectBoardPage.tsx   # Kanban board, columns, tasks
    │   │   ├── SettingsPage.tsx       # Profile, notification settings & security/password
    │   │   ├── Login.tsx              # Authentication with password show/hide toggle
    │   │   └── Register.tsx           # Registration with department selection & password toggle
    │   └── components/
    │       ├── Sidebar.tsx            # Full-height sticky sidebar with mobile responsiveness
    │       ├── NotificationBell.tsx   # Real-time notifications dropdown & unread counter
    │       ├── CreateProjectModal.tsx # Project creation with tech & faculty guide
    │       ├── KanbanColumn.tsx
    │       ├── TaskCard.tsx
    │       ├── TaskDetailModal.tsx
    │       └── ProtectedRoute.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Live Production Deployment

| Service | Platform | URL / Configuration |
|---|---|---|
| **Frontend** | Vercel | Single-Page Application with rewrite routing (`vercel.json`) |
| **Backend API** | Render | Node.js / Express Web Service (`https://stackx-skilltrack.onrender.com`) |
| **Database** | Neon | Serverless PostgreSQL with auto-scaling compute |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **PostgreSQL** (Local instance or [Neon](https://neon.tech) cloud database)
- **npm** ≥ 9.x

### 1. Database Setup

Ensure PostgreSQL is running and create the database (or use your Neon PostgreSQL connection string):
```sql
CREATE DATABASE skilltrack_db;
```

Push Prisma schema to the database:
```bash
cd backend
npx prisma db push
```

### 2. Quick Start (Combined Frontend + Backend)

From the project root, start both the backend API and frontend client with a single command:

```bash
npm start
```

This launches both services concurrently with formatted logging:
- 🚀 **Backend REST API**: `http://localhost:4300`
- 💻 **Frontend Web App**: `http://localhost:5173`

Press `Ctrl + C` at any time to gracefully stop both services.

#### Individual & Auxiliary Commands

```bash
# Start in development mode (equivalent to npm start)
npm run dev

# Build both backend & frontend packages
npm run build

# Start only the backend (Express on port 4300)
npm run backend

# Start only the frontend (Vite on port 5173)
npm run frontend
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://<username>:<password>@<host>:5432/skilltrack_db?sslmode=require"
JWT_SECRET=your_super_secret_jwt_key
PORT=4300
CLIENT_ORIGIN=http://localhost:5173
```

### Frontend (`frontend/.env` or Vercel Environment Variables)

```env
VITE_API_BASE_URL=https://stackx-skilltrack.onrender.com/api
```

---

## Implementation Status Checklist

- [x] **Faculty Skill Verification Workflow** (`POST /submit`, `GET /pending`, `PATCH /:id/verify`, `PATCH /:id/reject`)
- [x] **Faculty Dashboard Verification Panel** (Approve & Verify / Reject with real-time feedback)
- [x] **Student Technology Submission** (`POST /projects/:id/technologies`, technology input in project creation modal)
- [x] **Rule-Based Mapping Engine ($R \subseteq T \times S$)** (Knowledge base of 50+ tools mapped to competency domains)
- [x] **Verified Student Skill Profile (Paper Eq. 3–4)** (Separation of faculty-verified competencies and project exposure)
- [x] **Digital Skill Passport & Portfolio Page** (`/student/portfolio` with printable / exportable PDF layout)
- [x] **Student Project Creation** (Students can initiate capstone/academic projects and pick faculty guides)
- [x] **Placement Talent Search Enhancement** (Verified skill counts and badges in candidate ranking)
- [x] **Kanban Board & Custom Columns** (Add/delete columns, move tasks, priority, due dates)
- [x] **Task Comments & Collaboration** (Threaded comments with author & timestamp)
- [x] **Admin Skills Catalogue & Job Roles** (Master CRUD with soft-deactivation)
- [x] **Admin User Management Roster** (`/admin/users` with role reassignment & user deletion)
- [x] **Account & Security Settings** (`/settings` with profile updates, notification preferences & OWASP password changes)
- [x] **Clean Production Build Verification** (Both backend and frontend compile with 0 errors)

---

## Author & Maintainer

**Soumyaranjan Parida** ([@rahul06dev](https://github.com/rahul06dev))

---

## License

This project is developed for academic, educational, and research evaluation at MIT Art, Design and Technology University, Pune.
