import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { isDateMatchingRule, generateOccurrencesForUser } from '../src/server/services/recurrenceService';
import { createTestDatabase } from './test-db';
import { createDb } from '../src/server/db/client';
import { users, tasks, recurrenceRules, recurrenceExceptions } from '../src/server/db/schema';
import { hashPassword } from '../src/server/lib/crypto';

describe('Recurrence Engine Suite', () => {
  describe('Rule Date Matching Logic', () => {
    it('matches daily frequency with intervals correctly', () => {
      const rule = {
        frequency: 'daily',
        interval: 2,
        startDate: '2026-10-01',
        endType: 'never',
      };

      expect(isDateMatchingRule('2026-10-01', rule)).toBe(true);
      expect(isDateMatchingRule('2026-10-02', rule)).toBe(false);
      expect(isDateMatchingRule('2026-10-03', rule)).toBe(true);
      expect(isDateMatchingRule('2026-09-30', rule)).toBe(false); // Before start date
    });

    it('matches weekly frequency with day-of-week filter', () => {
      // 2026-10-05 is Monday (day 1), 2026-10-07 is Wednesday (day 3)
      const rule = {
        frequency: 'weekly',
        interval: 1,
        byDayOfWeek: [1, 3], // Mon, Wed
        startDate: '2026-10-05',
        endType: 'never',
      };

      expect(isDateMatchingRule('2026-10-05', rule)).toBe(true); // Monday
      expect(isDateMatchingRule('2026-10-06', rule)).toBe(false); // Tuesday
      expect(isDateMatchingRule('2026-10-07', rule)).toBe(true); // Wednesday
      expect(isDateMatchingRule('2026-10-08', rule)).toBe(false); // Thursday
    });

    it('matches monthly frequency on specific day of month', () => {
      const rule = {
        frequency: 'monthly',
        interval: 1,
        byDayOfMonth: 15,
        startDate: '2026-01-15',
        endType: 'never',
      };

      expect(isDateMatchingRule('2026-01-15', rule)).toBe(true);
      expect(isDateMatchingRule('2026-02-15', rule)).toBe(true);
      expect(isDateMatchingRule('2026-02-14', rule)).toBe(false);
    });

    it('respects end date boundaries', () => {
      const rule = {
        frequency: 'daily',
        interval: 1,
        startDate: '2026-10-01',
        endType: 'until_date',
        endDate: '2026-10-03',
      };

      expect(isDateMatchingRule('2026-10-01', rule)).toBe(true);
      expect(isDateMatchingRule('2026-10-03', rule)).toBe(true);
      expect(isDateMatchingRule('2026-10-04', rule)).toBe(false);
    });
  });

  describe('Occurrence Generation & Invariant Preservations', () => {
    let testD1: D1Database;
    let disposeD1: () => Promise<void>;
    const userId = 'usr_recurrence_tester';

    beforeAll(async () => {
      const { db, dispose } = await createTestDatabase();
      testD1 = db;
      disposeD1 = dispose;

      const orm = createDb(testD1);
      const { hash, salt } = await hashPassword('TestPassword123!');
      await orm.insert(users).values({
        id: userId,
        email: 'recurrence@test.com',
        name: 'Recurrence Tester',
        passwordHash: hash,
        salt,
        role: 'user',
        status: 'active',
      });
    });

    afterAll(async () => {
      if (disposeD1) await disposeD1();
    });

    it('never reuses or overwrites completed recurring task rows', async () => {
      const orm = createDb(testD1);
      const templateTaskId = 'tsk_rec_template_1';
      const ruleId = 'rcr_rule_1';
      const now = new Date();

      // 1. Insert template task
      await orm.insert(tasks).values({
        id: templateTaskId,
        userId,
        title: 'Daily Morning Standup',
        status: 'todo',
        priority: 'high',
        startDate: '2026-10-01',
        dueDate: '2026-10-01',
        isRecurringTemplate: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Insert recurrence rule (daily, interval 1)
      await orm.insert(recurrenceRules).values({
        id: ruleId,
        userId,
        templateTaskId,
        frequency: 'daily',
        interval: 1,
        endType: 'never',
        timezone: 'UTC',
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 3. Link recurrence rule back to template task
      await orm
        .update(tasks)
        .set({ recurrenceRuleId: ruleId })
        .where(eq(tasks.id, templateTaskId));

      // 3. Generate occurrences up to 2026-10-02
      const gen1 = await generateOccurrencesForUser(testD1, userId, '2026-10-02');
      expect(gen1.generatedCount).toBeGreaterThanOrEqual(2);

      // Verify occurrences in DB
      const occurrencesDay1 = await orm
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.recurrenceRuleId, ruleId),
            eq(tasks.recurrenceOccurrenceDate, '2026-10-01'),
            eq(tasks.isRecurringTemplate, 0)
          )
        );
      expect(occurrencesDay1.length).toBe(1);
      const occurrence1Id = occurrencesDay1[0].id;

      // 4. User completes Day 1 occurrence
      const completedTimestamp = new Date('2026-10-01T10:00:00Z');
      await orm
        .update(tasks)
        .set({
          status: 'done',
          completedAt: completedTimestamp,
        })
        .where(eq(tasks.id, occurrence1Id));

      // 5. Run generator again for the next day 2026-10-03
      const gen2 = await generateOccurrencesForUser(testD1, userId, '2026-10-03');
      expect(gen2.generatedCount).toBeGreaterThanOrEqual(1);

      // 6. Verify Day 1 occurrence was NOT overwritten or reused
      const day1Check = (
        await orm
          .select()
          .from(tasks)
          .where(eq(tasks.id, occurrence1Id))
          .limit(1)
      )[0];

      expect(day1Check.status).toBe('done');
      expect(day1Check.completedAt?.getTime()).toBe(completedTimestamp.getTime());
      expect(day1Check.recurrenceOccurrenceDate).toBe('2026-10-01');

      // 7. Verify Day 2 and Day 3 exist as separate records
      const day2Check = await orm
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.recurrenceRuleId, ruleId),
            eq(tasks.recurrenceOccurrenceDate, '2026-10-02'),
            eq(tasks.isRecurringTemplate, 0)
          )
        );
      expect(day2Check.length).toBe(1);
      expect(day2Check[0].id).not.toBe(occurrence1Id);

      const day3Check = await orm
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.recurrenceRuleId, ruleId),
            eq(tasks.recurrenceOccurrenceDate, '2026-10-03'),
            eq(tasks.isRecurringTemplate, 0)
          )
        );
      expect(day3Check.length).toBe(1);
      expect(day3Check[0].id).not.toBe(occurrence1Id);
    });

    it('respects recurrence exceptions (skip action)', async () => {
      const orm = createDb(testD1);
      const ruleId = 'rcr_rule_1';

      // Log skip exception for 2026-10-04
      await orm.insert(recurrenceExceptions).values({
        id: 'rex_skip_1',
        userId,
        recurrenceRuleId: ruleId,
        occurrenceDate: '2026-10-04',
        action: 'skip',
        reason: 'National Holiday',
        createdAt: new Date(),
      });

      // Generate for 2026-10-04
      await generateOccurrencesForUser(testD1, userId, '2026-10-04');

      // Check that 2026-10-04 was NOT generated
      const day4Occurrences = await orm
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.recurrenceRuleId, ruleId),
            eq(tasks.recurrenceOccurrenceDate, '2026-10-04')
          )
        );
      expect(day4Occurrences.length).toBe(0);
    });
  });
});
