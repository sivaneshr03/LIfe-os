# Agent Governance & Operational Directives: LifeOS

## Non-Negotiable Prohibitions (Zero Tolerance)
Agents operating within this repository MUST NOT:
1. Deploy to production or any remote environment without explicit user approval.
2. Use production data for development, testing, staging, previews, screenshots, or demos.
3. Execute remote or destructive database migrations without explicit approval, a verified backup/export, and a documented rollback script.
4. Automatically create Git commits, pushes, merges, tags, or pull requests without explicit instruction.
5. Provision or integrate paid services, paid APIs, or cost-incurring cloud infrastructure without explicit user authorization.
6. Store authentication tokens, session identifiers, or encryption keys in `localStorage`, `sessionStorage`, `IndexedDB`, URLs, query parameters, or client-persisted browser state.
7. Use JavaScript floating-point numbers (`number` with floating points) as the authoritative source for financial balances, ledger entries, currency math, or investment calculations.
8. Implement finance modules in parallel or out of sequential order (dependencies must be verified sequentially: Base Currency & Accounts -> Ledger Transactions -> Budgets -> Debts -> Net Worth -> Investments).
9. Retain mock, localStorage, or in-memory persistence shims after the database integration phase has commenced.
10. Modify system architecture, add runtime dependencies, or alter API/data-model contracts outside of approved design documentation.

---

## Technical Stack Boundaries
- **Frontend Framework:** React 19 + TypeScript + Vite.
- **Styling & Design System:** Tailwind CSS with CSS variable-backed design tokens for light/dark mode and customizable global accent colors.
- **Client State:** Zustand strictly for ephemeral UI state (modals, drawers, layout collapse, temporary filter toggles).
- **Server State & Data Fetching:** TanStack Query strictly for all API fetching, caching, synchronization, and optimistic mutations.
- **Form Management & Validation:** React Hook Form paired with Zod schemas.
- **Backend Runtime:** Cloudflare Workers running Hono framework.
- **Database & ORM:** Cloudflare D1 (SQLite) with Drizzle ORM.
- **Object Storage:** Cloudflare R2 only when binary file attachments (receipts, avatars, exports) are explicitly implemented; deferred until required.
- **PWA:** Service worker registration with offline static asset caching and install manifest.
- **Authentication:** Server-managed session IDs stored in D1 and transmitted via `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookies.

---

## Finance Integrity Directives
- **Integer Minor Units:** All monetary currency values are stored as integers representing minor units (e.g., USD cents: $12.34 is `1234`).
- **Investment Shares:** Fractional units/shares are represented as fixed-point integers scaled to 6 decimal places (e.g., `1.5` shares = `1500000`).
- **Ledger Invariant:** Account balances must always reconcile to the sum of atomic ledger transactions.
- **Validation Before Mutation:** Any financial calculation or CSV import row must be validated via Zod schemas and tested in an isolated unit test suite before database persistence.

---

## Security & Privacy Directives
- **Zero Token Leakage:** Never expose session identifiers in response bodies, client-readable cookies, query parameters, or client telemetry.
- **RBAC Enforcement:** Access control is verified at the Hono middleware layer. The `/admin` UI and `/api/admin/*` endpoints require `role === 'admin'`.
- **Parameterized Queries:** Raw SQL string interpolation is strictly prohibited; all queries must use Drizzle ORM query builders and parameterization.
- **Security Headers:** Enforce strict CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Work Order & Phased Execution
Agents must follow the phased roadmap defined in `docs/architecture.md`. Do not jump ahead to product feature implementation without completing foundation layers and receiving explicit user approval at designated stage gates.
