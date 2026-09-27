import { eq, and } from 'drizzle-orm';
import { createDb } from '../db/client';
import { goals, goalMilestones, goalProgressLogs } from '../db/schema';
import type { GoalStatus } from '../../shared/trackerTypes';

export interface MilestoneProgressItem {
  id: string;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean | number;
}

/**
 * Calculates aggregate goal progress (0-100%) from milestone list.
 */
export function calculateGoalProgress(milestones: MilestoneProgressItem[]): number {
  if (!milestones || milestones.length === 0) return 0;

  let totalPercentage = 0;
  for (const m of milestones) {
    if (m.isCompleted) {
      totalPercentage += 100;
    } else if (m.targetValue > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((m.currentValue / m.targetValue) * 100)));
      totalPercentage += pct;
    }
  }

  return Math.min(100, Math.max(0, Math.round(totalPercentage / milestones.length)));
}

/**
 * Derives goal status from progress percentage and existing status.
 */
export function deriveGoalStatus(progress: number, currentStatus?: GoalStatus): GoalStatus {
  if (currentStatus === 'abandoned') return 'abandoned';
  if (progress >= 100) return 'completed';
  if (progress > 0) return 'in_progress';
  return 'not_started';
}

/**
 * Recalculates goal progress, updates the goal record, and records a progress log entry if changed.
 */
export async function syncAndLogGoalProgress(
  db: ReturnType<typeof createDb>,
  userId: string,
  goalId: string,
  milestoneId?: string | null,
  notes?: string | null
): Promise<{ previousProgress: number; newProgress: number; status: GoalStatus }> {
  const [goalRecord] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

  if (!goalRecord) {
    throw new Error('Goal not found');
  }

  const milestonesList = await db
    .select()
    .from(goalMilestones)
    .where(and(eq(goalMilestones.goalId, goalId), eq(goalMilestones.userId, userId)));

  const previousProgress = goalRecord.progressPercentage;
  const newProgress = calculateGoalProgress(milestonesList);
  const status = deriveGoalStatus(newProgress, goalRecord.status as GoalStatus);

  await db
    .update(goals)
    .set({
      progressPercentage: newProgress,
      status,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, goalId));

  // If progress changed, record an audit log entry in goal_progress_logs
  if (newProgress !== previousProgress) {
    const today = new Date().toISOString().split('T')[0];
    await db.insert(goalProgressLogs).values({
      id: `gpl_${crypto.randomUUID()}`,
      userId,
      goalId,
      milestoneId: milestoneId || null,
      previousProgress,
      newProgress,
      changeDelta: newProgress - previousProgress,
      notes: notes || null,
      loggedAt: today,
      createdAt: new Date(),
    });
  }

  return { previousProgress, newProgress, status };
}
