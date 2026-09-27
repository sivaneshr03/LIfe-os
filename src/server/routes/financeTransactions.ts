import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc, gte, lte, or, like } from 'drizzle-orm';
import { createDb } from '../db/client';
import {
  financeAccounts,
  financeTransactions,
  financeTransactionSplits,
  categories,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  financeTransactionCreateSchema,
  financeTransactionUpdateSchema,
  financeTransferCreateSchema,
  financeTransactionQuerySchema,
} from '../../shared/schemas/finance';
import { isValidCalendarDate } from '../../shared/utils/date';
import {
  validateActiveFinanceCategory,
  recordFinanceAuditEvent,
} from '../services/financeLedgerService';
import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  FinanceTransactionData,
  FinanceTransactionSplitData,
  FinanceTransactionType,
} from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeTransactionsRouter = new Hono<{ Bindings: AppBindings }>();

financeTransactionsRouter.use('*', requireAuth);

/**
 * GET /api/finance/transactions
 * Filtered, paginated transactions list with search and splits.
 */
financeTransactionsRouter.get('/', zValidator('query', financeTransactionQuerySchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const q = c.req.valid('query');

  const conditions = [eq(financeTransactions.userId, user.id)];

  if (q.accountId) {
    conditions.push(
      or(
        eq(financeTransactions.accountId, q.accountId),
        eq(financeTransactions.transferAccountId, q.accountId)
      )!
    );
  }

  if (q.categoryId) {
    // Also match if any split matches category
    conditions.push(
      or(
        eq(financeTransactions.categoryId, q.categoryId),
        sql`EXISTS (SELECT 1 FROM finance_transaction_splits WHERE finance_transaction_splits.transaction_id = finance_transactions.id AND finance_transaction_splits.category_id = ${q.categoryId})`
      )!
    );
  }

  if (q.type) {
    conditions.push(eq(financeTransactions.type, q.type));
  }

  if (q.startDate) {
    conditions.push(gte(financeTransactions.transactionDate, q.startDate));
  }

  if (q.endDate) {
    conditions.push(lte(financeTransactions.transactionDate, q.endDate));
  }

  if (q.minAmountCents !== undefined) {
    conditions.push(gte(financeTransactions.amountCents, q.minAmountCents));
  }

  if (q.maxAmountCents !== undefined) {
    conditions.push(lte(financeTransactions.amountCents, q.maxAmountCents));
  }

  if (q.isReconciled !== undefined) {
    conditions.push(eq(financeTransactions.isReconciled, q.isReconciled ? 1 : 0));
  }

  if (q.q && q.q.trim().length > 0) {
    const term = `%${q.q.trim()}%`;
    conditions.push(
      or(like(financeTransactions.payee, term), like(financeTransactions.notes, term))!
    );
  }

  const whereClause = and(...conditions);

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(financeTransactions)
    .where(whereClause);
  const total = Number(countRes[0]?.count || 0);

  const offset = (q.page - 1) * q.pageSize;

  const rows = await db
    .select()
    .from(financeTransactions)
    .where(whereClause)
    .orderBy(desc(financeTransactions.transactionDate), desc(financeTransactions.timestampMs))
    .limit(q.pageSize)
    .offset(offset);

  // Fetch splits for rows that have splits
  const splitTxnIds = rows.filter((r) => r.hasSplits === 1).map((r) => r.id);
  const splitsByTxnId: Record<string, FinanceTransactionSplitData[]> = {};

  if (splitTxnIds.length > 0) {
    const splitRows = await db
      .select({
        split: financeTransactionSplits,
        categoryName: categories.name,
      })
      .from(financeTransactionSplits)
      .leftJoin(categories, eq(financeTransactionSplits.categoryId, categories.id))
      .where(
        and(
          eq(financeTransactionSplits.userId, user.id),
          sql`${financeTransactionSplits.transactionId} IN (${sql.join(
            splitTxnIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      );

    for (const r of splitRows) {
      if (!splitsByTxnId[r.split.transactionId]) {
        splitsByTxnId[r.split.transactionId] = [];
      }
      splitsByTxnId[r.split.transactionId].push({
        id: r.split.id,
        userId: r.split.userId,
        transactionId: r.split.transactionId,
        categoryId: r.split.categoryId,
        categoryName: r.categoryName,
        amountCents: r.split.amountCents,
        notes: r.split.notes,
        createdAt: r.split.createdAt.getTime(),
        updatedAt: r.split.updatedAt.getTime(),
      });
    }
  }

  const items: FinanceTransactionData[] = rows.map((t) => ({
    id: t.id,
    userId: t.userId,
    accountId: t.accountId,
    categoryId: t.categoryId,
    type: t.type as FinanceTransactionType,
    amountCents: t.amountCents,
    transactionDate: t.transactionDate,
    timestampMs: t.timestampMs.getTime(),
    payee: t.payee,
    notes: t.notes,
    transferAccountId: t.transferAccountId,
    transferTransactionId: t.transferTransactionId,
    isReconciled: Boolean(t.isReconciled),
    hasSplits: Boolean(t.hasSplits),
    splits: splitsByTxnId[t.id] || [],
    createdAt: t.createdAt.getTime(),
    updatedAt: t.updatedAt.getTime(),
  }));

  return c.json<ApiPaginatedResponse<FinanceTransactionData>>({
    success: true,
    data: {
      items,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / q.pageSize) || 1,
        hasNextPage: offset + items.length < total,
        hasPrevPage: q.page > 1,
      },
    },
  });
});

/**
 * POST /api/finance/transactions
 * Create income or expense transaction with optional splits.
 */
financeTransactionsRouter.post('/', zValidator('json', financeTransactionCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  if (!isValidCalendarDate(input.transactionDate)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Date must be YYYY-MM-DD' } },
      400
    );
  }

  // Validate primary category
  if (input.categoryId) {
    const catCheck = await validateActiveFinanceCategory(c.env.DB, input.categoryId, user.id);
    if (!catCheck.valid) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: catCheck.error! } }, 400);
    }
  }

  // Validate splits if provided
  if (input.splits && input.splits.length > 0) {
    let splitTotal = 0;
    for (const s of input.splits) {
      splitTotal += s.amountCents;
      if (s.categoryId) {
        const catCheck = await validateActiveFinanceCategory(c.env.DB, s.categoryId, user.id);
        if (!catCheck.valid) {
          return c.json(
            { success: false, error: { code: 'BAD_REQUEST', message: `Split error: ${catCheck.error!}` } },
            400
          );
        }
      }
    }

    if (splitTotal !== input.amountCents) {
      return c.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: `Sum of split amounts (${splitTotal}) must equal total transaction amount (${input.amountCents})`,
          },
        },
        400
      );
    }
  }

  const account = (
    await db
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, input.accountId), eq(financeAccounts.userId, user.id)))
      .limit(1)
  )[0];

  if (!account) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404);
  }

  const delta = input.type === 'income' ? input.amountCents : -input.amountCents;
  const newBalance = account.balanceCents + delta;

  const txnId = `txn_${crypto.randomUUID()}`;
  const now = new Date();
  const hasSplits = input.splits && input.splits.length > 0 ? 1 : 0;

  // Atomically update balance and insert transaction
  await db
    .update(financeAccounts)
    .set({ balanceCents: newBalance, updatedAt: now })
    .where(eq(financeAccounts.id, account.id));

  await db.insert(financeTransactions).values({
    id: txnId,
    userId: user.id,
    accountId: account.id,
    categoryId: input.categoryId || null,
    type: input.type,
    amountCents: input.amountCents,
    transactionDate: input.transactionDate,
    timestampMs: now,
    payee: input.payee || null,
    notes: input.notes || null,
    transferAccountId: input.transferAccountId || null,
    isReconciled: 1,
    hasSplits,
    createdAt: now,
    updatedAt: now,
  });

  const createdSplits: FinanceTransactionSplitData[] = [];
  if (input.splits && input.splits.length > 0) {
    for (const s of input.splits) {
      const splitId = `txs_${crypto.randomUUID()}`;
      await db.insert(financeTransactionSplits).values({
        id: splitId,
        userId: user.id,
        transactionId: txnId,
        categoryId: s.categoryId || null,
        amountCents: s.amountCents,
        notes: s.notes || null,
        createdAt: now,
        updatedAt: now,
      });

      createdSplits.push({
        id: splitId,
        userId: user.id,
        transactionId: txnId,
        categoryId: s.categoryId || null,
        amountCents: s.amountCents,
        notes: s.notes || null,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });
    }
  }

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_transaction', txnId, 'create', {
    type: input.type,
    amountCents: input.amountCents,
    accountId: input.accountId,
    hasSplits: Boolean(hasSplits),
  });

  const data: FinanceTransactionData = {
    id: txnId,
    userId: user.id,
    accountId: account.id,
    categoryId: input.categoryId || null,
    type: input.type,
    amountCents: input.amountCents,
    transactionDate: input.transactionDate,
    timestampMs: now.getTime(),
    payee: input.payee || null,
    notes: input.notes || null,
    transferAccountId: input.transferAccountId || null,
    transferTransactionId: null,
    isReconciled: true,
    hasSplits: Boolean(hasSplits),
    splits: createdSplits,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceTransactionData>>({ success: true, data }, 201);
});

/**
 * POST /api/finance/transactions/transfer
 * Atomically transfer funds between two user accounts.
 */
financeTransactionsRouter.post(
  '/transfer',
  zValidator('json', financeTransferCreateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const input = c.req.valid('json');

    if (input.fromAccountId === input.toAccountId) {
      return c.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Source and destination accounts must differ' },
        },
        400
      );
    }

    if (!isValidCalendarDate(input.transactionDate)) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Date must be YYYY-MM-DD' } },
        400
      );
    }

    const fromAcc = (
      await db
        .select()
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, input.fromAccountId), eq(financeAccounts.userId, user.id)))
        .limit(1)
    )[0];

    const toAcc = (
      await db
        .select()
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, input.toAccountId), eq(financeAccounts.userId, user.id)))
        .limit(1)
    )[0];

    if (!fromAcc || !toAcc) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'One or both accounts not found' } },
        404
      );
    }

    const now = new Date();
    const txnId = `txn_${crypto.randomUUID()}`;

    // Atomically debit source account and credit destination account
    await db
      .update(financeAccounts)
      .set({ balanceCents: fromAcc.balanceCents - input.amountCents, updatedAt: now })
      .where(eq(financeAccounts.id, fromAcc.id));

    await db
      .update(financeAccounts)
      .set({ balanceCents: toAcc.balanceCents + input.amountCents, updatedAt: now })
      .where(eq(financeAccounts.id, toAcc.id));

    await db.insert(financeTransactions).values({
      id: txnId,
      userId: user.id,
      accountId: fromAcc.id,
      categoryId: null,
      type: 'transfer',
      amountCents: input.amountCents,
      transactionDate: input.transactionDate,
      timestampMs: now,
      payee: input.payee || `Transfer to ${toAcc.name}`,
      notes: input.notes || null,
      transferAccountId: toAcc.id,
      isReconciled: 1,
      hasSplits: 0,
      createdAt: now,
      updatedAt: now,
    });

    await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_transaction', txnId, 'transfer', {
      fromAccountId: fromAcc.id,
      toAccountId: toAcc.id,
      amountCents: input.amountCents,
    });

    const data: FinanceTransactionData = {
      id: txnId,
      userId: user.id,
      accountId: fromAcc.id,
      categoryId: null,
      type: 'transfer',
      amountCents: input.amountCents,
      transactionDate: input.transactionDate,
      timestampMs: now.getTime(),
      payee: input.payee || `Transfer to ${toAcc.name}`,
      notes: input.notes || null,
      transferAccountId: toAcc.id,
      transferTransactionId: null,
      isReconciled: true,
      hasSplits: false,
      splits: [],
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    };

    return c.json<ApiSuccessResponse<FinanceTransactionData>>({ success: true, data }, 201);
  }
);

/**
 * GET /api/finance/transactions/:id
 */
financeTransactionsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const t = (
    await db
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, user.id)))
      .limit(1)
  )[0];

  if (!t) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    );
  }

  const splits = await db
    .select({
      split: financeTransactionSplits,
      categoryName: categories.name,
    })
    .from(financeTransactionSplits)
    .leftJoin(categories, eq(financeTransactionSplits.categoryId, categories.id))
    .where(
      and(
        eq(financeTransactionSplits.transactionId, id),
        eq(financeTransactionSplits.userId, user.id)
      )
    );

  const splitsData: FinanceTransactionSplitData[] = splits.map((r) => ({
    id: r.split.id,
    userId: r.split.userId,
    transactionId: r.split.transactionId,
    categoryId: r.split.categoryId,
    categoryName: r.categoryName,
    amountCents: r.split.amountCents,
    notes: r.split.notes,
    createdAt: r.split.createdAt.getTime(),
    updatedAt: r.split.updatedAt.getTime(),
  }));

  const data: FinanceTransactionData = {
    id: t.id,
    userId: t.userId,
    accountId: t.accountId,
    categoryId: t.categoryId,
    type: t.type as FinanceTransactionType,
    amountCents: t.amountCents,
    transactionDate: t.transactionDate,
    timestampMs: t.timestampMs.getTime(),
    payee: t.payee,
    notes: t.notes,
    transferAccountId: t.transferAccountId,
    transferTransactionId: t.transferTransactionId,
    isReconciled: Boolean(t.isReconciled),
    hasSplits: Boolean(t.hasSplits),
    splits: splitsData,
    createdAt: t.createdAt.getTime(),
    updatedAt: t.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceTransactionData>>({ success: true, data });
});

/**
 * PATCH /api/finance/transactions/:id
 * Update transaction metadata, adjust balance delta if amount changed, and update splits.
 */
financeTransactionsRouter.patch(
  '/:id',
  zValidator('json', financeTransactionUpdateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const existing = (
      await db
        .select()
        .from(financeTransactions)
        .where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, user.id)))
        .limit(1)
    )[0];

    if (!existing) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
        404
      );
    }

    if (input.categoryId) {
      const catCheck = await validateActiveFinanceCategory(c.env.DB, input.categoryId, user.id);
      if (!catCheck.valid) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: catCheck.error! } }, 400);
      }
    }

    const now = new Date();
    const updateData: Partial<typeof financeTransactions.$inferInsert> = {
      updatedAt: now,
    };

    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.transactionDate !== undefined) updateData.transactionDate = input.transactionDate;
    if (input.payee !== undefined) updateData.payee = input.payee;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isReconciled !== undefined) updateData.isReconciled = input.isReconciled ? 1 : 0;

    const targetAmount = input.amountCents !== undefined ? input.amountCents : existing.amountCents;

    // Handle splits update
    if (input.splits !== undefined) {
      let splitSum = 0;
      for (const s of input.splits) {
        splitSum += s.amountCents;
        if (s.categoryId) {
          const catCheck = await validateActiveFinanceCategory(c.env.DB, s.categoryId, user.id);
          if (!catCheck.valid) {
            return c.json(
              { success: false, error: { code: 'BAD_REQUEST', message: `Split error: ${catCheck.error!}` } },
              400
            );
          }
        }
      }

      if (input.splits.length > 0 && splitSum !== targetAmount) {
        return c.json(
          {
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: `Sum of split amounts (${splitSum}) must equal total transaction amount (${targetAmount})`,
            },
          },
          400
        );
      }

      // Delete existing splits and re-insert
      await db.delete(financeTransactionSplits).where(eq(financeTransactionSplits.transactionId, id));

      if (input.splits.length > 0) {
        updateData.hasSplits = 1;
        for (const s of input.splits) {
          await db.insert(financeTransactionSplits).values({
            id: `txs_${crypto.randomUUID()}`,
            userId: user.id,
            transactionId: id,
            categoryId: s.categoryId || null,
            amountCents: s.amountCents,
            notes: s.notes || null,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        updateData.hasSplits = 0;
      }
    }

    if (input.amountCents !== undefined && input.amountCents !== existing.amountCents) {
      updateData.amountCents = input.amountCents;
      const diff = input.amountCents - existing.amountCents;

      if (existing.type === 'income') {
        await db
          .update(financeAccounts)
          .set({
            balanceCents: sql`${financeAccounts.balanceCents} + ${diff}`,
            updatedAt: now,
          })
          .where(eq(financeAccounts.id, existing.accountId));
      } else if (existing.type === 'expense') {
        await db
          .update(financeAccounts)
          .set({
            balanceCents: sql`${financeAccounts.balanceCents} - ${diff}`,
            updatedAt: now,
          })
          .where(eq(financeAccounts.id, existing.accountId));
      }
    }

    await db.update(financeTransactions).set(updateData).where(eq(financeTransactions.id, id));

    await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_transaction', id, 'update', {
      updatedFields: Object.keys(input),
    });

    const updated = (
      await db
        .select()
        .from(financeTransactions)
        .where(eq(financeTransactions.id, id))
        .limit(1)
    )[0];

    const splits = await db
      .select({
        split: financeTransactionSplits,
        categoryName: categories.name,
      })
      .from(financeTransactionSplits)
      .leftJoin(categories, eq(financeTransactionSplits.categoryId, categories.id))
      .where(eq(financeTransactionSplits.transactionId, id));

    const data: FinanceTransactionData = {
      id: updated.id,
      userId: updated.userId,
      accountId: updated.accountId,
      categoryId: updated.categoryId,
      type: updated.type as FinanceTransactionType,
      amountCents: updated.amountCents,
      transactionDate: updated.transactionDate,
      timestampMs: updated.timestampMs.getTime(),
      payee: updated.payee,
      notes: updated.notes,
      transferAccountId: updated.transferAccountId,
      transferTransactionId: updated.transferTransactionId,
      isReconciled: Boolean(updated.isReconciled),
      hasSplits: Boolean(updated.hasSplits),
      splits: splits.map((s) => ({
        id: s.split.id,
        userId: s.split.userId,
        transactionId: s.split.transactionId,
        categoryId: s.split.categoryId,
        categoryName: s.categoryName,
        amountCents: s.split.amountCents,
        notes: s.split.notes,
        createdAt: s.split.createdAt.getTime(),
        updatedAt: s.split.updatedAt.getTime(),
      })),
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
    };

    return c.json<ApiSuccessResponse<FinanceTransactionData>>({ success: true, data });
  }
);

/**
 * DELETE /api/finance/transactions/:id
 * Reverses account balance impact and deletes transaction record.
 */
financeTransactionsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const t = (
    await db
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, user.id)))
      .limit(1)
  )[0];

  if (!t) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    );
  }

  const now = new Date();

  // Reverse balance impact
  if (t.type === 'income') {
    await db
      .update(financeAccounts)
      .set({
        balanceCents: sql`${financeAccounts.balanceCents} - ${t.amountCents}`,
        updatedAt: now,
      })
      .where(eq(financeAccounts.id, t.accountId));
  } else if (t.type === 'expense') {
    await db
      .update(financeAccounts)
      .set({
        balanceCents: sql`${financeAccounts.balanceCents} + ${t.amountCents}`,
        updatedAt: now,
      })
      .where(eq(financeAccounts.id, t.accountId));
  } else if (t.type === 'transfer' && t.transferAccountId) {
    // Reverse transfer: restore source, deduct destination
    await db
      .update(financeAccounts)
      .set({
        balanceCents: sql`${financeAccounts.balanceCents} + ${t.amountCents}`,
        updatedAt: now,
      })
      .where(eq(financeAccounts.id, t.accountId));

    await db
      .update(financeAccounts)
      .set({
        balanceCents: sql`${financeAccounts.balanceCents} - ${t.amountCents}`,
        updatedAt: now,
      })
      .where(eq(financeAccounts.id, t.transferAccountId));
  }

  await db.delete(financeTransactions).where(eq(financeTransactions.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_transaction', id, 'delete', {
    type: t.type,
    amountCents: t.amountCents,
  });

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
