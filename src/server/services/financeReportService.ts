import { eq, and, sql, gte, lte } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import {
  financeTransactions,
  financeTransactionSplits,
  categories,
} from '../db/schema';
import type {
  FinanceSpendingAnalysisData,
  FinanceSpendingCategoryBreakdown,
  FinanceTopPayee,
  FinanceTimeTrendPoint,
  BudgetPeriod,
} from '../../shared/financeTypes';

/**
 * Generates spending analysis, category distributions, savings rates, and top payees for a given period.
 * Transfers are strictly excluded from income/expense calculations.
 * Split transactions allocate their amounts to their respective categories.
 */
export async function generateSpendingReport(
  d1: D1Database,
  userId: string,
  period: BudgetPeriod = 'monthly',
  yearMonth?: string,
  year?: string
): Promise<FinanceSpendingAnalysisData> {
  const db = createDb(d1);

  let startDate: string;
  let endDate: string;

  if (period === 'monthly') {
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    startDate = `${ym}-01`;
    endDate = `${ym}-31`;
  } else {
    const y = year || (yearMonth ? yearMonth.slice(0, 4) : new Date().getFullYear().toString());
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31`;
  }

  // 1. Fetch non-transfer transactions in date range
  const txns = await db
    .select({
      id: financeTransactions.id,
      categoryId: financeTransactions.categoryId,
      type: financeTransactions.type,
      amountCents: financeTransactions.amountCents,
      transactionDate: financeTransactions.transactionDate,
      payee: financeTransactions.payee,
      hasSplits: financeTransactions.hasSplits,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.userId, userId),
        gte(financeTransactions.transactionDate, startDate),
        lte(financeTransactions.transactionDate, endDate)
      )
    );

  // 2. Fetch splits for transactions with splits
  const splitTxnIds = txns.filter((t) => t.hasSplits === 1).map((t) => t.id);
  const splitsByTxnId: Record<
    string,
    Array<{ categoryId: string | null; amountCents: number }>
  > = {};

  if (splitTxnIds.length > 0) {
    const splits = await db
      .select({
        transactionId: financeTransactionSplits.transactionId,
        categoryId: financeTransactionSplits.categoryId,
        amountCents: financeTransactionSplits.amountCents,
      })
      .from(financeTransactionSplits)
      .where(
        and(
          eq(financeTransactionSplits.userId, userId),
          sql`${financeTransactionSplits.transactionId} IN (${sql.join(
            splitTxnIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      );

    for (const s of splits) {
      if (!splitsByTxnId[s.transactionId]) splitsByTxnId[s.transactionId] = [];
      splitsByTxnId[s.transactionId].push({
        categoryId: s.categoryId,
        amountCents: s.amountCents,
      });
    }
  }

  // 3. Fetch all user categories for names & colors
  const userCats = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.domain, 'finance')));

  const catMap = new Map<string, { name: string; color?: string | null; icon?: string | null }>();
  for (const c of userCats) {
    catMap.set(c.id, { name: c.name, color: c.color, icon: c.icon });
  }

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;

  const categorySpendingMap = new Map<
    string,
    { totalCents: number; count: number; name: string; color?: string | null; icon?: string | null }
  >();

  const payeeMap = new Map<string, { totalCents: number; count: number }>();
  const trendMap = new Map<string, { incomeCents: number; expenseCents: number }>();

  for (const t of txns) {
    if (t.type === 'transfer') {
      // Directives mandate: transfers must NOT count as income or expense
      continue;
    }

    const periodKey = period === 'monthly' ? t.transactionDate : t.transactionDate.slice(0, 7);
    if (!trendMap.has(periodKey)) {
      trendMap.set(periodKey, { incomeCents: 0, expenseCents: 0 });
    }
    const trendPoint = trendMap.get(periodKey)!;

    if (t.type === 'income') {
      totalIncomeCents += t.amountCents;
      trendPoint.incomeCents += t.amountCents;
    } else if (t.type === 'expense') {
      totalExpenseCents += t.amountCents;
      trendPoint.expenseCents += t.amountCents;

      // Top payees aggregation
      const payeeName = (t.payee || 'Unspecified Payee').trim();
      const currentPayee = payeeMap.get(payeeName) || { totalCents: 0, count: 0 };
      currentPayee.totalCents += t.amountCents;
      currentPayee.count += 1;
      payeeMap.set(payeeName, currentPayee);

      // Category spending breakdown (with splits allocation)
      if (t.hasSplits === 1 && splitsByTxnId[t.id]) {
        for (const split of splitsByTxnId[t.id]) {
          const catId = split.categoryId || 'uncategorized';
          const catMeta = catMap.get(catId);
          const name = catMeta ? catMeta.name : catId === 'uncategorized' ? 'Uncategorized' : 'Other';

          const cur = categorySpendingMap.get(catId) || {
            totalCents: 0,
            count: 0,
            name,
            color: catMeta?.color,
            icon: catMeta?.icon,
          };
          cur.totalCents += split.amountCents;
          cur.count += 1;
          categorySpendingMap.set(catId, cur);
        }
      } else {
        const catId = t.categoryId || 'uncategorized';
        const catMeta = catMap.get(catId);
        const name = catMeta ? catMeta.name : catId === 'uncategorized' ? 'Uncategorized' : 'Other';

        const cur = categorySpendingMap.get(catId) || {
          totalCents: 0,
          count: 0,
          name,
          color: catMeta?.color,
          icon: catMeta?.icon,
        };
        cur.totalCents += t.amountCents;
        cur.count += 1;
        categorySpendingMap.set(catId, cur);
      }
    }
  }

  // Calculate Net Savings and Savings Rate
  const netSavingsCents = totalIncomeCents - totalExpenseCents;
  const savingsRatePercentage =
    totalIncomeCents > 0
      ? Math.max(0, Math.round(((totalIncomeCents - totalExpenseCents) / totalIncomeCents) * 100))
      : 0;

  // Build category breakdown array with percentages
  const categoryBreakdown: FinanceSpendingCategoryBreakdown[] = Array.from(
    categorySpendingMap.entries()
  )
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      color: data.color,
      icon: data.icon,
      totalCents: data.totalCents,
      percentageOfExpense:
        totalExpenseCents > 0 ? Math.round((data.totalCents / totalExpenseCents) * 100) : 0,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  // Build top payees array
  const topPayees: FinanceTopPayee[] = Array.from(payeeMap.entries())
    .map(([payee, data]) => ({
      payee,
      totalCents: data.totalCents,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  // Build time trend array
  const trend: FinanceTimeTrendPoint[] = Array.from(trendMap.entries())
    .map(([periodKey, data]) => {
      const netCents = data.incomeCents - data.expenseCents;
      const savingsRate =
        data.incomeCents > 0 ? Math.round((netCents / data.incomeCents) * 100) : 0;
      return {
        periodKey,
        incomeCents: data.incomeCents,
        expenseCents: data.expenseCents,
        netCents,
        savingsRatePercentage: Math.max(0, savingsRate),
      };
    })
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  return {
    period,
    yearMonth: period === 'monthly' ? yearMonth || startDate.slice(0, 7) : undefined,
    year: period === 'yearly' ? year || startDate.slice(0, 4) : undefined,
    totalIncomeCents,
    totalExpenseCents,
    netSavingsCents,
    savingsRatePercentage,
    categoryBreakdown,
    topPayees,
    trend,
  };
}
