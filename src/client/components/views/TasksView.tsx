import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { LoadingState, EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';
import {
  IconCheckSquare,
  IconPlus,
  IconSearch,
  IconCalendar,
  IconRefreshCw,
  IconTrash,
  IconClock,
  IconChevronLeft,
  IconChevronRight,
} from '../ui/Icons';
import type { TaskData, TaskPriority, TaskStatus, ApiPaginatedResponse } from '../../../shared/types';

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
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const { data: json } = await safeParseJson<ApiPaginatedResponse<TaskData>>(res);
      const taskList = Array.isArray(json?.data)
        ? json.data
        : (json?.data?.items || []);
      setTasks(taskList);
    } catch {
      toast('Error loading tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
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

      toast('Task created successfully', 'success');
      setIsModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setNewDueDate('');
      setNewDueTime('');
      fetchTasks();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Error creating task', 'error');
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
      toast(nextStatus === 'done' ? 'Task marked complete' : 'Task reopened', 'info');
    } catch {
      toast('Error updating task status', 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== id));
      toast('Task removed', 'info');
    } catch {
      toast('Error deleting task', 'error');
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

  const priorityBadge = (priority: TaskPriority) => {
    const styles: Record<TaskPriority, string> = {
      urgent: 'bg-rose-500/10 text-rose-500 border-rose-500/20 font-bold',
      high: 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold',
      medium: 'bg-primary/10 text-primary border-primary/20 font-medium',
      low: 'bg-foreground/5 text-foreground/50 border-border font-medium',
    };
    return (
      <span className={clsx('px-2 py-0.5 text-[10px] font-mono border rounded-md uppercase tracking-wider', styles[priority])}>
        {priority}
      </span>
    );
  };

  const statusBadge = (status: TaskStatus) => {
    const styles: Record<TaskStatus, string> = {
      todo: 'bg-foreground/5 text-foreground/70 border-border',
      in_progress: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
      blocked: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      done: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      archived: 'bg-foreground/10 text-foreground/40 border-border',
    };
    return (
      <span className={clsx('px-2 py-0.5 text-[10px] font-mono font-semibold border rounded-md uppercase tracking-wider', styles[status])}>
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

  const handlePrevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };
  const handleTodayMonth = () => {
    setCalendarDate(new Date());
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            Tasks & Projects
          </h1>
          <p className="text-xs text-foreground/60 mt-0.5">
            Unified productivity engine with recurring schedules, checklist milestones, list, board & calendar views
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex bg-muted/60 p-1 rounded-xl border border-border/80 text-xs font-semibold">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-foreground/60 hover:text-foreground'
              )}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                viewMode === 'board'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-foreground/60 hover:text-foreground'
              )}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                viewMode === 'calendar'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-foreground/60 hover:text-foreground'
              )}
            >
              Calendar
            </button>
          </div>
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <IconPlus size={14} />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar (List & Board modes) */}
      {viewMode !== 'calendar' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card/60 backdrop-blur-sm border border-border/80 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0 whitespace-nowrap">
            {(['all', 'todo', 'in_progress', 'blocked', 'done'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={clsx(
                  'px-3.5 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[32px] text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-all duration-150 cursor-pointer touch-manipulation',
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted/70'
                )}
              >
                {st === 'all' ? 'All Tasks' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Content Rendering */}
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
          onAction={() => setIsModalOpen(true)}
          icon={<IconCheckSquare size={32} className="text-primary" />}
        />
      ) : viewMode === 'list' ? (
        <div className="bg-card border border-border/80 rounded-2xl divide-y divide-border/60 overflow-hidden shadow-xs">
          {filteredTasks.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'p-4 flex items-start sm:items-center justify-between gap-3.5 hover:bg-muted/40 hover:shadow-xs transition-colors duration-150 group',
                t.status === 'done' && 'opacity-65'
              )}
            >
              <div className="flex items-start sm:items-center gap-2 sm:gap-3.5 min-w-0">
                <label className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 sm:-ml-1 cursor-pointer touch-manipulation shrink-0">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => handleToggleTaskStatus(t)}
                    aria-label={`Mark "${t.title}" as ${t.status === 'done' ? 'incomplete' : 'complete'}`}
                    className="h-5 w-5 rounded-md border-border text-primary focus:ring-2 focus:ring-primary cursor-pointer transition-transform active:scale-90"
                  />
                </label>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={clsx(
                        'text-sm font-semibold text-foreground truncate',
                        t.status === 'done' && 'line-through text-foreground/50'
                      )}
                    >
                      {t.title}
                    </span>
                    {priorityBadge(t.priority)}
                    {statusBadge(t.status)}
                    {t.recurrenceRuleId && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                        <IconRefreshCw size={10} />
                        <span>Recurring</span>
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-foreground/60 mt-1 line-clamp-1">{t.description}</p>
                  )}
                  {t.dueDate && (
                    <div className="text-[11px] text-foreground/50 mt-1 flex items-center gap-1.5">
                      <IconCalendar size={12} className="text-foreground/40" />
                      <span>Due {t.dueDate} {t.dueTime ? `@ ${t.dueTime}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  title="Delete task"
                  aria-label={`Delete task ${t.title}`}
                  className="p-1.5 text-foreground/40 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors active:scale-90 cursor-pointer"
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'board' ? (
        /* Kanban Board View with horizontal snap on mobile */
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 sm:pb-0 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
          {(['todo', 'in_progress', 'blocked', 'done'] as const).map((columnStatus) => {
            const columnTasks = filteredTasks.filter((t) => t.status === columnStatus);
            return (
              <div
                key={columnStatus}
                className="w-[82vw] shrink-0 sm:w-auto snap-center bg-card/70 border border-border/80 rounded-2xl flex flex-col min-h-[380px] sm:min-h-[420px] shadow-xs overflow-hidden"
              >
                <div className="p-3.5 border-b border-border/60 flex items-center justify-between bg-muted/30">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {columnStatus.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 bg-muted rounded-full font-mono font-semibold text-foreground/60">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-foreground/40">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 bg-card border border-border/70 rounded-xl space-y-2.5 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-200 group cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-semibold text-foreground line-clamp-2">
                            {t.title}
                          </span>
                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            className="text-foreground/30 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                            aria-label="Delete"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          {priorityBadge(t.priority)}
                          {t.dueDate && (
                            <span className="text-[10px] text-foreground/50 font-mono">
                              {t.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Calendar View */
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-card border border-border/80 rounded-2xl shadow-xs">
            <h2 className="text-sm font-bold text-foreground">{monthName}</h2>
            <div className="flex items-center gap-1.5 text-xs">
              <Button onClick={handlePrevMonth} variant="secondary" size="sm">
                <IconChevronLeft size={14} />
                <span>Prev</span>
              </Button>
              <Button onClick={handleTodayMonth} variant="secondary" size="sm">
                Today
              </Button>
              <Button onClick={handleNextMonth} variant="secondary" size="sm">
                <span>Next</span>
                <IconChevronRight size={14} />
              </Button>
            </div>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40 text-center text-xs font-bold text-foreground/70 py-2.5">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[96px] p-2 bg-muted/10 opacity-40" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
                const isToday =
                  new Date().toISOString().slice(0, 10) === dateStr;

                return (
                  <div
                    key={dateStr}
                    className={clsx(
                      'min-h-[96px] p-2 transition-colors flex flex-col justify-between hover:bg-muted/20',
                      isToday && 'bg-primary/5 font-semibold'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          'text-xs inline-flex items-center justify-center w-6 h-6 rounded-full font-mono',
                          isToday ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-foreground/70'
                        )}
                      >
                        {day}
                      </span>
                      <button
                        onClick={() => {
                          setNewDueDate(dateStr);
                          setIsModalOpen(true);
                        }}
                        className="p-1 rounded text-foreground/30 hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                        title="Add task on this date"
                        aria-label="Add task"
                      >
                        <IconPlus size={12} />
                      </button>
                    </div>

                    <div className="space-y-1 mt-1.5 flex-1 overflow-y-auto max-h-[80px]">
                      {dayTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => handleToggleTaskStatus(t)}
                          className={clsx(
                            'text-[10px] px-1.5 py-0.5 rounded-md border truncate cursor-pointer transition-colors font-medium',
                            t.status === 'done'
                              ? 'line-through opacity-50 bg-muted border-border'
                              : t.priority === 'urgent'
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                              : 'bg-primary/10 text-primary border-primary/20'
                          )}
                          title={`${t.title} (${t.status})`}
                        >
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Task"
        size="md"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Title"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title..."
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Description
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional details or context..."
              rows={3}
              className="w-full p-3 text-base sm:text-xs bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs touch-manipulation"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer touch-manipulation"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer touch-manipulation font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Due Time
              </label>
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer touch-manipulation font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-initial">
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
