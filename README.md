# CodeLine JO — CRM & Business Operations Platform

A production-ready full-stack **CRM and Business Operations Platform** built with **Next.js (App Router)**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, **Server Actions**, **RBAC Authorization**, and **Tailwind CSS**. Optional vertical modules support school and outreach workflows without limiting the platform to one industry.

---

## 🌟 Key Architecture & Product Principles

### 1. Strict Data Privacy & Scoped Access
- **Member Access**: Regular team members can **only** access tickets where they are currently an active assignee or CC participant.
- **URL Manipulation Guard**: Manually changing `/tickets/CL-1001` to `/tickets/CL-1002` verifies server-side access on every request. Unauthorized requests receive a `403 Forbidden` response.
- **Private To-Do Isolation**: The **My To-Do** digital sticky-note board is strictly isolated. Even Super Admins cannot view another user's personal to-do notes.

### 2. Immutable Tickets & Notes
- **Append-Only History**: Tickets and Notes are strictly immutable. Once created, no update or delete routes/actions exist.
- **Traceable History**: Updates occur strictly via new immutable Notes, State Machine transitions, Rejections (with mandatory reasons), Transfers, or Contact Attempt logs.

### 3. Bulk School Assignment & Multi-User Distribution
- **One School = One Individual Ticket**: Distributing 50 schools to team members generates **50 individual tickets** (e.g. `CL-1001`, `CL-1002`, etc.) in a single **atomic Prisma transaction** (`prisma.$transaction`).
- **Distribution Strategies**: Equal auto-split distribution across multiple selected members (e.g., 50 schools across 3 members $\rightarrow$ 17, 17, 16) or manual targeted selection.

### 4. Excel / CSV School Import Engine
- Multi-step validation pipeline: Upload $\rightarrow$ Parse $\rightarrow$ Duplicate & error detection preview $\rightarrow$ Transactional batch import $\rightarrow$ Import summary.

### 5. Bilingual Arabic + English & RTL / LTR
- Native Arabic typography with Google **Tajawal** font.
- Dynamic language switcher with complete natural Arabic translations and right-to-left layout.

---

## 🚀 Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 App Router, React 18, TypeScript |
| **Database & ORM** | PostgreSQL 16, Prisma ORM |
| **Authentication** | JWT Server Cookies (`jose`), `bcryptjs`, Secure HttpOnly |
| **Validation** | Zod |
| **UI & Styling** | Tailwind CSS, Lucide Icons, Pastel Sticky-Note styling |
| **Tables** | TanStack Table |
| **File Parsing** | `read-excel-file`, `papaparse`, `fflate` |
| **Testing** | Vitest |

---

## 📋 Local-only seed accounts

No reusable demo password is published. The destructive seed is strictly for a disposable loopback database and reads its account password from `SEED_DEFAULT_PASSWORD` at execution time. Generate a fresh local-only value and never reuse it in another environment.

| Role | Email | Purpose |
|---|---|---|
| **Super Admin** | `superadmin@codeline.jo` | Full system control, role permissions matrix, audit logs |
| **Admin** | `admin@codeline.jo` | Operational administration, all tickets oversight, analytics |
| **School Manager** | `manager@codeline.jo` | School registry, CSV/Excel import, bulk school assignment |
| **PR Member** | `ahmad@codeline.jo` | Field officer, assigned tickets, contact logging, private to-dos |
| **Outreach Member** | `hala@codeline.jo` | School outreach officer |
| **Visits Member** | `noor@codeline.jo` | Campus visit coordinator |
| **Data Collection** | `mohammad@codeline.jo` | Data collection and technical surveying |

---

## 🛠️ Quick Start & Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a local environment file from the documented example. Supply a loopback-only PostgreSQL target and generate a fresh `AUTH_SECRET`; do not copy credentials from documentation or commit the local file.

### 3. Safe local database setup
```bash
# Local development schema synchronization only; never use db:push for deployment.
npm run db:push

# Destructive seed: disposable loopback database only. In addition to DATABASE_URL
# and a fresh SEED_DEFAULT_PASSWORD, all four explicit safety values are required.
NODE_ENV=test
SEED_TARGET=disposable-local
SEED_DATABASE_LABEL=disposable
SEED_CONFIRM=ERASE_DISPOSABLE_DATABASE
npm run db:seed
```

The seed refuses production-like environments, remote database hosts, ambiguous or production-like database names, missing labels, and missing confirmation before constructing a Prisma client. Use a database name containing a distinct `local`, `test`, or `disposable` segment.

### Production deployment

Production changes are migration-only: run `npx prisma migrate deploy` (the `migrator` service in `docker-compose.prod.yml` already does this). Never run `db:push` or `db:seed` against production or staging.

The complete server procedure is in [the production deployment guide](docs/production-deployment.md). Start from `.env.production.example`, copy it to `.env`, fill in the real secrets and public HTTPS origin, then use the Compose commands in that guide. Do not upload `.env`, `node_modules`, `.next`, or local uploads to the server.

The application container requires these non-secret security settings:

- `APP_ORIGIN`: the exact public, origin-only HTTPS URL, with no path, query, fragment, or credentials.
- `TRUST_PROXY=single-hop`: asserts that exactly one trusted TLS-termination reverse proxy replaces forwarding headers and that the application container is not directly reachable by clients.

The reverse proxy must be attached to the private application network, be the only ingress to port 3000, overwrite `X-Forwarded-For` with one valid client IP, overwrite `X-Forwarded-Proto` with one value, and preserve the public `Host` (or set `X-Forwarded-Host` to that exact host) so Next.js Server Action same-origin checks succeed. Startup fails if either production setting is absent or invalid.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Personalized workspace setup

Open `/onboarding` to register, describe your business, select goals, review editable recommendations, and create your workspace. Progress is saved to the organization. Optional getting-started tasks can be dismissed and resumed from the CRM overview.

See [the implementation and verification report](docs/personalized-setup-report.md) for supported capabilities, test commands, architectural limits, and completion-time measurement.

### Smart Excel/CSV import

Users with `schools.import` and an `import_export` plan feature can open `/imports` to import Clients, Leads, Contacts, Deals, or Tasks without a fixed template. The wizard supports Arabic and English headers, multi-sheet workbooks, custom fields, validation, duplicate modes, transactional confirmation, failure reports, and tenant-scoped history.

See [the Smart Import implementation report](docs/smart-import.md) for supported fields, limits, retention, matching rules, and deployment notes.

### 5. Run Automated Tests
```bash
npm run lint
npm run typecheck
npm run test
```

The unauthenticated `GET /api/health` readiness endpoint returns `200` only
when the application can reach PostgreSQL. It returns a generic `503` without
exposing connection details when the dependency is unavailable.

Before any staging or production rollout, follow
[the release-readiness runbook](docs/pre-launch-readiness.md). It includes the
environment checklist, forward-only migration procedure, rollback boundaries,
backup/restore requirements, health checks, and monitoring signals.

---

## 🔒 Security & RBAC Model

### Permission Codes
```text
users.view / users.create / users.update / users.disable
roles.view / roles.create / roles.update
departments.manage / task_types.manage
schools.view / schools.create / schools.import / schools.update / schools.assign
tickets.view_assigned / tickets.view_all / tickets.create / tickets.mark_seen
tickets.accept / tickets.reject / tickets.add_note / tickets.transfer / tickets.complete / tickets.close
attachments.upload / attachments.download / communications.log
analytics.view / audit_logs.view / todo.manage_own
```

### Ticket Status Lifecycle
```text
PENDING ──► SEEN ──► ACCEPTED ──► IN_PROGRESS ──► COMPLETED ──► CLOSED
   │         │           │             │
   └─────────┴──► REJECTED (with reason)
                 │
                 └──► TRANSFERRED (to new assignee)
```
