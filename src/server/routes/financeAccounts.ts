import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import { financeAccounts, financeTransactions } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  financeAccountCreateSchema,
  financeAccountUpdateSchema,
} from '../../shared/schemas/finance';
import {
  reconcileAccountBalance,
  validateActiveFinanceCategory,
  recordFinanceAuditEvent,
} from '../services/financeLedgerService';
import { getTodayCalendarDate } from '../../shared/utils/date';
import type {
  ApiSuccessResponse,
  FinanceAccountData,
  FinanceAccountType,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const financeAccountsRouter = new Hono<{ Bindings: AppBindings }>();

financeAccountsRouter.use('*', requireAuth);

/**
 * GET /api/finance/accounts
 * List all accounts for user with transaction count.
 */
financeAccountsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      archived: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === 'true')),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { archived } = c.req.valid('query');

    const conditions = [eq(financeAccounts.userId, user.id)];
    if (archived !== undefined) {
      conditions.push(eq(financeAccounts.isArchived, archived ? 1 : 0));
    }

    const rows = await db
      .select({
        account: financeAccounts,
        txnCount: sql<number>`(SELECT count(*) FROM finance_transactions WHERE finance_transactions.account_id = finance_accounts.id)`,
      })
      .from(financeAccounts)
      .where(and(...conditions))
      .orderBy(financeAccounts.sortOrder, financeAccounts.createdAt);

    const data: FinanceAccountData[] = rows.map(({ account, txnCount }) => ({
      id: account.id,
      userId: account.userId,
      categoryId: account.categoryId,
      name: account.name,
      type: account.type as FinanceAccountType,
      currency: account.currency,
      balanceCents: account.balanceCents,
      description: account.description,
      color: account.color,
      icon: account.icon,
      isArchived: Boolean(account.isArchived),
      sortOrder: account.sortOrder,
      transactionCount: Number(txnCount || 0),
      createdAt: account.createdAt.getTime(),
      updatedAt: account.updatedAt.getTime(),
    }));

    return c.json<ApiSuccessResponse<FinanceAccountData[]>>({ success: true, data });
  }
);

/**
 * POST /api/finance/accounts
 * Create new account. If initial balance != 0, posts opening balance transaction.
 */
financeAccountsRouter.post('/', zValidator('json', financeAccountCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  if (input.categoryId) {
    const catCheck = await validateActiveFinanceCategory(c.env.DB, input.categoryId, user.id);
    if (!catCheck.valid) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: catCheck.error! } }, 400);
    }
  }

  const accountId = `acc_${crypto.randomUUID()}`;
  const now = new Date();
  const initialBalance = input.initialBalanceCents ?? 0;

  await db.insert(financeAccounts).values({
    id: accountId,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    type: input.type,
    currency: input.currency || 'USD',
    balanceCents: initialBalance,
    description: input.description || null,
    color: input.color || '#3b82f6',
    icon: input.icon || 'wallet',
    isArchived: 0,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  // If initial balance is non-zero, create opening balance transaction
  if (initialBalance !== 0) {
    const txnId = `txn_${crypto.randomUUID()}`;
    const today = getTodayCalendarDate('UTC');
    await db.insert(financeTransactions).values({
      id: txnId,
      userId: user.id,
      accountId,
      categoryId: null,
      type: initialBalance > 0 ? 'income' : 'expense',
      amountCents: Math.abs(initialBalance),
      transactionDate: today,
      timestampMs: now,
      payee: 'Opening Balance',
      notes: 'Initial account balance on creation',
      isReconciled: 1,
      hasSplits: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_account', accountId, 'create', {
    name: input.name,
    type: input.type,
    initialBalanceCents: initialBalance,
  });

  const created: FinanceAccountData = {
    id: accountId,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    type: input.type,
    currency: input.currency || 'USD',
    balanceCents: initialBalance,
    description: input.description || null,
    color: input.color || '#3b82f6',
    icon: input.icon || 'wallet',
    isArchived: false,
    sortOrder: input.sortOrder ?? 0,
    transactionCount: initialBalance !== 0 ? 1 : 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceAccountData>>({ success: true, data: created }, 201);
});

/**
 * GET /api/finance/accounts/:id
 */
financeAccountsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const row = (
    await db
      .select({
        account: financeAccounts,
        txnCount: sql<number>`(SELECT count(*) FROM finance_transactions WHERE finance_transactions.account_id = finance_accounts.id)`,
      })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, user.id)))
      .limit(1)
  )[0];

  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404);
  }

  const data: FinanceAccountData = {
    id: row.account.id,
    userId: row.account.userId,
    categoryId: row.account.categoryId,
    name: row.account.name,
    type: row.account.type as FinanceAccountType,
    currency: row.account.currency,
    balanceCents: row.account.balanceCents,
    description: row.account.description,
    color: row.account.color,
    icon: row.account.icon,
    isArchived: Boolean(row.account.isArchived),
    sortOrder: row.account.sortOrder,
    transactionCount: Number(row.txnCount || 0),
    createdAt: row.account.createdAt.getTime(),
    updatedAt: row.account.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceAccountData>>({ success: true, data });
});

/**
 * PATCH /api/finance/accounts/:id
 */
financeAccountsRouter.patch('/:id', zValidator('json', financeAccountUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404);
  }

  if (input.categoryId) {
    const catCheck = await validateActiveFinanceCategory(c.env.DB, input.categoryId, user.id);
    if (!catCheck.valid) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: catCheck.error! } }, 400);
    }
  }

  const now = new Date();
  const updateData: Partial<typeof financeAccounts.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.isArchived !== undefined) updateData.isArchived = input.isArchived ? 1 : 0;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  await db.update(financeAccounts).set(updateData).where(eq(financeAccounts.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_account', id, 'update', {
    updatedFields: Object.keys(input),
  });

  const updated = (await db.select().from(financeAccounts).where(eq(financeAccounts.id, id)).limit(1))[0];

  const data: FinanceAccountData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    name: updated.name,
    type: updated.type as FinanceAccountType,
    currency: updated.currency,
    balanceCents: updated.balanceCents,
    description: updated.description,
    color: updated.color,
    icon: updated.icon,
    isArchived: Boolean(updated.isArchived),
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceAccountData>>({ success: true, data });
});

/**
 * DELETE /api/finance/accounts/:id
 */
financeAccountsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: financeAccounts.id, name: financeAccounts.name })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404);
  }

  await db.delete(financeAccounts).where(eq(financeAccounts.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_account', id, 'delete', {
    name: existing.name,
  });

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * POST /api/finance/accounts/:id/reconcile
 * Verify and reconcile account balance against ledger transaction sum.
 */
financeAccountsRouter.post('/:id/reconcile', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const result = await reconcileAccountBalance(c.env.DB, id, user.id);

  return c.json<ApiSuccessResponse<typeof result>>({ success: true, data: result });
});
