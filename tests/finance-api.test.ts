import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import type {
  ApiSuccessResponse,
  FinanceAccountData,
  FinanceTransactionData,
  FinanceBudgetData,
  FinanceDebtData,
  FinanceOverviewData,
  CategoryData,
} from '../src/shared/types';

describe('Personal Finance Engine API Suite', () => {
  let testD1: D1Database;
  let disposeD1: () => Promise<void>;
  let userACookie: string;
  let userBCookie: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeD1 = dispose;

    // Bootstrap User A
    const resA = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Finance User A',
          email: 'financea@example.com',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookieA = resA.headers.get('set-cookie');
    userACookie = setCookieA?.split(';')[0] || '';

    // Create invite for User B
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: userACookie,
        },
        body: JSON.stringify({
          email: 'financeb@example.com',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<{ code: string }>;

    // Register User B
    const resB = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteJson.data.code,
          name: 'Finance User B',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookieB = resB.headers.get('set-cookie');
    userBCookie = setCookieB?.split(';')[0] || '';
  });

  afterAll(async () => {
    if (disposeD1) await disposeD1();
  });

  describe('Accounts & Balances API', () => {
    let checkingId: string;
    let savingsId: string;

    it('creates checking and savings accounts in integer minor units (cents)', async () => {
      // Create Checking ($0 initial balance)
      const res1 = await app.request(
        '/api/finance/accounts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Primary Checking',
            type: 'checking',
            currency: 'USD',
            initialBalanceCents: 0,
            color: '#3b82f6',
          }),
        },
        { DB: testD1 }
      );

      expect(res1.status).toBe(201);
      const json1 = (await res1.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(json1.success).toBe(true);
      expect(json1.data.name).toBe('Primary Checking');
      expect(json1.data.balanceCents).toBe(0);
      checkingId = json1.data.id;

      // Create Savings with initial balance of $500.00 (50000 cents)
      const res2 = await app.request(
        '/api/finance/accounts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'High Yield Savings',
            type: 'savings',
            currency: 'USD',
            initialBalanceCents: 50000,
            color: '#10b981',
          }),
        },
        { DB: testD1 }
      );

      expect(res2.status).toBe(201);
      const json2 = (await res2.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(json2.data.balanceCents).toBe(50000);
      savingsId = json2.data.id;
      expect(savingsId).toBeDefined();
    });

    it('enforces isolation: User B cannot view User A accounts', async () => {
      const res = await app.request(
        `/api/finance/accounts/${checkingId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('Ledger Transactions & Atomic Transfers API', () => {
    let checkingId: string;
    let savingsId: string;
    let expenseTxnId: string;

    beforeAll(async () => {
      // Retrieve account IDs
      const listRes = await app.request(
        '/api/finance/accounts',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const listJson = (await listRes.json()) as ApiSuccessResponse<FinanceAccountData[]>;
      checkingId = listJson.data.find((a) => a.type === 'checking')?.id || '';
      savingsId = listJson.data.find((a) => a.type === 'savings')?.id || '';
    });

    it('posts income and updates account balance atomically', async () => {
      // Income: +$1,000.00 (100000 cents)
      const res = await app.request(
        '/api/finance/transactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            accountId: checkingId,
            type: 'income',
            amountCents: 100000,
            transactionDate: '2026-10-15',
            payee: 'Acme Corp Payroll',
            notes: 'Biweekly salary direct deposit',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<FinanceTransactionData>;
      expect(json.success).toBe(true);
      expect(json.data.amountCents).toBe(100000);

      // Verify checking account balance is now 100000
      const accRes = await app.request(
        `/api/finance/accounts/${checkingId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const accJson = (await accRes.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(accJson.data.balanceCents).toBe(100000);
    });

    it('posts expense and updates account balance atomically', async () => {
      // Expense: -$250.00 (25000 cents)
      const res = await app.request(
        '/api/finance/transactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            accountId: checkingId,
            type: 'expense',
            amountCents: 25000,
            transactionDate: '2026-10-16',
            payee: 'Whole Foods Market',
            notes: 'Groceries',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<FinanceTransactionData>;
      expect(json.data.amountCents).toBe(25000);
      expenseTxnId = json.data.id;

      // Checking balance should be 100000 - 25000 = 75000 ($750.00)
      const accRes = await app.request(
        `/api/finance/accounts/${checkingId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const accJson = (await accRes.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(accJson.data.balanceCents).toBe(75000);
    });

    it('transfers funds atomically between checking and savings', async () => {
      // Transfer $200.00 (20000 cents) from Checking to Savings
      const res = await app.request(
        '/api/finance/transactions/transfer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            fromAccountId: checkingId,
            toAccountId: savingsId,
            amountCents: 20000,
            transactionDate: '2026-10-17',
            payee: 'Emergency Fund Transfer',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);

      // Checking was 75000 -> now 55000 ($550.00)
      const chkRes = await app.request(
        `/api/finance/accounts/${checkingId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const chkJson = (await chkRes.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(chkJson.data.balanceCents).toBe(55000);

      // Savings was 50000 -> now 70000 ($700.00)
      const savRes = await app.request(
        `/api/finance/accounts/${savingsId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const savJson = (await savRes.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(savJson.data.balanceCents).toBe(70000);
    });

    it('deletes transaction and reverses account balance impact accurately', async () => {
      // Delete the $250.00 expense
      const delRes = await app.request(
        `/api/finance/transactions/${expenseTxnId}`,
        {
          method: 'DELETE',
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      expect(delRes.status).toBe(200);

      // Checking balance reverses: 55000 + 25000 = 80000 ($800.00)
      const chkRes = await app.request(
        `/api/finance/accounts/${checkingId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const chkJson = (await chkRes.json()) as ApiSuccessResponse<FinanceAccountData>;
      expect(chkJson.data.balanceCents).toBe(80000);
    });
  });

  describe('Budgets API', () => {
    let diningCatId: string;
    let checkingId: string;

    beforeAll(async () => {
      // Create dining category in finance domain
      const catRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Dining & Restaurants',
            domain: 'finance',
            color: '#f59e0b',
          }),
        },
        { DB: testD1 }
      );
      const catJson = (await catRes.json()) as ApiSuccessResponse<CategoryData>;
      diningCatId = catJson.data.id;

      // Get checking account
      const accRes = await app.request(
        '/api/finance/accounts',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const accJson = (await accRes.json()) as ApiSuccessResponse<FinanceAccountData[]>;
      checkingId = accJson.data[0].id;
    });

    it('creates monthly category budget and tracks spending consumption', async () => {
      const yearMonth = '2026-10';

      // 1. Create budget: $400.00 (40000 cents)
      const res1 = await app.request(
        '/api/finance/budgets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            categoryId: diningCatId,
            period: 'monthly',
            yearMonth,
            amountCents: 40000,
          }),
        },
        { DB: testD1 }
      );

      expect(res1.status).toBe(201);
      const json1 = (await res1.json()) as ApiSuccessResponse<FinanceBudgetData>;
      expect(json1.data.amountCents).toBe(40000);

      // 2. Post expense in this category: $100.00 (10000 cents)
      await app.request(
        '/api/finance/transactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            accountId: checkingId,
            categoryId: diningCatId,
            type: 'expense',
            amountCents: 10000,
            transactionDate: '2026-10-18',
            payee: 'Local Bistro',
          }),
        },
        { DB: testD1 }
      );

      // 3. Query budgets for 2026-10: should report 10000 spent, 30000 remaining, 25% used
      const queryRes = await app.request(
        `/api/finance/budgets?yearMonth=${yearMonth}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      expect(queryRes.status).toBe(200);
      const queryJson = (await queryRes.json()) as ApiSuccessResponse<FinanceBudgetData[]>;
      const budget = queryJson.data.find((b) => b.categoryId === diningCatId);
      expect(budget).toBeDefined();
      expect(budget?.spentCents).toBe(10000);
      expect(budget?.remainingCents).toBe(30000);
      expect(budget?.percentageUsed).toBe(25);
    });
  });

  describe('Debts & Payoff API', () => {
    let debtId: string;

    it('creates a debt and records payoff payments until fully retired', async () => {
      // 1. Create debt: Credit Card balance of $1,000.00 (100000 cents) at 19.99% (1999 bps)
      const res1 = await app.request(
        '/api/finance/debts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Visa Platinum Card',
            creditor: 'First National Bank',
            totalOwedCents: 100000,
            interestRateBps: 1999,
            minimumPaymentCents: 3500,
            targetPayoffDate: '2027-04-30',
          }),
        },
        { DB: testD1 }
      );

      expect(res1.status).toBe(201);
      const json1 = (await res1.json()) as ApiSuccessResponse<FinanceDebtData>;
      expect(json1.data.totalOwedCents).toBe(100000);
      expect(json1.data.isPaidOff).toBe(false);
      debtId = json1.data.id;

      // 2. Make payment 1: $400.00 ($350 principal, $50 interest)
      const pay1Res = await app.request(
        `/api/finance/debts/${debtId}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            date: '2026-10-19',
            amountCents: 40000,
            principalCents: 35000,
            interestCents: 5000,
            notes: 'Extra principal contribution',
          }),
        },
        { DB: testD1 }
      );
      expect(pay1Res.status).toBe(201);

      // Verify debt balance reduced: 100000 - 35000 = 65000 ($650.00)
      const debtCheck1 = await app.request(
        `/api/finance/debts/${debtId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const debtJson1 = (await debtCheck1.json()) as ApiSuccessResponse<FinanceDebtData>;
      expect(debtJson1.data.remainingBalanceCents).toBe(65000);
      expect(debtJson1.data.isPaidOff).toBe(false);

      // 3. Make final payment of $650.00 principal
      const pay2Res = await app.request(
        `/api/finance/debts/${debtId}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            date: '2026-10-20',
            amountCents: 65000,
            principalCents: 65000,
            notes: 'Final debt payoff!',
          }),
        },
        { DB: testD1 }
      );
      expect(pay2Res.status).toBe(201);

      // Verify debt is now 0 and isPaidOff is true
      const debtCheck2 = await app.request(
        `/api/finance/debts/${debtId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const debtJson2 = (await debtCheck2.json()) as ApiSuccessResponse<FinanceDebtData>;
      expect(debtJson2.data.remainingBalanceCents).toBe(0);
      expect(debtJson2.data.isPaidOff).toBe(true);
    });
  });

  describe('Finance Overview & Net Worth API', () => {
    it('aggregates net worth, cashflow, savings rate, and active items in a unified payload', async () => {
      const res = await app.request(
        '/api/finance/overview?month=2026-10',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<FinanceOverviewData>;
      expect(json.success).toBe(true);
      expect(json.data.netWorth).toBeDefined();
      expect(json.data.netWorth.netWorthCents).toBeGreaterThan(0);
      expect(json.data.monthlyIncomeCents).toBeGreaterThanOrEqual(100000);
      expect(json.data.monthlyExpenseCents).toBeGreaterThanOrEqual(10000);
      expect(json.data.monthlySavingsRatePercentage).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(json.data.activeBudgets)).toBe(true);
      expect(Array.isArray(json.data.activeDebts)).toBe(true);
    });
  });
});
