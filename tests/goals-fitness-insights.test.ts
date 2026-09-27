import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import {
  calculateOneRepMaxGrams,
  calculateSetsTonnageGrams,
  calculateWeightMovingAverages,
  extractExercisePersonalRecords,
} from '../src/server/services/fitnessCalculationService';
import {
  calculateGoalProgress,
  deriveGoalStatus,
} from '../src/server/services/goalProgressService';
import type {
  ApiSuccessResponse,
  GoalData,
  GoalProgressLogData,
  GoalTaskLinkData,
  TrackerData,
  TrackerStatsData,
  WorkoutData,
  WorkoutTemplateData,
  FitnessStatsData,
  InsightsOverviewData,
} from '../src/shared/types';

describe('Goals, Flexible Activity Tracking, Fitness, and Insights Engine', () => {
  let testD1: D1Database;
  let disposeD1: () => Promise<void>;
  let userCookie: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeD1 = dispose;

    // Bootstrap user
    const res = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Trackers Tester',
          email: 'tracker_tester@example.com',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookie = res.headers.get('set-cookie');
    userCookie = setCookie?.split(';')[0] || '';
  });

  afterAll(async () => {
    await disposeD1?.();
  });

  // ====================================================================
  // 1. FITNESS CALCULATION UNIT TESTS
  // ====================================================================
  describe('Fitness Calculation Rules & Integer Arithmetic', () => {
    it('calculates 1RM via Epley formula in integer arithmetic', () => {
      // 1 rep of 100kg (100000g) -> 100000g
      expect(calculateOneRepMaxGrams(100000, 1)).toBe(100000);

      // 10 reps of 80kg (80000g) -> round(80000 * (30 + 10) / 30) = round(80000 * 40 / 30) = round(106666.666) = 106667g
      expect(calculateOneRepMaxGrams(80000, 10)).toBe(106667);

      // 5 reps of 120kg (120000g) -> round(120000 * 35 / 30) = 140000g
      expect(calculateOneRepMaxGrams(120000, 5)).toBe(140000);

      // Edge cases
      expect(calculateOneRepMaxGrams(0, 5)).toBe(0);
      expect(calculateOneRepMaxGrams(100000, 0)).toBe(0);
    });

    it('calculates total tonnage (volume load) across sets', () => {
      const sets = [
        { setNumber: 1, reps: 10, weightGrams: 60000 }, // 600,000g
        { setNumber: 2, reps: 8, weightGrams: 80000 },  // 640,000g
        { setNumber: 3, reps: 6, weightGrams: 100000 }, // 600,000g
      ];

      expect(calculateSetsTonnageGrams(sets)).toBe(1840000); // 1,840 kg
    });

    it('computes 7-day rolling weight moving averages correctly', () => {
      const entries = [
        { date: '2026-10-01', weightGrams: 80000 },
        { date: '2026-10-02', weightGrams: 80400 },
        { date: '2026-10-03', weightGrams: 79600 },
      ];

      const ma = calculateWeightMovingAverages(entries, 7);
      expect(ma).toHaveLength(3);
      expect(ma[0].movingAvgGrams).toBe(80000);
      expect(ma[1].movingAvgGrams).toBe(80200); // (80000 + 80400) / 2
      expect(ma[2].movingAvgGrams).toBe(80000); // (80000 + 80400 + 79600) / 3
    });

    it('extracts Personal Records across historical workout logs', () => {
      const workoutsList = [
        {
          id: 'w1',
          date: '2026-10-01',
          exercises: [
            {
              exerciseName: 'Bench Press',
              sets: [{ setNumber: 1, reps: 10, weightGrams: 80000 }], // 1RM ~106667
            },
          ],
        },
        {
          id: 'w2',
          date: '2026-10-08',
          exercises: [
            {
              exerciseName: 'Bench Press',
              sets: [{ setNumber: 1, reps: 5, weightGrams: 100000 }], // 1RM ~116667 (New PR)
            },
          ],
        },
      ];

      const prs = extractExercisePersonalRecords(workoutsList);
      expect(prs['Bench Press']).toBeDefined();
      expect(prs['Bench Press'].workoutId).toBe('w2');
      expect(prs['Bench Press'].maxWeightGrams).toBe(100000);
      expect(prs['Bench Press'].estimatedOneRepMaxGrams).toBe(116667);
    });
  });

  // ====================================================================
  // 2. GOAL PROGRESS CALCULATION UNIT TESTS
  // ====================================================================
  describe('Goal Progress Calculation Rules', () => {
    it('calculates weighted progress across milestones', () => {
      const milestones = [
        { id: 'm1', targetValue: 100, currentValue: 100, isCompleted: true },
        { id: 'm2', targetValue: 100, currentValue: 50, isCompleted: false },
      ];

      // (100% + 50%) / 2 = 75%
      expect(calculateGoalProgress(milestones)).toBe(75);
    });

    it('derives status correctly from progress percentage', () => {
      expect(deriveGoalStatus(0)).toBe('not_started');
      expect(deriveGoalStatus(50)).toBe('in_progress');
      expect(deriveGoalStatus(100)).toBe('completed');
      expect(deriveGoalStatus(100, 'abandoned')).toBe('abandoned');
    });
  });

  // ====================================================================
  // 3. GOALS API INTEGRATION TESTS
  // ====================================================================
  describe('Goals API Endpoints', () => {
    let createdGoalId: string;
    let createdMilestoneId: string;

    it('creates a goal with timeframe, target date, and initial milestones', async () => {
      const res = await app.request(
        '/api/goals',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            title: 'Master TypeScript & Cloudflare',
            description: 'Achieve expert level systems engineering',
            timeframe: 'medium_term',
            targetDate: '2026-12-31',
            milestones: [
              { title: 'Read Documentation', targetValue: 100, unit: '%' },
              { title: 'Build 5 Microservices', targetValue: 5, unit: 'services' },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<GoalData>;
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Master TypeScript & Cloudflare');
      expect(json.data.timeframe).toBe('medium_term');
      expect(json.data.milestoneCount).toBe(2);
      expect(json.data.progressPercentage).toBe(0);

      createdGoalId = json.data.id;
      createdMilestoneId = json.data.milestones![0].id;
    });

    it('updates a milestone and automatically syncs and logs goal progress', async () => {
      const res = await app.request(
        `/api/goals/milestones/${createdMilestoneId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            isCompleted: true,
            currentValue: 100,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);

      // Verify goal detail reflects the updated progress and audit trail
      const goalRes = await app.request(
        `/api/goals/${createdGoalId}`,
        {
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );

      expect(goalRes.status).toBe(200);
      const goalJson = (await goalRes.json()) as ApiSuccessResponse<GoalData>;
      expect(goalJson.data.progressPercentage).toBe(50); // 1 of 2 milestones completed = 50%
      expect(goalJson.data.status).toBe('in_progress');
      expect(goalJson.data.progressLogs).toBeDefined();
      expect(goalJson.data.progressLogs!.length).toBeGreaterThan(0);
      expect(goalJson.data.progressLogs![0].newProgress).toBe(50);
    });

    it('links a task to the goal', async () => {
      // Create a task first
      const taskRes = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            title: 'Study D1 SQLite indexing',
            priority: 'high',
          }),
        },
        { DB: testD1 }
      );
      const taskJson = await taskRes.json();
      const taskId = taskJson.data.id;

      const linkRes = await app.request(
        `/api/goals/${createdGoalId}/tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            taskId,
            milestoneId: createdMilestoneId,
          }),
        },
        { DB: testD1 }
      );

      expect(linkRes.status).toBe(201);
      const linkJson = (await linkRes.json()) as ApiSuccessResponse<GoalTaskLinkData>;
      expect(linkJson.data.taskId).toBe(taskId);
      expect(linkJson.data.taskTitle).toBe('Study D1 SQLite indexing');
    });

    it('records a manual progress log entry', async () => {
      const res = await app.request(
        `/api/goals/${createdGoalId}/progress-logs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            newProgress: 85,
            notes: 'Rapid progress on benchmark suites',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<GoalProgressLogData>;
      expect(json.data.newProgress).toBe(85);
      expect(json.data.notes).toBe('Rapid progress on benchmark suites');
    });
  });

  // ====================================================================
  // 4. FLEXIBLE TRACKERS & HABITS API TESTS
  // ====================================================================
  describe('Flexible Trackers & Habits API Endpoints', () => {
    let trackerId: string;

    it('creates a flexible metric tracker of type count / text', async () => {
      const res = await app.request(
        '/api/trackers',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            name: 'Daily Meditation',
            type: 'duration',
            unit: 'mins',
            targetValue: 20,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<TrackerData>;
      expect(json.data.name).toBe('Daily Meditation');
      trackerId = json.data.id;
    });

    it('logs multi-date entries and returns tracker statistics', async () => {
      await app.request(
        `/api/trackers/${trackerId}/entries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            date: '2026-10-01',
            value: 20,
            notes: 'Morning breathwork session',
          }),
        },
        { DB: testD1 }
      );

      await app.request(
        `/api/trackers/${trackerId}/entries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            date: '2026-10-02',
            value: 30,
            notes: 'Evening mindfulness',
          }),
        },
        { DB: testD1 }
      );

      const statsRes = await app.request(
        `/api/trackers/${trackerId}/stats`,
        {
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );

      expect(statsRes.status).toBe(200);
      const statsJson = (await statsRes.json()) as ApiSuccessResponse<TrackerStatsData>;
      expect(statsJson.data.totalEntries).toBe(2);
      expect(statsJson.data.sumValue).toBe(50);
      expect(statsJson.data.avgValue).toBe(25);
      expect(statsJson.data.minValue).toBe(20);
      expect(statsJson.data.maxValue).toBe(30);
    });

    it('updates tracker entry on same date (upsert semantics) and preserves date notes', async () => {
      // 1. Test tracker entry creation/editing by date
      const updateRes = await app.request(
        `/api/trackers/${trackerId}/entries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            date: '2026-10-01',
            value: 45,
            notes: 'Extended meditation session (updated)',
          }),
        },
        { DB: testD1 }
      );

      expect(updateRes.status).toBe(201);
      const updateJson = await updateRes.json();
      expect(updateJson.data.value).toBe(45);
      expect(updateJson.data.notes).toBe('Extended meditation session (updated)');

      // Verify stats reflect updated entry
      const statsRes = await app.request(
        `/api/trackers/${trackerId}/stats`,
        {
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );
      const statsJson = (await statsRes.json()) as ApiSuccessResponse<TrackerStatsData>;
      expect(statsJson.data.totalEntries).toBe(2);
      expect(statsJson.data.sumValue).toBe(75); // 45 + 30
      expect(statsJson.data.maxValue).toBe(45);
    });

    it('handles zero-data states gracefully for tracker statistics and charts', async () => {
      // Create empty tracker
      const emptyRes = await app.request(
        '/api/trackers',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            name: 'Empty Test Tracker',
            type: 'numeric',
            unit: 'units',
          }),
        },
        { DB: testD1 }
      );
      const emptyTracker = (await emptyRes.json()).data;

      const emptyStatsRes = await app.request(
        `/api/trackers/${emptyTracker.id}/stats`,
        {
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );

      expect(emptyStatsRes.status).toBe(200);
      const emptyStatsJson = (await emptyStatsRes.json()) as ApiSuccessResponse<TrackerStatsData>;
      expect(emptyStatsJson.data.totalEntries).toBe(0);
      expect(emptyStatsJson.data.sumValue).toBe(0);
      expect(emptyStatsJson.data.avgValue).toBe(0);
      expect(emptyStatsJson.data.minValue).toBe(0);
      expect(emptyStatsJson.data.maxValue).toBe(0);
    });
  });

  // ====================================================================
  // 5. FITNESS & WORKOUTS API TESTS
  // ====================================================================
  describe('Fitness, Workout Templates, and Measurements API', () => {
    let templateId: string;

    it('creates a workout routine template and instantiates a workout', async () => {
      const res = await app.request(
        '/api/workouts/templates',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            name: 'Upper Body Hypertrophy',
            type: 'strength',
            defaultRestSeconds: 90,
            exercises: [
              {
                exerciseName: 'Incline Dumbbell Press',
                targetSets: 3,
                targetReps: 10,
                targetWeightGrams: 30000,
              },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<WorkoutTemplateData>;
      expect(json.data.name).toBe('Upper Body Hypertrophy');
      expect(json.data.exerciseCount).toBe(1);
      templateId = json.data.id;

      // Start workout from template
      const startRes = await app.request(
        `/api/workouts/templates/${templateId}/start`,
        {
          method: 'POST',
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );

      expect(startRes.status).toBe(201);
      const startJson = (await startRes.json()) as ApiSuccessResponse<WorkoutData>;
      expect(startJson.data.name).toBe('Upper Body Hypertrophy');
      expect(startJson.data.exercises).toHaveLength(1);
      expect(startJson.data.exercises![0].sets).toHaveLength(3);
    });

    it('logs body measurements and calculates moving averages', async () => {
      const res1 = await app.request(
        '/api/workouts/measurements',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            date: '2026-10-01',
            weightGrams: 78500, // 78.5 kg
            bodyFatBps: 1520,   // 15.2%
            waistMm: 820,       // 82.0 cm
          }),
        },
        { DB: testD1 }
      );
      expect(res1.status).toBe(201);

      const res2 = await app.request(
        '/api/workouts/measurements',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            date: '2026-10-02',
            weightGrams: 78300, // 78.3 kg
            bodyFatBps: 1510,
          }),
        },
        { DB: testD1 }
      );
      expect(res2.status).toBe(201);

      const statsRes = await app.request(
        '/api/workouts/stats',
        {
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );

      expect(statsRes.status).toBe(200);
      const statsJson = (await statsRes.json()) as ApiSuccessResponse<FitnessStatsData>;
      expect(statsJson.data.bodyWeightMovingAverage7d).toBeDefined();
      expect(statsJson.data.bodyWeightMovingAverage7d!.length).toBe(2);
    });
  });

  // ====================================================================
  // 6. CROSS-DOMAIN INSIGHTS API TESTS
  // ====================================================================
  describe('Cross-Domain Insights Engine API', () => {
    it('returns full overview payload with 365-day heatmap and velocity', async () => {
      const res = await app.request(
        '/api/insights/overview',
        {
          headers: { Cookie: userCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<InsightsOverviewData>;
      expect(json.success).toBe(true);
      expect(json.data.tasks).toBeDefined();
      expect(json.data.goals).toBeDefined();
      expect(json.data.trackers).toBeDefined();
      expect(json.data.fitness).toBeDefined();
      expect(json.data.heatmap365).toBeDefined();
      expect(json.data.heatmap365.length).toBeGreaterThanOrEqual(365);
    });
  });
});
