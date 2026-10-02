import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Badge } from '../ui/Badge';
import { KpiCard, KpiGrid } from '../ui/KpiCard';
import { LoadingState } from '../ui/States';
import { useToast } from '../ui/Toast';
import {
  IconPlus,
  IconCheck,
  IconTarget,
  IconFlame,
  IconActivity,
  IconDumbbell,
  IconSparkles,
  IconTrendingUp,
  IconFileText,
  IconCalendar,
  IconEdit,
  IconTrash,
} from '../ui/Icons';
import type {
  HabitData,
  TrackerData,
  WorkoutData,
  WorkoutTemplateData,
  BodyMeasurementData,
  FitnessStatsData,
  GoalData,
  GoalTimeframe,
  InsightsOverviewData,
  ExerciseSet,
  ApiSuccessResponse,
} from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

export function TrackersView() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'goals' | 'habits' | 'fitness' | 'insights'>('goals');

  // Data States
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [trackers, setTrackers] = useState<TrackerData[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplateData[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementData[]>([]);
  const [fitnessStats, setFitnessStats] = useState<FitnessStatsData | null>(null);
  const [insights, setInsights] = useState<InsightsOverviewData | null>(null);

  // Goal Modals & State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalData | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<GoalData | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [selectedGoalForMilestone, setSelectedGoalForMilestone] = useState<string | null>(null);
  const [selectedGoalForLogs, setSelectedGoalForLogs] = useState<GoalData | null>(null);
  const [isProgressLogModalOpen, setIsProgressLogModalOpen] = useState(false);
  const [isLinkTaskModalOpen, setIsLinkTaskModalOpen] = useState(false);
  const [selectedGoalForLinkTask, setSelectedGoalForLinkTask] = useState<string | null>(null);

  // Habit CRUD states
  const [editingHabit, setEditingHabit] = useState<HabitData | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<HabitData | null>(null);
  const [isDeletingHabit, setIsDeletingHabit] = useState(false);

  // Tracker CRUD states
  const [editingTracker, setEditingTracker] = useState<TrackerData | null>(null);
  const [trackerToDelete, setTrackerToDelete] = useState<TrackerData | null>(null);
  const [isDeletingTracker, setIsDeletingTracker] = useState(false);

  // Fitness CRUD states
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutData | null>(null);
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<WorkoutTemplateData | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [measurementToDelete, setMeasurementToDelete] = useState<BodyMeasurementData | null>(null);
  const [isDeletingMeasurement, setIsDeletingMeasurement] = useState(false);

  // Goal Form
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalTimeframe, setGoalTimeframe] = useState<GoalTimeframe>('medium_term');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalColor, setGoalColor] = useState('#8b5cf6');

  // Milestone Form
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneTarget, setMilestoneTarget] = useState(100);
  const [milestoneUnit, setMilestoneUnit] = useState('%');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');

  // Progress Log Form
  const [newProgressValue, setNewProgressValue] = useState(50);
  const [progressLogNotes, setProgressLogNotes] = useState('');

  // Task Link Form
  const [linkTaskId, setLinkTaskId] = useState('');

  // Habit & Tracker Modals
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [isLogTrackerModalOpen, setIsLogTrackerModalOpen] = useState(false);
  const [selectedTrackerForLog, setSelectedTrackerForLog] = useState<TrackerData | null>(null);

  // Habit Form
  const [habitName, setHabitName] = useState('');
  const [habitFrequency, setHabitFrequency] = useState<'daily' | 'weekly' | 'custom_days'>('daily');
  const [habitTarget, setHabitTarget] = useState(7);
  const [habitColor, setHabitColor] = useState('#10b981');

  // Tracker Form
  const [trackerName, setTrackerName] = useState('');
  const [trackerType, setTrackerType] = useState<'numeric' | 'boolean' | 'duration' | 'rating' | 'count' | 'text'>('numeric');
  const [trackerUnit, setTrackerUnit] = useState('count');
  const [trackerTarget, setTrackerTarget] = useState<number | ''>('');

  // Tracker Log Entry Form
  const [trackerLogDate, setTrackerLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [trackerLogValue, setTrackerLogValue] = useState<number>(1);
  const [trackerLogText, setTrackerLogText] = useState('');
  const [trackerLogNotes, setTrackerLogNotes] = useState('');

  // Fitness Modals & Forms
  const [fitnessSubTab, setFitnessSubTab] = useState<'workouts' | 'templates' | 'prs' | 'measurements'>('workouts');
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);

  // New Workout Form
  const [workoutName, setWorkoutName] = useState('');
  const [workoutType, setWorkoutType] = useState<'strength' | 'cardio' | 'flexibility' | 'sport' | 'other'>('strength');
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutDuration, setWorkoutDuration] = useState<number | ''>(45);
  const [workoutCalories, setWorkoutCalories] = useState<number | ''>('');
  const [workoutExercisesList, setWorkoutExercisesList] = useState<
    Array<{ exerciseName: string; sets: ExerciseSet[] }>
  >([
    {
      exerciseName: 'Bench Press',
      sets: [
        { setNumber: 1, reps: 10, weightKg: 60, setType: 'warmup', isCompleted: true },
        { setNumber: 2, reps: 8, weightKg: 80, setType: 'normal', isCompleted: true },
        { setNumber: 3, reps: 6, weightKg: 90, setType: 'normal', isCompleted: true },
      ],
    },
  ]);

  // New Template Form
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState<'strength' | 'cardio' | 'flexibility' | 'sport' | 'other'>('strength');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateRestSec, setTemplateRestSec] = useState(90);

  // New Measurement Form
  const [measureDate, setMeasureDate] = useState(new Date().toISOString().split('T')[0]);
  const [measureWeightKg, setMeasureWeightKg] = useState<number | ''>(75.0);
  const [measureBodyFatPct, setMeasureBodyFatPct] = useState<number | ''>(15.0);
  const [measureWaistCm, setMeasureWaistCm] = useState<number | ''>('');
  const [measureChestCm, setMeasureChestCm] = useState<number | ''>('');
  const [measureNotes, setMeasureNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [goalFilterTimeframe, setGoalFilterTimeframe] = useState<string>('all');

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [gRes, hRes, tRes, wRes, tmplRes, mRes, stRes, insRes] = await Promise.all([
        fetch('/api/goals'),
        fetch('/api/habits'),
        fetch('/api/trackers'),
        fetch('/api/workouts'),
        fetch('/api/workouts/templates'),
        fetch('/api/workouts/measurements'),
        fetch('/api/workouts/stats'),
        fetch('/api/insights/overview'),
      ]);

      if (gRes.ok) {
        const { data: gJson } = await safeParseJson<ApiSuccessResponse<GoalData[]>>(gRes);
        if (gJson) setGoals(gJson.data || []);
      }
      if (hRes.ok) {
        const { data: hJson } = await safeParseJson<ApiSuccessResponse<HabitData[]>>(hRes);
        if (hJson) setHabits(hJson.data || []);
      }
      if (tRes.ok) {
        const { data: tJson } = await safeParseJson<ApiSuccessResponse<TrackerData[]>>(tRes);
        if (tJson) setTrackers(tJson.data || []);
      }
      if (wRes.ok) {
        const { data: wJson } = await safeParseJson<ApiSuccessResponse<WorkoutData[]>>(wRes);
        if (wJson) setWorkouts(wJson.data || []);
      }
      if (tmplRes.ok) {
        const { data: tmplJson } = await safeParseJson<ApiSuccessResponse<WorkoutTemplateData[]>>(tmplRes);
        if (tmplJson) setWorkoutTemplates(tmplJson.data || []);
      }
      if (mRes.ok) {
        const { data: mJson } = await safeParseJson<ApiSuccessResponse<BodyMeasurementData[]>>(mRes);
        if (mJson) setMeasurements(mJson.data || []);
      }
      if (stRes.ok) {
        const { data: stJson } = await safeParseJson<ApiSuccessResponse<FitnessStatsData>>(stRes);
        if (stJson) setFitnessStats(stJson.data || null);
      }
      if (insRes.ok) {
        const { data: insJson } = await safeParseJson<ApiSuccessResponse<InsightsOverviewData>>(insRes);
        if (insJson) setInsights(insJson.data || null);
      }
    } catch {
      addToast('Error loading tracking and insights data', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // GOAL ACTIONS
  // ==========================================

  const handleOpenCreateGoal = () => {
    setEditingGoal(null);
    setGoalTitle('');
    setGoalDescription('');
    setGoalTimeframe('medium_term');
    setGoalTargetDate('');
    setGoalNotes('');
    setGoalColor('#8b5cf6');
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: GoalData) => {
    setEditingGoal(goal);
    setGoalTitle(goal.title);
    setGoalDescription(goal.description || '');
    setGoalTimeframe(goal.timeframe);
    setGoalTargetDate(goal.targetDate || '');
    setGoalNotes(goal.notes || '');
    setGoalColor(goal.color || '#8b5cf6');
    setIsGoalModalOpen(true);
  };

  const confirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    const g = goalToDelete;
    try {
      setIsDeletingGoal(true);
      const res = await fetch(`/api/goals/${g.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete goal');
      setGoals((prev) => prev.filter((item) => item.id !== g.id));
      addToast(`Goal "${g.title}" deleted`, 'success');
      setGoalToDelete(null);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting goal', 'error');
    } finally {
      setIsDeletingGoal(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    try {
      setSubmitting(true);

      if (editingGoal) {
        const res = await fetch(`/api/goals/${editingGoal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: goalTitle.trim(),
            description: goalDescription.trim() || undefined,
            timeframe: goalTimeframe,
            targetDate: goalTargetDate || undefined,
            notes: goalNotes.trim() || undefined,
            color: goalColor,
          }),
        });

        if (!res.ok) throw new Error('Failed to update goal');
        addToast('Goal updated successfully', 'success');
        setIsGoalModalOpen(false);
        setEditingGoal(null);
        fetchData();
        return;
      }

      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goalTitle.trim(),
          description: goalDescription.trim() || undefined,
          timeframe: goalTimeframe,
          targetDate: goalTargetDate || undefined,
          notes: goalNotes.trim() || undefined,
          color: goalColor,
        }),
      });

      if (!res.ok) throw new Error('Failed to create goal');
      addToast('Goal created successfully', 'success');
      setIsGoalModalOpen(false);
      setGoalTitle('');
      setGoalDescription('');
      setGoalTargetDate('');
      setGoalNotes('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating goal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForMilestone || !milestoneTitle.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/goals/${selectedGoalForMilestone}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: milestoneTitle.trim(),
          targetValue: Number(milestoneTarget),
          unit: milestoneUnit.trim(),
          dueDate: milestoneDueDate || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create milestone');
      addToast('Milestone added', 'success');
      setIsMilestoneModalOpen(false);
      setMilestoneTitle('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating milestone', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, currentCompleted: boolean) => {
    try {
      const res = await fetch(`/api/goals/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCompleted: !currentCompleted,
          currentValue: !currentCompleted ? 100 : 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to update milestone');
      addToast(!currentCompleted ? 'Milestone completed' : 'Milestone reopened', 'info');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error updating milestone', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/goals/milestones/${milestoneId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete milestone');
      addToast('Milestone deleted', 'info');
      if (selectedGoalForLogs) {
        const goalRes = await fetch(`/api/goals/${selectedGoalForLogs.id}`);
        if (goalRes.ok) {
          const { data: json } = await safeParseJson<ApiSuccessResponse<GoalData>>(goalRes);
          if (json?.data) {
            setSelectedGoalForLogs(json.data);
          }
        }
      }
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting milestone', 'error');
    }
  };

  const handleLogGoalProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForLogs) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/goals/${selectedGoalForLogs.id}/progress-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newProgress: Number(newProgressValue),
          notes: progressLogNotes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to record progress log');
      addToast('Progress updated and logged', 'success');
      setIsProgressLogModalOpen(false);
      setProgressLogNotes('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error recording progress', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkTaskToGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForLinkTask || !linkTaskId.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/goals/${selectedGoalForLinkTask}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: linkTaskId.trim() }),
      });

      if (!res.ok) throw new Error('Failed to link task');
      addToast('Task linked to goal', 'success');
      setIsLinkTaskModalOpen(false);
      setLinkTaskId('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error linking task', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // HABIT & TRACKER ACTIONS
  // ==========================================

  const handleOpenCreateHabit = () => {
    setEditingHabit(null);
    setHabitName('');
    setHabitFrequency('daily');
    setHabitTarget(7);
    setHabitColor('#10b981');
    setIsHabitModalOpen(true);
  };

  const handleOpenEditHabit = (h: HabitData) => {
    setEditingHabit(h);
    setHabitName(h.name);
    setHabitFrequency(h.frequencyType as 'daily' | 'weekly' | 'custom_days');
    setHabitTarget(h.targetDaysPerWeek);
    setHabitColor(h.color || '#10b981');
    setIsHabitModalOpen(true);
  };

  const confirmDeleteHabit = async () => {
    if (!habitToDelete) return;
    const h = habitToDelete;
    try {
      setIsDeletingHabit(true);
      const res = await fetch(`/api/habits/${h.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete habit');
      setHabits((prev) => prev.filter((item) => item.id !== h.id));
      addToast(`Habit "${h.name}" deleted`, 'success');
      setHabitToDelete(null);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting habit', 'error');
    } finally {
      setIsDeletingHabit(false);
    }
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;

    try {
      setSubmitting(true);

      if (editingHabit) {
        const res = await fetch(`/api/habits/${editingHabit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: habitName.trim(),
            frequencyType: habitFrequency,
            targetDaysPerWeek: Number(habitTarget),
            color: habitColor,
          }),
        });

        if (!res.ok) throw new Error('Failed to update habit');
        addToast('Habit updated successfully', 'success');
        setIsHabitModalOpen(false);
        setEditingHabit(null);
        fetchData();
        return;
      }

      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: habitName.trim(),
          frequencyType: habitFrequency,
          targetDaysPerWeek: Number(habitTarget),
          color: habitColor,
        }),
      });

      if (!res.ok) throw new Error('Failed to create habit');
      addToast('Habit streak tracker created', 'success');
      setIsHabitModalOpen(false);
      setHabitName('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating habit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogHabitToday = async (habitId: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/habits/${habitId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, completed: true }),
      });

      if (!res.ok) throw new Error('Failed to log habit');
      addToast('Habit checked in for today', 'success');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error logging habit', 'error');
    }
  };

  const handleOpenCreateTracker = () => {
    setEditingTracker(null);
    setTrackerName('');
    setTrackerType('numeric');
    setTrackerUnit('count');
    setTrackerTarget('');
    setIsTrackerModalOpen(true);
  };

  const handleOpenEditTracker = (t: TrackerData) => {
    setEditingTracker(t);
    setTrackerName(t.name);
    setTrackerType(t.type);
    setTrackerUnit(t.unit || 'count');
    setTrackerTarget(t.targetValue ?? '');
    setIsTrackerModalOpen(true);
  };

  const confirmDeleteTracker = async () => {
    if (!trackerToDelete) return;
    const t = trackerToDelete;
    try {
      setIsDeletingTracker(true);
      const res = await fetch(`/api/trackers/${t.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tracker');
      setTrackers((prev) => prev.filter((item) => item.id !== t.id));
      addToast(`Tracker "${t.name}" deleted`, 'success');
      setTrackerToDelete(null);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting tracker', 'error');
    } finally {
      setIsDeletingTracker(false);
    }
  };

  const handleCreateTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackerName.trim()) return;

    try {
      setSubmitting(true);

      if (editingTracker) {
        const res = await fetch(`/api/trackers/${editingTracker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trackerName.trim(),
            unit: trackerUnit.trim() || undefined,
            targetValue: trackerTarget !== '' ? Number(trackerTarget) : undefined,
          }),
        });

        if (!res.ok) throw new Error('Failed to update tracker');
        addToast('Metric tracker updated', 'success');
        setIsTrackerModalOpen(false);
        setEditingTracker(null);
        fetchData();
        return;
      }

      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trackerName.trim(),
          type: trackerType,
          unit: trackerUnit.trim() || undefined,
          targetValue: trackerTarget !== '' ? Number(trackerTarget) : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create tracker');
      addToast('Metric tracker created', 'success');
      setIsTrackerModalOpen(false);
      setTrackerName('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating tracker', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogTrackerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackerForLog) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/trackers/${selectedTrackerForLog.id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: trackerLogDate,
          value: Number(trackerLogValue),
          textValue: trackerLogText.trim() || undefined,
          notes: trackerLogNotes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to log measurement');
      addToast('Entry logged', 'success');
      setIsLogTrackerModalOpen(false);
      setTrackerLogText('');
      setTrackerLogNotes('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error logging entry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // FITNESS & WORKOUT ACTIONS
  // ==========================================

  const confirmDeleteWorkout = async () => {
    if (!workoutToDelete) return;
    const w = workoutToDelete;
    try {
      setIsDeletingWorkout(true);
      const res = await fetch(`/api/workouts/${w.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete workout');
      setWorkouts((prev) => prev.filter((item) => item.id !== w.id));
      addToast(`Workout session "${w.name}" deleted`, 'success');
      setWorkoutToDelete(null);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting workout', 'error');
    } finally {
      setIsDeletingWorkout(false);
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    const tmpl = templateToDelete;
    try {
      setIsDeletingTemplate(true);
      const res = await fetch(`/api/workouts/templates/${tmpl.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete routine template');
      setWorkoutTemplates((prev) => prev.filter((item) => item.id !== tmpl.id));
      addToast(`Routine template "${tmpl.name}" deleted`, 'success');
      setTemplateToDelete(null);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting template', 'error');
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const confirmDeleteMeasurement = async () => {
    if (!measurementToDelete) return;
    const m = measurementToDelete;
    try {
      setIsDeletingMeasurement(true);
      const res = await fetch(`/api/workouts/measurements/${m.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete body measurement');
      setMeasurements((prev) => prev.filter((item) => item.id !== m.id));
      addToast(`Measurement record from ${m.date} deleted`, 'success');
      setMeasurementToDelete(null);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error deleting measurement', 'error');
    } finally {
      setIsDeletingMeasurement(false);
    }
  };

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutName.trim()) return;

    try {
      setSubmitting(true);
      const formattedExercises = workoutExercisesList.map((ex, idx) => ({
        exerciseName: ex.exerciseName,
        sortOrder: idx,
        sets: ex.sets.map((s, sIdx) => ({
          setNumber: sIdx + 1,
          reps: s.reps ?? null,
          weightGrams: s.weightKg ? Math.round(s.weightKg * 1000) : null,
          weightKg: s.weightKg ?? null,
          rpe: s.rpe ?? null,
          setType: s.setType ?? 'normal',
          isCompleted: s.isCompleted ?? true,
        })),
      }));

      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workoutName.trim(),
          type: workoutType,
          date: workoutDate,
          durationMinutes: workoutDuration !== '' ? Number(workoutDuration) : undefined,
          caloriesBurned: workoutCalories !== '' ? Number(workoutCalories) : undefined,
          exercises: formattedExercises,
        }),
      });

      if (!res.ok) throw new Error('Failed to record workout');
      addToast('Workout session recorded', 'success');
      setIsWorkoutModalOpen(false);
      setWorkoutName('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error saving workout', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartWorkoutFromTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/workouts/templates/${templateId}/start`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to start workout');
      addToast('Workout started from template', 'success');
      setFitnessSubTab('workouts');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error starting template', 'error');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/workouts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          type: templateType,
          description: templateDesc.trim() || undefined,
          defaultRestSeconds: Number(templateRestSec),
        }),
      });

      if (!res.ok) throw new Error('Failed to create template');
      addToast('Workout routine template created', 'success');
      setIsTemplateModalOpen(false);
      setTemplateName('');
      setTemplateDesc('');
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error creating template', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      const res = await fetch('/api/workouts/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: measureDate,
          weightGrams: measureWeightKg !== '' ? Math.round(Number(measureWeightKg) * 1000) : undefined,
          bodyFatBps: measureBodyFatPct !== '' ? Math.round(Number(measureBodyFatPct) * 100) : undefined,
          waistMm: measureWaistCm !== '' ? Math.round(Number(measureWaistCm) * 10) : undefined,
          chestMm: measureChestCm !== '' ? Math.round(Number(measureChestCm) * 10) : undefined,
          notes: measureNotes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to save body measurement');
      addToast('Body measurement saved', 'success');
      setIsMeasurementModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Error saving measurement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    if (goalFilterTimeframe === 'all') return goals;
    return goals.filter((g) => g.timeframe === goalFilterTimeframe);
  }, [goals, goalFilterTimeframe]);

  if (loading && !goals.length && !habits.length) {
    return <LoadingState message="Loading goals, activities, fitness, and cross-domain insights..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* Top Header Cockpit Bento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border/70 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Goals, Trackers & Insights
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              {habits.length} Habits • {goals.length} Goals
            </span>
          </div>
        </div>

        {/* Action Button depending on active tab */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {activeTab === 'goals' && (
            <Button onClick={handleOpenCreateGoal} variant="primary" className="cursor-pointer w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[38px] rounded-xl shadow-xs">
              <IconPlus size={16} className="mr-1" /> New Goal
            </Button>
          )}
          {activeTab === 'habits' && (
            <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <Button onClick={handleOpenCreateHabit} variant="outline" className="cursor-pointer w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[38px] rounded-xl shadow-xs">
                <IconPlus size={16} className="mr-1" /> Habit
              </Button>
              <Button onClick={handleOpenCreateTracker} variant="primary" className="cursor-pointer w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[38px] rounded-xl shadow-xs">
                <IconPlus size={16} className="mr-1" /> Metric Tracker
              </Button>
            </div>
          )}
          {activeTab === 'fitness' && (
            <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <Button onClick={() => setIsMeasurementModalOpen(true)} variant="outline" className="cursor-pointer w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[38px] rounded-xl shadow-xs">
                <IconActivity size={16} className="mr-1" /> Body Check
              </Button>
              <Button onClick={() => setIsWorkoutModalOpen(true)} variant="primary" className="cursor-pointer w-full sm:w-auto justify-center min-h-[40px] sm:min-h-[38px] rounded-xl shadow-xs">
                <IconPlus size={16} className="mr-1" /> Log Workout
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 4-Column Cockpit Bento Telemetry Strip */}
      <KpiGrid cols="4">
        <KpiCard
          title="Habit Consistency"
          value={`${insights?.trackers?.overallConsistencyRate30d ?? 84}%`}
          subtitle={`${habits.filter(h => h.completedToday).length} of ${habits.length} habits done today`}
          color="emerald"
        />
        <KpiCard
          title="Top Streak"
          value={`${Math.max(...habits.map(h => h.currentStreak || 0), 0)} Days`}
          subtitle={insights?.trackers?.topHabitName ? `Leader: ${insights.trackers.topHabitName}` : 'Consistent daily execution'}
          color="primary"
        />
        <KpiCard
          title="Fitness Volume"
          value={`${Math.round((insights?.fitness?.tonnagePast30dGrams || 0) / 1000).toLocaleString()} kg`}
          subtitle={`${workouts.length} total logged workout sessions`}
          color="cyan"
        />
        <KpiCard
          title="Active Goals"
          value={goals.filter(g => g.status === 'in_progress').length}
          subtitle={`${goals.filter(g => g.status === 'completed').length} completed milestones`}
          color="default"
        />
      </KpiGrid>

      {/* Main Tab Navigation - Bento Pill Container */}
      <div className="flex items-center gap-1.5 p-1.5 bg-surface-container-low border border-border/60 rounded-2xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('goals')}
          className={clsx(
            'min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer touch-manipulation shrink-0',
            activeTab === 'goals'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-xs border border-border/60'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
          )}
        >
          <IconTarget size={16} />
          <span>Goals & Milestones</span>
          <Badge variant="default" className="text-[10px] font-mono">{goals.length}</Badge>
        </button>

        <button
          onClick={() => setActiveTab('habits')}
          className={clsx(
            'min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer touch-manipulation shrink-0',
            activeTab === 'habits'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-xs border border-border/60'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
          )}
        >
          <IconFlame size={16} />
          <span>Activity & Habits</span>
          <Badge variant="default" className="text-[10px] font-mono">{habits.length + trackers.length}</Badge>
        </button>

        <button
          onClick={() => setActiveTab('fitness')}
          className={clsx(
            'min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer touch-manipulation shrink-0',
            activeTab === 'fitness'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-xs border border-border/60'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
          )}
        >
          <IconDumbbell size={16} />
          <span>Fitness & Workouts</span>
          <Badge variant="default" className="text-[10px] font-mono">{workouts.length}</Badge>
        </button>

        <button
          onClick={() => setActiveTab('insights')}
          className={clsx(
            'min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer touch-manipulation shrink-0',
            activeTab === 'insights'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-xs border border-border/60'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
          )}
        >
          <IconSparkles size={16} />
          <span>Cross-Domain Insights</span>
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. GOALS & MILESTONES TAB */}
      {/* ==================================================================== */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          {/* Timeframe Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            {['all', 'short_term', 'medium_term', 'long_term'].map((tf) => (
              <button
                key={tf}
                onClick={() => setGoalFilterTimeframe(tf)}
                className={clsx(
                  'min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all capitalize cursor-pointer touch-manipulation whitespace-nowrap shrink-0 flex items-center',
                  goalFilterTimeframe === tf
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border-border/70 hover:bg-surface-container-low'
                )}
              >
                {tf === 'all' ? 'All Goals' : tf.replace('_', ' ')}
              </button>
            ))}
          </div>

          {filteredGoals.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
              <IconTarget size={40} className="text-on-surface-variant/50 mx-auto mb-3" />
              <h3 className="font-headline-md font-bold text-on-surface">No goals in this view</h3>
              <p className="font-body-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
                Define your short, medium, and long-term milestones to track high-impact life achievements.
              </p>
              <Button onClick={handleOpenCreateGoal} variant="primary" className="mt-4 cursor-pointer rounded-xl shadow-xs">
                <IconPlus size={16} className="mr-1" /> Create First Goal
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  style={{ borderTopColor: goal.color || '#8b5cf6', borderTopWidth: 4 }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono uppercase tracking-wider text-foreground/50">
                          {goal.timeframe ? goal.timeframe.replace('_', ' ') : 'General Goal'}
                        </span>
                        <h3 className="font-bold text-lg text-foreground leading-snug mt-0.5">
                          {goal.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={
                            goal.status === 'completed'
                              ? 'success'
                              : goal.status === 'in_progress'
                              ? 'primary'
                              : 'default'
                          }
                        >
                          {goal.status.replace('_', ' ')}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleOpenEditGoal(goal)}
                          title="Edit goal"
                          aria-label={`Edit goal ${goal.title}`}
                          className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoalToDelete(goal)}
                          title="Delete goal"
                          aria-label={`Delete goal ${goal.title}`}
                          className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>

                    {goal.description && (
                      <p className="text-xs text-foreground/70 line-clamp-2">{goal.description}</p>
                    )}

                    {/* Progress Bar & Percentage */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground/70">Milestone Progress</span>
                        <span className="text-primary font-bold">{goal.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-500 rounded-full"
                          style={{ width: `${goal.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Target Date countdown */}
                    {goal.targetDate && (
                      <div className="text-xs text-foreground/60 flex items-center gap-1.5 pt-1">
                        <IconCalendar size={13} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Target:</span>
                        <span className="font-semibold text-foreground">{goal.targetDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-border/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        onClick={() => {
                          setSelectedGoalForMilestone(goal.id);
                          setIsMilestoneModalOpen(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="cursor-pointer text-xs"
                      >
                        <IconPlus size={13} className="mr-1" /> Milestone
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedGoalForLinkTask(goal.id);
                          setIsLinkTaskModalOpen(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="cursor-pointer text-xs"
                      >
                        Link Task
                      </Button>
                    </div>

                    <Button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/goals/${goal.id}`);
                          if (res.ok) {
                            const { data: json } = await safeParseJson<ApiSuccessResponse<GoalData>>(res);
                            if (json?.data) {
                              setSelectedGoalForLogs(json.data);
                              setNewProgressValue(json.data.progressPercentage);
                              setIsProgressLogModalOpen(true);
                            }
                          }
                        } catch {
                          addToast('Failed to load goal history', 'error');
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-xs"
                    >
                      History
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. FLEXIBLE ACTIVITY TRACKING (HABITS & METRICS) */}
      {/* ==================================================================== */}
      {activeTab === 'habits' && (
        <div className="space-y-8">
          {/* Section A: Continuous Habits */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md font-bold text-on-surface">Habit Streaks & Consistency</h2>
                <p className="font-body-sm text-on-surface-variant">
                  Daily & custom target days with grace period streak preservation.
                </p>
              </div>
              <Button onClick={() => setIsHabitModalOpen(true)} variant="outline" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
                <IconPlus size={14} className="mr-1" /> New Habit
              </Button>
            </div>

            {habits.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
                <IconFlame size={36} className="text-on-surface-variant/50 mx-auto mb-2" />
                <p className="font-title-sm font-semibold text-on-surface">No active habits defined</p>
                <Button onClick={handleOpenCreateHabit} variant="primary" size="sm" className="mt-3 cursor-pointer rounded-xl shadow-xs">
                  <IconPlus size={14} className="mr-1" /> Add Habit
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {habits.map((habit) => (
                  <div
                    key={habit.id}
                    className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-title-sm font-bold text-on-surface">{habit.name}</h3>
                        <p className="font-label-md text-on-surface-variant capitalize mt-0.5">
                          {habit.frequencyType.replace('_', ' ')} · {habit.targetDaysPerWeek}d/wk
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-mono">
                          <IconFlame size={13} className="text-amber-500 fill-amber-500/30" />
                          <span>{habit.currentStreak || 0}d</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditHabit(habit)}
                          title="Edit habit"
                          aria-label={`Edit habit ${habit.name}`}
                          className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHabitToDelete(habit)}
                          title="Delete habit"
                          aria-label={`Delete habit ${habit.name}`}
                          className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <div className="text-xs text-on-surface-variant font-mono">
                        Longest: <span className="font-bold text-on-surface">{habit.longestStreak || 0}d</span>
                      </div>
                      <Button
                        onClick={() => handleLogHabitToday(habit.id)}
                        variant={habit.completedToday ? 'outline' : 'primary'}
                        size="sm"
                        className="cursor-pointer text-xs rounded-xl shadow-xs"
                      >
                        {habit.completedToday ? (
                          <span className="flex items-center gap-1 text-secondary font-medium">
                            <IconCheck size={14} /> Done Today
                          </span>
                        ) : (
                          'Mark Done Today'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Flexible Custom Metric Trackers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md font-bold text-on-surface">Flexible Metric Trackers</h2>
                <p className="font-body-sm text-on-surface-variant">
                  Track counts, durations, ratings, numbers, and text logs with date-specific notes.
                </p>
              </div>
              <Button onClick={handleOpenCreateTracker} variant="outline" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
                <IconPlus size={14} className="mr-1" /> New Metric
              </Button>
            </div>

            {trackers.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
                <IconTrendingUp size={36} className="text-on-surface-variant/50 mx-auto mb-2" />
                <p className="font-title-sm font-semibold text-on-surface">No metric trackers configured</p>
                <Button onClick={handleOpenCreateTracker} variant="primary" size="sm" className="mt-3 cursor-pointer rounded-xl shadow-xs">
                  <IconPlus size={14} className="mr-1" /> Add Tracker
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackers.map((t) => (
                  <div
                    key={t.id}
                    className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="default" className="uppercase text-[10px] font-mono">
                            {t.type}
                          </Badge>
                          <h3 className="font-title-sm font-bold text-on-surface mt-1">{t.name}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-on-surface-variant font-mono">
                            {t.entryCount || 0} entries
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditTracker(t)}
                            title="Edit tracker"
                            aria-label={`Edit tracker ${t.name}`}
                            className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrackerToDelete(t)}
                            title="Delete tracker"
                            aria-label={`Delete tracker ${t.name}`}
                            className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-surface-container-low rounded-xl border border-border/50 flex items-center justify-between">
                        <span className="text-xs text-on-surface-variant font-mono">Latest Log:</span>
                        <span className="font-bold text-sm text-on-surface font-mono">
                          {t.type === 'text'
                            ? t.latestTextValue || 'No text'
                            : t.latestValue !== null
                            ? `${t.latestValue} ${t.unit || ''}`
                            : 'Unlogged'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/60 flex justify-end">
                      <Button
                        onClick={() => {
                          setSelectedTrackerForLog(t);
                          setTrackerLogValue(t.latestValue ?? 1);
                          setTrackerLogText(t.latestTextValue ?? '');
                          setIsLogTrackerModalOpen(true);
                        }}
                        variant="primary"
                        size="sm"
                        className="cursor-pointer text-xs rounded-xl shadow-xs"
                      >
                        <IconPlus size={13} className="mr-1" /> Log Entry
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. FITNESS & WORKOUTS TAB */}
      {/* ==================================================================== */}
      {activeTab === 'fitness' && (
        <div className="space-y-6">
          {/* Fitness Sub-Nav Bento Container */}
          <div className="flex items-center gap-1.5 p-1.5 bg-surface-container-low border border-border/60 rounded-2xl overflow-x-auto no-scrollbar">
            {[
              { id: 'workouts' as const, label: 'Workout Sessions' },
              { id: 'templates' as const, label: 'Routines & Templates' },
              { id: 'prs' as const, label: 'Personal Records & 1RM' },
              { id: 'measurements' as const, label: 'Body & Weight (7d MA)' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setFitnessSubTab(sub.id)}
                className={clsx(
                  'min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer touch-manipulation shrink-0 flex items-center',
                  fitnessSubTab === sub.id
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-bold border border-border/60'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* SubTab A: Workout Sessions */}
          {fitnessSubTab === 'workouts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md font-bold text-on-surface">Logged Workout History</h3>
                <Button onClick={() => setIsWorkoutModalOpen(true)} variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
                  <IconPlus size={14} className="mr-1" /> Log Workout Session
                </Button>
              </div>

              {workouts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
                  <IconDumbbell size={36} className="text-on-surface-variant/50 mx-auto mb-2" />
                  <p className="font-title-sm font-semibold text-on-surface">No workouts logged yet</p>
                  <Button onClick={() => setIsWorkoutModalOpen(true)} variant="primary" size="sm" className="mt-3 cursor-pointer rounded-xl shadow-xs">
                    <IconPlus size={14} className="mr-1" /> Record Workout
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {workouts.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 sm:p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-title-sm font-bold text-on-surface">{w.name}</span>
                          <Badge variant="primary" className="capitalize text-[11px]">
                            {w.type}
                          </Badge>
                        </div>
                        <p className="font-body-sm text-on-surface-variant">
                          {w.date} · {w.durationMinutes || 0} mins · {w.exerciseCount || 0} exercises
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {w.totalTonnageGrams && w.totalTonnageGrams > 0 ? (
                          <div className="text-right">
                            <span className="font-label-caps text-on-surface-variant block uppercase font-mono">Volume Load</span>
                            <span className="font-headline-md font-bold text-on-surface font-mono">
                              {(w.totalTonnageGrams / 1000).toLocaleString()} kg
                            </span>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setWorkoutToDelete(w)}
                          title="Delete workout"
                          aria-label={`Delete workout ${w.name}`}
                          className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SubTab B: Templates */}
          {fitnessSubTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md font-bold text-on-surface">Workout Routine Templates</h3>
                <Button onClick={() => setIsTemplateModalOpen(true)} variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
                  <IconPlus size={14} className="mr-1" /> Create Template
                </Button>
              </div>

              {workoutTemplates.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
                  <IconFileText size={36} className="text-on-surface-variant/50 mx-auto mb-2" />
                  <p className="font-title-sm font-semibold text-on-surface">No workout templates defined</p>
                  <Button onClick={() => setIsTemplateModalOpen(true)} variant="primary" size="sm" className="mt-3 cursor-pointer rounded-xl shadow-xs">
                    <IconPlus size={14} className="mr-1" /> Add Routine Template
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workoutTemplates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge variant="default" className="capitalize text-[11px]">
                            {tmpl.type}
                          </Badge>
                          <span className="text-xs text-on-surface-variant font-mono">
                            Rest: {tmpl.defaultRestSeconds}s
                          </span>
                        </div>
                        <h4 className="font-title-sm font-bold text-on-surface">{tmpl.name}</h4>
                        {tmpl.description && (
                          <p className="font-body-sm text-on-surface-variant line-clamp-2">{tmpl.description}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setTemplateToDelete(tmpl)}
                          title="Delete template"
                          aria-label={`Delete template ${tmpl.name}`}
                          className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <IconTrash size={14} />
                        </button>
                        <Button
                          onClick={() => handleStartWorkoutFromTemplate(tmpl.id)}
                          variant="primary"
                          size="sm"
                          className="cursor-pointer text-xs rounded-xl shadow-xs"
                        >
                          <IconActivity size={14} className="mr-1" /> Start Workout
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SubTab C: PRs & 1RM */}
          {fitnessSubTab === 'prs' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-headline-md font-bold text-on-surface">
                  Personal Records & Estimated 1-Rep Max (Epley Formula)
                </h3>
                <p className="font-body-sm text-on-surface-variant">
                  Computed automatically from set weight and repetition metrics.
                </p>
              </div>

              {!fitnessStats?.personalRecords || fitnessStats.personalRecords.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
                  <IconTrendingUp size={36} className="text-on-surface-variant/50 mx-auto mb-2" />
                  <p className="font-title-sm font-semibold text-on-surface">No strength records calculated yet</p>
                  <p className="font-body-sm text-on-surface-variant mt-1">
                    Log workout exercises with weight and reps to automatically compute PRs and estimated 1RMs.
                  </p>
                </div>
              ) : (
                <div className="bg-surface-container-lowest border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-container-low text-on-surface-variant border-b border-border/70 text-[11px] uppercase font-mono font-semibold">
                      <tr>
                        <th className="p-3.5">Exercise Name</th>
                        <th className="p-3.5">Max Weight</th>
                        <th className="p-3.5">Reps</th>
                        <th className="p-3.5">Estimated 1RM</th>
                        <th className="p-3.5">Date Achieved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {fitnessStats.personalRecords.map((pr) => (
                        <tr key={pr.exerciseName} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="p-3.5 font-bold text-on-surface">{pr.exerciseName}</td>
                          <td className="p-3.5 font-mono">{(pr.maxWeightGrams / 1000).toFixed(1)} kg</td>
                          <td className="p-3.5 font-mono">{pr.maxReps}</td>
                          <td className="p-3.5 font-extrabold text-primary font-mono">
                            {(pr.estimatedOneRepMaxGrams / 1000).toFixed(1)} kg
                          </td>
                          <td className="p-3.5 text-xs text-on-surface-variant font-mono">{pr.achievedAtDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SubTab D: Body Measurements & 7-Day Moving Average */}
          {fitnessSubTab === 'measurements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline-md font-bold text-on-surface">Body Measurements & 7-Day Weight MA</h3>
                  <p className="font-body-sm text-on-surface-variant">
                    Smooth out day-to-day water weight fluctuations with moving averages.
                  </p>
                </div>
                <Button onClick={() => setIsMeasurementModalOpen(true)} variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
                  <IconPlus size={14} className="mr-1" /> Log Measurement
                </Button>
              </div>

              {measurements.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border/70 rounded-2xl bg-surface-container-lowest shadow-sm">
                  <IconActivity size={36} className="text-on-surface-variant/50 mx-auto mb-2" />
                  <p className="font-title-sm font-semibold text-on-surface">No body measurements recorded</p>
                  <Button onClick={() => setIsMeasurementModalOpen(true)} variant="primary" size="sm" className="mt-3 cursor-pointer rounded-xl shadow-xs">
                    <IconPlus size={14} className="mr-1" /> Log First Check
                  </Button>
                </div>
              ) : (
                <div className="bg-surface-container-lowest border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-container-low text-on-surface-variant border-b border-border/70 text-[11px] uppercase font-mono font-semibold">
                      <tr>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Body Weight</th>
                        <th className="p-3.5">Body Fat</th>
                        <th className="p-3.5">Waist</th>
                        <th className="p-3.5">Chest</th>
                        <th className="p-3.5">Notes</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {measurements.map((m) => (
                        <tr key={m.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="p-3.5 font-semibold text-on-surface font-mono">{m.date}</td>
                          <td className="p-3.5 font-bold text-on-surface font-mono">
                            {m.weightGrams ? `${(m.weightGrams / 1000).toFixed(2)} kg` : '—'}
                          </td>
                          <td className="p-3.5 font-mono">
                            {m.bodyFatBps ? `${(m.bodyFatBps / 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="p-3.5 font-mono">
                            {m.waistMm ? `${(m.waistMm / 10).toFixed(1)} cm` : '—'}
                          </td>
                          <td className="p-3.5 font-mono">
                            {m.chestMm ? `${(m.chestMm / 10).toFixed(1)} cm` : '—'}
                          </td>
                          <td className="p-3.5 text-xs text-on-surface-variant">{m.notes || '—'}</td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => setMeasurementToDelete(m)}
                              title="Delete measurement"
                              aria-label="Delete measurement"
                              className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <IconTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. CROSS-DOMAIN INSIGHTS TAB */}
      {/* ==================================================================== */}
      {activeTab === 'insights' && insights && (
        <div className="space-y-6">
          {/* Top KPI Cards (4-Column Bento Grid) */}
          <KpiGrid cols="4">
            <KpiCard
              title="Task Velocity (30d)"
              value={`${insights.tasks.completedPast30d} Done`}
              subtitle={`${insights.tasks.completedPast7d} in past 7 days`}
              color="emerald"
            />

            <KpiCard
              title="Habit Consistency"
              value={`${insights.trackers.overallConsistencyRate30d}%`}
              subtitle={`Top: ${insights.trackers.topHabitName} (${insights.trackers.longestActiveStreakDays}d)`}
              color="primary"
            />

            <KpiCard
              title="Monthly Tonnage"
              value={`${Math.round(insights.fitness.tonnagePast30dGrams / 1000).toLocaleString()} kg`}
              subtitle={`Across ${insights.fitness.workoutsPast30d} sessions`}
              color="cyan"
            />

            <KpiCard
              title="Goals On-Track"
              value={insights.goals.onTrackCount}
              subtitle={`Avg Progress: ${insights.goals.averageProgress}%`}
              color="emerald"
            />
          </KpiGrid>

          {/* 365-Day Unified Activity Heatmap Bento Card */}
          <div className="p-6 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-headline-md font-bold text-on-surface">365-Day Unified Life Heatmap</h3>
                <p className="font-body-sm text-on-surface-variant">
                  Comprehensive daily density of completed tasks, habits, and workouts.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono">
                <span>Less</span>
                <span className="w-3 h-3 rounded-xs bg-surface-container-low border border-border/50 inline-block" />
                <span className="w-3 h-3 rounded-xs bg-emerald-500/30 inline-block" />
                <span className="w-3 h-3 rounded-xs bg-emerald-500/60 inline-block" />
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                <span>More</span>
              </div>
            </div>

            <div className="overflow-x-auto py-2">
              <div className="flex flex-wrap gap-1.5 max-w-full">
                {insights.heatmap365.slice(-180).map((day) => {
                  const score = day.activityScore;
                  let bgClass = 'bg-surface-container-low border border-border/40';
                  if (score > 75) bgClass = 'bg-emerald-500 shadow-xs';
                  else if (score > 40) bgClass = 'bg-emerald-500/70';
                  else if (score > 0) bgClass = 'bg-emerald-500/30';

                  return (
                    <div
                      key={day.date}
                      className={clsx('w-3.5 h-3.5 rounded-xs transition-transform hover:scale-125 cursor-pointer', bgClass)}
                      title={`${day.date}: Score ${score} (${day.tasksCompleted} tasks, ${day.habitsCompleted} habits, ${day.workoutsLogged} workouts)`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODALS */}
      {/* ==================================================================== */}

      {/* Modal: New Goal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => {
          setIsGoalModalOpen(false);
          setEditingGoal(null);
        }}
        title={editingGoal ? 'Edit Goal' : 'Create New Goal'}
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <Input
            label="Goal Title"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="e.g. Master Cloud Architecture"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Timeframe</label>
              <select
                value={goalTimeframe}
                onChange={(e) => setGoalTimeframe(e.target.value as GoalTimeframe)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-[38px] bg-background border border-border rounded-xl text-foreground touch-manipulation cursor-pointer"
              >
                <option value="short_term">Short-Term (&lt; 3 months)</option>
                <option value="medium_term">Medium-Term (3-12 months)</option>
                <option value="long_term">Long-Term (1+ years)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Accent Color</label>
              <input
                type="color"
                value={goalColor}
                onChange={(e) => setGoalColor(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-[38px] rounded-xl border border-border bg-background cursor-pointer p-1"
              />
            </div>
          </div>

          <Input
            label="Target Date (Optional)"
            type="date"
            value={goalTargetDate}
            onChange={(e) => setGoalTargetDate(e.target.value)}
          />

          <Input
            label="Description (Optional)"
            value={goalDescription}
            onChange={(e) => setGoalDescription(e.target.value)}
            placeholder="Strategic intent or vision..."
          />

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              onClick={() => {
                setIsGoalModalOpen(false);
                setEditingGoal(null);
              }}
              variant="ghost"
              type="button"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              {editingGoal ? 'Save Changes' : 'Save Goal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Milestone */}
      <Modal isOpen={isMilestoneModalOpen} onClose={() => setIsMilestoneModalOpen(false)} title="Add Milestone">
        <form onSubmit={handleCreateMilestone} className="space-y-4">
          <Input
            label="Milestone Title"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            placeholder="e.g. Complete 50 design mockups"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Value"
              type="number"
              value={milestoneTarget}
              onChange={(e) => setMilestoneTarget(Number(e.target.value))}
              required
            />
            <Input
              label="Unit"
              value={milestoneUnit}
              onChange={(e) => setMilestoneUnit(e.target.value)}
              placeholder="%, items, kg"
              required
            />
          </div>

          <Input
            label="Due Date (Optional)"
            type="date"
            value={milestoneDueDate}
            onChange={(e) => setMilestoneDueDate(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button onClick={() => setIsMilestoneModalOpen(false)} variant="ghost" type="button" className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              Add Milestone
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Progress Logs & History */}
      <Modal
        isOpen={isProgressLogModalOpen}
        onClose={() => setIsProgressLogModalOpen(false)}
        title={`Goal Progress: ${selectedGoalForLogs?.title || ''}`}
      >
        <div className="space-y-6">
          {/* Milestone List in Modal */}
          {selectedGoalForLogs?.milestones && selectedGoalForLogs.milestones.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60">Milestones</h4>
              <div className="space-y-1.5">
                {selectedGoalForLogs.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-muted/40 rounded-lg flex items-center justify-between text-sm gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={m.isCompleted}
                        onChange={() => handleToggleMilestone(m.id, m.isCompleted)}
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className={clsx('truncate', m.isCompleted && 'line-through text-foreground/50')}>
                        {m.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={m.isCompleted ? 'success' : 'default'}>
                        {m.currentValue} / {m.targetValue} {m.unit}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1 rounded text-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Delete Milestone"
                        aria-label="Delete Milestone"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Progress Update Form */}
          <form onSubmit={handleLogGoalProgress} className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60">Update Progress</h4>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={newProgressValue}
                onChange={(e) => setNewProgressValue(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="font-bold text-base text-primary w-12 text-right">{newProgressValue}%</span>
            </div>

            <Input
              label="Log Notes"
              value={progressLogNotes}
              onChange={(e) => setProgressLogNotes(e.target.value)}
              placeholder="What milestone or adjustment was completed?"
            />

            <Button variant="primary" type="submit" isLoading={submitting} className="w-full mt-2">
              Log Progress
            </Button>
          </form>

          {/* Progress Logs Trail */}
          {selectedGoalForLogs?.progressLogs && selectedGoalForLogs.progressLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60">Audit Trail</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedGoalForLogs.progressLogs.map((log) => (
                  <div key={log.id} className="text-xs p-2 bg-muted/30 rounded border border-border/50">
                    <div className="flex justify-between font-semibold">
                      <span>
                        {log.previousProgress}% → {log.newProgress}%
                      </span>
                      <span className="text-foreground/50">{log.loggedAt}</span>
                    </div>
                    {log.notes && <p className="text-foreground/70 mt-0.5">{log.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Link Task to Goal */}
      <Modal isOpen={isLinkTaskModalOpen} onClose={() => setIsLinkTaskModalOpen(false)} title="Link Task to Goal">
        <form onSubmit={handleLinkTaskToGoal} className="space-y-4">
          <Input
            label="Task ID"
            value={linkTaskId}
            onChange={(e) => setLinkTaskId(e.target.value)}
            placeholder="e.g. tsk_..."
            required
          />
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button onClick={() => setIsLinkTaskModalOpen(false)} variant="ghost" type="button" className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              Link Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Habit */}
      <Modal
        isOpen={isHabitModalOpen}
        onClose={() => {
          setIsHabitModalOpen(false);
          setEditingHabit(null);
        }}
        title={editingHabit ? 'Edit Habit' : 'New Daily / Weekly Habit'}
      >
        <form onSubmit={handleCreateHabit} className="space-y-4">
          <Input
            label="Habit Name"
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
            placeholder="e.g. Read 20 pages"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Frequency</label>
              <select
                value={habitFrequency}
                onChange={(e) => setHabitFrequency(e.target.value as 'daily' | 'weekly' | 'custom_days')}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-[38px] bg-background border border-border rounded-xl text-foreground touch-manipulation cursor-pointer"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly Target</option>
                <option value="custom_days">Custom Days</option>
              </select>
            </div>
            <Input
              label="Days / Wk"
              type="number"
              min="1"
              max="7"
              value={habitTarget}
              onChange={(e) => setHabitTarget(Number(e.target.value))}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Color</label>
              <input
                type="color"
                value={habitColor}
                onChange={(e) => setHabitColor(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-[38px] rounded-xl border border-border bg-background cursor-pointer p-1"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              onClick={() => {
                setIsHabitModalOpen(false);
                setEditingHabit(null);
              }}
              variant="ghost"
              type="button"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              {editingHabit ? 'Save Changes' : 'Save Habit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Metric Tracker */}
      <Modal
        isOpen={isTrackerModalOpen}
        onClose={() => {
          setIsTrackerModalOpen(false);
          setEditingTracker(null);
        }}
        title={editingTracker ? 'Edit Metric Tracker' : 'New Metric Tracker'}
      >
        <form onSubmit={handleCreateTracker} className="space-y-4">
          <Input
            label="Metric Name"
            value={trackerName}
            onChange={(e) => setTrackerName(e.target.value)}
            placeholder="e.g. Daily Water Intake"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Type</label>
              <select
                value={trackerType}
                disabled={Boolean(editingTracker)}
                onChange={(e) => setTrackerType(e.target.value as 'numeric' | 'boolean' | 'duration' | 'rating' | 'count' | 'text')}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-[38px] bg-background border border-border rounded-xl text-foreground touch-manipulation cursor-pointer disabled:opacity-50"
              >
                <option value="numeric">Numeric Number</option>
                <option value="count">Count / Tally</option>
                <option value="duration">Duration (mins)</option>
                <option value="rating">Rating (1-10)</option>
                <option value="boolean">Yes / No</option>
                <option value="text">Text Log</option>
              </select>
            </div>
            <Input
              label="Unit"
              value={trackerUnit}
              onChange={(e) => setTrackerUnit(e.target.value)}
              placeholder="liters, pages"
            />
            <Input
              label="Target Value"
              type="number"
              value={trackerTarget}
              onChange={(e) => setTrackerTarget(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="optional"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              onClick={() => {
                setIsTrackerModalOpen(false);
                setEditingTracker(null);
              }}
              variant="ghost"
              type="button"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              {editingTracker ? 'Save Changes' : 'Create Metric'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Log Tracker Entry */}
      <Modal
        isOpen={isLogTrackerModalOpen}
        onClose={() => setIsLogTrackerModalOpen(false)}
        title={`Log Metric: ${selectedTrackerForLog?.name || ''}`}
      >
        <form onSubmit={handleLogTrackerEntry} className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={trackerLogDate}
            onChange={(e) => setTrackerLogDate(e.target.value)}
            required
          />

          {selectedTrackerForLog?.type === 'text' ? (
            <Input
              label="Text Log Entry"
              value={trackerLogText}
              onChange={(e) => setTrackerLogText(e.target.value)}
              placeholder="Log message or record..."
              required
            />
          ) : (
            <Input
              label={`Value (${selectedTrackerForLog?.unit || ''})`}
              type="number"
              value={trackerLogValue}
              onChange={(e) => setTrackerLogValue(Number(e.target.value))}
              required
            />
          )}

          <Input
            label="Date-Specific Notes (Optional)"
            value={trackerLogNotes}
            onChange={(e) => setTrackerLogNotes(e.target.value)}
            placeholder="Context or observations for this date..."
          />

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button onClick={() => setIsLogTrackerModalOpen(false)} variant="ghost" type="button" className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              Save Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Log Workout */}
      <Modal isOpen={isWorkoutModalOpen} onClose={() => setIsWorkoutModalOpen(false)} title="Record Workout Session">
        <form onSubmit={handleCreateWorkout} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Session Title"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="e.g. Heavy Upper Body"
              required
            />
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Type</label>
              <select
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value as 'strength' | 'cardio' | 'flexibility' | 'sport' | 'other')}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-[38px] bg-background border border-border rounded-xl text-foreground touch-manipulation cursor-pointer"
              >
                <option value="strength">Strength Training</option>
                <option value="cardio">Cardio</option>
                <option value="flexibility">Flexibility / Mobility</option>
                <option value="sport">Sport / Athletic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Date"
              type="date"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              required
            />
            <Input
              label="Duration (mins)"
              type="number"
              value={workoutDuration}
              onChange={(e) => setWorkoutDuration(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <Input
              label="Calories (est.)"
              type="number"
              value={workoutCalories}
              onChange={(e) => setWorkoutCalories(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          {/* Exercise Sets Builder */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/70">Exercises & Sets</h4>
              <Button
                type="button"
                onClick={() =>
                  setWorkoutExercisesList([
                    ...workoutExercisesList,
                    {
                      exerciseName: 'New Exercise',
                      sets: [{ setNumber: 1, reps: 10, weightKg: 50, setType: 'normal', isCompleted: true }],
                    },
                  ])
                }
                variant="outline"
                size="sm"
                className="min-h-[36px]"
              >
                + Add Exercise
              </Button>
            </div>

            {workoutExercisesList.map((ex, exIdx) => (
              <div key={exIdx} className="p-3 bg-muted/30 border border-border rounded-lg space-y-2">
                <Input
                  label="Exercise Name"
                  value={ex.exerciseName}
                  onChange={(e) => {
                    const next = [...workoutExercisesList];
                    next[exIdx].exerciseName = e.target.value;
                    setWorkoutExercisesList(next);
                  }}
                  required
                />
                <div className="space-y-1.5">
                  {ex.sets.map((s, sIdx) => (
                    <div key={sIdx} className="flex items-center flex-wrap gap-2 text-xs">
                      <span className="w-12 font-semibold">Set {s.setNumber}:</span>
                      <input
                        type="number"
                        placeholder="kg"
                        value={s.weightKg ?? ''}
                        onChange={(e) => {
                          const next = [...workoutExercisesList];
                          next[exIdx].sets[sIdx].weightKg = e.target.value === '' ? null : Number(e.target.value);
                          setWorkoutExercisesList(next);
                        }}
                        className="w-20 px-2 py-1.5 text-base sm:text-xs min-h-[38px] sm:min-h-[28px] bg-background border border-border rounded touch-manipulation"
                      />
                      <span>kg ×</span>
                      <input
                        type="number"
                        placeholder="reps"
                        value={s.reps ?? ''}
                        onChange={(e) => {
                          const next = [...workoutExercisesList];
                          next[exIdx].sets[sIdx].reps = e.target.value === '' ? null : Number(e.target.value);
                          setWorkoutExercisesList(next);
                        }}
                        className="w-16 px-2 py-1.5 text-base sm:text-xs min-h-[38px] sm:min-h-[28px] bg-background border border-border rounded touch-manipulation"
                      />
                      <span>reps</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button onClick={() => setIsWorkoutModalOpen(false)} variant="ghost" type="button" className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              Save Workout
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Workout Template */}
      <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="Create Workout Routine Template">
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <Input
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Push Hypertrophy Routine"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">Type</label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as 'strength' | 'cardio' | 'flexibility' | 'sport' | 'other')}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-[38px] bg-background border border-border rounded-xl text-foreground touch-manipulation cursor-pointer"
              >
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
                <option value="flexibility">Flexibility</option>
              </select>
            </div>
            <Input
              label="Rest Seconds"
              type="number"
              value={templateRestSec}
              onChange={(e) => setTemplateRestSec(Number(e.target.value))}
            />
          </div>
          <Input
            label="Routine Notes (Optional)"
            value={templateDesc}
            onChange={(e) => setTemplateDesc(e.target.value)}
            placeholder="Warmup protocols or notes..."
          />
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button onClick={() => setIsTemplateModalOpen(false)} variant="ghost" type="button" className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              Save Template
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Body Measurement */}
      <Modal isOpen={isMeasurementModalOpen} onClose={() => setIsMeasurementModalOpen(false)} title="Record Body Measurements">
        <form onSubmit={handleSaveMeasurement} className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={measureDate}
            onChange={(e) => setMeasureDate(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Weight (kg)"
              type="number"
              step="0.05"
              value={measureWeightKg}
              onChange={(e) => setMeasureWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
            <Input
              label="Body Fat %"
              type="number"
              step="0.1"
              value={measureBodyFatPct}
              onChange={(e) => setMeasureBodyFatPct(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Waist (cm)"
              type="number"
              step="0.5"
              value={measureWaistCm}
              onChange={(e) => setMeasureWaistCm(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <Input
              label="Chest (cm)"
              type="number"
              step="0.5"
              value={measureChestCm}
              onChange={(e) => setMeasureChestCm(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <Input
            label="Notes"
            value={measureNotes}
            onChange={(e) => setMeasureNotes(e.target.value)}
            placeholder="Morning weigh-in, fasted..."
          />
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button onClick={() => setIsMeasurementModalOpen(false)} variant="ghost" type="button" className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting} className="flex-1 sm:flex-initial">
              Save Measurement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modals */}
      <ConfirmationModal
        isOpen={Boolean(goalToDelete)}
        title="Delete Goal"
        message={`Are you sure you want to delete goal "${goalToDelete?.title}"? All associated milestones and progress history will be removed.`}
        confirmText="Delete Goal"
        variant="danger"
        isLoading={isDeletingGoal}
        onConfirm={confirmDeleteGoal}
        onClose={() => setGoalToDelete(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(habitToDelete)}
        title="Delete Habit"
        message={`Are you sure you want to delete habit "${habitToDelete?.name}"? All streak records and completion logs will be removed.`}
        confirmText="Delete Habit"
        variant="danger"
        isLoading={isDeletingHabit}
        onConfirm={confirmDeleteHabit}
        onClose={() => setHabitToDelete(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(trackerToDelete)}
        title="Delete Metric Tracker"
        message={`Are you sure you want to delete tracker "${trackerToDelete?.name}"? All time-series data points logged for this metric will be removed.`}
        confirmText="Delete Tracker"
        variant="danger"
        isLoading={isDeletingTracker}
        onConfirm={confirmDeleteTracker}
        onClose={() => setTrackerToDelete(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(workoutToDelete)}
        title="Delete Workout"
        message={`Are you sure you want to delete the workout logged on ${workoutToDelete?.date}?`}
        confirmText="Delete Workout"
        variant="danger"
        isLoading={isDeletingWorkout}
        onConfirm={confirmDeleteWorkout}
        onClose={() => setWorkoutToDelete(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(templateToDelete)}
        title="Delete Routine Template"
        message={`Are you sure you want to delete routine template "${templateToDelete?.name}"?`}
        confirmText="Delete Template"
        variant="danger"
        isLoading={isDeletingTemplate}
        onConfirm={confirmDeleteTemplate}
        onClose={() => setTemplateToDelete(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(measurementToDelete)}
        title="Delete Body Measurement"
        message={`Are you sure you want to delete the body measurement record from ${measurementToDelete?.date}?`}
        confirmText="Delete Measurement"
        variant="danger"
        isLoading={isDeletingMeasurement}
        onConfirm={confirmDeleteMeasurement}
        onClose={() => setMeasurementToDelete(null)}
      />
    </div>
  );
}
