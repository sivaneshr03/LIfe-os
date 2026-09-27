export const habitFrequencyEnum = ['daily', 'weekly', 'custom_days'] as const;
export type HabitFrequency = (typeof habitFrequencyEnum)[number];

export const trackerTypeEnum = ['numeric', 'boolean', 'rating', 'duration', 'count', 'text'] as const;
export type TrackerType = (typeof trackerTypeEnum)[number];

export const trackerPeriodEnum = ['daily', 'weekly', 'monthly'] as const;
export type TrackerPeriod = (typeof trackerPeriodEnum)[number];

export const workoutTypeEnum = ['strength', 'cardio', 'flexibility', 'sport', 'other'] as const;
export type WorkoutType = (typeof workoutTypeEnum)[number];

export const goalStatusEnum = ['not_started', 'in_progress', 'completed', 'abandoned'] as const;
export type GoalStatus = (typeof goalStatusEnum)[number];

export const goalTimeframeEnum = ['short_term', 'medium_term', 'long_term'] as const;
export type GoalTimeframe = (typeof goalTimeframeEnum)[number];

export const setTypeEnum = ['warmup', 'normal', 'drop', 'failure'] as const;
export type SetType = (typeof setTypeEnum)[number];

// ==========================================
// HABIT TYPES
// ==========================================

export interface HabitData {
  id: string;
  userId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  frequencyType: HabitFrequency;
  targetDaysPerWeek: number;
  targetDaysOfWeek?: number[] | null; // 0=Sun, 1=Mon, ..., 6=Sat
  color?: string | null;
  icon?: string | null;
  archived: boolean;
  sortOrder: number;
  currentStreak?: number;
  longestStreak?: number;
  completionRate30d?: number; // 0-100%
  completedToday?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface HabitLogData {
  id: string;
  userId: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  notes?: string | null;
  createdAt: number;
}

export interface HabitStreakStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate30d: number;
  completionRate90d: number;
  heatmap: Array<{ date: string; completed: boolean }>;
}

// ==========================================
// TRACKER TYPES
// ==========================================

export interface TrackerData {
  id: string;
  userId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  type: TrackerType;
  unit?: string | null;
  targetValue?: number | null;
  targetPeriod?: TrackerPeriod | null;
  color?: string | null;
  icon?: string | null;
  archived: boolean;
  sortOrder: number;
  latestValue?: number | null;
  latestTextValue?: string | null;
  latestDate?: string | null;
  entryCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TrackerEntryData {
  id: string;
  userId: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  timestampMs: number;
  value: number;
  textValue?: string | null;
  notes?: string | null;
  createdAt: number;
}

export interface TrackerStatsData {
  trackerId: string;
  totalEntries: number;
  sumValue?: number | null;
  avgValue?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  history30d: Array<{ date: string; value: number; textValue?: string | null }>;
}

// ==========================================
// FITNESS & WORKOUT TYPES
// ==========================================

export interface ExerciseSet {
  setNumber: number;
  reps?: number | null;
  weightGrams?: number | null; // integer grams (e.g., 80000 = 80kg)
  weightKg?: number | null; // helper representation
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  rpe?: number | null; // 1-10
  setType?: SetType | null;
  isCompleted?: boolean | null;
}

export interface WorkoutExerciseData {
  id: string;
  userId: string;
  workoutId: string;
  exerciseName: string;
  sortOrder: number;
  sets: ExerciseSet[];
  notes?: string | null;
  createdAt: number;
}

export interface WorkoutData {
  id: string;
  userId: string;
  name: string;
  type: WorkoutType;
  date: string; // YYYY-MM-DD
  durationMinutes?: number | null;
  caloriesBurned?: number | null;
  notes?: string | null;
  exerciseCount?: number;
  totalTonnageGrams?: number;
  exercises?: WorkoutExerciseData[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutTemplateExerciseData {
  id: string;
  userId: string;
  templateId: string;
  exerciseName: string;
  targetSets: number;
  targetReps?: number | null;
  targetWeightGrams?: number | null;
  targetDurationSeconds?: number | null;
  restSeconds?: number | null;
  sortOrder: number;
  notes?: string | null;
  createdAt: number;
}

export interface WorkoutTemplateData {
  id: string;
  userId: string;
  name: string;
  type: WorkoutType;
  description?: string | null;
  category?: string | null;
  defaultRestSeconds: number;
  sortOrder: number;
  exerciseCount?: number;
  exercises?: WorkoutTemplateExerciseData[];
  createdAt: number;
  updatedAt: number;
}

export interface BodyMeasurementData {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  weightGrams?: number | null; // integer grams
  bodyFatBps?: number | null; // basis points (100 = 1%)
  chestMm?: number | null;
  waistMm?: number | null;
  hipsMm?: number | null;
  bicepLeftMm?: number | null;
  bicepRightMm?: number | null;
  thighLeftMm?: number | null;
  thighRightMm?: number | null;
  calfLeftMm?: number | null;
  calfRightMm?: number | null;
  neckMm?: number | null;
  shoulderMm?: number | null;
  forearmMm?: number | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalRecordData {
  exerciseName: string;
  maxWeightGrams: number;
  maxReps: number;
  estimatedOneRepMaxGrams: number;
  achievedAtDate: string;
  workoutId: string;
}

export interface FitnessStatsData {
  totalWorkouts: number;
  totalTonnageGrams: number;
  totalSets: number;
  totalReps: number;
  totalDurationMinutes: number;
  weeklyTonnage: Array<{ week: string; tonnageGrams: number; workoutCount: number }>;
  bodyWeightMovingAverage7d?: Array<{ date: string; weightGrams: number; movingAvgGrams: number }>;
  personalRecords: PersonalRecordData[];
}

// ==========================================
// GOAL TYPES
// ==========================================

export interface GoalMilestoneData {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  isCompleted: boolean;
  dueDate?: string | null; // YYYY-MM-DD
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalProgressLogData {
  id: string;
  userId: string;
  goalId: string;
  milestoneId?: string | null;
  previousProgress: number;
  newProgress: number;
  changeDelta: number;
  notes?: string | null;
  loggedAt: string;
  createdAt: number;
}

export interface GoalTaskLinkData {
  id: string;
  userId: string;
  goalId: string;
  taskId: string;
  milestoneId?: string | null;
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
  createdAt: number;
}

export interface GoalData {
  id: string;
  userId: string;
  categoryId?: string | null;
  projectId?: string | null;
  title: string;
  description?: string | null;
  timeframe?: GoalTimeframe | null;
  targetDate?: string | null; // YYYY-MM-DD
  status: GoalStatus;
  progressPercentage: number; // 0-100
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
  milestoneCount?: number;
  completedMilestoneCount?: number;
  milestones?: GoalMilestoneData[];
  linkedTasks?: GoalTaskLinkData[];
  progressLogs?: GoalProgressLogData[];
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// INSIGHTS TYPES
// ==========================================

export interface HeatmapDayScore {
  date: string;
  activityScore: number; // 0-100 normalized score
  tasksCompleted: number;
  habitsCompleted: number;
  workoutsLogged: number;
}

export interface TaskInsightsData {
  completedPast7d: number;
  completedPast30d: number;
  completionRate30d: number;
  overdueTasksCount: number;
  averageLeadDays: number;
  velocityByWeek: Array<{ week: string; count: number }>;
  byCategory: Array<{ categoryName: string; count: number }>;
}

export interface GoalInsightsData {
  totalGoals: number;
  completedGoals: number;
  inProgressGoals: number;
  averageProgress: number;
  onTrackCount: number;
  atRiskCount: number;
  byTimeframe: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
}

export interface TrackerInsightsData {
  activeHabitsCount: number;
  overallConsistencyRate30d: number;
  longestActiveStreakDays: number;
  topHabitName: string;
  habitsOverview: Array<{ name: string; currentStreak: number; completionRate30d: number }>;
}

export interface FitnessInsightsData {
  workoutsPast30d: number;
  tonnagePast30dGrams: number;
  averageDurationMinutes: number;
  latestWeightGrams?: number | null;
  weightDeltaPast30dGrams?: number | null;
  topExercises: Array<{ name: string; prOneRepMaxGrams: number }>;
}

export interface InsightsOverviewData {
  tasks: TaskInsightsData;
  goals: GoalInsightsData;
  trackers: TrackerInsightsData;
  fitness: FitnessInsightsData;
  heatmap365: HeatmapDayScore[];
  generatedAt: number;
}
