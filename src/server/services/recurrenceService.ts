import { eq, and } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import { tasks, recurrenceRules, recurrenceExceptions, taskChecklistItems } from '../db/schema';
import { shiftCalendarDate } from '../../shared/utils/date';

/**
 * Checks if a given calendar date matches a recurrence rule.
 */
export function isDateMatchingRule(
  calendarDate: string,
  rule: {
    frequency: string;
    interval: number;
    byDayOfWeek?: number[] | null;
    byDayOfMonth?: number | null;
    byMonth?: number | null;
    startDate: string;
    endType: string;
    endDate?: string | null;
  }
): boolean {
  if (calendarDate < rule.startDate) return false;
  if (rule.endType === 'until_date' && rule.endDate && calendarDate > rule.endDate) {
    return false;
  }

  const [y, m, d] = calendarDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 1 is Monday, ...

  if (rule.frequency === 'daily') {
    // Calculate difference in days from start date
    const [sy, sm, sd] = rule.startDate.split('-').map(Number);
    const startObj = new Date(Date.UTC(sy, sm - 1, sd));
    const diffDays = Math.round((dateObj.getTime() - startObj.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays % rule.interval === 0;
  }

  if (rule.frequency === 'weekly') {
    // If byDayOfWeek specified, check day
    if (rule.byDayOfWeek && rule.byDayOfWeek.length > 0) {
      if (!rule.byDayOfWeek.includes(dayOfWeek)) return false;
    }
    // Calculate difference in weeks
    const [sy, sm, sd] = rule.startDate.split('-').map(Number);
    const startObj = new Date(Date.UTC(sy, sm - 1, sd));
    const diffWeeks = Math.floor(
      (dateObj.getTime() - startObj.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return diffWeeks % rule.interval === 0;
  }

  if (rule.frequency === 'monthly') {
    if (rule.byDayOfMonth && d !== rule.byDayOfMonth) return false;
    const [sy, sm] = rule.startDate.split('-').map(Number);
    const diffMonths = (y - sy) * 12 + (m - sm);
    return diffMonths % rule.interval === 0;
  }

  if (rule.frequency === 'yearly') {
    if (rule.byMonth && m !== rule.byMonth) return false;
    if (rule.byDayOfMonth && d !== rule.byDayOfMonth) return false;
    const [sy] = rule.startDate.split('-').map(Number);
    return (y - sy) % rule.interval === 0;
  }

  return false;
}

/**
 * Materializes occurrences for active recurrence rules up to a target calendar date.
 * Rules:
 * - Never reuse or overwrite completed recurring task rows.
 * - Respects recurrence_exceptions (skips, cancels, reschedules).
 * - Avoids duplicate generation if an occurrence already exists.
 */
export async function generateOccurrencesForUser(
  d1: D1Database,
  userId: string,
  targetDate: string
): Promise<{ generatedCount: number }> {
  const db = createDb(d1);

  // Fetch active rules for user
  const activeRules = await db
    .select()
    .from(recurrenceRules)
    .where(and(eq(recurrenceRules.userId, userId), eq(recurrenceRules.isActive, 1)));

  let generatedCount = 0;

  for (const rule of activeRules) {
    // Fetch template task
    const template = (
      await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, rule.templateTaskId), eq(tasks.userId, userId)))
        .limit(1)
    )[0];

    if (!template) continue;

    const startDate = template.dueDate || template.startDate || rule.createdAt.toISOString().slice(0, 10);
    const fromDate = rule.lastGeneratedDate ? shiftCalendarDate(rule.lastGeneratedDate, 1) : startDate;

    if (fromDate > targetDate) continue;

    // Fetch exceptions for rule
    const exceptions = await db
      .select()
      .from(recurrenceExceptions)
      .where(
        and(
          eq(recurrenceExceptions.userId, userId),
          eq(recurrenceExceptions.recurrenceRuleId, rule.id)
        )
      );
    const exceptionMap = new Map<string, typeof exceptions[0]>();
    for (const ex of exceptions) {
      exceptionMap.set(ex.occurrenceDate, ex);
    }

    let cursorDate = fromDate;
    while (cursorDate <= targetDate) {
      const parsedRule = {
        frequency: rule.frequency,
        interval: rule.interval,
        byDayOfWeek: rule.byDayOfWeek ? JSON.parse(rule.byDayOfWeek) : null,
        byDayOfMonth: rule.byDayOfMonth,
        byMonth: rule.byMonth,
        startDate,
        endType: rule.endType,
        endDate: rule.endDate,
      };

      if (isDateMatchingRule(cursorDate, parsedRule)) {
        const exception = exceptionMap.get(cursorDate);

        if (!exception || (exception.action !== 'skip' && exception.action !== 'cancel')) {
          // Check if occurrence already materialized
          const existingOccurrence = (
            await db
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.userId, userId),
                  eq(tasks.recurrenceRuleId, rule.id),
                  eq(tasks.recurrenceOccurrenceDate, cursorDate)
                )
              )
              .limit(1)
          )[0];

          if (!existingOccurrence) {
            const occurrenceId = `tsk_${crypto.randomUUID()}`;
            const actualDueDate =
              exception?.action === 'reschedule' && exception.rescheduledToDate
                ? exception.rescheduledToDate
                : cursorDate;

            const now = new Date();

            await db.insert(tasks).values({
              id: occurrenceId,
              userId,
              projectId: template.projectId,
              boardId: template.boardId,
              boardColumnId: template.boardColumnId,
              categoryId: template.categoryId,
              parentTaskId: null,
              title: template.title,
              description: template.description,
              status: 'todo',
              priority: template.priority,
              dueDate: actualDueDate,
              dueTime: template.dueTime,
              startDate: cursorDate,
              sortOrder: template.sortOrder,
              sortOrderBoard: template.sortOrderBoard,
              estimatedMinutes: template.estimatedMinutes,
              actualMinutes: null,
              recurrenceRuleId: rule.id,
              recurrenceOccurrenceDate: cursorDate,
              isRecurringTemplate: 0,
              createdAt: now,
              updatedAt: now,
            });

            // Clone checklist items if template has any
            const templateItems = await db
              .select()
              .from(taskChecklistItems)
              .where(
                and(
                  eq(taskChecklistItems.userId, userId),
                  eq(taskChecklistItems.taskId, template.id)
                )
              );

            for (const item of templateItems) {
              await db.insert(taskChecklistItems).values({
                id: `chk_${crypto.randomUUID()}`,
                userId,
                taskId: occurrenceId,
                title: item.title,
                isCompleted: 0,
                sortOrder: item.sortOrder,
                createdAt: now,
                updatedAt: now,
              });
            }

            generatedCount++;
          }
        }
      }

      cursorDate = shiftCalendarDate(cursorDate, 1);
    }

    // Update lastGeneratedDate on rule
    await db
      .update(recurrenceRules)
      .set({ lastGeneratedDate: targetDate, updatedAt: new Date() })
      .where(eq(recurrenceRules.id, rule.id));
  }

  return { generatedCount };
}
