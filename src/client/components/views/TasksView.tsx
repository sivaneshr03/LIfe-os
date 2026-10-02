import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { LoadingState, EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';
import {
  IconCheckSquare,
  IconPlus,
  IconCalendar,
  IconRefreshCw,
  IconTrash,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from '../ui/Icons';
import type { TaskData, TaskChecklistItemData, TaskPriority, TaskStatus, ApiPaginatedResponse } from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

export function TasksView() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sub-checklist state
  const [taskChecklists, setTaskChecklists] = useState<Record<string, TaskChecklistItemData[]>>({});
  const [expandedTaskChecklists, setExpandedTaskChecklists] = useState<Record<string, boolean>>({});
  const [newChecklistInput, setNewChecklistInput] = useState<Record<string, string>>({});

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks?limit=100');
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiPaginatedResponse<TaskData>>(res);
        const taskList = Array.isArray(json?.data)
          ? json.data
          : (json?.data?.items || []);
        setTasks(taskList);
        return;
      }
      setTasks([]);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Global keydown shortcut 'T' for New Task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 't' &&
        !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase()) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        handleOpenCreateTask();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setNewDueDate('');
    setNewDueTime('');
    setIsModalOpen(true);
  };

  const handleOpenEditTask = (task: TaskData) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewDesc(task.description || '');
    setNewPriority(task.priority);
    setNewDueDate(task.dueDate || '');
    setNewDueTime(task.dueTime || '');
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
      if (editingTask) {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle.trim(),
            description: newDesc.trim() || undefined,
            priority: newPriority,
            dueDate: newDueDate || undefined,
            dueTime: newDueTime || undefined,
          }),
        });

        if (!res.ok) {
          const { data: errJson } = await safeParseJson<{ error?: string }>(res);
          throw new Error(errJson?.error || 'Failed to update task');
        }

        toast.success(`Task "${newTitle.trim()}" updated`);
        setTasks((prev) =>
          (Array.isArray(prev) ? prev : []).map((t) =>
            t.id === editingTask.id
              ? {
                  ...t,
                  title: newTitle.trim(),
                  description: newDesc.trim() || undefined,
                  priority: newPriority,
                  dueDate: newDueDate || undefined,
                  dueTime: newDueTime || undefined,
                }
              : t
          )
        );
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle.trim(),
            description: newDesc.trim() || undefined,
            priority: newPriority,
            dueDate: newDueDate || undefined,
            dueTime: newDueTime || undefined,
            status: 'todo',
          }),
        });

        if (!res.ok) {
          const { data: errJson } = await safeParseJson<{ error?: string }>(res);
          throw new Error(errJson?.error || 'Failed to create task');
        }

        toast.success('Task created successfully');
      }

      setIsModalOpen(false);
      setEditingTask(null);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setNewDueDate('');
      setNewDueTime('');
      fetchTasks();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTaskStatus = async (task: TaskData) => {
    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) throw new Error('Failed to update task status');
      setTasks((prev) =>
        (Array.isArray(prev) ? prev : []).map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );

      if (nextStatus === 'done') {
        toast.success(`Completed "${task.title}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await fetch(`/api/tasks/${task.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'todo' }),
                });
                setTasks((prev) =>
                  (Array.isArray(prev) ? prev : []).map((t) =>
                    t.id === task.id ? { ...t, status: 'todo' } : t
                  )
                );
                toast.info(`Reopened "${task.title}"`);
              } catch {
                toast.error('Failed to undo task completion');
              }
            },
          },
          duration: 5000,
        });
      } else {
        toast.info('Task reopened');
      }
    } catch {
      toast.error('Error updating task status');
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const task = taskToDelete;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== task.id));
      toast.success(`Task "${task.title}" deleted`);
      setTaskToDelete(null);
    } catch {
      toast.error('Error deleting task');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sub-checklist interaction handlers
  const toggleChecklistExpanded = async (taskId: string) => {
    const isNowExpanded = !expandedTaskChecklists[taskId];
    setExpandedTaskChecklists((prev) => ({ ...prev, [taskId]: isNowExpanded }));

    if (isNowExpanded && !taskChecklists[taskId]) {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (res.ok) {
          const { data: json } = await safeParseJson<{ data: { checklistItems?: TaskChecklistItemData[] } }>(res);
          if (json?.data?.checklistItems) {
            setTaskChecklists((prev) => ({ ...prev, [taskId]: json.data.checklistItems }));
          }
        }
      } catch {
        // ignore background fetch error
      }
    }
  };

  const handleToggleChecklistItem = async (taskId: string, itemId: string, isCompleted: boolean) => {
    setTaskChecklists((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] || []).map((item) =>
        item.id === itemId ? { ...item, isCompleted } : item
      ),
    }));

    try {
      await fetch(`/api/tasks/checklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted }),
      });
    } catch {
      // ignore mutation error
    }
  };

  const handleCreateChecklistItem = async (taskId: string) => {
    const title = (newChecklistInput[taskId] || '').trim();
    if (!title) return;

    setNewChecklistInput((prev) => ({ ...prev, [taskId]: '' }));

    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const { data: json } = await safeParseJson<{ data: TaskChecklistItemData }>(res);
        if (json?.data) {
          setTaskChecklists((prev) => ({
            ...prev,
            [taskId]: [...(prev[taskId] || []), json.data],
          }));
        }
      }
    } catch {
      // ignore creation error
    }
  };

  const handleDeleteChecklistItem = async (taskId: string, itemId: string) => {
    setTaskChecklists((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter((item) => item.id !== itemId),
    }));

    try {
      await fetch(`/api/tasks/checklist/${itemId}`, { method: 'DELETE' });
    } catch {
      // ignore deletion error
    }
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const filteredTasks = safeTasks.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const todoCount = safeTasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = safeTasks.filter((t) => t.status === 'in_progress').length;
  const blockedCount = safeTasks.filter((t) => t.status === 'blocked').length;
  const doneCount = safeTasks.filter((t) => t.status === 'done').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueCount = safeTasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done').length;
  const velocityPct = safeTasks.length > 0 ? Math.round((doneCount / safeTasks.length) * 100) : 0;

  const priorityBadge = (priority: TaskPriority) => {
    const styles: Record<TaskPriority, string> = {
      urgent: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold',
      high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold',
      medium: 'bg-primary-fixed text-primary font-semibold',
      low: 'bg-surface-container-highest text-on-surface-variant font-medium',
    };
    return (
      <span className={clsx('px-2 py-0.5 text-[10px] font-label-caps uppercase tracking-wider rounded', styles[priority])}>
        {priority}
      </span>
    );
  };

  const statusBadge = (status: TaskStatus) => {
    const styles: Record<TaskStatus, string> = {
      todo: 'bg-surface-container text-on-surface-variant',
      in_progress: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold',
      blocked: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold',
      done: 'bg-secondary-container/50 text-secondary font-semibold',
      archived: 'bg-surface-container text-outline',
    };
    return (
      <span className={clsx('px-2 py-0.5 text-[10px] font-label-caps uppercase tracking-wider rounded', styles[status])}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Calendar calculations
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const handleTodayMonth = () => setCalendarDate(new Date());

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* ─── Executive Header & Controls ─── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Tasks & Projects
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              {tasks.filter((t) => t.status !== 'done').length} Pending
            </span>
          </div>
        </div>

        {/* View Switcher & Primary Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Segmented Control */}
          <div className="inline-flex p-1 bg-surface-container-low rounded-xl border border-border/60 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer',
                viewMode === 'list'
                  ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer',
                viewMode === 'board'
                  ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer',
                viewMode === 'calendar'
                  ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <span>Calendar</span>
            </button>
          </div>

          {/* New Task CTA */}
          <button
            onClick={handleOpenCreateTask}
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded-xl font-label-md text-label-md font-semibold shadow-sm hover:shadow-[0_4px_16px_rgba(70,72,212,0.28)] transition-all active:scale-[0.98] cursor-pointer"
          >
            <IconPlus size={16} />
            <span>New Task</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 rounded bg-surface-container-lowest/20 text-on-primary font-label-caps text-label-caps font-mono">
              T
            </kbd>
          </button>
        </div>
      </div>

      {/* ─── Bento Productivity Telemetry Strip (Strict 2x2 Mobile Grid) ─── */}
      <section aria-label="Productivity Telemetry" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Sprint Velocity */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 truncate block select-none">
              Sprint Velocity
            </span>
            <span className="text-[11px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded-full bg-surface-container text-primary shrink-0">
              {doneCount} / {safeTasks.length} done
            </span>
          </div>
          <div className="space-y-1 my-auto">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface leading-none py-0.5">
                {velocityPct}%
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary shrink-0">
                {doneCount > 0 ? `+${doneCount} resolved` : '0 completed'}
              </span>
            </div>
            <div className="text-xs text-on-surface-variant/80 truncate leading-normal mt-1">
              {safeTasks.length > 0 ? 'Sprint completion velocity' : 'No tasks recorded yet'}
            </div>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-2.5 overflow-hidden shrink-0">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${velocityPct}%` }} />
          </div>
        </div>

        {/* KPI 2: Scheduled Today */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 truncate block select-none">
              Open Queue
            </span>
            <span
              className={clsx(
                'text-[11px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded-full shrink-0',
                overdueCount > 0
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-surface-container text-on-surface-variant'
              )}
            >
              {overdueCount} Overdue
            </span>
          </div>
          <div className="space-y-1 my-auto">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface leading-none py-0.5">
                {todoCount + inProgressCount}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                slated
              </span>
            </div>
            <div className="text-xs text-on-surface-variant truncate flex items-center gap-1 mt-1">
              <span>•</span>
              <span className="truncate">{inProgressCount} in progress • {blockedCount} blocked</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Priority Focus */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 truncate block select-none">
              Priority Focus
            </span>
            <span className="text-amber-500 font-bold text-sm">⚡</span>
          </div>
          <div className="space-y-1 my-auto">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface leading-none py-0.5">
                {safeTasks.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'done').length}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                critical
              </span>
            </div>
            <div className="text-xs text-on-surface-variant/80 truncate leading-normal mt-1">
              Urgent & high priority milestones
            </div>
          </div>
        </div>

        {/* KPI 4: Cloudflare D1 Replication */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 truncate block select-none">
              D1 Ledger
            </span>
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          </div>
          <div className="space-y-1 my-auto">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-secondary leading-none py-0.5">
                Synced
              </span>
              <span className="text-xs text-on-surface-variant font-mono">
                SQLite Edge
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono mt-1">
              <span>edge-ord-01</span>
              <span className="text-secondary font-semibold">0 errors</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Filters & Search Bar ─── */}
      {viewMode !== 'calendar' && (
        <div className="bg-surface-container-lowest p-3 sm:p-4 rounded-2xl border border-border/70 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {[
              { id: 'all', label: 'All Tasks', count: safeTasks.length },
              { id: 'todo', label: 'Todo', count: todoCount },
              { id: 'in_progress', label: 'In Progress', count: inProgressCount },
              { id: 'blocked', label: 'Blocked', count: blockedCount },
              { id: 'done', label: 'Completed', count: doneCount },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer',
                  statusFilter === st.id
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                )}
              >
                {st.label} <span className="ml-1 opacity-75 font-mono text-[11px]">{st.count}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <IconSearch size={16} className="text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks or tags..."
              className="w-full bg-surface-container-low hover:bg-surface-container focus:bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm pl-9 pr-10 py-1.5 rounded-xl border border-border/60 focus:border-primary outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Main View Content ─── */}
      {loading ? (
        <LoadingState message="Loading your task system..." />
      ) : filteredTasks.length === 0 && viewMode !== 'calendar' ? (
        <EmptyState
          title="No tasks found"
          description={
            search || statusFilter !== 'all'
              ? 'Try changing your search keywords or filter criteria.'
              : 'Create your first actionable task to begin organizing your work.'
          }
          actionLabel="Create Task"
          onAction={handleOpenCreateTask}
          icon={<IconCheckSquare size={32} className="text-primary" />}
        />
      ) : viewMode === 'list' ? (
        /* Bento Checklist Cards View: Item title is strictly rendered inside the checklist card container */
        <div className="space-y-3">
          {filteredTasks.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'rounded-2xl bg-surface-container-lowest border border-border/70 p-4 sm:p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group',
                t.status === 'done' && 'opacity-70 bg-surface-container-low/30'
              )}
            >
              {/* Checklist Card Container Header: Checkbox and Title placed cleanly INSIDE this card container */}
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => handleToggleTaskStatus(t)}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer mt-0.5 sm:mt-0 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Checklist item title is rendered inside the checklist card container */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        onClick={() => handleOpenEditTask(t)}
                        className={clsx(
                          'font-body-md text-sm sm:text-base font-semibold text-on-surface cursor-pointer hover:text-primary transition-colors',
                          t.status === 'done' && 'line-through text-outline'
                        )}
                      >
                        {t.title}
                      </h3>
                      {priorityBadge(t.priority)}
                      {statusBadge(t.status)}
                      {t.isRecurringTemplate && (
                        <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-label-caps text-primary flex items-center gap-1 font-semibold">
                          <IconRefreshCw size={10} />
                          <span>Recurring</span>
                        </span>
                      )}
                    </div>

                    {t.description && (
                      <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-1.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 flex-wrap mt-2 text-xs text-outline font-mono">
                      {t.dueDate && (
                        <div className="flex items-center gap-1.5 font-label-caps text-[11px]">
                          <IconCalendar size={13} className="text-outline" />
                          <span>Due {t.dueDate} {t.dueTime ? `@ ${t.dueTime}` : ''}</span>
                        </div>
                      )}

                      {/* Sub-checklist toggle button */}
                      <button
                        type="button"
                        onClick={() => toggleChecklistExpanded(t.id)}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <IconCheckSquare size={13} />
                        <span>
                          {taskChecklists[t.id]?.length
                            ? `Checklist (${taskChecklists[t.id]?.filter((c) => c.isCompleted).length}/${taskChecklists[t.id]?.length})`
                            : 'Checklist Steps'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleOpenEditTask(t)}
                    title="Edit task"
                    className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                  >
                    <IconEdit size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskToDelete(t)}
                    title="Delete task"
                    className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>

              {/* Sub-checklist items container: Each checklist item title is strictly rendered INSIDE its item card container */}
              {expandedTaskChecklists[t.id] && (
                <div className="mt-3.5 pt-3 border-t border-border/50 space-y-2 pl-7">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                    Checklist Milestones
                  </span>

                  {(taskChecklists[t.id] || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(taskChecklists[t.id] || []).map((cItem) => (
                        <div
                          key={cItem.id}
                          className="p-2.5 px-3 rounded-xl bg-surface-container-low border border-border/50 flex items-center justify-between gap-3 group/check"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={cItem.isCompleted}
                              onChange={() => handleToggleChecklistItem(t.id, cItem.id, !cItem.isCompleted)}
                              className="w-3.5 h-3.5 rounded text-primary accent-primary cursor-pointer shrink-0"
                            />
                            {/* Checklist item title rendered directly INSIDE checklist container */}
                            <span
                              className={clsx(
                                'text-xs text-on-surface font-medium truncate select-none',
                                cItem.isCompleted && 'line-through text-outline'
                              )}
                            >
                              {cItem.title}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(t.id, cItem.id)}
                            className="opacity-0 group-hover/check:opacity-100 p-1 text-outline hover:text-rose-500 rounded transition-all cursor-pointer shrink-0"
                            title="Delete checklist item"
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant italic">No checklist items yet.</p>
                  )}

                  {/* Inline Add Checklist Item Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreateChecklistItem(t.id);
                    }}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={newChecklistInput[t.id] || ''}
                      onChange={(e) =>
                        setNewChecklistInput((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      placeholder="Add step-by-step checklist item..."
                      className="flex-1 bg-surface-container-low text-on-surface placeholder:text-outline text-xs px-3 py-1.5 rounded-lg border border-border/60 outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={!newChecklistInput[t.id]?.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      Add
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode === 'board' ? (
        /* Bento Kanban Board View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['todo', 'in_progress', 'blocked', 'done'] as const).map((columnStatus) => {
            const columnTasks = filteredTasks.filter((t) => t.status === columnStatus);
            const titles: Record<string, string> = {
              todo: 'To Do',
              in_progress: 'In Progress',
              blocked: 'Blocked',
              done: 'Done',
            };
            return (
              <div
                key={columnStatus}
                className="rounded-2xl bg-surface-container-lowest border border-border/70 p-4 flex flex-col min-h-[420px] shadow-sm"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                      {titles[columnStatus]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-caps text-label-caps font-bold">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={handleOpenCreateTask}
                    className="p-1 text-outline hover:text-primary rounded hover:bg-surface-container transition-colors"
                  >
                    <IconPlus size={14} />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all border border-border/50 shadow-xs group cursor-pointer"
                      onClick={() => handleOpenEditTask(task)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {priorityBadge(task.priority)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTaskStatus(task);
                          }}
                          className="text-xs text-outline hover:text-secondary"
                        >
                          {task.status === 'done' ? '✓' : '○'}
                        </button>
                      </div>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface line-clamp-2">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      {task.dueDate && (
                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between font-label-caps text-label-caps text-outline font-mono">
                          <span>{task.dueDate}</span>
                          <span>{task.dueTime || ''}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-border/60 rounded-xl flex items-center justify-center text-outline font-body-sm text-body-sm">
                      No tasks in this lane
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Bento Calendar View */
        <div className="rounded-2xl bg-surface-container-lowest border border-border/70 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {monthName}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-border/70 text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                onClick={handleTodayMonth}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container-high transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-border/70 text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-surface-container rounded-xl overflow-hidden border border-border/70">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="bg-surface-container-low p-2 text-center font-label-caps text-label-caps text-outline font-bold uppercase">
                {d}
              </div>
            ))}

            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-surface-container-lowest p-2 min-h-[90px] opacity-40" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasks = safeTasks.filter((t) => t.dueDate === dateStr);
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={day}
                  className={clsx(
                    'bg-surface-container-lowest p-2 min-h-[90px] flex flex-col justify-between hover:bg-surface-container-low/50 transition-colors',
                    isToday && 'bg-primary-fixed/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={clsx('font-label-caps text-label-caps font-mono', isToday ? 'font-bold text-primary' : 'text-outline')}>
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayTasks.slice(0, 2).map((dt) => (
                      <div
                        key={dt.id}
                        onClick={() => handleOpenEditTask(dt)}
                        className="text-[11px] p-1 rounded bg-surface-container truncate font-medium text-on-surface cursor-pointer hover:bg-primary hover:text-on-primary transition-colors"
                      >
                        {dt.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="text-[10px] text-outline font-mono">+{dayTasks.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Task Create / Edit Modal ─── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
        description="Configure milestone priority, scheduling, and descriptions."
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <Input
            label="Task Title *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g., Rebalance Nifty Index portfolio"
            required
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Description
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add optional notes, dependencies, or links..."
              rows={3}
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl border border-border/70 p-3 outline-none focus:border-primary transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full bg-surface-container-low text-on-surface text-xs rounded-xl border border-border/70 p-2.5 outline-none focus:border-primary cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-surface-container-low text-on-surface text-xs rounded-xl border border-border/70 p-2.5 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Due Time
              </label>
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="w-full bg-surface-container-low text-on-surface text-xs rounded-xl border border-border/70 p-2.5 outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !newTitle.trim()}
            >
              {submitting ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Task Delete Confirmation Modal ─── */}
      <ConfirmationModal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDeleteTask}
        isLoading={isDeleting}
        title="Delete Task"
        description={`Are you sure you want to permanently delete "${taskToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Task"
        variant="destructive"
      />

    </div>
  );
}
