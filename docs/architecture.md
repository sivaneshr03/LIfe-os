# LifeOS: Architecture & Technical Design

## 1. System Topology
LifeOS is architected as an edge-native web application deployed entirely on Cloudflare's serverless platform.

```text
[ Browser / PWA Client ]
        │
        │ HTTPS (Cookie-authenticated)
        ▼
[ Cloudflare Edge ]
   ├── Workers Assets: Static SPA Bundle (HTML, JS, CSS, Media)
   └── Worker API (Hono.js):
         ├── Auth & Session Middleware (Cookie validation, CSRF)
         ├── Domain Routers (/api/tasks, /api/finance, /api/notes, ...)
         └── Drizzle ORM Data Access Layer
                 │
                 ▼
         [ Cloudflare D1 (SQLite) ]
                 │
                 ▼ (Deferred until binary attachments enabled)
         [ Cloudflare R2 Object Storage ]
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack
- **Framework & Build:** React 19 + TypeScript + Vite.
- **Styling:** Tailwind CSS with CSS custom properties (`--color-primary`, `--color-bg`, etc.) enabling instant runtime theme color changes.
- **Component Primitives:** Accessible, unstyled UI primitives (Radix UI) wrapped in reusable design tokens compliant with WCAG 2.2 AA.
- **Form Management:** React Hook Form integrated with Zod validation schemas for end-to-end type safety.

### 2.2 State Management Separation
To avoid state synchronization bugs and bloat, state is split into two distinct tiers:

1. **Server State (TanStack Query):**
   - Authoritative for all remote data (tasks, accounts, transactions, notes, habits).
   - Manages caching, query invalidation, background revalidation, and optimistic UI mutations with rollback on network failure.
2. **Client UI State (Zustand):**
   - Strictly reserved for transient client-only state:
     - Navigation drawer open/closed
     - Active modal or sheet
     - Global command palette visibility
     - Active filter presets in memory
     - Theme preference (system / dark / light) and selected accent color palette.
   - **Prohibited:** Storing server entities or duplicated query data in Zustand stores.

---

## 3. Backend Architecture (Cloudflare Worker + Hono)

### 3.1 Routing & Middleware Pipeline
The API layer is built using Hono due to its minimal footprint, Web Standards compliance, and native Cloudflare Workers performance.

- **Request Pipeline:**
  1. `SecureHeaders`: Applies CSP, HSTS, X-Content-Type-Options, X-Frame-Options.
  2. `CORS & OriginValidator`: Validates origin header for mutating requests (`POST`, `PUT`, `DELETE`).
  3. `SessionAuthMiddleware`: Extracts and validates the session cookie from Cloudflare D1; attaches the authenticated `User` context (`c.set('user', user)`).
  4. `ZodValidator`: Validates incoming JSON bodies, URL query params, and route parameters against shared Zod schemas before route handlers execute.
  5. `DomainRouter`: Executes business logic inside Drizzle ORM database transactions.
  6. `ErrorHandler`: Catches errors, logs structured diagnostics, and produces standard JSON error responses.

### 3.2 Database Layer (Cloudflare D1 & Drizzle ORM)
- **Engine:** Cloudflare D1 (distributed serverless SQLite).
- **ORM:** Drizzle ORM configured with SQLite dialect.
- **Query Strategy:** Prepared statements and parameterized queries for 100% of database interactions.
- **Transactions:** Complex financial operations (e.g., transfers, CSV imports) execute within atomic SQLite transactions to prevent partial writes.

---

## 4. Authentication & Session Flow

```text
Client                          Hono API                          D1 Database
  │                                │                                   │
  │── POST /api/auth/login ───────>│                                   │
  │   { email, password }          │── Verify Argon2/PBKDF2 hash ─────>│
  │                                │<── User Record Validated ─────────│
  │                                │                                   │
  │                                │── INSERT session (id, expires) ──>│
  │                                │<── Session Committed ─────────────│
  │                                │                                   │
  │<── 200 OK ─────────────────────│                                   │
  │    Set-Cookie: session_id=...; │                                   │
  │    HttpOnly; Secure;           │                                   │
  │    SameSite=Lax; Path=/        │                                   │
  │                                │                                   │
  │── GET /api/tasks ─────────────>│                                   │
  │   Cookie: session_id=...       │── SELECT session + user ─────────>│
  │                                │<── Active session returned ───────│
  │<── 200 OK (Tasks payload) ─────│                                   │
```

---

## 5. Phased Delivery Roadmap

1. **Phase 0:** Governance & Architecture Baseline (Docs & ADRs) - *Current Gate*
2. **Phase 1:** Core Tooling, Vite Scaffold, Hono Worker, and D1 Database setup
3. **Phase 2:** Authentication Engine, Session Management, and Role Authorization
4. **Phase 3:** Productivity Engine (Tasks, Projects, Boards, Notes, Prompts)
5. **Phase 4:** Trackers & Habits (Habit streaks, fitness metrics, flexible trackers)
6. **Phase 5:** Financial Engine (Accounts, Ledger, Budgets, Debts, Net Worth)
7. **Phase 6:** Investment Engine & CSV Importer
8. **Phase 7:** Admin Panel (`/admin`), Theming Engine, PWA, and Security Audit
