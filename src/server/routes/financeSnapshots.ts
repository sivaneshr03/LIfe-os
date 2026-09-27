import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { createDb } from '../db/client';
import { financeNetWorthSnapshots } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { financeNetWorthSnapshotCreateSchema } from '../../shared/schemas/finance';
import { calculateNetWorth, recordFinanceAuditEvent } from '../services/financeLedgerService';
import type { ApiSuccessResponse, FinanceNetWorthSnapshotData } from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeSnapshotsRouter = new Hono<{ Bindings: AppBindings }>();

financeSnapshotsRouter.use('*', requireAuth);

/**
 * GET /api/finance/snapshots
 * List monthly net worth snapshots.
 */
financeSnapshotsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(financeNetWorthSnapshots)
    .where(eq(financeNetWorthSnapshots.userId, user.id))
    .orderBy(desc(financeNetWorthSnapshots.yearMonth));

  const data: FinanceNetWorthSnapshotData[] = rows.map((s) => ({
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

  return c.json<ApiSuccessResponse<FinanceNetWorthSnapshotData[]>>({ success: true, data });
});

/**
 * POST /api/finance/snapshots
 * Calculate current balance sheet and snapshot it for the specified yearMonth.
 */
financeSnapshotsRouter.post(
  '/',
  zValidator('json', financeNetWorthSnapshotCreateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { yearMonth, notes } = c.req.valid('json');

    const netWorth = await calculateNetWorth(
      c.env.DB,
      user.id,
      `${yearMonth}-28`
    );

    const now = new Date();
    const id = `snp_${crypto.randomUUID()}`;

    // Upsert or insert snapshot
    const existing = (
      await db
        .select()
        .from(financeNetWorthSnapshots)
        .where(
          and(
            eq(financeNetWorthSnapshots.userId, user.id),
            eq(financeNetWorthSnapshots.yearMonth, yearMonth)
          )
        )
        .limit(1)
    )[0];

    if (existing) {
      await db
        .update(financeNetWorthSnapshots)
        .set({
          totalAssetsCents: netWorth.totalAssetsCents,
          totalLiabilitiesCents: netWorth.totalLiabilitiesCents,
          netWorthCents: netWorth.netWorthCents,
          notes: notes !== undefined ? notes : existing.notes,
        })
        .where(eq(financeNetWorthSnapshots.id, existing.id));

      await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_snapshot', existing.id, 'update', {
        yearMonth,
        netWorthCents: netWorth.netWorthCents,
      });

      const updated: FinanceNetWorthSnapshotData = {
        id: existing.id,
        userId: user.id,
        yearMonth,
        totalAssetsCents: netWorth.totalAssetsCents,
        totalLiabilitiesCents: netWorth.totalLiabilitiesCents,
        netWorthCents: netWorth.netWorthCents,
        currency: existing.currency,
        notes: notes !== undefined ? notes : existing.notes,
        createdAt: existing.createdAt.getTime(),
      };

      return c.json<ApiSuccessResponse<FinanceNetWorthSnapshotData>>({ success: true, data: updated });
    }

    await db.insert(financeNetWorthSnapshots).values({
      id,
      userId: user.id,
      yearMonth,
      totalAssetsCents: netWorth.totalAssetsCents,
      totalLiabilitiesCents: netWorth.totalLiabilitiesCents,
      netWorthCents: netWorth.netWorthCents,
      currency: netWorth.baseCurrency,
      notes: notes || null,
      createdAt: now,
    });

    await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_snapshot', id, 'create', {
      yearMonth,
      netWorthCents: netWorth.netWorthCents,
    });

    const created: FinanceNetWorthSnapshotData = {
      id,
      userId: user.id,
      yearMonth,
      totalAssetsCents: netWorth.totalAssetsCents,
      totalLiabilitiesCents: netWorth.totalLiabilitiesCents,
      netWorthCents: netWorth.netWorthCents,
      currency: netWorth.baseCurrency,
      notes: notes || null,
      createdAt: now.getTime(),
    };

    return c.json<ApiSuccessResponse<FinanceNetWorthSnapshotData>>({ success: true, data: created }, 201);
  }
);

/**
 * DELETE /api/finance/snapshots/:id
 */
financeSnapshotsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: financeNetWorthSnapshots.id })
      .from(financeNetWorthSnapshots)
      .where(and(eq(financeNetWorthSnapshots.id, id), eq(financeNetWorthSnapshots.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Snapshot not found' } }, 404);
  }

  await db.delete(financeNetWorthSnapshots).where(eq(financeNetWorthSnapshots.id, id));

  await recordFinanceAuditEvent(c.env.DB, user.id, 'finance_snapshot', id, 'delete');

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
