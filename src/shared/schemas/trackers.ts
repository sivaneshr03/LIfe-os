import { z } from 'zod';
import {
  habitFrequencyEnum,
  trackerTypeEnum,
  trackerPeriodEnum,
  workoutTypeEnum,
  goalStatusEnum,
  goalTimeframeEnum,
  setTypeEnum,
} from '../trackerTypes';

// ==========================================
// HABIT SCHEMAS
// ==========================================

export const habitCreateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional().nullable(),
  frequencyType: z.enum(habitFrequencyEnum).default('daily'),
  targetDaysPerWeek: z.number().int().min(1).max(7).default(7),
  targetDaysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const habitUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  frequencyType: z.enum(habitFrequencyEnum).optional(),
  targetDaysPerWeek: z.number().int().min(1).max(7).optional(),
  targetDaysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const habitLogUpsertSchema = z.object({
  completed: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});

// ==========================================
// TRACKER SCHEMAS
// ==========================================

export const trackerCreateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(trackerTypeEnum),
  unit: z.string().max(50).optional().nullable(),
  targetValue: z.number().optional().nullable(),
  targetPeriod: z.enum(trackerPeriodEnum).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const trackerUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  targetValue: z.number().optional().nullable(),
  targetPeriod: z.enum(trackerPeriodEnum).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const trackerEntryCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  value: z.number().default(1),
  textValue: z.string().max(1000).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const trackerEntryUpdateSchema = z.object({
  value: z.number().optional(),
  textValue: z.string().max(1000).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ==========================================
// FITNESS & WORKOUT SCHEMAS
// ==========================================

export const exerciseSetSchema = z.object({
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).optional().nullable(),
  weightGrams: z.number().int().min(0).optional().nullable(),
  weightKg: z.number().min(0).optional().nullable(),
  rpe: z.number().min(1).max(10).optional().nullable(),
  distanceMeters: z.number().min(0).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  setType: z.enum(setTypeEnum).optional().nullable(),
  isCompleted: z.boolean().optional().nullable(),
});

export const workoutExerciseCreateSchema = z.object({
  exerciseName: z.string().min(1, 'Exercise name is required').max(100).trim(),
  sortOrder: z.number().int().optional().default(0),
  sets: z.array(exerciseSetSchema).default([]),
  notes: z.string().max(500).optional().nullable(),
});

export const workoutCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  type: z.enum(workoutTypeEnum).default('strength'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  caloriesBurned: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  exercises: z.array(workoutExerciseCreateSchema).optional(),
});

export const workoutUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  type: z.enum(workoutTypeEnum).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  caloriesBurned: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const workoutTemplateExerciseCreateSchema = z.object({
  exerciseName: z.string().min(1, 'Exercise name is required').max(100).trim(),
  targetSets: z.number().int().min(1).default(3),
  targetReps: z.number().int().min(1).optional().nullable(),
  targetWeightGrams: z.number().int().min(0).optional().nullable(),
  targetDurationSeconds: z.number().int().min(0).optional().nullable(),
  restSeconds: z.number().int().min(0).optional().nullable().default(90),
  sortOrder: z.number().int().optional().default(0),
  notes: z.string().max(500).optional().nullable(),
});

export const workoutTemplateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100).trim(),
  type: z.enum(workoutTypeEnum).default('strength'),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  defaultRestSeconds: z.number().int().min(0).default(90),
  sortOrder: z.number().int().optional().default(0),
  exercises: z.array(workoutTemplateExerciseCreateSchema).optional(),
});

export const workoutTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  type: z.enum(workoutTypeEnum).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  defaultRestSeconds: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
});

export const bodyMeasurementCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  weightGrams: z.number().int().min(10000).max(500000).optional().nullable(), // 10kg - 500kg
  bodyFatBps: z.number().int().min(100).max(7000).optional().nullable(), // 1.00% - 70.00%
  chestMm: z.number().int().min(300).max(2500).optional().nullable(),
  waistMm: z.number().int().min(300).max(2500).optional().nullable(),
  hipsMm: z.number().int().min(300).max(2500).optional().nullable(),
  bicepLeftMm: z.number().int().min(100).max(1000).optional().nullable(),
  bicepRightMm: z.number().int().min(100).max(1000).optional().nullable(),
  thighLeftMm: z.number().int().min(100).max(1500).optional().nullable(),
  thighRightMm: z.number().int().min(100).max(1500).optional().nullable(),
  calfLeftMm: z.number().int().min(100).max(1000).optional().nullable(),
  calfRightMm: z.number().int().min(100).max(1000).optional().nullable(),
  neckMm: z.number().int().min(100).max(1000).optional().nullable(),
  shoulderMm: z.number().int().min(200).max(2000).optional().nullable(),
  forearmMm: z.number().int().min(100).max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const bodyMeasurementUpdateSchema = bodyMeasurementCreateSchema.partial();

// ==========================================
// GOAL SCHEMAS
// ==========================================

export const goalMilestoneCreateSchema = z.object({
  title: z.string().min(1, 'Milestone title is required').max(200).trim(),
  targetValue: z.number().int().default(100),
  currentValue: z.number().int().default(0),
  unit: z.string().max(50).default('%'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const goalMilestoneUpdateSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  targetValue: z.number().int().optional(),
  currentValue: z.number().int().optional(),
  unit: z.string().max(50).optional(),
  isCompleted: z.boolean().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const goalCreateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).optional().nullable(),
  timeframe: z.enum(goalTimeframeEnum).optional().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(goalStatusEnum).default('not_started'),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  milestones: z.array(goalMilestoneCreateSchema).optional(),
});

export const goalUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).optional().nullable(),
  timeframe: z.enum(goalTimeframeEnum).optional().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(goalStatusEnum).optional(),
  progressPercentage: z.number().int().min(0).max(100).optional(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const goalProgressLogCreateSchema = z.object({
  milestoneId: z.string().optional().nullable(),
  newProgress: z.number().int().min(0).max(100),
  notes: z.string().max(1000).optional().nullable(),
  loggedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const goalTaskLinkCreateSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  milestoneId: z.string().optional().nullable(),
});
