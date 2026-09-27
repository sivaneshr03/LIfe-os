import { shiftCalendarDate } from '../../shared/utils/date';
import type { HabitStreakStats } from '../../shared/trackerTypes';

export interface HabitLogSummary {
  date: string; // YYYY-MM-DD
  completed: boolean | number;
}

export interface HabitConfig {
  id: string;
  frequencyType: string; // 'daily' | 'weekly' | 'custom_days'
  targetDaysPerWeek: number;
  targetDaysOfWeek?: number[] | string | null;
}

/**
 * Checks if a specific calendar date is a target day for a given habit.
 */
export function isTargetDayForHabit(calendarDate: string, habit: HabitConfig): boolean {
  if (habit.frequencyType === 'daily') return true;

  if (habit.frequencyType === 'custom_days') {
    let days: number[] | null = null;
    if (typeof habit.targetDaysOfWeek === 'string') {
      try {
        days = JSON.parse(habit.targetDaysOfWeek);
      } catch {
        days = null;
      }
    } else if (Array.isArray(habit.targetDaysOfWeek)) {
      days = habit.targetDaysOfWeek;
    }

    if (!days || days.length === 0) return true;

    const [y, m, d] = calendarDate.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 is Sunday
    return days.includes(dayOfWeek);
  }

  // Weekly habits target any day until the weekly threshold is met
  return true;
}

/**
 * Computes streaks, completion rates, and heatmap for a habit.
 */
export function calculateHabitStats(
  habit: HabitConfig,
  logs: HabitLogSummary[],
  todayDate: string,
  heatmapDays: number = 90
): HabitStreakStats {
  const completedDateSet = new Set<string>();
  for (const log of logs) {
    if (log.completed) {
      completedDateSet.add(log.date);
    }
  }

  // 1. Heatmap for the past heatmapDays
  const heatmap: Array<{ date: string; completed: boolean }> = [];
  const startDate = shiftCalendarDate(todayDate, -(heatmapDays - 1));

  let cursor = startDate;
  while (cursor <= todayDate) {
    heatmap.push({
      date: cursor,
      completed: completedDateSet.has(cursor),
    });
    cursor = shiftCalendarDate(cursor, 1);
  }

  // 2. Current Streak Calculation
  // Walk backwards from today (or yesterday if today isn't completed yet and is a target day)
  let currentStreak = 0;
  let checkDate = todayDate;

  // If today is a target day and not completed yet, check if yesterday was completed
  if (isTargetDayForHabit(todayDate, habit) && !completedDateSet.has(todayDate)) {
    checkDate = shiftCalendarDate(todayDate, -1);
  }

  while (true) {
    if (isTargetDayForHabit(checkDate, habit)) {
      if (completedDateSet.has(checkDate)) {
        currentStreak++;
      } else {
        // Target day was missed -> streak ends
        break;
      }
    }
    // Non-target days (e.g. weekends for weekday habit) are skipped without breaking streak
    checkDate = shiftCalendarDate(checkDate, -1);

    // Guard against infinite loop
    if (currentStreak > 1000) break;
  }

  // 3. Longest Streak Calculation
  // Sort completed dates ascending
  const sortedCompleted = Array.from(completedDateSet).sort();
  let longestStreak = 0;
  let tempStreak = 0;

  if (sortedCompleted.length > 0) {
    let scanDate = sortedCompleted[0];
    const lastDate = sortedCompleted[sortedCompleted.length - 1];

    while (scanDate <= lastDate) {
      if (isTargetDayForHabit(scanDate, habit)) {
        if (completedDateSet.has(scanDate)) {
          tempStreak++;
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      }
      scanDate = shiftCalendarDate(scanDate, 1);
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  // 4. Completion rate for last 30 and 90 days
  function calculateRate(daysCount: number): number {
    let targetDays = 0;
    let completedDays = 0;
    const start = shiftCalendarDate(todayDate, -(daysCount - 1));
    let c = start;

    while (c <= todayDate) {
      if (isTargetDayForHabit(c, habit)) {
        targetDays++;
        if (completedDateSet.has(c)) {
          completedDays++;
        }
      }
      c = shiftCalendarDate(c, 1);
    }

    if (targetDays === 0) return 0;
    return Math.round((completedDays / targetDays) * 100);
  }

  return {
    habitId: habit.id,
    currentStreak,
    longestStreak,
    totalCompletions: completedDateSet.size,
    completionRate30d: calculateRate(30),
    completionRate90d: calculateRate(90),
    heatmap,
  };
}
