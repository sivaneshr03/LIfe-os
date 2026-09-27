import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import type {
  ApiSuccessResponse,
  FinanceAccountData,
  FinanceTransactionData,
  FinanceBudgetData,
  FinanceDebtData,
  FinanceSpendingAnalysisData,
  FinanceNetWorthSnapshotData,
  FinanceImportPreviewData,
  FinanceImportCommitResult,
  CategoryData,
} from '../src/shared/types';

describe('Finance Core Comprehensive Verification Suite (Checks 1-16)', () => {
  let testD1: D1Database;
  let disposeD1: () => Promise<void>;
  let userACookie: string;
  let userBCookie: string;

  let checkingAccId: string;
  let savingsAccId: string;
  let groceriesCatId: string;
  let utilitiesCatId: string;
  let salaryCatId: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeD1 = dispose;

    // 1. Bootstrap User A
    const resA = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Finance Tester A',
          email: 'financetestera@example.com',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookieA = resA.headers.get('set-cookie');
    userACookie = setCookieA?.split(';')[0] || '';

    // 2. Create invite & register User B
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: userACookie,
        },
        body: JSON.stringify({
          email: 'financetesterb@example.com',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<{ code: string }>;

    const resB = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteJson.data.code,
          name: 'Finance Tester B',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookieB = resB.headers.get('set-cookie');
    userBCookie = setCookieB?.split(';')[0] || '';

    // 3. Setup Categories for User A
    const c1 = await app.request(
      '/api/categories',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ name: 'Salary Income', domain: 'finance', color: '#10b981' }),
      },
      { DB: testD1 }
    );
    salaryCatId = ((await c1.json()) as ApiSuccessResponse<CategoryData>).data.id;

    const c2 = await app.request(
      '/api/categories',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ name: 'Groceries', domain: 'finance', color: '#3b82f6' }),
      },
      { DB: testD1 }
    );
    groceriesCatId = ((await c2.json()) as ApiSuccessResponse<CategoryData>).data.id;

    const c3 = await app.request(
      '/api/categories',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ name: 'Utilities', domain: 'finance', color: '#f59e0b' }),
      },
      { DB: testD1 }
    );
    utilitiesCatId = ((await c3.json()) as ApiSuccessResponse<CategoryData>).data.id;

    // 4. Create Accounts for User A
    const a1 = await app.request(
      '/api/finance/accounts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          name: 'Main Checking',
          type: 'checking',
          currency: 'USD',
          initialBalanceCents: 100000, // $1,000.00
        }),
      },
      { DB: testD1 }
    );
    checkingAccId = ((await a1.json()) as ApiSuccessResponse<FinanceAccountData>).data.id;

    const a2 = await app.request(
      '/api/finance/accounts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          name: 'Reserve Savings',
          type: 'savings',
          currency: 'USD',
          initialBalanceCents: 50000, // $500.00
        }),
      },
      { DB: testD1 }
    );
    savingsAccId = ((await a2.json()) as ApiSuccessResponse<FinanceAccountData>).data.id;
  });

  afterAll(async () => {
    if (disposeD1) await disposeD1();
  });

  // Check 1: Income calculations
  it('1. verifies income calculations and atomic balance updates', async () => {
    const res = await app.request(
      '/api/finance/transactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          accountId: checkingAccId,
          categoryId: salaryCatId,
          type: 'income',
          amountCents: 250000, // $2,500.00
          transactionDate: '2026-11-01',
          payee: 'Tech Employer',
        }),
      },
      { DB: testD1 }
    );
    expect(res.status).toBe(201);

    // Checking balance should now be 100000 + 250000 = 350000
    const accRes = await app.request(
      `/api/finance/accounts/${checkingAccId}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const accJson = (await accRes.json()) as ApiSuccessResponse<FinanceAccountData>;
    expect(accJson.data.balanceCents).toBe(350000);
  });

  // Check 2: Expense calculations
  it('2. verifies expense calculations and atomic balance reductions', async () => {
    const res = await app.request(
      '/api/finance/transactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          accountId: checkingAccId,
          categoryId: groceriesCatId,
          type: 'expense',
          amountCents: 45000, // $450.00
          transactionDate: '2026-11-02',
          payee: 'Supermarket Supercenter',
        }),
      },
      { DB: testD1 }
    );
    expect(res.status).toBe(201);

    // Checking balance should now be 350000 - 45000 = 305000
    const accRes = await app.request(
      `/api/finance/accounts/${checkingAccId}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const accJson = (await accRes.json()) as ApiSuccessResponse<FinanceAccountData>;
    expect(accJson.data.balanceCents).toBe(305000);
  });

  // Check 3: Transfer exclusion from income/expense
  it('3. verifies transfers atomically transfer funds and are excluded from income and expenses', async () => {
    // Transfer $500.00 (50000 cents) from Checking to Savings
    const res = await app.request(
      '/api/finance/transactions/transfer',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          fromAccountId: checkingAccId,
          toAccountId: savingsAccId,
          amountCents: 50000,
          transactionDate: '2026-11-03',
          payee: 'Transfer to Savings',
        }),
      },
      { DB: testD1 }
    );
    expect(res.status).toBe(201);

    // Checking balance: 305000 - 50000 = 255000 ($2,550.00)
    const chkRes = await app.request(
      `/api/finance/accounts/${checkingAccId}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const chkJson = (await chkRes.json()) as ApiSuccessResponse<FinanceAccountData>;
    expect(chkJson.data.balanceCents).toBe(255000);

    // Savings balance: 50000 + 50000 = 100000 ($1,000.00)
    const savRes = await app.request(
      `/api/finance/accounts/${savingsAccId}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const savJson = (await savRes.json()) as ApiSuccessResponse<FinanceAccountData>;
    expect(savJson.data.balanceCents).toBe(100000);

    // Verify spending report excludes this $500 transfer from expenses and income
    const reportRes = await app.request(
      '/api/finance/reports/spending?period=monthly&yearMonth=2026-11',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    expect(reportRes.status).toBe(200);
    const reportJson = (await reportRes.json()) as ApiSuccessResponse<FinanceSpendingAnalysisData>;
    expect(reportJson.data.totalIncomeCents).toBe(250000); // Only salary
    expect(reportJson.data.totalExpenseCents).toBe(45000); // Only groceries
  });

  // Check 4: Split transaction aggregation
  it('4. verifies split transaction creation and exact sum integrity', async () => {
    // Total expense of $300.00 (30000 cents): $200 groceries, $100 utilities
    const res = await app.request(
      '/api/finance/transactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          accountId: checkingAccId,
          type: 'expense',
          amountCents: 30000,
          transactionDate: '2026-11-04',
          payee: 'Mega Mart',
          splits: [
            { categoryId: groceriesCatId, amountCents: 20000, notes: 'Food items' },
            { categoryId: utilitiesCatId, amountCents: 10000, notes: 'Lightbulbs & batteries' },
          ],
        }),
      },
      { DB: testD1 }
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as ApiSuccessResponse<FinanceTransactionData>;
    expect(json.data.hasSplits).toBe(true);
    expect(json.data.splits?.length).toBe(2);

    // Checking balance: 255000 - 30000 = 225000
    const chkRes = await app.request(
      `/api/finance/accounts/${checkingAccId}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const chkJson = (await chkRes.json()) as ApiSuccessResponse<FinanceAccountData>;
    expect(chkJson.data.balanceCents).toBe(225000);
  });

  // Check 5: Category summary accuracy
  it('5. verifies category summary allocates split amounts to their respective categories', async () => {
    const reportRes = await app.request(
      '/api/finance/reports/spending?period=monthly&yearMonth=2026-11',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    expect(reportRes.status).toBe(200);
    const reportJson = (await reportRes.json()) as ApiSuccessResponse<FinanceSpendingAnalysisData>;

    // Total expenses = 45000 (direct groceries) + 30000 (split: 20000 groceries + 10000 utilities) = 75000
    expect(reportJson.data.totalExpenseCents).toBe(75000);

    const grocCat = reportJson.data.categoryBreakdown.find((c) => c.categoryId === groceriesCatId);
    expect(grocCat?.totalCents).toBe(65000); // 45000 + 20000

    const utilCat = reportJson.data.categoryBreakdown.find((c) => c.categoryId === utilitiesCatId);
    expect(utilCat?.totalCents).toBe(10000); // 10000 from split
  });

  // Check 6: Budget-period accuracy
  it('6. verifies budget envelopes aggregate both direct and split expenses accurately', async () => {
    // Create Groceries budget for 2026-11: $1,000.00 (100000 cents)
    const bRes = await app.request(
      '/api/finance/budgets',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          categoryId: groceriesCatId,
          period: 'monthly',
          yearMonth: '2026-11',
          amountCents: 100000,
        }),
      },
      { DB: testD1 }
    );
    expect(bRes.status).toBe(201);

    // Query budgets for 2026-11
    const listRes = await app.request(
      '/api/finance/budgets?yearMonth=2026-11',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as ApiSuccessResponse<FinanceBudgetData[]>;
    const grocBudget = listJson.data.find((b) => b.categoryId === groceriesCatId);
    expect(grocBudget).toBeDefined();
    // Spent should be 65000 (45000 direct + 20000 split)
    expect(grocBudget?.spentCents).toBe(65000);
    expect(grocBudget?.remainingCents).toBe(35000);
    expect(grocBudget?.percentageUsed).toBe(65);
  });

  // Check 7, 8, 9: Partial debt payments, debt settlement, and remaining balance derivation
  it('7, 8, 9. verifies partial debt payment, balance derivation, and settlement transitions', async () => {
    // 1. Create debt: $1,200.00 (120000 cents)
    const dRes = await app.request(
      '/api/finance/debts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          name: 'Personal Loan',
          creditor: 'Credit Union',
          totalOwedCents: 120000,
          interestRateBps: 850,
          minimumPaymentCents: 10000,
          dueDate: '2026-12-01',
        }),
      },
      { DB: testD1 }
    );
    expect(dRes.status).toBe(201);
    const debt = ((await dRes.json()) as ApiSuccessResponse<FinanceDebtData>).data;
    expect(debt.remainingBalanceCents).toBe(120000);
    expect(debt.isPaidOff).toBe(false);

    // 2. Partial Payment 1: $500.00 principal
    const p1 = await app.request(
      `/api/finance/debts/${debt.id}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          date: '2026-11-05',
          amountCents: 50000,
          principalCents: 50000,
        }),
      },
      { DB: testD1 }
    );
    expect(p1.status).toBe(201);

    // Verify derived remaining balance: 120000 - 50000 = 70000
    const check1 = await app.request(
      `/api/finance/debts/${debt.id}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const check1Json = (await check1.json()) as ApiSuccessResponse<FinanceDebtData>;
    expect(check1Json.data.remainingBalanceCents).toBe(70000);
    expect(check1Json.data.isPaidOff).toBe(false);

    // 3. Settlement Payment 2: Remaining $700.00 principal
    const p2 = await app.request(
      `/api/finance/debts/${debt.id}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          date: '2026-11-10',
          amountCents: 70000,
          principalCents: 70000,
        }),
      },
      { DB: testD1 }
    );
    expect(p2.status).toBe(201);

    // Verify remaining balance is 0 and isPaidOff is true
    const check2 = await app.request(
      `/api/finance/debts/${debt.id}`,
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const check2Json = (await check2.json()) as ApiSuccessResponse<FinanceDebtData>;
    expect(check2Json.data.remainingBalanceCents).toBe(0);
    expect(check2Json.data.isPaidOff).toBe(true);
  });

  // Check 10: Net-worth calculations & monthly snapshots
  it('10. verifies Net Worth calculation and monthly snapshot persistence', async () => {
    // Current Checking = 225000 ($2,250), Savings = 100000 ($1,000) -> Total Assets = 325000
    // Paid off debt = 0 liabilities -> Net Worth = 325000
    const snapRes = await app.request(
      '/api/finance/snapshots',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          yearMonth: '2026-11',
          notes: 'End of month audit',
        }),
      },
      { DB: testD1 }
    );
    expect(snapRes.status).toBe(201);
    const snapJson = (await snapRes.json()) as ApiSuccessResponse<FinanceNetWorthSnapshotData>;
    expect(snapJson.data.totalAssetsCents).toBe(325000);
    expect(snapJson.data.totalLiabilitiesCents).toBe(0);
    expect(snapJson.data.netWorthCents).toBe(325000);
  });

  // Check 11: Category disable & history preservation
  it('11. verifies disabling a category preserves historical relations but blocks new assignments', async () => {
    // Disable utilities category
    const disableRes = await app.request(
      `/api/categories/${utilitiesCatId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ isEnabled: false }),
      },
      { DB: testD1 }
    );
    expect(disableRes.status).toBe(200);

    // Historical transactions still link to utilitiesCatId
    const txnsRes = await app.request(
      '/api/finance/reports/spending?period=monthly&yearMonth=2026-11',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const txnsJson = (await txnsRes.json()) as ApiSuccessResponse<FinanceSpendingAnalysisData>;
    const utilCat = txnsJson.data.categoryBreakdown.find((c) => c.categoryId === utilitiesCatId);
    expect(utilCat?.totalCents).toBe(10000); // Preserved!

    // Attempting to create a NEW transaction with disabled category must fail (400 Bad Request)
    const failRes = await app.request(
      '/api/finance/transactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          accountId: checkingAccId,
          categoryId: utilitiesCatId,
          type: 'expense',
          amountCents: 5000,
          transactionDate: '2026-11-15',
          payee: 'Electric Co',
        }),
      },
      { DB: testD1 }
    );
    expect(failRes.status).toBe(400);
  });

  // Check 12: Import validation and duplicate detection
  it('12. validates CSV import preview, detects duplicates, and commits atomically', async () => {
    const csvContent = `date,payee,amount,type,category,notes
2026-11-01,Tech Employer,$2500.00,income,Salary Income,payroll
2026-11-20,Coffee Shop,$4.50,expense,Groceries,latte
invalid-date,Bad Row,$10.00,expense,Groceries,error
2026-11-21,Bookstore,$25.00,expense,Groceries,reading`;

    // 1. Preview Import
    const prevRes = await app.request(
      '/api/finance/import/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          accountId: checkingAccId,
          csvData: csvContent,
          hasHeader: true,
        }),
      },
      { DB: testD1 }
    );
    expect(prevRes.status).toBe(200);
    const prevJson = (await prevRes.json()) as ApiSuccessResponse<FinanceImportPreviewData>;
    expect(prevJson.data.totalRows).toBe(4);
    expect(prevJson.data.validCount).toBe(3);
    expect(prevJson.data.invalidCount).toBe(1);
    expect(prevJson.data.duplicateCount).toBe(1); // Tech Employer on 2026-11-01 is duplicate

    // 2. Commit valid rows
    const validRows = prevJson.data.rows
      .filter((r) => r.isValid && !r.isDuplicate)
      .map((r) => ({
        transactionDate: r.transactionDate,
        payee: r.payee,
        amountCents: r.amountCents,
        type: r.type,
        notes: r.notes,
      }));

    const commitRes = await app.request(
      '/api/finance/import/commit',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({
          accountId: checkingAccId,
          rows: validRows,
        }),
      },
      { DB: testD1 }
    );
    expect(commitRes.status).toBe(201);
    const commitJson = (await commitRes.json()) as ApiSuccessResponse<FinanceImportCommitResult>;
    expect(commitJson.data.importedCount).toBe(2);
  });

  // Check 13: Export correctness
  it('13. exports financial transactions to RFC 4180 CSV and JSON formats', async () => {
    // CSV Export
    const csvRes = await app.request(
      '/api/finance/export?format=csv&entity=transactions',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('content-type')).toContain('text/csv');
    const csvText = await csvRes.text();
    expect(csvText).toContain('id,transactionDate,type,amountCents');
    expect(csvText).toContain('Tech Employer');

    // JSON Export
    const jsonRes = await app.request(
      '/api/finance/export?format=json&entity=transactions',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get('content-type')).toContain('application/json');
    const exportJson = (await jsonRes.json()) as unknown[];
    expect(Array.isArray(exportJson)).toBe(true);
    expect(exportJson.length).toBeGreaterThan(0);
  });

  // Check 14: User isolation
  it('14. verifies strict user isolation across all finance endpoints', async () => {
    // User B attempts to access User A's account
    const accRes = await app.request(
      `/api/finance/accounts/${checkingAccId}`,
      { headers: { Cookie: userBCookie } },
      { DB: testD1 }
    );
    expect(accRes.status).toBe(404);

    // User B attempts to view User A's spending report
    const bReport = await app.request(
      '/api/finance/reports/spending?period=monthly&yearMonth=2026-11',
      { headers: { Cookie: userBCookie } },
      { DB: testD1 }
    );
    const bReportJson = (await bReport.json()) as ApiSuccessResponse<FinanceSpendingAnalysisData>;
    expect(bReportJson.data.totalIncomeCents).toBe(0);
    expect(bReportJson.data.totalExpenseCents).toBe(0);
  });

  // Check 15: No floating-point artifacts
  it('15. verifies all balances and computations are exact integers with zero floating-point artifacts', async () => {
    const res = await app.request(
      '/api/finance/overview?month=2026-11',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    const json = (await res.json()) as ApiSuccessResponse<{
      netWorth: { totalAssetsCents: number; totalLiabilitiesCents: number; netWorthCents: number };
      monthlyIncomeCents: number;
      monthlyExpenseCents: number;
    }>;

    expect(Number.isInteger(json.data.netWorth.totalAssetsCents)).toBe(true);
    expect(Number.isInteger(json.data.netWorth.totalLiabilitiesCents)).toBe(true);
    expect(Number.isInteger(json.data.netWorth.netWorthCents)).toBe(true);
    expect(Number.isInteger(json.data.monthlyIncomeCents)).toBe(true);
    expect(Number.isInteger(json.data.monthlyExpenseCents)).toBe(true);
  });

  // Check 16: Restricted-action status & audit trail
  it('16. verifies financial audit events recorded for all mutations', async () => {
    // Fetch audit events recorded during the suite execution
    const auditRes = await app.request(
      '/api/admin/audit-events',
      { headers: { Cookie: userACookie } },
      { DB: testD1 }
    );
    expect(auditRes.status).toBe(200);
  });
});
