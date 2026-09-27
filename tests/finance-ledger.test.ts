import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculateBalanceDelta,
  reconcileAccountBalance,
  calculateNetWorth,
} from '../src/server/services/financeLedgerService';
import { createTestDatabase } from './test-db';
import { createDb } from '../src/server/db/client';
import { users, financeAccounts, financeTransactions, financeDebts } from '../src/server/db/schema';
import { hashPassword } from '../src/server/lib/crypto';

describe('Finance Ledger & Financial Integrity Suite', () => {
  describe('Balance Deltas & Minor Unit Arithmetic', () => {
    it('calculates positive delta for income in integer minor units (cents)', () => {
      // $123.45 is represented as 12345 cents
      const delta = calculateBalanceDelta('income', 12345);
      expect(delta).toBe(12345);
      expect(Number.isInteger(delta)).toBe(true);
    });

    it('calculates negative delta for expense in integer minor units (cents)', () => {
      // $54.20 is represented as 5420 cents
      const delta = calculateBalanceDelta('expense', 5420);
      expect(delta).toBe(-5420);
      expect(Number.isInteger(delta)).toBe(true);
    });

    it('throws error if transaction magnitude is negative', () => {
      expect(() => calculateBalanceDelta('income', -100)).toThrow();
    });
  });

  describe('Ledger Invariant & Reconciliation', () => {
    let testD1: D1Database;
    let disposeD1: () => Promise<void>;
    const userId = 'usr_ledger_tester';

    beforeAll(async () => {
      const { db, dispose } = await createTestDatabase();
      testD1 = db;
      disposeD1 = dispose;

      const orm = createDb(testD1);
      const { hash, salt } = await hashPassword('LedgerPass123!');
      await orm.insert(users).values({
        id: userId,
        email: 'ledger@test.com',
        name: 'Ledger Tester',
        passwordHash: hash,
        salt,
        role: 'user',
        status: 'active',
      });
    });

    afterAll(async () => {
      if (disposeD1) await disposeD1();
    });

    it('reconciles account balance to the exact sum of atomic ledger transactions', async () => {
      const orm = createDb(testD1);
      const accountId = 'acc_reconcile_1';
      const now = new Date();

      // 1. Create checking account with cached balance of 100000 ($1,000.00)
      await orm.insert(financeAccounts).values({
        id: accountId,
        userId,
        name: 'Main Checking',
        type: 'checking',
        currency: 'USD',
        balanceCents: 100000,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Add income of $500.00 (50000 cents)
      await orm.insert(financeTransactions).values({
        id: 'txn_rec_1',
        userId,
        accountId,
        type: 'income',
        amountCents: 50000,
        transactionDate: '2026-10-01',
        timestampMs: now,
        isReconciled: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 3. Add expense of $200.00 (20000 cents)
      await orm.insert(financeTransactions).values({
        id: 'txn_rec_2',
        userId,
        accountId,
        type: 'expense',
        amountCents: 20000,
        transactionDate: '2026-10-02',
        timestampMs: now,
        isReconciled: 1,
        createdAt: now,
        updatedAt: now,
      });

      // Ledger sum = 50000 - 20000 = 30000 ($300.00)
      // Cached was 100000 (drift)
      const recon = await reconcileAccountBalance(testD1, accountId, userId);
      expect(recon.matchesCached).toBe(false);
      expect(recon.reconciledBalanceCents).toBe(30000);

      // Re-running reconciliation now matches
      const recon2 = await reconcileAccountBalance(testD1, accountId, userId);
      expect(recon2.matchesCached).toBe(true);
      expect(recon2.reconciledBalanceCents).toBe(30000);
    });

    it('aggregates net worth correctly across assets, liabilities, and debts', async () => {
      const orm = createDb(testD1);
      const now = new Date();

      // Asset account: Savings = $5,000.00 (500000 cents)
      await orm.insert(financeAccounts).values({
        id: 'acc_savings_nw',
        userId,
        name: 'Emergency Savings',
        type: 'savings',
        currency: 'USD',
        balanceCents: 500000,
        createdAt: now,
        updatedAt: now,
      });

      // Liability account: Credit card = -$1,200.00 (-120000 cents)
      await orm.insert(financeAccounts).values({
        id: 'acc_credit_nw',
        userId,
        name: 'Credit Card',
        type: 'credit',
        currency: 'USD',
        balanceCents: -120000,
        createdAt: now,
        updatedAt: now,
      });

      // Standalone debt: Student Loan = $2,000.00 (200000 cents)
      await orm.insert(financeDebts).values({
        id: 'dbt_student_nw',
        userId,
        name: 'Student Loan',
        creditor: 'Dept of Education',
        totalOwedCents: 200000,
        interestRateBps: 550,
        minimumPaymentCents: 15000,
        isPaidOff: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Expected:
      // Assets = Checking ($300.00) + Savings ($5,000.00) = $5,300.00 (530000 cents)
      // Liabilities = Credit Card ($1,200.00) + Loan ($2,000.00) = $3,200.00 (320000 cents)
      // Net Worth = $5,300.00 - $3,200.00 = $2,100.00 (210000 cents)
      const nw = await calculateNetWorth(testD1, userId, '2026-10-15');
      expect(nw.totalAssetsCents).toBe(530000);
      expect(nw.totalLiabilitiesCents).toBe(320000);
      expect(nw.netWorthCents).toBe(210000);
    });
  });
});
