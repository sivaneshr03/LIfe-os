import { eq, and, lt, sql, desc, inArray } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import {
  tasks,
  projects,
  dailyNotes,
  reminders,
  userPreferences,
} from '../db/schema';
import { getTodayCalendarDate } from '../../shared/utils/date';
import { generateOccurrencesForUser } from './recurrenceService';
import type {
  TodayDashboardData,
  TaskData,
  DailyNoteData,
  TaskStatus,
  TaskPriority,
} from '../../shared/productivityTypes';

export async function getTodayDashboard(
  d1: D1Database,
  userId: string
): Promise<TodayDashboardData> {
  const db = createDb(d1);

  // 1. Get user timezone preference
  const prefs = (
    await db
      .select({ timezone: userPreferences.timezone })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1)
  )[0];

  const timeZone = prefs?.timezone || 'UTC';
  const today = getTodayCalendarDate(timeZone);

  // 2. On-demand materialize recurring tasks for today
  await generateOccurrencesForUser(d1, userId, today);

  // 3. Compute day boundaries in UTC ms
  const [y, m, d] = today.split('-').map(Number);
  const startOfDayUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endOfDayUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  // 4. Overdue tasks
  const overdueRows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isRecurringTemplate, 0),
        lt(tasks.dueDate, today),
        sql`${tasks.status} NOT IN ('done', 'archived')`
      )
    )
    .orderBy(desc(tasks.priority), tasks.dueDate);

  // 5. Today's tasks (due today, not yet done or archived)
  const todayRows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isRecurringTemplate, 0),
        eq(tasks.dueDate, today),
        sql`${tasks.status} NOT IN ('done', 'archived')`
      )
    )
    .orderBy(desc(tasks.priority), tasks.sortOrder, tasks.dueTime);

  // 6. Completed today
  const completedRows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isRecurringTemplate, 0),
        eq(tasks.status, 'done'),
        sql`(${tasks.completedAt} >= ${startOfDayUtcMs} OR ${tasks.dueDate} = ${today})`
      )
    )
    .orderBy(desc(tasks.completedAt));

  function mapTask(row: typeof tasks.$inferSelect): TaskData {
    return {
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      boardId: row.boardId,
      boardColumnId: row.boardColumnId,
      categoryId: row.categoryId,
      parentTaskId: row.parentTaskId,
      title: row.title,
      description: row.description,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      dueDate: row.dueDate,
      dueTime: row.dueTime,
      dueTimestampMs: row.dueTimestampMs ? row.dueTimestampMs.getTime() : null,
      startDate: row.startDate,
      completedAt: row.completedAt ? row.completedAt.getTime() : null,
      archivedAt: row.archivedAt ? row.archivedAt.getTime() : null,
      sortOrder: row.sortOrder,
      sortOrderBoard: row.sortOrderBoard,
      estimatedMinutes: row.estimatedMinutes,
      actualMinutes: row.actualMinutes,
      recurrenceRuleId: row.recurrenceRuleId,
      recurrenceOccurrenceDate: row.recurrenceOccurrenceDate,
      isRecurringTemplate: Boolean(row.isRecurringTemplate),
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  // 7. Daily note for today
  const dailyNoteRow = (
    await db
      .select()
      .from(dailyNotes)
      .where(and(eq(dailyNotes.userId, userId), eq(dailyNotes.date, today)))
      .limit(1)
  )[0];

  let dailyNote: DailyNoteData | null = null;
  if (dailyNoteRow) {
    dailyNote = {
      id: dailyNoteRow.id,
      userId: dailyNoteRow.userId,
      date: dailyNoteRow.date,
      content: dailyNoteRow.content,
      summary: dailyNoteRow.summary,
      mood: dailyNoteRow.mood,
      energy: dailyNoteRow.energy,
      wordCount: dailyNoteRow.wordCount,
      isPinned: Boolean(dailyNoteRow.isPinned),
      createdAt: dailyNoteRow.createdAt.getTime(),
      updatedAt: dailyNoteRow.updatedAt.getTime(),
    };
  }

  // 8. Reminders due today
  const dueReminders = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        inArray(reminders.status, ['pending', 'snoozed']),
        sql`${reminders.remindAt} <= ${endOfDayUtcMs}`
      )
    )
    .orderBy(reminders.remindAt);

  // 9. Active projects with task counts
  const activeProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      color: projects.color,
      openCount: sql<number>`(SELECT count(*) FROM tasks WHERE tasks.project_id = ${projects.id} AND tasks.status NOT IN ('done', 'archived'))`,
    })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.status, 'active')))
    .orderBy(projects.sortOrder, projects.name);

  return {
    date: today,
    overdueTasks: overdueRows.map(mapTask),
    todayTasks: todayRows.map(mapTask),
    completedTodayTasks: completedRows.map(mapTask),
    completedTodayCount: completedRows.length,
    totalTodayCount: todayRows.length + completedRows.length,
    dailyNote,
    pendingReminders: dueReminders.map((r) => ({
      id: r.id,
      title: r.title,
      remindAt: r.remindAt.getTime(),
      entityType: r.entityType,
      entityId: r.entityId,
    })),
    activeProjects: activeProjects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      openTaskCount: Number(p.openCount || 0),
    })),
  };
}
