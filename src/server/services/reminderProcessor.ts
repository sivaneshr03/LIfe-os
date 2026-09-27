import { eq, and, or, lte, desc } from 'drizzle-orm';
import { createDb } from '../db/client';
import {
  reminders,
  inAppNotifications,
  financeDebts,
  users,
} from '../db/schema';
import type { EntityType } from '../../shared/types';

export interface ReminderProcessResult {
  timestamp: number;
  processedReminders: number;
  triggeredReminders: number;
  recurringGenerated: number;
  overdueDebtsChecked: number;
  budgetAlertsChecked: number;
  errors: string[];
}

/**
 * Determines deep link action URL based on entityType and entityId
 */
export function getEntityActionUrl(entityType: EntityType, entityId?: string | null): string {
  if (!entityId) {
    switch (entityType) {
      case 'task':
        return '/tasks';
      case 'finance_transaction':
      case 'finance_account':
      case 'finance_budget':
        return '/finance';
      case 'habit':
      case 'tracker':
        return '/trackers';
      case 'goal':
        return '/goals';
      case 'note':
        return '/notes';
      default:
        return '/dashboard';
    }
  }

  switch (entityType) {
    case 'task':
      return `/tasks?id=${entityId}`;
    case 'finance_budget':
      return `/finance?tab=budgets&id=${entityId}`;
    case 'finance_transaction':
      return `/finance?tab=transactions&id=${entityId}`;
    case 'finance_account':
      return `/finance?tab=accounts&id=${entityId}`;
    case 'habit':
    case 'tracker':
      return `/trackers?id=${entityId}`;
    case 'goal':
      return `/goals?id=${entityId}`;
    case 'note':
      return `/notes?id=${entityId}`;
    default:
      return `/dashboard?entityId=${entityId}`;
  }
}

/**
 * Calculates next remindAt timestamp given a recurrence rule string
 */
export function calculateNextRecurrence(remindAt: Date, rule: string): Date | null {
  const normalized = rule.toUpperCase().trim();
  const next = new Date(remindAt.getTime());

  if (normalized === 'DAILY' || normalized.includes('FREQ=DAILY')) {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (normalized === 'WEEKLY' || normalized.includes('FREQ=WEEKLY')) {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (normalized === 'MONTHLY' || normalized.includes('FREQ=MONTHLY')) {
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (normalized === 'YEARLY' || normalized.includes('FREQ=YEARLY')) {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  return null;
}

/**
 * Single Scheduled Reminder Processor for Cloudflare Workers
 * Executes batch reminder checks, idempotency verification, and recurring generations
 */
export async function processDueReminders(
  d1: D1Database,
  currentTime: Date = new Date(),
  batchLimit: number = 50
): Promise<ReminderProcessResult> {
  const db = createDb(d1);
  const result: ReminderProcessResult = {
    timestamp: currentTime.getTime(),
    processedReminders: 0,
    triggeredReminders: 0,
    recurringGenerated: 0,
    overdueDebtsChecked: 0,
    budgetAlertsChecked: 0,
    errors: [],
  };

  try {
    // 1. Query pending or snoozed reminders that are now due
    const dueReminders = await db
      .select()
      .from(reminders)
      .where(
        or(
          and(eq(reminders.status, 'pending'), lte(reminders.remindAt, currentTime)),
          and(eq(reminders.status, 'snoozed'), lte(reminders.snoozedUntil, currentTime))
        )
      )
      .orderBy(reminders.remindAt)
      .limit(batchLimit);

    result.processedReminders = dueReminders.length;

    for (const rem of dueReminders) {
      try {
        // Deduplication & Idempotency check:
        // Ensure we have not already inserted an in-app notification for this entity within the last 10 minutes
        const conditions = [
          eq(inAppNotifications.userId, rem.userId),
          eq(inAppNotifications.title, rem.title),
        ];
        if (rem.entityId) {
          conditions.push(eq(inAppNotifications.entityId, rem.entityId));
        }

        const recentNotifs = await db
          .select()
          .from(inAppNotifications)
          .where(and(...conditions))
          .orderBy(desc(inAppNotifications.createdAt))
          .limit(1);

        const isDuplicate =
          recentNotifs.length > 0 &&
          currentTime.getTime() - recentNotifs[0].createdAt.getTime() < 10 * 60 * 1000;

        if (!isDuplicate) {
          const notifId = `notif_${crypto.randomUUID()}`;
          const actionUrl = getEntityActionUrl(rem.entityType as EntityType, rem.entityId);

          await db.insert(inAppNotifications).values({
            id: notifId,
            userId: rem.userId,
            type: 'reminder',
            title: rem.title,
            body: rem.description || `Scheduled reminder for ${rem.entityType.replace('_', ' ')}`,
            level: 'info',
            entityType: rem.entityType as EntityType,
            entityId: rem.entityId || null,
            actionUrl,
            isRead: 0,
            createdAt: currentTime,
          });
          result.triggeredReminders++;
        }

        // Transition reminder status to 'triggered'
        await db
          .update(reminders)
          .set({
            status: 'triggered',
            updatedAt: currentTime,
          })
          .where(eq(reminders.id, rem.id));

        // Generate next recurring reminder if recurrenceRule is configured
        if (rem.recurrenceRule) {
          const nextRemindAt = calculateNextRecurrence(rem.remindAt, rem.recurrenceRule);
          if (nextRemindAt) {
            const nextReminderId = `rem_${crypto.randomUUID()}`;
            await db.insert(reminders).values({
              id: nextReminderId,
              userId: rem.userId,
              entityType: rem.entityType,
              entityId: rem.entityId || null,
              title: rem.title,
              description: rem.description || null,
              remindAt: nextRemindAt,
              recurrenceRule: rem.recurrenceRule,
              status: 'pending',
              createdAt: currentTime,
              updatedAt: currentTime,
            });
            result.recurringGenerated++;
          }
        }
      } catch (remErr: unknown) {
        const msg = remErr instanceof Error ? remErr.message : 'Error processing reminder';
        result.errors.push(`Reminder ${rem.id}: ${msg}`);
      }
    }

    // 2. Evaluator: Check Overdue Debts
    const activeUsers = await db.select({ id: users.id }).from(users).where(eq(users.status, 'active')).limit(20);
    const todayStr = currentTime.toISOString().split('T')[0];

    for (const u of activeUsers) {
      const overdueDebts = await db
        .select()
        .from(financeDebts)
        .where(
          and(
            eq(financeDebts.userId, u.id),
            eq(financeDebts.isPaidOff, 0),
            lte(financeDebts.dueDate, todayStr)
          )
        )
        .limit(10);

      result.overdueDebtsChecked += overdueDebts.length;

      for (const debt of overdueDebts) {
        if ((debt.totalOwedCents || 0) <= 0) continue;

        // Check if debt overdue alert already sent in the last 24 hours
        const existingAlert = await db
          .select()
          .from(inAppNotifications)
          .where(
            and(
              eq(inAppNotifications.userId, u.id),
              eq(inAppNotifications.entityType, 'finance_transaction'),
              eq(inAppNotifications.entityId, debt.id)
            )
          )
          .orderBy(desc(inAppNotifications.createdAt))
          .limit(1);

        const hasRecentAlert =
          existingAlert.length > 0 &&
          currentTime.getTime() - existingAlert[0].createdAt.getTime() < 24 * 60 * 60 * 1000;

        if (!hasRecentAlert) {
          await db.insert(inAppNotifications).values({
            id: `notif_${crypto.randomUUID()}`,
            userId: u.id,
            type: 'reminder',
            title: `Debt Overdue: ${debt.name}`,
            body: `Payment of $${(debt.totalOwedCents / 100).toFixed(2)} was due on ${debt.dueDate}`,
            level: 'warning',
            entityType: 'finance_transaction',
            entityId: debt.id,
            actionUrl: `/finance?tab=debts&id=${debt.id}`,
            isRead: 0,
            createdAt: currentTime,
          });
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fatal error in reminder processor';
    result.errors.push(`Scheduler fatal: ${msg}`);
  }

  return result;
}
