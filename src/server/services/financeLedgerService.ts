import { eq, and, sql, desc } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import {
  financeAccounts,
  financeTransactions,
  financeDebts,
  financeNetWorthSnapshots,
  investmentAssets,
  activityEvents,
  categories,
} from '../db/schema';
import { calculateHoldingMarketValue } from '../../shared/utils/investment';
import type {
  FinanceTransactionType,
  NetWorthOverviewData,
  FinanceAccountType,
  FinanceNetWorthSnapshotData,
} from '../../shared/financeTypes';

/**
 * Calculates the balance impact of a transaction on an account.
 * Income increases balance (+), Expense decreases balance (-).
 */
export function calculateBalanceDelta(type: FinanceTransactionType, amountCents: number): number {
  if (amountCents < 0) {
    throw new Error('Transaction magnitude must be positive');
  }
  if (type === 'income') return amountCents;
  if (type === 'expense') return -amountCents;
  return 0; // Transfers handled symmetrically with from/to
}

/**
 * Verifies if a category ID is valid, active (isEnabled === 1), and belongs to the 'finance' domain.
 */
export async function validateActiveFinanceCategory(
  d1: D1Database,
  categoryId: string | null | undefined,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  if (!categoryId) return { valid: true };

  const db = createDb(d1);
  const cat = (
    await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1)
  )[0];

  if (!cat) {
    return { valid: false, error: 'Category not found or does not belong to user' };
  }

  if (cat.domain !== 'finance') {
    return { valid: false, error: 'Category must belong to the finance domain' };
  }

  if (cat.isEnabled === 0) {
    return { valid: false, error: 'Disabled categories cannot be assigned to new or edited records' };
  }

  return { valid: true };
}

/**
 * Records an audit / activity log for financial actions.
 */
export async function recordFinanceAuditEvent(
  d1: D1Database,
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = createDb(d1);
  const id = `act_${crypto.randomUUID()}`;
  await db.insert(activityEvents).values({
    id,
    userId,
    domain: 'finance',
    entityType,
    entityId,
    action,
    summary: `${action.toUpperCase()} ${entityType} ${entityId}`,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(),
  });
}

/**
 * Reconciles an account balance against the atomic sum of its ledger transactions.
 */
export async function reconcileAccountBalance(
  d1: D1Database,
  accountId: string,
  userId: string
): Promise<{ reconciledBalanceCents: number; matchesCached: boolean }> {
  const db = createDb(d1);

  const account = (
    await db
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, userId)))
      .limit(1)
  )[0];

  if (!account) {
    throw new Error(`Account ${accountId} not found for user ${userId}`);
  }

  // Sum transactions for this account
  const txns = await db
    .select({
      type: financeTransactions.type,
      amountCents: financeTransactions.amountCents,
      transferAccountId: financeTransactions.transferAccountId,
      accountId: financeTransactions.accountId,
    })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.accountId, accountId), eq(financeTransactions.userId, userId)));

  let ledgerSum = 0;
  for (const t of txns) {
    if (t.type === 'income') {
      ledgerSum += t.amountCents;
    } else if (t.type === 'expense') {
      ledgerSum -= t.amountCents;
    } else if (t.type === 'transfer') {
      // Outgoing transfer from this account
      ledgerSum -= t.amountCents;
    }
  }

  // Also include incoming transfers where transferAccountId == accountId
  const incomingTransfers = await db
    .select({ amountCents: financeTransactions.amountCents })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.transferAccountId, accountId),
        eq(financeTransactions.userId, userId)
      )
    );

  for (const inc of incomingTransfers) {
    ledgerSum += inc.amountCents;
  }

  const matchesCached = account.balanceCents === ledgerSum;

  if (!matchesCached) {
    // Correct cached balance to match ledger truth
    await db
      .update(financeAccounts)
      .set({ balanceCents: ledgerSum, updatedAt: new Date() })
      .where(eq(financeAccounts.id, accountId));

    await recordFinanceAuditEvent(d1, userId, 'finance_account', accountId, 'reconcile', {
      previousBalanceCents: account.balanceCents,
      reconciledBalanceCents: ledgerSum,
    });
  }

  return {
    reconciledBalanceCents: ledgerSum,
    matchesCached,
  };
}

/**
 * Calculates user's net worth across all accounts, debts, and money given/borrowed.
 */
export async function calculateNetWorth(
  d1: D1Database,
  userId: string,
  asOfDate: string,
  baseCurrency: string = 'INR'
): Promise<NetWorthOverviewData> {
  const db = createDb(d1);

  const accounts = await db
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.userId, userId), eq(financeAccounts.isArchived, 0)));

  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;

  const breakdown: NetWorthOverviewData['accountBreakdown'] = [];

  for (const acc of accounts) {
    const isLiabilityType = acc.type === 'credit' || acc.type === 'loan';
    const isAsset = !isLiabilityType;

    if (isAsset) {
      if (acc.balanceCents >= 0) {
        totalAssetsCents += acc.balanceCents;
      } else {
        // Negative balance in asset account counts as liability (overdraft)
        totalLiabilitiesCents += Math.abs(acc.balanceCents);
      }
    } else {
      // Liability account (credit card, loan)
      if (acc.balanceCents < 0) {
        totalLiabilitiesCents += Math.abs(acc.balanceCents);
      } else {
        totalLiabilitiesCents += acc.balanceCents;
      }
    }

    breakdown.push({
      id: acc.id,
      name: acc.name,
      type: acc.type as FinanceAccountType,
      balanceCents: acc.balanceCents,
      isAsset,
    });
  }

  // Include active standalone debts not linked to existing accounts
  const standaloneDebts = await db
    .select()
    .from(financeDebts)
    .where(
      and(
        eq(financeDebts.userId, userId),
        eq(financeDebts.isPaidOff, 0),
        sql`${financeDebts.accountId} IS NULL`
      )
    );

  for (const d of standaloneDebts) {
    if (d.debtType === 'money_given') {
      // Money given/lent to others is an asset (receivable)
      totalAssetsCents += d.totalOwedCents;
      breakdown.push({
        id: d.id,
        name: d.name,
        type: 'other',
        balanceCents: d.totalOwedCents,
        isAsset: true,
      });
    } else {
      // Standard debt / money borrowed is a liability
      totalLiabilitiesCents += d.totalOwedCents;
      breakdown.push({
        id: d.id,
        name: d.name,
        type: 'loan',
        balanceCents: -d.totalOwedCents,
        isAsset: false,
      });
    }
  }

  // Include investment holdings market valuation
  const holdings = await db
    .select()
    .from(investmentAssets)
    .where(eq(investmentAssets.userId, userId));

  for (const h of holdings) {
    const marketValueCents = calculateHoldingMarketValue(h.unitsMicro, h.latestPriceCents);
    if (marketValueCents > 0) {
      totalAssetsCents += marketValueCents;
      breakdown.push({
        id: h.id,
        name: `${h.symbol} - ${h.name}`,
        type: 'investment',
        balanceCents: marketValueCents,
        isAsset: true,
      });
    }
  }

  const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

  // Retrieve recent monthly snapshots
  const snapshots = await db
    .select()
    .from(financeNetWorthSnapshots)
    .where(eq(financeNetWorthSnapshots.userId, userId))
    .orderBy(desc(financeNetWorthSnapshots.yearMonth))
    .limit(12);

  const recentSnapshots: FinanceNetWorthSnapshotData[] = snapshots.map((s) => ({
    id: s.id,
    userId: s.userId,
    yearMonth: s.yearMonth,
    totalAssetsCents: s.totalAssetsCents,
    totalLiabilitiesCents: s.totalLiabilitiesCents,
    netWorthCents: s.netWorthCents,
    currency: s.currency,
    notes: s.notes,
    createdAt: s.createdAt.getTime(),
  }));

  return {
    totalAssetsCents,
    totalLiabilitiesCents,
    netWorthCents,
    baseCurrency,
    asOfDate,
    accountBreakdown: breakdown,
    recentSnapshots,
  };
}
