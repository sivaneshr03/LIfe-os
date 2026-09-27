import type { ExerciseSet, PersonalRecordData } from '../../shared/trackerTypes';

/**
 * Calculates the Estimated 1-Rep Maximum (1RM) using the Epley formula
 * using exact integer arithmetic in grams:
 * 1RM = weightGrams * (1 + reps / 30) = round(weightGrams * (30 + reps) / 30)
 */
export function calculateOneRepMaxGrams(weightGrams: number, reps: number): number {
  if (weightGrams <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightGrams;
  return Math.round((weightGrams * (30 + reps)) / 30);
}

/**
 * Calculates total tonnage (volume load) in integer grams for a list of exercise sets.
 * Tonnage = sum(weightGrams * reps)
 */
export function calculateSetsTonnageGrams(sets: ExerciseSet[]): number {
  let totalTonnage = 0;
  for (const set of sets) {
    if (set.weightGrams && set.reps && set.weightGrams > 0 && set.reps > 0) {
      totalTonnage += set.weightGrams * set.reps;
    }
  }
  return totalTonnage;
}

/**
 * Calculates 7-day rolling moving average for a series of date-sorted weight entries.
 */
export function calculateWeightMovingAverages(
  measurements: Array<{ date: string; weightGrams?: number | null }>,
  windowDays: number = 7
): Array<{ date: string; weightGrams: number; movingAvgGrams: number }> {
  const sorted = measurements
    .filter((m): m is { date: string; weightGrams: number } => typeof m.weightGrams === 'number' && m.weightGrams > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const result: Array<{ date: string; weightGrams: number; movingAvgGrams: number }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const currentDate = new Date(current.date).getTime();
    const windowStart = currentDate - windowDays * 24 * 60 * 60 * 1000;

    let windowSum = 0;
    let windowCount = 0;

    for (let j = 0; j <= i; j++) {
      const entryTime = new Date(sorted[j].date).getTime();
      if (entryTime >= windowStart && entryTime <= currentDate) {
        windowSum += sorted[j].weightGrams;
        windowCount++;
      }
    }

    const movingAvgGrams = windowCount > 0 ? Math.round(windowSum / windowCount) : current.weightGrams;
    result.push({
      date: current.date,
      weightGrams: current.weightGrams,
      movingAvgGrams,
    });
  }

  return result;
}

/**
 * Extracts Personal Records (PRs) per exercise across historical workout logs.
 */
export function extractExercisePersonalRecords(
  workoutsList: Array<{
    id: string;
    date: string;
    exercises?: Array<{
      exerciseName: string;
      sets: ExerciseSet[];
    }>;
  }>
): Record<string, PersonalRecordData> {
  const prMap: Record<string, PersonalRecordData> = {};

  for (const workout of workoutsList) {
    if (!workout.exercises) continue;
    for (const ex of workout.exercises) {
      const normalizedName = ex.exerciseName.trim();
      if (!normalizedName) continue;

      for (const set of ex.sets) {
        const weightGrams = set.weightGrams || (set.weightKg ? Math.round(set.weightKg * 1000) : 0);
        const reps = set.reps || 0;
        if (weightGrams <= 0 || reps <= 0) continue;

        const estimated1RM = calculateOneRepMaxGrams(weightGrams, reps);
        const existing = prMap[normalizedName];

        if (!existing || estimated1RM > existing.estimatedOneRepMaxGrams) {
          prMap[normalizedName] = {
            exerciseName: normalizedName,
            maxWeightGrams: weightGrams,
            maxReps: reps,
            estimatedOneRepMaxGrams: estimated1RM,
            achievedAtDate: workout.date,
            workoutId: workout.id,
          };
        }
      }
    }
  }

  return prMap;
}
