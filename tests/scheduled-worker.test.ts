import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase } from './test-db';
import {
  processDueReminders,
  calculateNextRecurrence,
  getEntityActionUrl,
} from '../src/server/services/reminderProcessor';
import { reminders, inAppNotifications, users, financeDebts } from '../src/server/db/schema';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/server/db/client';

describe('Scheduled Worker & Reminder Processor Suite', () => {
  let testD1: D1Database;
  let disposeDb: () => Promise<void>;
  let testUserId: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeDb = dispose;

    const dbClient = createDb(testD1);
    testUserId = 'user_worker_test';

    // Insert test user
    await dbClient.insert(users).values({
      id: testUserId,
      email: 'worker@test.local',
      name: 'Worker Tester',
      passwordHash: 'argon2-dummy-hash',
      salt: 'dummy-salt-1234',
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (disposeDb) {
      await disposeDb();
    }
  });

  describe('calculateNextRecurrence & getEntityActionUrl Helpers', () => {
    it('calculates next daily, weekly, monthly, and yearly recurrences accurately', () => {
      const base = new Date('2026-10-18T09:00:00Z');

      const nextDaily = calculateNextRecurrence(base, 'DAILY');
      expect(nextDaily?.toISOString().split('T')[0]).toBe('2026-10-19');

      const nextWeekly = calculateNextRecurrence(base, 'FREQ=WEEKLY');
      expect(nextWeekly?.toISOString().split('T')[0]).toBe('2026-10-25');

      const nextMonthly = calculateNextRecurrence(base, 'MONTHLY');
      expect(nextMonthly?.toISOString().split('T')[0]).toBe('2026-11-18');

      const nextYearly = calculateNextRecurrence(base, 'YEARLY');
      expect(nextYearly?.toISOString().split('T')[0]).toBe('2027-10-18');

      const invalid = calculateNextRecurrence(base, 'UNKNOWN_RULE');
      expect(invalid).toBeNull();
    });

    it('generates correct deep link URLs for different entity types', () => {
      expect(getEntityActionUrl('task', 'task_123')).toBe('/tasks?id=task_123');
      expect(getEntityActionUrl('finance_budget', 'bgt_456')).toBe('/finance?tab=budgets&id=bgt_456');
      expect(getEntityActionUrl('finance_transaction', 'tx_789')).toBe(
        '/finance?tab=transactions&id=tx_789'
      );
      expect(getEntityActionUrl('goal', 'goal_999')).toBe('/goals?id=goal_999');
      expect(getEntityActionUrl('note', 'note_111')).toBe('/notes?id=note_111');
      expect(getEntityActionUrl('task', null)).toBe('/tasks');
    });
  });

  describe('processDueReminders Batch & Deduplication Execution', () => {
    it('processes due reminders, inserts in-app notifications, and marks reminders as triggered', async () => {
      const dbClient = createDb(testD1);
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago

      // Insert 2 due reminders
      await dbClient.insert(reminders).values([
        {
          id: 'rem_due_1',
          userId: testUserId,
          entityType: 'task',
          entityId: 'task_abc',
          title: 'Review Quarterly Report',
          description: 'Ensure ledger reconciles',
          remindAt: pastTime,
          status: 'pending',
          createdAt: pastTime,
          updatedAt: pastTime,
        },
        {
          id: 'rem_due_2',
          userId: testUserId,
          entityType: 'goal',
          entityId: 'goal_xyz',
          title: 'Check Milestone Progress',
          remindAt: pastTime,
          status: 'pending',
          createdAt: pastTime,
          updatedAt: pastTime,
        },
      ]);

      const result = await processDueReminders(testD1, new Date(), 50);

      expect(result.processedReminders).toBe(2);
      expect(result.triggeredReminders).toBe(2);
      expect(result.errors.length).toBe(0);

      // Verify status updated to triggered in DB
      const r1 = (await dbClient.select().from(reminders).where(eq(reminders.id, 'rem_due_1')))[0];
      expect(r1.status).toBe('triggered');

      // Verify in-app notifications were created
      const notifs = await dbClient
        .select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.userId, testUserId));
      expect(notifs.length).toBeGreaterThanOrEqual(2);
      expect(notifs.some((n) => n.title === 'Review Quarterly Report')).toBe(true);
    });

    it('enforces idempotency: does not create duplicate notifications on immediate re-run', async () => {
      const dbClient = createDb(testD1);
      const notifsBefore = await dbClient
        .select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.userId, testUserId));

      // Re-run processor
      const secondRunResult = await processDueReminders(testD1, new Date(), 50);

      // Since previous reminders were already marked 'triggered', 0 should be due
      expect(secondRunResult.processedReminders).toBe(0);

      const notifsAfter = await dbClient
        .select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.userId, testUserId));
      expect(notifsAfter.length).toBe(notifsBefore.length);
    });

    it('generates next recurring reminder when recurrenceRule is configured', async () => {
      const dbClient = createDb(testD1);
      const pastTime = new Date('2026-10-18T10:00:00Z');
      const now = new Date('2026-10-18T10:05:00Z');

      await dbClient.insert(reminders).values({
        id: 'rem_recurring_1',
        userId: testUserId,
        entityType: 'habit',
        entityId: 'habit_water',
        title: 'Drink 2L Water Daily',
        remindAt: pastTime,
        recurrenceRule: 'DAILY',
        status: 'pending',
        createdAt: pastTime,
        updatedAt: pastTime,
      });

      const result = await processDueReminders(testD1, now, 50);
      expect(result.recurringGenerated).toBe(1);

      // Verify a new pending reminder exists with next day's date
      const habitReminders = await dbClient
        .select()
        .from(reminders)
        .where(eq(reminders.entityId, 'habit_water'));
      expect(habitReminders.length).toBe(2);
      const newPending = habitReminders.find((r) => r.status === 'pending');
      expect(newPending).toBeDefined();
      expect(newPending?.remindAt.toISOString().split('T')[0]).toBe('2026-10-19');
    });

    it('evaluates and triggers overdue debt alert notifications', async () => {
      const dbClient = createDb(testD1);
      const now = new Date('2026-10-25T12:00:00Z');

      // Insert overdue debt
      await dbClient.insert(financeDebts).values({
        id: 'debt_overdue_test',
        userId: testUserId,
        name: 'Loan to Alex Borrower',
        creditor: 'Alex Borrower',
        totalOwedCents: 25000, // $250.00 remaining
        dueDate: '2026-10-20', // was due 5 days ago
        isPaidOff: 0,
        createdAt: new Date('2026-10-01'),
        updatedAt: new Date('2026-10-01'),
      });

      const result = await processDueReminders(testD1, now, 50);
      expect(result.overdueDebtsChecked).toBeGreaterThanOrEqual(1);

      const notifs = await dbClient
        .select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.entityId, 'debt_overdue_test'));
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toContain('Debt Overdue: Loan to Alex Borrower');
      expect(notifs[0].level).toBe('warning');
    });
  });
});
