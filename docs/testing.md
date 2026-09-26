# LifeOS: Testing Strategy & Quality Assurance

## 1. Quality Objectives
LifeOS governs critical personal and financial information. The testing strategy prioritizes data integrity, deterministic arithmetic, authorization gates, and visual accessibility.

---

## 2. Testing Pyramid & Tooling

```text
       ▲
      / \     E2E Smoke Tests (Playwright)
     /   \    - Critical user journeys (Auth, Task lifecycle, CSV import)
    /─────\
   /       \   Integration Tests (Vitest + Miniflare)
  /         \  - Hono endpoints, D1 migrations, RBAC middleware
 /───────────\
/             \ Unit & Invariant Tests (Vitest)
─────────────── - Integer minor-unit math, recurrence logic, Zod schemas, a11y
```

---

## 3. Test Suites

### 3.1 Financial Invariant & Unit Testing
Financial modules must maintain mathematical integrity with zero floating-point imprecision.
- **Integer Cents Math:** Verify additions, subtractions, multi-currency conversions, and tax calculations are performed strictly in minor units.
- **Double-Entry Balance Verification:**
  ```typescript
  test('transaction ledger must balance across source and destination accounts', async () => {
    const transferAmount = 5000; // $50.00
    const [source, dest] = await executeTransfer(checkingAccount.id, savingsAccount.id, transferAmount);
    expect(source.balance_cents).toBe(initialChecking - transferAmount);
    expect(dest.balance_cents).toBe(initialSavings + transferAmount);
  });
  ```
- **Investment Precision:** Fractional shares test suite ensuring fixed-point values scaled by $10^6$ round down deterministically and preserve fractional quantities accurately.

### 3.2 Schema & Validation Testing
- Validate all incoming Zod contracts against valid payloads and edge-case invalid payloads (SQL injection strings, cross-site script payloads, out-of-range dates).

### 3.3 API Integration & Authorization Testing
- Tests execute against a local in-memory SQLite/Miniflare D1 instance.
- Validate that all protected endpoints return `401 Unauthorized` without a valid cookie.
- Validate that `/api/admin/*` endpoints return `403 Forbidden` for users with `role: 'member'`.

### 3.4 Accessibility (a11y) Testing
- Automated accessibility audits using `@axe-core/react` or `vitest-axe` on all reusable UI components.
- Ensure focus rings, keyboard navigability (Esc to close modals, Tab traps, arrow navigation in menus), and color contrast ratios comply with WCAG 2.2 AA.

---

## 4. Execution Commands
```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run test coverage report
npm run test:coverage

# Run Playwright end-to-end smoke suite
npm run test:e2e
```
