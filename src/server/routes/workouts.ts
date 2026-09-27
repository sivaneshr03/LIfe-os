import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import {
  workouts,
  workoutExercises,
  workoutTemplates,
  workoutTemplateExercises,
  bodyMeasurements,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  workoutCreateSchema,
  workoutUpdateSchema,
  workoutExerciseCreateSchema,
  workoutTemplateCreateSchema,
  workoutTemplateUpdateSchema,
  bodyMeasurementCreateSchema,
} from '../../shared/schemas/trackers';
import { isValidCalendarDate, shiftCalendarDate } from '../../shared/utils/date';
import {
  calculateSetsTonnageGrams,
  calculateWeightMovingAverages,
  extractExercisePersonalRecords,
} from '../services/fitnessCalculationService';
import type {
  ApiSuccessResponse,
  WorkoutData,
  WorkoutExerciseData,
  WorkoutTemplateData,
  WorkoutTemplateExerciseData,
  BodyMeasurementData,
  FitnessStatsData,
  WorkoutType,
  ExerciseSet,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const workoutsRouter = new Hono<{ Bindings: AppBindings }>();

workoutsRouter.use('*', requireAuth);

// ==========================================
// 1. WORKOUT TEMPLATES ENDPOINTS
// ==========================================

/**
 * GET /api/workouts/templates
 */
workoutsRouter.get('/templates', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({
      template: workoutTemplates,
      exerciseCount: sql<number>`(SELECT count(*) FROM workout_template_exercises WHERE workout_template_exercises.template_id = workout_templates.id)`,
    })
    .from(workoutTemplates)
    .where(eq(workoutTemplates.userId, user.id))
    .orderBy(workoutTemplates.sortOrder, workoutTemplates.createdAt);

  const data: WorkoutTemplateData[] = rows.map(({ template, exerciseCount }) => ({
    id: template.id,
    userId: template.userId,
    name: template.name,
    type: template.type as WorkoutType,
    description: template.description,
    category: template.category,
    defaultRestSeconds: template.defaultRestSeconds,
    sortOrder: template.sortOrder,
    exerciseCount: Number(exerciseCount || 0),
    createdAt: template.createdAt.getTime(),
    updatedAt: template.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<WorkoutTemplateData[]>>({ success: true, data });
});

/**
 * POST /api/workouts/templates
 */
workoutsRouter.post('/templates', zValidator('json', workoutTemplateCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const templateId = `wkt_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(workoutTemplates).values({
    id: templateId,
    userId: user.id,
    name: input.name,
    type: input.type,
    description: input.description || null,
    category: input.category || null,
    defaultRestSeconds: input.defaultRestSeconds ?? 90,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  const createdExercises: WorkoutTemplateExerciseData[] = [];

  if (input.exercises && input.exercises.length > 0) {
    for (const ex of input.exercises) {
      const exId = `wte_${crypto.randomUUID()}`;
      await db.insert(workoutTemplateExercises).values({
        id: exId,
        userId: user.id,
        templateId,
        exerciseName: ex.exerciseName,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps || null,
        targetWeightGrams: ex.targetWeightGrams || 0,
        targetDurationSeconds: ex.targetDurationSeconds || null,
        restSeconds: ex.restSeconds || 90,
        sortOrder: ex.sortOrder ?? 0,
        notes: ex.notes || null,
        createdAt: now,
      });

      createdExercises.push({
        id: exId,
        userId: user.id,
        templateId,
        exerciseName: ex.exerciseName,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps || null,
        targetWeightGrams: ex.targetWeightGrams || 0,
        targetDurationSeconds: ex.targetDurationSeconds || null,
        restSeconds: ex.restSeconds || 90,
        sortOrder: ex.sortOrder ?? 0,
        notes: ex.notes || null,
        createdAt: now.getTime(),
      });
    }
  }

  const data: WorkoutTemplateData = {
    id: templateId,
    userId: user.id,
    name: input.name,
    type: input.type as WorkoutType,
    description: input.description || null,
    category: input.category || null,
    defaultRestSeconds: input.defaultRestSeconds ?? 90,
    sortOrder: input.sortOrder ?? 0,
    exerciseCount: createdExercises.length,
    exercises: createdExercises,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutTemplateData>>({ success: true, data }, 201);
});

/**
 * GET /api/workouts/templates/:id
 */
workoutsRouter.get('/templates/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const [template] = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id)));

  if (!template) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout template not found' } }, 404);
  }

  const exerciseRows = await db
    .select()
    .from(workoutTemplateExercises)
    .where(and(eq(workoutTemplateExercises.templateId, id), eq(workoutTemplateExercises.userId, user.id)))
    .orderBy(workoutTemplateExercises.sortOrder, workoutTemplateExercises.createdAt);

  const exercises: WorkoutTemplateExerciseData[] = exerciseRows.map((ex) => ({
    id: ex.id,
    userId: ex.userId,
    templateId: ex.templateId,
    exerciseName: ex.exerciseName,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    targetWeightGrams: ex.targetWeightGrams,
    targetDurationSeconds: ex.targetDurationSeconds,
    restSeconds: ex.restSeconds,
    sortOrder: ex.sortOrder,
    notes: ex.notes,
    createdAt: ex.createdAt.getTime(),
  }));

  const data: WorkoutTemplateData = {
    id: template.id,
    userId: template.userId,
    name: template.name,
    type: template.type as WorkoutType,
    description: template.description,
    category: template.category,
    defaultRestSeconds: template.defaultRestSeconds,
    sortOrder: template.sortOrder,
    exerciseCount: exercises.length,
    exercises,
    createdAt: template.createdAt.getTime(),
    updatedAt: template.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutTemplateData>>({ success: true, data });
});

/**
 * PATCH /api/workouts/templates/:id
 */
workoutsRouter.patch('/templates/:id', zValidator('json', workoutTemplateUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id)));

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout template not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof workoutTemplates.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.defaultRestSeconds !== undefined) updateData.defaultRestSeconds = input.defaultRestSeconds;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  await db.update(workoutTemplates).set(updateData).where(eq(workoutTemplates.id, id));

  const [updated] = await db.select().from(workoutTemplates).where(eq(workoutTemplates.id, id));

  const data: WorkoutTemplateData = {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    type: updated.type as WorkoutType,
    description: updated.description,
    category: updated.category,
    defaultRestSeconds: updated.defaultRestSeconds,
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutTemplateData>>({ success: true, data });
});

/**
 * DELETE /api/workouts/templates/:id
 */
workoutsRouter.delete('/templates/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const [existing] = await db
    .select({ id: workoutTemplates.id })
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id)));

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout template not found' } }, 404);
  }

  await db.delete(workoutTemplates).where(eq(workoutTemplates.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * POST /api/workouts/templates/:id/start
 * Instantiate a template into an active workout for today.
 */
workoutsRouter.post('/templates/:id/start', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const templateId = c.req.param('id');

  const [template] = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, user.id)));

  if (!template) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } }, 404);
  }

  const templateExercisesList = await db
    .select()
    .from(workoutTemplateExercises)
    .where(and(eq(workoutTemplateExercises.templateId, templateId), eq(workoutTemplateExercises.userId, user.id)))
    .orderBy(workoutTemplateExercises.sortOrder);

  const workoutId = `wko_${crypto.randomUUID()}`;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  await db.insert(workouts).values({
    id: workoutId,
    userId: user.id,
    name: template.name,
    type: template.type,
    date: today,
    notes: template.description || null,
    createdAt: now,
    updatedAt: now,
  });

  const createdExercises: WorkoutExerciseData[] = [];

  for (const tEx of templateExercisesList) {
    const exId = `wke_${crypto.randomUUID()}`;
    const initialSets: ExerciseSet[] = [];
    for (let s = 1; s <= tEx.targetSets; s++) {
      initialSets.push({
        setNumber: s,
        reps: tEx.targetReps || null,
        weightGrams: tEx.targetWeightGrams || null,
        weightKg: tEx.targetWeightGrams ? tEx.targetWeightGrams / 1000 : null,
        durationSeconds: tEx.targetDurationSeconds || null,
        setType: 'normal',
        isCompleted: false,
      });
    }

    await db.insert(workoutExercises).values({
      id: exId,
      userId: user.id,
      workoutId,
      exerciseName: tEx.exerciseName,
      sortOrder: tEx.sortOrder,
      sets: JSON.stringify(initialSets),
      notes: tEx.notes,
      createdAt: now,
    });

    createdExercises.push({
      id: exId,
      userId: user.id,
      workoutId,
      exerciseName: tEx.exerciseName,
      sortOrder: tEx.sortOrder,
      sets: initialSets,
      notes: tEx.notes,
      createdAt: now.getTime(),
    });
  }

  const data: WorkoutData = {
    id: workoutId,
    userId: user.id,
    name: template.name,
    type: template.type as WorkoutType,
    date: today,
    exerciseCount: createdExercises.length,
    exercises: createdExercises,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutData>>({ success: true, data }, 201);
});

// ==========================================
// 2. BODY MEASUREMENTS ENDPOINTS
// ==========================================

/**
 * GET /api/workouts/measurements
 */
workoutsRouter.get('/measurements', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, user.id))
    .orderBy(desc(bodyMeasurements.date));

  const data: BodyMeasurementData[] = rows.map((m) => ({
    id: m.id,
    userId: m.userId,
    date: m.date,
    weightGrams: m.weightGrams,
    bodyFatBps: m.bodyFatBps,
    chestMm: m.chestMm,
    waistMm: m.waistMm,
    hipsMm: m.hipsMm,
    bicepLeftMm: m.bicepLeftMm,
    bicepRightMm: m.bicepRightMm,
    thighLeftMm: m.thighLeftMm,
    thighRightMm: m.thighRightMm,
    calfLeftMm: m.calfLeftMm,
    calfRightMm: m.calfRightMm,
    neckMm: m.neckMm,
    shoulderMm: m.shoulderMm,
    forearmMm: m.forearmMm,
    notes: m.notes,
    createdAt: m.createdAt.getTime(),
    updatedAt: m.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<BodyMeasurementData[]>>({ success: true, data });
});

/**
 * POST /api/workouts/measurements
 */
workoutsRouter.post('/measurements', zValidator('json', bodyMeasurementCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, user.id), eq(bodyMeasurements.date, input.date)));

  const now = new Date();

  if (existing) {
    await db
      .update(bodyMeasurements)
      .set({
        ...input,
        updatedAt: now,
      })
      .where(eq(bodyMeasurements.id, existing.id));

    const [updated] = await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.id, existing.id));
    const data: BodyMeasurementData = {
      id: updated.id,
      userId: updated.userId,
      date: updated.date,
      weightGrams: updated.weightGrams,
      bodyFatBps: updated.bodyFatBps,
      chestMm: updated.chestMm,
      waistMm: updated.waistMm,
      hipsMm: updated.hipsMm,
      bicepLeftMm: updated.bicepLeftMm,
      bicepRightMm: updated.bicepRightMm,
      thighLeftMm: updated.thighLeftMm,
      thighRightMm: updated.thighRightMm,
      calfLeftMm: updated.calfLeftMm,
      calfRightMm: updated.calfRightMm,
      neckMm: updated.neckMm,
      shoulderMm: updated.shoulderMm,
      forearmMm: updated.forearmMm,
      notes: updated.notes,
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
    };
    return c.json<ApiSuccessResponse<BodyMeasurementData>>({ success: true, data });
  }

  const id = `bms_${crypto.randomUUID()}`;
  await db.insert(bodyMeasurements).values({
    id,
    userId: user.id,
    date: input.date,
    weightGrams: input.weightGrams ?? null,
    bodyFatBps: input.bodyFatBps ?? null,
    chestMm: input.chestMm ?? null,
    waistMm: input.waistMm ?? null,
    hipsMm: input.hipsMm ?? null,
    bicepLeftMm: input.bicepLeftMm ?? null,
    bicepRightMm: input.bicepRightMm ?? null,
    thighLeftMm: input.thighLeftMm ?? null,
    thighRightMm: input.thighRightMm ?? null,
    calfLeftMm: input.calfLeftMm ?? null,
    calfRightMm: input.calfRightMm ?? null,
    neckMm: input.neckMm ?? null,
    shoulderMm: input.shoulderMm ?? null,
    forearmMm: input.forearmMm ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const data: BodyMeasurementData = {
    id,
    userId: user.id,
    date: input.date,
    weightGrams: input.weightGrams ?? null,
    bodyFatBps: input.bodyFatBps ?? null,
    chestMm: input.chestMm ?? null,
    waistMm: input.waistMm ?? null,
    hipsMm: input.hipsMm ?? null,
    bicepLeftMm: input.bicepLeftMm ?? null,
    bicepRightMm: input.bicepRightMm ?? null,
    thighLeftMm: input.thighLeftMm ?? null,
    thighRightMm: input.thighRightMm ?? null,
    calfLeftMm: input.calfLeftMm ?? null,
    calfRightMm: input.calfRightMm ?? null,
    neckMm: input.neckMm ?? null,
    shoulderMm: input.shoulderMm ?? null,
    forearmMm: input.forearmMm ?? null,
    notes: input.notes ?? null,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<BodyMeasurementData>>({ success: true, data }, 201);
});

/**
 * DELETE /api/workouts/measurements/:id
 */
workoutsRouter.delete('/measurements/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  await db
    .delete(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

// ==========================================
// 3. FITNESS STATS & PRs ENDPOINT
// ==========================================

/**
 * GET /api/workouts/stats
 */
workoutsRouter.get('/stats', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, user.id))
    .orderBy(desc(workouts.date));

  const workoutExercisesList = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.userId, user.id));

  const exercisesByWorkoutId: Record<string, Array<{ exerciseName: string; sets: ExerciseSet[] }>> = {};
  let totalSets = 0;
  let totalReps = 0;
  let totalTonnageGrams = 0;

  for (const ex of workoutExercisesList) {
    if (!exercisesByWorkoutId[ex.workoutId]) {
      exercisesByWorkoutId[ex.workoutId] = [];
    }
    let parsedSets: ExerciseSet[] = [];
    try {
      parsedSets = JSON.parse(ex.sets);
    } catch {
      parsedSets = [];
    }

    for (const set of parsedSets) {
      totalSets++;
      if (set.reps) totalReps += set.reps;
      if (set.weightGrams && set.reps) {
        totalTonnageGrams += set.weightGrams * set.reps;
      }
    }

    exercisesByWorkoutId[ex.workoutId].push({
      exerciseName: ex.exerciseName,
      sets: parsedSets,
    });
  }

  let totalDurationMinutes = 0;
  const weeklyTonnageMap: Record<string, { tonnageGrams: number; workoutCount: number }> = {};

  const workoutsWithExercises = userWorkouts.map((w) => {
    if (w.durationMinutes) totalDurationMinutes += w.durationMinutes;

    const exs = exercisesByWorkoutId[w.id] || [];
    let workoutTonnage = 0;
    for (const ex of exs) {
      workoutTonnage += calculateSetsTonnageGrams(ex.sets);
    }

    // Weekly bucket (week starting Sunday)
    const weekStart = shiftCalendarDate(w.date, -new Date(w.date).getUTCDay());
    if (!weeklyTonnageMap[weekStart]) {
      weeklyTonnageMap[weekStart] = { tonnageGrams: 0, workoutCount: 0 };
    }
    weeklyTonnageMap[weekStart].tonnageGrams += workoutTonnage;
    weeklyTonnageMap[weekStart].workoutCount += 1;

    return {
      id: w.id,
      date: w.date,
      exercises: exs,
    };
  });

  const weeklyTonnage = Object.entries(weeklyTonnageMap)
    .map(([week, val]) => ({
      week,
      tonnageGrams: val.tonnageGrams,
      workoutCount: val.workoutCount,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const prMap = extractExercisePersonalRecords(workoutsWithExercises);
  const personalRecords = Object.values(prMap).sort((a, b) => b.estimatedOneRepMaxGrams - a.estimatedOneRepMaxGrams);

  const measurements = await db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, user.id))
    .orderBy(bodyMeasurements.date);

  const bodyWeightMovingAverage7d = calculateWeightMovingAverages(measurements, 7);

  const data: FitnessStatsData = {
    totalWorkouts: userWorkouts.length,
    totalTonnageGrams,
    totalSets,
    totalReps,
    totalDurationMinutes,
    weeklyTonnage,
    bodyWeightMovingAverage7d,
    personalRecords,
  };

  return c.json<ApiSuccessResponse<FitnessStatsData>>({ success: true, data });
});

// ==========================================
// 4. WORKOUTS ROOT & PARAMETERIZED ENDPOINTS
// ==========================================

/**
 * GET /api/workouts
 */
workoutsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { startDate, endDate, limit } = c.req.valid('query');

    const conditions = [eq(workouts.userId, user.id)];

    if (startDate) conditions.push(gte(workouts.date, startDate));
    if (endDate) conditions.push(lte(workouts.date, endDate));

    const rows = await db
      .select({
        workout: workouts,
        exerciseCount: sql<number>`(SELECT count(*) FROM workout_exercises WHERE workout_exercises.workout_id = workouts.id)`,
      })
      .from(workouts)
      .where(and(...conditions))
      .orderBy(desc(workouts.date), desc(workouts.createdAt))
      .limit(limit);

    const data: WorkoutData[] = rows.map(({ workout, exerciseCount }) => ({
      id: workout.id,
      userId: workout.userId,
      name: workout.name,
      type: workout.type as WorkoutType,
      date: workout.date,
      durationMinutes: workout.durationMinutes,
      caloriesBurned: workout.caloriesBurned,
      notes: workout.notes,
      exerciseCount: Number(exerciseCount || 0),
      createdAt: workout.createdAt.getTime(),
      updatedAt: workout.updatedAt.getTime(),
    }));

    return c.json<ApiSuccessResponse<WorkoutData[]>>({ success: true, data });
  }
);

/**
 * POST /api/workouts
 */
workoutsRouter.post('/', zValidator('json', workoutCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  if (!isValidCalendarDate(input.date)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Date must be a valid YYYY-MM-DD' } },
      400
    );
  }

  const workoutId = `wko_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(workouts).values({
    id: workoutId,
    userId: user.id,
    name: input.name,
    type: input.type,
    date: input.date,
    durationMinutes: input.durationMinutes || null,
    caloriesBurned: input.caloriesBurned || null,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  const createdExercises: WorkoutExerciseData[] = [];
  let totalTonnage = 0;

  if (input.exercises && input.exercises.length > 0) {
    for (const ex of input.exercises) {
      const exerciseId = `wke_${crypto.randomUUID()}`;
      const sets: ExerciseSet[] = (ex.sets || []).map((s) => ({
        ...s,
        weightGrams: s.weightGrams ?? (s.weightKg ? Math.round(s.weightKg * 1000) : null),
        weightKg: s.weightKg ?? (s.weightGrams ? s.weightGrams / 1000 : null),
      }));

      totalTonnage += calculateSetsTonnageGrams(sets);

      await db.insert(workoutExercises).values({
        id: exerciseId,
        userId: user.id,
        workoutId,
        exerciseName: ex.exerciseName,
        sortOrder: ex.sortOrder ?? 0,
        sets: JSON.stringify(sets),
        notes: ex.notes || null,
        createdAt: now,
      });

      createdExercises.push({
        id: exerciseId,
        userId: user.id,
        workoutId,
        exerciseName: ex.exerciseName,
        sortOrder: ex.sortOrder ?? 0,
        sets,
        notes: ex.notes || null,
        createdAt: now.getTime(),
      });
    }
  }

  const data: WorkoutData = {
    id: workoutId,
    userId: user.id,
    name: input.name,
    type: input.type as WorkoutType,
    date: input.date,
    durationMinutes: input.durationMinutes || null,
    caloriesBurned: input.caloriesBurned || null,
    notes: input.notes || null,
    exerciseCount: createdExercises.length,
    totalTonnageGrams: totalTonnage,
    exercises: createdExercises,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutData>>({ success: true, data }, 201);
});

/**
 * GET /api/workouts/:id
 */
workoutsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)));

  if (!workout) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout not found' } }, 404);
  }

  const exerciseRows = await db
    .select()
    .from(workoutExercises)
    .where(and(eq(workoutExercises.workoutId, id), eq(workoutExercises.userId, user.id)))
    .orderBy(workoutExercises.sortOrder, workoutExercises.createdAt);

  let totalTonnage = 0;
  const exercises: WorkoutExerciseData[] = exerciseRows.map((ex) => {
    let sets: ExerciseSet[] = [];
    if (ex.sets) {
      try {
        sets = JSON.parse(ex.sets);
      } catch {
        sets = [];
      }
    }
    totalTonnage += calculateSetsTonnageGrams(sets);
    return {
      id: ex.id,
      userId: ex.userId,
      workoutId: ex.workoutId,
      exerciseName: ex.exerciseName,
      sortOrder: ex.sortOrder,
      sets,
      notes: ex.notes,
      createdAt: ex.createdAt.getTime(),
    };
  });

  const data: WorkoutData = {
    id: workout.id,
    userId: workout.userId,
    name: workout.name,
    type: workout.type as WorkoutType,
    date: workout.date,
    durationMinutes: workout.durationMinutes,
    caloriesBurned: workout.caloriesBurned,
    notes: workout.notes,
    exerciseCount: exercises.length,
    totalTonnageGrams: totalTonnage,
    exercises,
    createdAt: workout.createdAt.getTime(),
    updatedAt: workout.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutData>>({ success: true, data });
});

/**
 * PATCH /api/workouts/:id
 */
workoutsRouter.patch('/:id', zValidator('json', workoutUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)));

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof workouts.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.date !== undefined) updateData.date = input.date;
  if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
  if (input.caloriesBurned !== undefined) updateData.caloriesBurned = input.caloriesBurned;
  if (input.notes !== undefined) updateData.notes = input.notes;

  await db.update(workouts).set(updateData).where(eq(workouts.id, id));

  const [updated] = await db.select().from(workouts).where(eq(workouts.id, id));

  const data: WorkoutData = {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    type: updated.type as WorkoutType,
    date: updated.date,
    durationMinutes: updated.durationMinutes,
    caloriesBurned: updated.caloriesBurned,
    notes: updated.notes,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<WorkoutData>>({ success: true, data });
});

/**
 * DELETE /api/workouts/:id
 */
workoutsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const [existing] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)));

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout not found' } }, 404);
  }

  await db.delete(workouts).where(eq(workouts.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * POST /api/workouts/:id/exercises
 */
workoutsRouter.post(
  '/:id/exercises',
  zValidator('json', workoutExerciseCreateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const workoutId = c.req.param('id');
    const input = c.req.valid('json');

    const [workout] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.id, workoutId), eq(workouts.userId, user.id)));

    if (!workout) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workout not found' } }, 404);
    }

    const exerciseId = `wke_${crypto.randomUUID()}`;
    const now = new Date();

    const formattedSets = (input.sets || []).map((s) => ({
      ...s,
      weightGrams: s.weightGrams ?? (s.weightKg ? Math.round(s.weightKg * 1000) : null),
      weightKg: s.weightKg ?? (s.weightGrams ? s.weightGrams / 1000 : null),
    }));

    await db.insert(workoutExercises).values({
      id: exerciseId,
      userId: user.id,
      workoutId,
      exerciseName: input.exerciseName,
      sortOrder: input.sortOrder ?? 0,
      sets: JSON.stringify(formattedSets),
      notes: input.notes || null,
      createdAt: now,
    });

    const data: WorkoutExerciseData = {
      id: exerciseId,
      userId: user.id,
      workoutId,
      exerciseName: input.exerciseName,
      sortOrder: input.sortOrder ?? 0,
      sets: formattedSets,
      notes: input.notes || null,
      createdAt: now.getTime(),
    };

    return c.json<ApiSuccessResponse<WorkoutExerciseData>>({ success: true, data }, 201);
  }
);

/**
 * DELETE /api/workouts/exercises/:exerciseId
 */
workoutsRouter.delete('/exercises/:exerciseId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const exerciseId = c.req.param('exerciseId');

  await db
    .delete(workoutExercises)
    .where(and(eq(workoutExercises.id, exerciseId), eq(workoutExercises.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id: exerciseId } });
});
