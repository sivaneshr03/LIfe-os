import { eq, and, gte, desc } from 'drizzle-orm';
import { createDb } from '../db/client';
import {
  tasks,
  goals,
  habits,
  habitLogs,
  workouts,
  workoutExercises,
  bodyMeasurements,
  categories,
} from '../db/schema';
import { shiftCalendarDate } from '../../shared/utils/date';
import { calculateHabitStats } from './habitStreakService';
import { calculateSetsTonnageGrams, extractExercisePersonalRecords } from './fitnessCalculationService';
import type {
  InsightsOverviewData,
  TaskInsightsData,
  GoalInsightsData,
  TrackerInsightsData,
  FitnessInsightsData,
  HeatmapDayScore,
  ExerciseSet,
} from '../../shared/trackerTypes';

export async function generateInsightsOverview(
  db: ReturnType<typeof createDb>,
  userId: string,
  todayDate: string
): Promise<InsightsOverviewData> {
  const date7dAgo = shiftCalendarDate(todayDate, -7);
  const date30dAgo = shiftCalendarDate(todayDate, -30);
  const date365dAgo = shiftCalendarDate(todayDate, -365);

  // ----------------------------------------------------
  // 1. TASK INSIGHTS
  // ----------------------------------------------------
  const userTasks = await db
    .select({
      task: tasks,
      categoryName: categories.name,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(eq(tasks.userId, userId));

  let completedPast7d = 0;
  let completedPast30d = 0;
  let totalTasksPast30d = 0;
  let overdueTasksCount = 0;
  let totalLeadDays = 0;
  let completedWithLeadCount = 0;

  const categoryMap: Record<string, number> = {};
  const weeklyTaskVelocity: Record<string, number> = {};

  for (const { task, categoryName } of userTasks) {
    const isCompleted = task.status === 'completed';
    const isOverdue = !isCompleted && task.dueDate && task.dueDate < todayDate;

    if (isOverdue) {
      overdueTasksCount++;
    }

    if (task.completedAt) {
      const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
      if (completedDate >= date7dAgo && completedDate <= todayDate) {
        completedPast7d++;
      }
      if (completedDate >= date30dAgo && completedDate <= todayDate) {
        completedPast30d++;
        // Track lead time from createdAt to completedAt
        const createdDate = new Date(task.createdAt).getTime();
        const doneDate = new Date(task.completedAt).getTime();
        const leadDays = Math.max(0, Math.round((doneDate - createdDate) / (1000 * 60 * 60 * 24)));
        totalLeadDays += leadDays;
        completedWithLeadCount++;
      }

      // Group into week bucket (e.g. YYYY-Www or week start)
      if (completedDate >= date30dAgo) {
        const weekKey = shiftCalendarDate(completedDate, -(new Date(completedDate).getUTCDay()));
        weeklyTaskVelocity[weekKey] = (weeklyTaskVelocity[weekKey] || 0) + 1;
      }
    }

    if (task.createdAt >= new Date(date30dAgo).getTime()) {
      totalTasksPast30d++;
    }

    if (isCompleted) {
      const cat = categoryName || 'Uncategorized';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
  }

  const completionRate30d = totalTasksPast30d > 0
    ? Math.min(100, Math.round((completedPast30d / totalTasksPast30d) * 100))
    : 100;

  const averageLeadDays = completedWithLeadCount > 0
    ? Math.round(totalLeadDays / completedWithLeadCount)
    : 0;

  const velocityByWeek = Object.entries(weeklyTaskVelocity)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const byCategory = Object.entries(categoryMap)
    .map(([categoryName, count]) => ({ categoryName, count }))
    .sort((a, b) => b.count - a.count);

  const taskInsights: TaskInsightsData = {
    completedPast7d,
    completedPast30d,
    completionRate30d,
    overdueTasksCount,
    averageLeadDays,
    velocityByWeek,
    byCategory,
  };

  // ----------------------------------------------------
  // 2. GOAL INSIGHTS
  // ----------------------------------------------------
  const userGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId));

  let completedGoals = 0;
  let inProgressGoals = 0;
  let totalProgress = 0;
  let onTrackCount = 0;
  let atRiskCount = 0;

  const timeframeCounts = {
    shortTerm: 0,
    mediumTerm: 0,
    longTerm: 0,
  };

  for (const g of userGoals) {
    if (g.status === 'completed') completedGoals++;
    if (g.status === 'in_progress') inProgressGoals++;
    totalProgress += g.progressPercentage;

    if (g.timeframe === 'short_term') timeframeCounts.shortTerm++;
    else if (g.timeframe === 'medium_term') timeframeCounts.mediumTerm++;
    else if (g.timeframe === 'long_term') timeframeCounts.longTerm++;

    if (g.status !== 'completed' && g.status !== 'abandoned') {
      if (g.targetDate && g.targetDate < todayDate) {
        atRiskCount++;
      } else {
        onTrackCount++;
      }
    }
  }

  const averageProgress = userGoals.length > 0 ? Math.round(totalProgress / userGoals.length) : 0;

  const goalInsights: GoalInsightsData = {
    totalGoals: userGoals.length,
    completedGoals,
    inProgressGoals,
    averageProgress,
    onTrackCount,
    atRiskCount,
    byTimeframe: timeframeCounts,
  };

  // ----------------------------------------------------
  // 3. TRACKER & HABIT INSIGHTS
  // ----------------------------------------------------
  const userHabits = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.archived, 0)));

  const allHabitLogs = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, date365dAgo)));

  const habitLogsByHabitId: Record<string, Array<{ date: string; completed: number }>> = {};
  const habitLogsByDate: Record<string, number> = {};

  for (const log of allHabitLogs) {
    if (!habitLogsByHabitId[log.habitId]) {
      habitLogsByHabitId[log.habitId] = [];
    }
    habitLogsByHabitId[log.habitId].push({ date: log.date, completed: log.completed });

    if (log.completed) {
      habitLogsByDate[log.date] = (habitLogsByDate[log.date] || 0) + 1;
    }
  }

  let totalConsistencyRate30dSum = 0;
  let longestActiveStreakDays = 0;
  let topHabitName = 'None';
  const habitsOverview: Array<{ name: string; currentStreak: number; completionRate30d: number }> = [];

  for (const habit of userHabits) {
    const logs = habitLogsByHabitId[habit.id] || [];
    const stats = calculateHabitStats(habit, logs, todayDate);

    totalConsistencyRate30dSum += stats.completionRate30d;
    if (stats.currentStreak > longestActiveStreakDays) {
      longestActiveStreakDays = stats.currentStreak;
      topHabitName = habit.name;
    }

    habitsOverview.push({
      name: habit.name,
      currentStreak: stats.currentStreak,
      completionRate30d: stats.completionRate30d,
    });
  }

  const overallConsistencyRate30d = userHabits.length > 0
    ? Math.round(totalConsistencyRate30dSum / userHabits.length)
    : 0;

  const trackerInsights: TrackerInsightsData = {
    activeHabitsCount: userHabits.length,
    overallConsistencyRate30d,
    longestActiveStreakDays,
    topHabitName,
    habitsOverview,
  };

  // ----------------------------------------------------
  // 4. FITNESS INSIGHTS
  // ----------------------------------------------------
  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, date365dAgo)))
    .orderBy(desc(workouts.date));

  const workoutIds = userWorkouts.map((w) => w.id);
  const workoutExercisesList = workoutIds.length > 0
    ? await db
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.userId, userId))
    : [];

  const exercisesByWorkoutId: Record<string, Array<{ exerciseName: string; sets: ExerciseSet[] }>> = {};
  for (const ex of workoutExercisesList) {
    if (!exercisesByWorkoutId[ex.workoutId]) {
      exercisesByWorkoutId[ex.workoutId] = [];
    }
    let parsedSets: ExerciseSet[] = [];
    try {
      parsedSets = typeof ex.sets === 'string' ? JSON.parse(ex.sets) : ex.sets;
    } catch {
      parsedSets = [];
    }
    exercisesByWorkoutId[ex.workoutId].push({
      exerciseName: ex.exerciseName,
      sets: parsedSets,
    });
  }

  let workoutsPast30d = 0;
  let tonnagePast30dGrams = 0;
  let totalDurationMinutes30d = 0;
  const workoutsByDate: Record<string, number> = {};

  const workoutsWithExercises = userWorkouts.map((w) => {
    const exs = exercisesByWorkoutId[w.id] || [];
    workoutsByDate[w.date] = (workoutsByDate[w.date] || 0) + 1;

    if (w.date >= date30dAgo && w.date <= todayDate) {
      workoutsPast30d++;
      if (w.durationMinutes) totalDurationMinutes30d += w.durationMinutes;

      for (const ex of exs) {
        tonnagePast30dGrams += calculateSetsTonnageGrams(ex.sets);
      }
    }

    return {
      id: w.id,
      date: w.date,
      exercises: exs,
    };
  });

  const averageDurationMinutes = workoutsPast30d > 0
    ? Math.round(totalDurationMinutes30d / workoutsPast30d)
    : 0;

  const prs = extractExercisePersonalRecords(workoutsWithExercises);
  const topExercises = Object.values(prs)
    .map((pr) => ({
      name: pr.exerciseName,
      prOneRepMaxGrams: pr.estimatedOneRepMaxGrams,
    }))
    .sort((a, b) => b.prOneRepMaxGrams - a.prOneRepMaxGrams)
    .slice(0, 5);

  // Body Measurements
  const measurements = await db
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, userId), gte(bodyMeasurements.date, date365dAgo)))
    .orderBy(desc(bodyMeasurements.date));

  const latestWeightGrams = measurements.find((m) => m.weightGrams !== null && m.weightGrams !== undefined)?.weightGrams || null;
  const weight30dEntry = measurements.find((m) => m.date <= date30dAgo && m.weightGrams !== null && m.weightGrams !== undefined);
  const weightDeltaPast30dGrams = latestWeightGrams && weight30dEntry?.weightGrams
    ? latestWeightGrams - weight30dEntry.weightGrams
    : null;

  const fitnessInsights: FitnessInsightsData = {
    workoutsPast30d,
    tonnagePast30dGrams,
    averageDurationMinutes,
    latestWeightGrams,
    weightDeltaPast30dGrams,
    topExercises,
  };

  // ----------------------------------------------------
  // 5. 365-DAY UNIFIED HEATMAP
  // ----------------------------------------------------
  const tasksByCompletedDate: Record<string, number> = {};
  for (const { task } of userTasks) {
    if (task.completedAt) {
      const d = new Date(task.completedAt).toISOString().split('T')[0];
      if (d >= date365dAgo && d <= todayDate) {
        tasksByCompletedDate[d] = (tasksByCompletedDate[d] || 0) + 1;
      }
    }
  }

  const heatmap365: HeatmapDayScore[] = [];
  let cursor = date365dAgo;

  while (cursor <= todayDate) {
    const tasksDone = tasksByCompletedDate[cursor] || 0;
    const habitsDone = habitLogsByDate[cursor] || 0;
    const workoutsDone = workoutsByDate[cursor] || 0;

    // Weighted activity score: Tasks * 25, Habits * 25, Workouts * 50 capped at 100
    const rawScore = tasksDone * 25 + habitsDone * 25 + workoutsDone * 50;
    const activityScore = Math.min(100, rawScore);

    heatmap365.push({
      date: cursor,
      activityScore,
      tasksCompleted: tasksDone,
      habitsCompleted: habitsDone,
      workoutsLogged: workoutsDone,
    });

    cursor = shiftCalendarDate(cursor, 1);
  }

  return {
    tasks: taskInsights,
    goals: goalInsights,
    trackers: trackerInsights,
    fitness: fitnessInsights,
    heatmap365,
    generatedAt: Date.now(),
  };
}
