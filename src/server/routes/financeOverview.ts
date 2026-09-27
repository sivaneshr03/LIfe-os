import { Hono } from 'hono';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { createDb } from '../db/client';
import {
  financeTransactions,
  financeTransactionSplits,
  financeBudgets,
  financeDebts,
  financeDebtPayments,
  financeContacts,
  userPreferences,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { calculateNetWorth } from '../services/financeLedgerService';
import { getTodayCalendarDate } from '../../shared/utils/date';
import type {
  ApiSuccessResponse,
  FinanceOverviewData,
  FinanceBudgetData,
  FinanceDebtData,
  BudgetPeriod,
} from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeOverviewRouter = new Hono<{ Bindings: AppBindings }>();

financeOverviewRouter.use('*', requireAuth);

/**
 * GET /api/finance/overview
 * Composite dashboard: Net Worth, monthly cashflow, savings rate, active budgets, active debts, and contacts summary.
 */
financeOverviewRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const prefs = (
    await db
      .select({ timezone: userPreferences.timezone, currency: userPreferences.baseCurrency })
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
  )[0];

  const today = getTodayCalendarDate(prefs?.timezone || 'UTC');
  const currentMonth = today.slice(0, 7);
  const queryMonth = c.req.query('month');
  const targetMonth = queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : currentMonth;
  const baseCurrency = prefs?.currency || 'INR';

  // 1. Calculate Net Worth
  const netWorth = await calculateNetWorth(c.env.DB, user.id, today, baseCurrency);

  // 2. Calculate Monthly Cashflow (Income & Expense in target month, excluding transfers)
  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-31`;

  const cashflowRes = await db
    .select({
      type: financeTransactions.type,
      total: sql<number>`sum(${financeTransactions.amountCents})`,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.userId, user.id),
        gte(financeTransactions.transactionDate, startDate),
        lte(financeTransactions.transactionDate, endDate)
      )
    )
    .groupBy(financeTransactions.type);

  let monthlyIncomeCents = 0;
  let monthlyExpenseCents = 0;

  for (const row of cashflowRes) {
    if (row.type === 'income') {
      monthlyIncomeCents = Number(row.total || 0);
    } else if (row.type === 'expense') {
      monthlyExpenseCents = Number(row.total || 0);
    }
  }

  const monthlySavingsRatePercentage =
    monthlyIncomeCents > 0
      ? Math.max(0, Math.round(((monthlyIncomeCents - monthlyExpenseCents) / monthlyIncomeCents) * 100))
      : 0;

  // 3. Active Budgets for target month (with split awareness)
  const budgetRows = await db
    .select()
    .from(financeBudgets)
    .where(and(eq(financeBudgets.userId, user.id), eq(financeBudgets.yearMonth, targetMonth)))
    .limit(10);

  const activeBudgets: FinanceBudgetData[] = [];
  for (const b of budgetRows) {
    const directSpentRes = await db
      .select({ total: sql<number>`coalesce(sum(amount_cents), 0)` })
      .from(financeTransactions)
      .where(
        and(
          eq(financeTransactions.userId, user.id),
          eq(financeTransactions.categoryId, b.categoryId),
          eq(financeTransactions.type, 'expense'),
          eq(financeTransactions.hasSplits, 0),
          gte(financeTransactions.transactionDate, startDate),
          lte(financeTransactions.transactionDate, endDate)
        )
      );

    const splitSpentRes = await db
      .select({ total: sql<number>`coalesce(sum(${financeTransactionSplits.amountCents}), 0)` })
      .from(financeTransactionSplits)
      .innerJoin(financeTransactions, eq(financeTransactionSplits.transactionId, financeTransactions.id))
      .where(
        and(
          eq(financeTransactionSplits.userId, user.id),
          eq(financeTransactionSplits.categoryId, b.categoryId),
          eq(financeTransactions.type, 'expense'),
          gte(financeTransactions.transactionDate, startDate),
          lte(financeTransactions.transactionDate, endDate)
        )
      );

    const spentCents =
      Number(directSpentRes[0]?.total || 0) + Number(splitSpentRes[0]?.total || 0);
    const remainingCents = b.amountCents - spentCents;
    const percentageUsed = b.amountCents > 0 ? Math.round((spentCents / b.amountCents) * 100) : 0;

    activeBudgets.push({
      id: b.id,
      userId: b.userId,
      categoryId: b.categoryId,
      period: b.period as BudgetPeriod,
      yearMonth: b.yearMonth,
      amountCents: b.amountCents,
      spentCents,
      remainingCents,
      percentageUsed,
      rollover: Boolean(b.rollover),
      notes: b.notes,
      createdAt: b.createdAt.getTime(),
      updatedAt: b.updatedAt.getTime(),
    });
  }

  // 4. Active Debts with remaining balances
  const debtRows = await db
    .select()
    .from(financeDebts)
    .where(and(eq(financeDebts.userId, user.id), eq(financeDebts.isPaidOff, 0)))
    .orderBy(financeDebts.totalOwedCents)
    .limit(10);

  const activeDebts: FinanceDebtData[] = [];
  for (const d of debtRows) {
    const paidRes = await db
      .select({ totalPaid: sql<number>`coalesce(sum(${financeDebtPayments.principalCents}), 0)` })
      .from(financeDebtPayments)
      .where(and(eq(financeDebtPayments.debtId, d.id), eq(financeDebtPayments.userId, user.id)));

    const totalPaid = Number(paidRes[0]?.totalPaid || 0);
    const remainingBalanceCents = Math.max(0, d.totalOwedCents - totalPaid);

    activeDebts.push({
      id: d.id,
      userId: d.userId,
      accountId: d.accountId,
      contactId: d.contactId,
      debtType: d.debtType,
      name: d.name,
      creditor: d.creditor,
      totalOwedCents: d.totalOwedCents,
      remainingBalanceCents,
      totalPaidCents: totalPaid,
      interestRateBps: d.interestRateBps,
      minimumPaymentCents: d.minimumPaymentCents,
      dueDate: d.dueDate,
      targetPayoffDate: d.targetPayoffDate,
      isPaidOff: false,
      isOverdue: Boolean(d.dueDate && d.dueDate < today && remainingBalanceCents > 0),
      notes: d.notes,
      createdAt: d.createdAt.getTime(),
      updatedAt: d.updatedAt.getTime(),
    });
  }

  // 5. Contacts Summary
  const contacts = await db
    .select()
    .from(financeContacts)
    .where(eq(financeContacts.userId, user.id));

  let totalLentCents = 0;
  let totalBorrowedCents = 0;

  const allDebts = await db
    .select()
    .from(financeDebts)
    .where(eq(financeDebts.userId, user.id));

  for (const d of allDebts) {
    if (d.contactId) {
      const paidRes = await db
        .select({ totalPaid: sql<number>`coalesce(sum(${financeDebtPayments.principalCents}), 0)` })
        .from(financeDebtPayments)
        .where(eq(financeDebtPayments.debtId, d.id));

      const totalPaid = Number(paidRes[0]?.totalPaid || 0);
      const remaining = Math.max(0, d.totalOwedCents - totalPaid);

      if (d.debtType === 'money_given') {
        totalLentCents += remaining;
      } else {
        totalBorrowedCents += remaining;
      }
    }
  }

  const data: FinanceOverviewData = {
    netWorth,
    monthlyIncomeCents,
    monthlyExpenseCents,
    monthlySavingsRatePercentage,
    activeBudgets,
    activeDebts,
    contactsSummary: {
      totalContacts: contacts.length,
      totalLentCents,
      totalBorrowedCents,
    },
  };

  return c.json<ApiSuccessResponse<FinanceOverviewData>>({ success: true, data });
});
