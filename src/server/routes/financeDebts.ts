import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import {
  financeDebts,
  financeDebtPayments,
  financeContacts,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  financeDebtCreateSchema,
  financeDebtUpdateSchema,
  financeDebtPaymentCreateSchema,
} from '../../shared/schemas/finance';
import { isValidCalendarDate, getTodayCalendarDate } from '../../shared/utils/date';
import { recordFinanceAuditEvent } from '../services/financeLedgerService';
import type {
  ApiSuccessResponse,
  FinanceDebtData,
  FinanceDebtPaymentData,
  FinanceDebtType,
} from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeDebtsRouter = new Hono<{ Bindings: AppBindings }>();

financeDebtsRouter.use('*', requireAuth);

/**
 * GET /api/finance/debts
 * List user's debts with derived remaining balances, contact names, and overdue flags.
 */
financeDebtsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      isPaidOff: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === 'true')),
      debtType: z
        .enum(['credit_card', 'loan', 'mortgage', 'money_borrowed', 'money_given', 'other'])
        .optional(),
      contactId: z.string().optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { isPaidOff, debtType, contactId } = c.req.valid('query');

    const conditions = [eq(financeDebts.userId, user.id)];

    if (isPaidOff !== undefined) {
      conditions.push(eq(financeDebts.isPaidOff, isPaidOff ? 1 : 0));
    }
    if (debtType) {
      conditions.push(eq(financeDebts.debtType, debtType));
    }
    if (contactId) {
      conditions.push(eq(financeDebts.contactId, contactId));
    }

    const rows = await db
      .select({
        debt: financeDebts,
        contactName: financeContacts.name,
      })
      .from(financeDebts)
      .leftJoin(financeContacts, eq(financeDebts.contactId, financeContacts.id))
      .where(and(...conditions))
      .orderBy(financeDebts.isPaidOff, desc(financeDebts.totalOwedCents));

    const today = getTodayCalendarDate('UTC');

    // Fetch payments sum for each debt to derive remaining balances
    const data: FinanceDebtData[] = [];

    for (const { debt, contactName } of rows) {
      const paymentSumRes = await db
        .select({
          totalPrincipalPaid: sql<number>`coalesce(sum(${financeDebtPayments.principalCents}), 0)`,
        })
        .from(financeDebtPayments)
        .where(
          and(
            eq(financeDebtPayments.debtId, debt.id),
            eq(financeDebtPayments.userId, user.id)
          )
        );

      const totalPaid = Number(paymentSumRes[0]?.totalPrincipalPaid || 0);
      const remainingBalanceCents = Math.max(0, debt.totalOwedCents - totalPaid);
      const isOverdue =
        !debt.isPaidOff &&
        remainingBalanceCents > 0 &&
        Boolean(debt.dueDate && debt.dueDate < today);

      data.push({
        id: debt.id,
        userId: debt.userId,
        accountId: debt.accountId,
        contactId: debt.contactId,
        contactName,
        debtType: debt.debtType as FinanceDebtType,
        name: debt.name,
        creditor: debt.creditor,
        totalOwedCents: debt.totalOwedCents,
        remainingBalanceCents,
        totalPaidCents: totalPaid,
        interestRateBps: debt.interestRateBps,
        minimumPaymentCents: debt.minimumPaymentCents,
        dueDate: debt.dueDate,
        targetPayoffDate: debt.targetPayoffDate,
        isPaidOff: Boolean(debt.isPaidOff),
        isOverdue,
        notes: debt.notes,
        createdAt: debt.createdAt.getTime(),
        updatedAt: debt.updatedAt.getTime(),
      });
    }

    return c.json<ApiSuccessResponse<FinanceDebtData[]>>({ success: true, data });
  }
);

/**
 * POST /api/finance/debts
 */
financeDebtsRouter.post('/', zValidator('json', financeDebtCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `dbt_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(financeDebts).values({
    id,
    userId: user.id,
    accountId: input.accountId || null,
    contactId: input.contactId || null,
    debtType: input.debtType,
    name: input.name,
    creditor: input.creditor,
    totalOwedCents: input.totalOwedCents,
    interestRateBps: input.interestRateBps,
    minimumPaymentCents: input.minimumPaymentCents,
    dueDate: input.dueDate || null,
    targetPayoffDate: input.targetPayoffDate || null,
    isPaidOff: 0,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_debt', id, 'create', {
    name: input.name,
    creditor: input.creditor,
    totalOwedCents: input.totalOwedCents,
    debtType: input.debtType,
  });

  const created: FinanceDebtData = {
    id,
    userId: user.id,
    accountId: input.accountId || null,
    contactId: input.contactId || null,
    debtType: input.debtType,
    name: input.name,
    creditor: input.creditor,
    totalOwedCents: input.totalOwedCents,
    remainingBalanceCents: input.totalOwedCents,
    totalPaidCents: 0,
    interestRateBps: input.interestRateBps,
    minimumPaymentCents: input.minimumPaymentCents,
    dueDate: input.dueDate || null,
    targetPayoffDate: input.targetPayoffDate || null,
    isPaidOff: false,
    isOverdue: false,
    notes: input.notes || null,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceDebtData>>({ success: true, data: created }, 201);
});

/**
 * GET /api/finance/debts/:id
 * Retrieve debt with all payments ledger and derived balances.
 */
financeDebtsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const row = (
    await db
      .select({
        debt: financeDebts,
        contactName: financeContacts.name,
      })
      .from(financeDebts)
      .leftJoin(financeContacts, eq(financeDebts.contactId, financeContacts.id))
      .where(and(eq(financeDebts.id, id), eq(financeDebts.userId, user.id)))
      .limit(1)
  )[0];

  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Debt not found' } }, 404);
  }

  const { debt, contactName } = row;

  const paymentRows = await db
    .select()
    .from(financeDebtPayments)
    .where(and(eq(financeDebtPayments.debtId, id), eq(financeDebtPayments.userId, user.id)))
    .orderBy(desc(financeDebtPayments.date));

  let totalPaid = 0;
  const payments: FinanceDebtPaymentData[] = paymentRows.map((p) => {
    const principal = p.principalCents !== null ? p.principalCents : p.amountCents;
    totalPaid += principal;
    return {
      id: p.id,
      userId: p.userId,
      debtId: p.debtId,
      transactionId: p.transactionId,
      date: p.date,
      amountCents: p.amountCents,
      principalCents: p.principalCents,
      interestCents: p.interestCents,
      notes: p.notes,
      createdAt: p.createdAt.getTime(),
    };
  });

  const remainingBalanceCents = Math.max(0, debt.totalOwedCents - totalPaid);
  const today = getTodayCalendarDate('UTC');
  const isOverdue =
    !debt.isPaidOff &&
    remainingBalanceCents > 0 &&
    Boolean(debt.dueDate && debt.dueDate < today);

  const data: FinanceDebtData & { payments: FinanceDebtPaymentData[] } = {
    id: debt.id,
    userId: debt.userId,
    accountId: debt.accountId,
    contactId: debt.contactId,
    contactName,
    debtType: debt.debtType as FinanceDebtType,
    name: debt.name,
    creditor: debt.creditor,
    totalOwedCents: debt.totalOwedCents,
    remainingBalanceCents,
    totalPaidCents: totalPaid,
    interestRateBps: debt.interestRateBps,
    minimumPaymentCents: debt.minimumPaymentCents,
    dueDate: debt.dueDate,
    targetPayoffDate: debt.targetPayoffDate,
    isPaidOff: Boolean(debt.isPaidOff),
    isOverdue,
    notes: debt.notes,
    payments,
    createdAt: debt.createdAt.getTime(),
    updatedAt: debt.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<typeof data>>({ success: true, data });
});

/**
 * PATCH /api/finance/debts/:id
 */
financeDebtsRouter.patch('/:id', zValidator('json', financeDebtUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(financeDebts)
      .where(and(eq(financeDebts.id, id), eq(financeDebts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Debt not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof financeDebts.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.creditor !== undefined) updateData.creditor = input.creditor;
  if (input.contactId !== undefined) updateData.contactId = input.contactId;
  if (input.debtType !== undefined) updateData.debtType = input.debtType;
  if (input.totalOwedCents !== undefined) updateData.totalOwedCents = input.totalOwedCents;
  if (input.interestRateBps !== undefined) updateData.interestRateBps = input.interestRateBps;
  if (input.minimumPaymentCents !== undefined) updateData.minimumPaymentCents = input.minimumPaymentCents;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
  if (input.targetPayoffDate !== undefined) updateData.targetPayoffDate = input.targetPayoffDate;
  if (input.isPaidOff !== undefined) updateData.isPaidOff = input.isPaidOff ? 1 : 0;
  if (input.notes !== undefined) updateData.notes = input.notes;

  await db.update(financeDebts).set(updateData).where(eq(financeDebts.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_debt', id, 'update', {
    updatedFields: Object.keys(input),
  });

  const updated = (await db.select().from(financeDebts).where(eq(financeDebts.id, id)).limit(1))[0];

  const data: FinanceDebtData = {
    id: updated.id,
    userId: updated.userId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    debtType: updated.debtType as FinanceDebtType,
    name: updated.name,
    creditor: updated.creditor,
    totalOwedCents: updated.totalOwedCents,
    interestRateBps: updated.interestRateBps,
    minimumPaymentCents: updated.minimumPaymentCents,
    dueDate: updated.dueDate,
    targetPayoffDate: updated.targetPayoffDate,
    isPaidOff: Boolean(updated.isPaidOff),
    notes: updated.notes,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceDebtData>>({ success: true, data });
});

/**
 * DELETE /api/finance/debts/:id
 */
financeDebtsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: financeDebts.id, name: financeDebts.name })
      .from(financeDebts)
      .where(and(eq(financeDebts.id, id), eq(financeDebts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Debt not found' } }, 404);
  }

  await db.delete(financeDebts).where(eq(financeDebts.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_debt', id, 'delete', {
    name: existing.name,
  });

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * POST /api/finance/debts/:id/payments
 * Record debt payment. Reduces debt principal owed. If owed reaches 0, marks as paid off.
 */
financeDebtsRouter.post(
  '/:id/payments',
  zValidator('json', financeDebtPaymentCreateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const debtId = c.req.param('id');
    const input = c.req.valid('json');

    if (!isValidCalendarDate(input.date)) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Date must be YYYY-MM-DD' } },
        400
      );
    }

    const debt = (
      await db
        .select()
        .from(financeDebts)
        .where(and(eq(financeDebts.id, debtId), eq(financeDebts.userId, user.id)))
        .limit(1)
    )[0];

    if (!debt) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Debt not found' } }, 404);
    }

    const paymentId = `dbp_${crypto.randomUUID()}`;
    const now = new Date();

    const principalPaid =
      input.principalCents !== undefined && input.principalCents !== null
        ? input.principalCents
        : input.amountCents;

    // Fetch previous payments sum
    const prevPaidRes = await db
      .select({
        total: sql<number>`coalesce(sum(${financeDebtPayments.principalCents}), 0)`,
      })
      .from(financeDebtPayments)
      .where(and(eq(financeDebtPayments.debtId, debtId), eq(financeDebtPayments.userId, user.id)));

    const prevPaid = Number(prevPaidRes[0]?.total || 0);
    const newTotalPaid = prevPaid + principalPaid;
    const remainingBalance = Math.max(0, debt.totalOwedCents - newTotalPaid);
    const isPaidOff = remainingBalance === 0 ? 1 : 0;

    await db.insert(financeDebtPayments).values({
      id: paymentId,
      userId: user.id,
      debtId,
      transactionId: null,
      date: input.date,
      amountCents: input.amountCents,
      principalCents: principalPaid,
      interestCents: input.interestCents || null,
      notes: input.notes || null,
      createdAt: now,
    });

    await db
      .update(financeDebts)
      .set({
        isPaidOff,
        updatedAt: now,
      })
      .where(eq(financeDebts.id, debtId));

    await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_debt', debtId, 'payment', {
      amountCents: input.amountCents,
      principalPaidCents: principalPaid,
      remainingBalanceCents: remainingBalance,
      isPaidOff: Boolean(isPaidOff),
    });

    const data: FinanceDebtPaymentData = {
      id: paymentId,
      userId: user.id,
      debtId,
      date: input.date,
      amountCents: input.amountCents,
      principalCents: principalPaid,
      interestCents: input.interestCents || null,
      notes: input.notes || null,
      createdAt: now.getTime(),
    };

    return c.json<ApiSuccessResponse<FinanceDebtPaymentData>>({ success: true, data }, 201);
  }
);
