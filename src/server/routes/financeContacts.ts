import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { financeContacts, financeDebts, financeDebtPayments } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  financeContactCreateSchema,
  financeContactUpdateSchema,
} from '../../shared/schemas/finance';
import { recordFinanceAuditEvent } from '../services/financeLedgerService';
import type { ApiSuccessResponse, FinanceContactData } from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeContactsRouter = new Hono<{ Bindings: AppBindings }>();

financeContactsRouter.use('*', requireAuth);

/**
 * GET /api/finance/contacts
 * List all contacts with calculated balances of money given / borrowed.
 */
financeContactsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(financeContacts)
    .where(eq(financeContacts.userId, user.id))
    .orderBy(financeContacts.name);

  const data: FinanceContactData[] = [];

  for (const contact of rows) {
    // Fetch all active debts linked to this contact
    const contactDebts = await db
      .select({
        id: financeDebts.id,
        debtType: financeDebts.debtType,
        totalOwedCents: financeDebts.totalOwedCents,
        isPaidOff: financeDebts.isPaidOff,
      })
      .from(financeDebts)
      .where(and(eq(financeDebts.userId, user.id), eq(financeDebts.contactId, contact.id)));

    let totalGivenCents = 0;
    let totalBorrowedCents = 0;

    for (const d of contactDebts) {
      // Calculate remaining balance for this debt
      const paidRes = await db
        .select({
          totalPaid: sql<number>`coalesce(sum(${financeDebtPayments.principalCents}), 0)`,
        })
        .from(financeDebtPayments)
        .where(eq(financeDebtPayments.debtId, d.id));

      const totalPaid = Number(paidRes[0]?.totalPaid || 0);
      const remaining = Math.max(0, d.totalOwedCents - totalPaid);

      if (d.debtType === 'money_given') {
        totalGivenCents += remaining;
      } else {
        totalBorrowedCents += remaining;
      }
    }

    data.push({
      id: contact.id,
      userId: contact.userId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      notes: contact.notes,
      totalGivenCents,
      totalBorrowedCents,
      netOwedCents: totalGivenCents - totalBorrowedCents,
      createdAt: contact.createdAt.getTime(),
      updatedAt: contact.updatedAt.getTime(),
    });
  }

  return c.json<ApiSuccessResponse<FinanceContactData[]>>({ success: true, data });
});

/**
 * POST /api/finance/contacts
 */
financeContactsRouter.post('/', zValidator('json', financeContactCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `cnt_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(financeContacts).values({
    id,
    userId: user.id,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_contact', id, 'create', {
    name: input.name,
  });

  const created: FinanceContactData = {
    id,
    userId: user.id,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    notes: input.notes || null,
    totalGivenCents: 0,
    totalBorrowedCents: 0,
    netOwedCents: 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceContactData>>({ success: true, data: created }, 201);
});

/**
 * GET /api/finance/contacts/:id
 */
financeContactsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const contact = (
    await db
      .select()
      .from(financeContacts)
      .where(and(eq(financeContacts.id, id), eq(financeContacts.userId, user.id)))
      .limit(1)
  )[0];

  if (!contact) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } }, 404);
  }

  const contactDebts = await db
    .select({
      id: financeDebts.id,
      debtType: financeDebts.debtType,
      totalOwedCents: financeDebts.totalOwedCents,
      isPaidOff: financeDebts.isPaidOff,
    })
    .from(financeDebts)
    .where(and(eq(financeDebts.userId, user.id), eq(financeDebts.contactId, id)));

  let totalGivenCents = 0;
  let totalBorrowedCents = 0;

  for (const d of contactDebts) {
    const paidRes = await db
      .select({
        totalPaid: sql<number>`coalesce(sum(${financeDebtPayments.principalCents}), 0)`,
      })
      .from(financeDebtPayments)
      .where(eq(financeDebtPayments.debtId, d.id));

    const totalPaid = Number(paidRes[0]?.totalPaid || 0);
    const remaining = Math.max(0, d.totalOwedCents - totalPaid);

    if (d.debtType === 'money_given') {
      totalGivenCents += remaining;
    } else {
      totalBorrowedCents += remaining;
    }
  }

  const data: FinanceContactData = {
    id: contact.id,
    userId: contact.userId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    notes: contact.notes,
    totalGivenCents,
    totalBorrowedCents,
    netOwedCents: totalGivenCents - totalBorrowedCents,
    createdAt: contact.createdAt.getTime(),
    updatedAt: contact.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceContactData>>({ success: true, data });
});

/**
 * PATCH /api/finance/contacts/:id
 */
financeContactsRouter.patch('/:id', zValidator('json', financeContactUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(financeContacts)
      .where(and(eq(financeContacts.id, id), eq(financeContacts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof financeContacts.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.notes !== undefined) updateData.notes = input.notes;

  await db.update(financeContacts).set(updateData).where(eq(financeContacts.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_contact', id, 'update', {
    updatedFields: Object.keys(input),
  });

  const updated = (
    await db.select().from(financeContacts).where(eq(financeContacts.id, id)).limit(1)
  )[0];

  const data: FinanceContactData = {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    notes: updated.notes,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<FinanceContactData>>({ success: true, data });
});

/**
 * DELETE /api/finance/contacts/:id
 */
financeContactsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: financeContacts.id, name: financeContacts.name })
      .from(financeContacts)
      .where(and(eq(financeContacts.id, id), eq(financeContacts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } }, 404);
  }

  await db.delete(financeContacts).where(eq(financeContacts.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_contact', id, 'delete', {
    name: existing.name,
  });

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
