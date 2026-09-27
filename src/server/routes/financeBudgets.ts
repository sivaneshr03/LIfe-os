import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import {
  financeBudgets,
  financeTransactions,
  financeTransactionSplits,
  categories,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  financeBudgetCreateSchema,
  financeBudgetUpdateSchema,
} from '../../shared/schemas/finance';
import {
  validateActiveFinanceCategory,
  recordFinanceAuditEvent,
} from '../services/financeLedgerService';
import type { ApiSuccessResponse, FinanceBudgetData } from '../../shared/types';
import type { AppBindings } from '../index';

export const financeBudgetsRouter = new Hono<{ Bindings: AppBindings }>();

financeBudgetsRouter.use('*', requireAuth);

/**
 * GET /api/finance/budgets
 * List user's budgets for a given yearMonth period with live spent aggregation.
 */
financeBudgetsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      yearMonth: z.string().optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { yearMonth } = c.req.valid('query');

    const conditions = [eq(financeBudgets.userId, user.id)];
    if (yearMonth) {
      conditions.push(eq(financeBudgets.yearMonth, yearMonth));
    }

    const rows = await db
      .select({
        budget: financeBudgets,
        categoryName: categories.name,
      })
      .from(financeBudgets)
      .leftJoin(categories, eq(financeBudgets.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(categories.name);

    // Compute spent cents for each budget envelope
    const data: FinanceBudgetData[] = [];

    for (const { budget, categoryName } of rows) {
      const startDate = `${budget.yearMonth}-01`;
      const endDate = `${budget.yearMonth}-31`;

      // 1. Direct transactions in category (excluding transfers)
      const directSpentRes = await db
        .select({
          total: sql<number>`coalesce(sum(amount_cents), 0)`,
        })
        .from(financeTransactions)
        .where(
          and(
            eq(financeTransactions.userId, user.id),
            eq(financeTransactions.categoryId, budget.categoryId),
            eq(financeTransactions.type, 'expense'),
            eq(financeTransactions.hasSplits, 0),
            gte(financeTransactions.transactionDate, startDate),
            lte(financeTransactions.transactionDate, endDate)
          )
        );

      // 2. Split items in category (excluding transfers)
      const splitSpentRes = await db
        .select({
          total: sql<number>`coalesce(sum(${financeTransactionSplits.amountCents}), 0)`,
        })
        .from(financeTransactionSplits)
        .innerJoin(
          financeTransactions,
          eq(financeTransactionSplits.transactionId, financeTransactions.id)
        )
        .where(
          and(
            eq(financeTransactionSplits.userId, user.id),
            eq(financeTransactionSplits.categoryId, budget.categoryId),
            eq(financeTransactions.type, 'expense'),
            gte(financeTransactions.transactionDate, startDate),
            lte(financeTransactions.transactionDate, endDate)
          )
        );

      const spentCents =
        Number(directSpentRes[0]?.total || 0) + Number(splitSpentRes[0]?.total || 0);
      const remainingCents = budget.amountCents - spentCents;
      const percentageUsed =
        budget.amountCents > 0 ? Math.round((spentCents / budget.amountCents) * 100) : 0;

      data.push({
        id: budget.id,
        userId: budget.userId,
        categoryId: budget.categoryId,
        categoryName,
        period: budget.period as 'monthly' | 'yearly',
        yearMonth: budget.yearMonth,
        amountCents: budget.amountCents,
        spentCents,
        remainingCents,
        percentageUsed,
        rollover: Boolean(budget.rollover),
        notes: budget.notes,
        createdAt: budget.createdAt.getTime(),
        updatedAt: budget.updatedAt.getTime(),
      });
    }

    return c.json<ApiSuccessResponse<FinanceBudgetData[]>>({ success: true, data });
  }
);

/**
 * POST /api/finance/budgets
 */
financeBudgetsRouter.post('/', zValidator('json', financeBudgetCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const catCheck = await validateActiveFinanceCategory(c.env.DB, input.categoryId, user.id);
  if (!catCheck.valid) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: catCheck.error! } }, 400);
  }

  // Check unique envelope constraint
  const existing = (
    await db
      .select()
      .from(financeBudgets)
      .where(
        and(
          eq(financeBudgets.userId, user.id),
          eq(financeBudgets.categoryId, input.categoryId),
          eq(financeBudgets.yearMonth, input.yearMonth)
        )
      )
      .limit(1)
  )[0];

  if (existing) {
    return c.json(
      {
        success: false,
        error: { code: 'CONFLICT', message: 'Budget envelope already exists for this category and period' },
      },
      409
    );
  }

  const id = `bdg_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(financeBudgets).values({
    id,
    userId: user.id,
    categoryId: input.categoryId,
    period: input.period,
    yearMonth: input.yearMonth,
    amountCents: input.amountCents,
    rollover: input.rollover ? 1 : 0,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_budget', id, 'create', {
    categoryId: input.categoryId,
    yearMonth: input.yearMonth,
    amountCents: input.amountCents,
  });

  const created: FinanceBudgetData = {
    id,
    userId: user.id,
    categoryId: input.categoryId,
    period: input.period,
    yearMonth: input.yearMonth,
    amountCents: input.amountCents,
    spentCents: 0,
    remainingCents: input.amountCents,
    percentageUsed: 0,
    rollover: input.rollover,
    notes: input.notes || null,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceBudgetData>>({ success: true, data: created }, 201);
});

/**
 * PATCH /api/finance/budgets/:id
 */
financeBudgetsRouter.patch('/:id', zValidator('json', financeBudgetUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(financeBudgets)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof financeBudgets.$inferInsert> = {
    updatedAt: now,
  };

  if (input.amountCents !== undefined) updateData.amountCents = input.amountCents;
  if (input.rollover !== undefined) updateData.rollover = input.rollover ? 1 : 0;
  if (input.notes !== undefined) updateData.notes = input.notes;

  await db.update(financeBudgets).set(updateData).where(eq(financeBudgets.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_budget', id, 'update', {
    updatedFields: Object.keys(input),
  });

  const updated = (
    await db.select().from(financeBudgets).where(eq(financeBudgets.id, id)).limit(1)
  )[0];

  const data: FinanceBudgetData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    period: updated.period as 'monthly' | 'yearly',
    yearMonth: updated.yearMonth,
    amountCents: updated.amountCents,
    rollover: Boolean(updated.rollover),
    notes: updated.notes,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceBudgetData>>({ success: true, data });
});

/**
 * DELETE /api/finance/budgets/:id
 */
financeBudgetsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: financeBudgets.id })
      .from(financeBudgets)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } }, 404);
  }

  await db.delete(financeBudgets).where(eq(financeBudgets.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_budget', id, 'delete');

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
