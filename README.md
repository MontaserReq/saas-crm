# CodeLine JO — PR & School Operations CRM Platform

A production-ready full-stack **PR Team, School Assignment, and Ticket Management Platform** built with **Next.js (App Router)**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, **Server Actions**, **RBAC Authorization**, and **Tailwind CSS**.

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
| **Framework** | Next.js 14 App Router, React 18, TypeScript |
| **Database & ORM** | PostgreSQL 16, Prisma ORM |
| **Authentication** | JWT Server Cookies (`jose`), `bcryptjs`, Secure HttpOnly |
| **Validation** | Zod |
| **UI & Styling** | Tailwind CSS, Lucide Icons, Pastel Sticky-Note styling |
| **Tables** | TanStack Table |
| **File Parsing** | `xlsx`, `papaparse` |
| **Testing** | Vitest |

---

## 📋 Default Seed Accounts

All demo accounts use the password: `Password123!`

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
Create `.env` based on `.env.example`:
```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5435/codeline_crm?schema=public"
AUTH_SECRET="codeline-super-secret-jwt-key-change-in-production-2026"
NEXTAUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR="./uploads"
```

### 3. Database Migration & Seed
```bash
# Push Prisma schema to PostgreSQL
npm run db:push

# Seed database with roles, permissions, departments, task types, 32 schools, tickets, and to-dos
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Automated Tests
```bash
npm run test
```

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
