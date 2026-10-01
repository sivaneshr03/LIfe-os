import React, { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../stores/authStore';
import {
  IconCheckSquare,
  IconCreditCard,
  IconTrendingUp,
  IconTarget,
  IconShield,
  IconArrowUpRight,
  IconPlus,
  IconRefreshCw,
  IconPieChart,
  IconCheck,
  IconClock,
  IconZap,
} from '../ui/Icons';
import { KpiCard, KpiGrid } from '../ui/KpiCard';
import type { HealthCheckData, ApiResponse } from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

interface OperationalTask {
  id: string;
  title: string;
  category: 'FINANCE' | 'HIGH' | 'PROMPTS' | 'HABIT';
  statusText: string;
  completed: boolean;
}

interface MonthlyCashflowPoint {
  month: string;
  inflow: number; // in thousands (₹k)
  outflow: number; // in thousands (₹k)
  savingsRate: number; // percentage
}

const CASHFLOW_DATA: MonthlyCashflowPoint[] = [
  { month: 'May', inflow: 110, outflow: 48, savingsRate: 56 },
  { month: 'Jun', inflow: 125, outflow: 52, savingsRate: 58 },
  { month: 'Jul', inflow: 118, outflow: 60, savingsRate: 49 },
  { month: 'Aug', inflow: 140, outflow: 55, savingsRate: 61 },
  { month: 'Sep', inflow: 135, outflow: 49, savingsRate: 64 },
  { month: 'Oct', inflow: 125, outflow: 42, savingsRate: 66 },
];

// Monthly category spend breakdown (amounts in ₹k, sorted descending)
const CATEGORY_SPEND = [
  { label: 'Groceries & Provisions', amountK: 18.4, color: 'bg-indigo-500', textColor: 'text-indigo-400', icon: '🛒' },
  { label: 'Cloud & Infrastructure', amountK: 12.1, color: 'bg-cyan-500', textColor: 'text-cyan-400', icon: '⚡' },
  { label: 'Dining & Cafes', amountK: 9.8, color: 'bg-amber-500', textColor: 'text-amber-400', icon: '☕' },
  { label: 'Health & Fitness', amountK: 7.2, color: 'bg-rose-500', textColor: 'text-rose-400', icon: '💪' },
  { label: 'Transport & Fuel', amountK: 5.5, color: 'bg-violet-500', textColor: 'text-violet-400', icon: '🚗' },
  { label: 'Entertainment & Media', amountK: 3.0, color: 'bg-emerald-500', textColor: 'text-emerald-400', icon: '🎬' },
];

const ASSET_ALLOCATION = [
  { label: 'Equities & SIPs', percentage: 52, value: '₹7.70 L', color: 'bg-primary' },
  { label: 'Fixed Income & Debt', percentage: 22, value: '₹3.26 L', color: 'bg-secondary' },
  { label: 'Gold & Precious Metals', percentage: 14, value: '₹2.07 L', color: 'bg-amber-500' },
  { label: 'Liquid Cash & Vault', percentage: 12, value: '₹1.79 L', color: 'bg-tertiary' },
];

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user } = useAuthStore();
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [resyncSuccess, setResyncSuccess] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'cashflow' | 'savings'>('cashflow');
  const [hoveredPoint, setHoveredPoint] = useState<MonthlyCashflowPoint | null>(null);

  // Operational priority checklist state
  const [tasks, setTasks] = useState<OperationalTask[]>([
    {
      id: 'task-1',
      title: 'Rebalance Nifty 50 Index SIP portfolio weights',
      category: 'FINANCE',
      statusText: 'Done',
      completed: true,
    },
    {
      id: 'task-2',
      title: 'Approve cloud infrastructure invoices and electricity utility ledger',
      category: 'HIGH',
      statusText: 'Due 5 PM',
      completed: false,
    },
    {
      id: 'task-3',
      title: 'Refactor System Architecture prompt on Claude 3.7',
      category: 'PROMPTS',
      statusText: 'Today',
      completed: false,
    },
    {
      id: 'task-4',
      title: 'Evening 6km endurance run + mobility routine',
      category: 'HABIT',
      statusText: '7:00 PM',
      completed: false,
    },
  ]);

  const [newTaskInput, setNewTaskInput] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) return null;
        const { data } = await safeParseJson<ApiResponse<HealthCheckData>>(res);
        return data;
      })
      .then((json) => {
        if (json?.success) setHealth(json.data);
      })
      .catch(() => {});
  }, []);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    const newTask: OperationalTask = {
      id: `task-${Date.now()}`,
      title: newTaskInput.trim(),
      category: 'HIGH',
      statusText: 'Today',
      completed: false,
    };
    setTasks([newTask, ...tasks]);
    setNewTaskInput('');
    setIsAddingTask(false);
  };

  const handleForceResync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setResyncSuccess(true);
      setTimeout(() => setResyncSuccess(false), 3000);
    }, 700);
  };

  const pendingCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const completionPercentage = useMemo(
    () => Math.round((completedCount / tasks.length) * 100),
    [completedCount, tasks.length]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* ─── 1. Executive Command Header ─── */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 shadow-xs">
            <IconZap size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-lg text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
                Good day, {user?.name || 'Sivanesh'}
              </h1>
              <span className="font-label-caps text-[11px] uppercase bg-primary-fixed text-on-primary-fixed px-2.5 py-0.5 rounded-full font-bold tracking-wider">
                {user?.role === 'admin' ? 'ADMIN' : 'OWNER'}
              </span>
              <span className="font-label-caps text-[11px] uppercase bg-secondary-container/30 text-secondary px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Live Node Synced
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Toolbelt */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setIsAddingTask(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-title-sm text-xs border border-border/60 transition-all cursor-pointer font-semibold shadow-xs"
            type="button"
          >
            <IconPlus size={14} className="text-primary" />
            <span>Quick Task</span>
            <kbd className="ml-1 text-[10px] font-mono px-1 py-0.2 rounded bg-surface-container-highest text-on-surface-variant">
              T
            </kbd>
          </button>

          <button
            onClick={() => onNavigate('finance')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-title-sm text-xs font-semibold shadow-xs transition-all cursor-pointer"
            type="button"
          >
            <IconCreditCard size={14} />
            <span>Log Transaction</span>
          </button>
        </div>
      </section>

      {/* ─── 2. Top Executive Telemetry (4 Primary Domain KPI Cards) ─── */}
      <KpiGrid cols="4">
        {/* KPI 1: Net Worth */}
        <KpiCard
          title="Total Net Worth"
          value="₹14,82,000"
          subtitle="All asset classes reconciled"
          trend={{
            value: '+12.4%',
            isPositive: true,
            label: 'vs. last quarter',
          }}
          color="emerald"
          onClick={() => onNavigate('investments')}
        />

        {/* KPI 2: Monthly Outflow vs Ceiling */}
        <KpiCard
          title="Monthly Outflow"
          value="₹1,24,500"
          subtitle="Cap: ₹1,50,000 • Buffer: +₹25.5k"
          progressBar={{ value: 83 }}
          trend={{
            value: '83%',
            isPositive: true,
            label: 'within budget ceiling',
          }}
          color="primary"
          onClick={() => onNavigate('finance')}
        />

        {/* KPI 3: Actionable Tasks */}
        <KpiCard
          title="Tasks Due Today"
          value={`${pendingCount} Pending`}
          subtitle={`1 high priority chore • ${completionPercentage}% weekly`}
          progressBar={{ value: completionPercentage }}
          color="rose"
          onClick={() => onNavigate('tasks')}
        />

        {/* KPI 4: Habit & Vitality Score */}
        <KpiCard
          title="Discipline & Streaks"
          value="5-Day Streak"
          subtitle="8.4/10 optimal sleep & hydration"
          trend={{
            value: '92%',
            isPositive: true,
            label: 'weekly consistency',
          }}
          color="amber"
          onClick={() => onNavigate('trackers')}
        />
      </KpiGrid>

      {/* ─── 3. Insight Area: Data Visualizations (12-Col Grid) ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Cashflow & Savings Velocity (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-surface-container-lowest p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <IconTrendingUp size={18} className="text-primary" />
                <h2 className="font-title-sm text-sm sm:text-base font-bold text-on-surface">
                  Monthly Cashflow & Savings Velocity
                </h2>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Answers: How has monthly income vs. burn trended over the past 6 cycles?
              </p>
            </div>

            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-border/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveChartTab('cashflow')}
                className={clsx(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  activeChartTab === 'cashflow'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                In vs Out
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('savings')}
                className={clsx(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  activeChartTab === 'savings'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                Savings Rate
              </button>
            </div>
          </div>

          {/* Interactive Chart Visual */}
          <div className="my-2">
            <div className="h-44 sm:h-48 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 relative">
              {/* Background grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                <div className="border-b border-dashed border-border" />
                <div className="border-b border-dashed border-border" />
                <div className="border-b border-dashed border-border" />
              </div>

              {CASHFLOW_DATA.map((pt) => {
                const maxVal = 160;
                const inflowHeight = (pt.inflow / maxVal) * 100;
                const outflowHeight = (pt.outflow / maxVal) * 100;
                const isHovered = hoveredPoint?.month === pt.month;

                return (
                  <div
                    key={pt.month}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="flex-1 flex flex-col items-center justify-end h-full z-10 cursor-pointer group"
                  >
                    {activeChartTab === 'cashflow' ? (
                      <div className="w-full max-w-[36px] flex items-end justify-center gap-1">
                        {/* Inflow Bar */}
                        <div
                          style={{ height: `${inflowHeight}%` }}
                          className={clsx(
                            'w-3.5 sm:w-4 rounded-t-md transition-all duration-300 bg-secondary',
                            isHovered ? 'opacity-100 ring-2 ring-secondary' : 'opacity-85 hover:opacity-100'
                          )}
                        />
                        {/* Outflow Bar */}
                        <div
                          style={{ height: `${outflowHeight}%` }}
                          className={clsx(
                            'w-3.5 sm:w-4 rounded-t-md transition-all duration-300 bg-primary',
                            isHovered ? 'opacity-100 ring-2 ring-primary' : 'opacity-85 hover:opacity-100'
                          )}
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-[28px] flex items-end justify-center">
                        <div
                          style={{ height: `${pt.savingsRate}%` }}
                          className={clsx(
                            'w-5 rounded-t-md transition-all duration-300 bg-emerald-500',
                            isHovered ? 'opacity-100 ring-2 ring-emerald-400' : 'opacity-85'
                          )}
                        />
                      </div>
                    )}
                    <span className="font-mono text-[11px] text-on-surface-variant font-medium mt-2">
                      {pt.month}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hover Tooltip / Detail Banner */}
            <div className="min-h-[32px] mt-1 bg-surface-container-low px-3 py-1.5 rounded-xl border border-border/50 flex items-center justify-between text-xs font-mono">
              {hoveredPoint ? (
                <>
                  <span className="font-bold text-on-surface">{hoveredPoint.month} Summary:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-secondary font-semibold">
                      Inflow: +₹{hoveredPoint.inflow}k
                    </span>
                    <span className="text-primary font-semibold">
                      Outflow: -₹{hoveredPoint.outflow}k
                    </span>
                    <span className="text-on-surface font-bold bg-surface-container px-2 py-0.5 rounded">
                      Savings: {hoveredPoint.savingsRate}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between w-full text-on-surface-variant">
                  <span>Hover over any month for exact atomic values</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-secondary" /> Inflow
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Outflow
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart 2: Asset & Budget Composition (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-surface-container-lowest p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <IconPieChart size={18} className="text-primary" />
                <h2 className="font-title-sm text-sm sm:text-base font-bold text-on-surface">
                  Asset & Budget Distribution
                </h2>
              </div>
              <button
                onClick={() => onNavigate('investments')}
                className="font-label-caps text-xs text-primary hover:underline font-bold uppercase cursor-pointer"
                type="button"
              >
                Rebalance
              </button>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant mb-4">
              Answers: How is capital distributed across asset classes and risk profiles?
            </p>

            {/* Segmented Distribution Bar */}
            <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden flex my-3">
              {ASSET_ALLOCATION.map((item) => (
                <div
                  key={item.label}
                  style={{ width: `${item.percentage}%` }}
                  className={clsx('h-full transition-all duration-500', item.color)}
                  title={`${item.label}: ${item.percentage}%`}
                />
              ))}
            </div>

            {/* Item Breakdown List */}
            <div className="space-y-2 mt-4">
              {ASSET_ALLOCATION.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-border/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', item.color)} />
                    <span className="font-medium text-on-surface truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono shrink-0">
                    <span className="text-on-surface-variant font-semibold">{item.percentage}%</span>
                    <span className="font-bold text-on-surface">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Portfolio Target Alignment</span>
            <span className="font-mono text-secondary font-semibold">98.2% Balanced</span>
          </div>
        </div>
      </section>

      {/* ─── 3b. Monthly Spending Breakdown (Category Bar Chart) ─── */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <IconPieChart size={18} className="text-amber-500" />
            <h2 className="font-title-sm text-sm sm:text-base font-bold text-on-surface">
              Monthly Category Spending
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-on-surface-variant">
              Total: <strong className="text-on-surface">₹56,000</strong>
            </span>
            <button
              onClick={() => onNavigate('finance')}
              className="font-label-caps text-xs text-primary hover:underline font-bold uppercase cursor-pointer flex items-center gap-1"
              type="button"
            >
              Full Ledger <IconArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* Horizontal Bar Chart */}
        <div className="space-y-3">
          {(() => {
            const maxVal = Math.max(...CATEGORY_SPEND.map((c) => c.amountK));
            const totalK = CATEGORY_SPEND.reduce((s, c) => s + c.amountK, 0);
            return CATEGORY_SPEND.map((cat) => {
              const pct = Math.round((cat.amountK / totalK) * 100);
              const barWidth = (cat.amountK / maxVal) * 100;
              return (
                <div key={cat.label} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-48 sm:w-56 shrink-0">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs font-medium text-on-surface truncate">{cat.label}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-surface-container rounded-full h-2.5 overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-700', cat.color)}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-24 justify-end">
                      <span className={clsx('font-mono text-[11px] font-semibold', cat.textColor)}>
                        ₹{cat.amountK.toFixed(1)}k
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Summary donut-style legend row */}
        <div className="mt-5 pt-3.5 border-t border-border/50 flex items-center gap-1.5 flex-wrap">
          {CATEGORY_SPEND.map((cat) => (
            <span
              key={cat.label}
              className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-surface-container-low border border-border/40"
            >
              <span className={clsx('w-2 h-2 rounded-full shrink-0', cat.color)} />
              <span className="text-on-surface-variant">{cat.label.split(' ')[0]}</span>
            </span>
          ))}
          <span className="ml-auto font-mono text-[11px] text-on-surface-variant">
            Last 30 days • Oct 2026
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Priority Focus Tasks Queue (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-surface-container-lowest p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <IconCheckSquare size={18} className="text-primary" />
                <h3 className="font-title-sm text-sm sm:text-base font-bold text-on-surface">
                  Daily Priority Focus Stack
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface font-label-caps text-xs font-semibold">
                {pendingCount} Pending
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant mb-4">
              Actionable tasks and chore milestones connected to your atomic D1 index.
            </p>

            {/* Quick Inline Task Capture Form */}
            {isAddingTask && (
              <form onSubmit={handleCreateTask} className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  placeholder="Task title or quick chore..."
                  autoFocus
                  className="flex-1 bg-surface-container-low text-on-surface text-xs px-3 py-2 rounded-xl border border-primary outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="px-2.5 py-2 rounded-xl bg-surface-container-low text-on-surface-variant text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Task List Items */}
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group',
                    task.completed
                      ? 'bg-surface-container-low/40 border-border/40 opacity-70'
                      : 'bg-surface-container-low border-border/60 hover:bg-surface-container'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-primary accent-primary cursor-pointer shrink-0"
                    />
                    <span
                      className={clsx(
                        'text-xs truncate select-none',
                        task.completed
                          ? 'line-through text-on-surface-variant'
                          : 'text-on-surface font-medium'
                      )}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded font-label-caps text-[10px] font-bold uppercase',
                        task.category === 'HIGH'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : task.category === 'PROMPTS'
                          ? 'bg-primary-fixed text-primary'
                          : task.category === 'HABIT'
                          ? 'bg-secondary-container/40 text-secondary'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      )}
                    >
                      {task.category}
                    </span>
                    <span
                      className={clsx(
                        'text-xs font-mono',
                        task.completed ? 'text-secondary font-semibold' : 'text-on-surface-variant'
                      )}
                    >
                      {task.completed ? 'Done' : task.statusText}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-medium">
              {completedCount} of {tasks.length} items completed
            </span>
            <button
              onClick={() => onNavigate('tasks')}
              className="font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
              type="button"
            >
              <span>View Tasks Queue</span>
              <IconArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Column: Live Ledger Activity & Consistency (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Card A: Recent Ledger Entries */}
          <div className="rounded-2xl bg-surface-container-lowest p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <IconCreditCard size={18} className="text-secondary" />
                  <h4 className="font-title-sm text-sm font-bold text-on-surface">
                    Recent Ledger Activity
                  </h4>
                </div>
                <button
                  onClick={() => onNavigate('finance')}
                  className="font-label-caps text-xs text-primary hover:underline font-bold uppercase cursor-pointer"
                  type="button"
                >
                  View All
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {/* Entry 1 */}
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 font-bold">
                      ⚡
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-on-surface truncate">Cloudflare Workers</span>
                      <span className="text-[10px] text-on-surface-variant">Infrastructure</span>
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="font-bold text-on-surface block">- ₹415.00</span>
                    <span className="text-[10px] text-on-surface-variant">Debit</span>
                  </div>
                </div>

                {/* Entry 2 */}
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 font-bold">
                      🛒
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-on-surface truncate">Nature&apos;s Basket</span>
                      <span className="text-[10px] text-on-surface-variant">Provisions</span>
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="font-bold text-on-surface block">- ₹2,180.00</span>
                    <span className="text-[10px] text-on-surface-variant">Debit</span>
                  </div>
                </div>

                {/* Entry 3 */}
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-secondary-container/40 flex items-center justify-center text-secondary shrink-0 font-bold font-mono">
                      ₹
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-on-surface truncate">Consulting Retainer</span>
                      <span className="text-[10px] text-secondary">Inflow</span>
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="font-bold text-secondary block">+ ₹65,000.00</span>
                    <span className="text-[10px] text-on-surface-variant">Wire</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: 7-Day Consistency Matrix */}
          <div className="rounded-2xl bg-surface-container-lowest p-5 sm:p-6 border border-border/70 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconTarget size={18} className="text-amber-500" />
                <h4 className="font-title-sm text-sm font-bold text-on-surface">
                  Weekly Habit Matrix
                </h4>
              </div>
              <span className="font-mono text-xs font-bold text-secondary">92% Target</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mt-3">
              {[
                { day: 'M', score: '100', active: true },
                { day: 'T', score: '100', active: true },
                { day: 'W', score: '100', active: true },
                { day: 'T', score: '85', active: true },
                { day: 'F', score: 'TODAY', active: false, today: true },
                { day: 'S', score: '-', active: false },
                { day: 'S', score: '-', active: false },
              ].map((item, idx) => (
                <div key={idx} className="text-center">
                  <span className="font-label-caps text-[10px] text-on-surface-variant block mb-1">
                    {item.day}
                  </span>
                  <div
                    className={clsx(
                      'w-full h-8 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono transition-colors',
                      item.today
                        ? 'bg-primary text-on-primary ring-2 ring-primary/40'
                        : item.active
                        ? 'bg-secondary text-white'
                        : 'bg-surface-container-high text-on-surface-variant'
                    )}
                  >
                    {item.score}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Hydration & Sleep Score</span>
              <span className="font-bold text-on-surface font-mono">8.4 / 10 Optimal</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. Admin Console Banner (Compact 1-liner if admin) ─── */}
      {user?.role === 'admin' && (
        <section className="p-4 rounded-xl border border-primary/20 bg-primary-fixed/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <IconShield size={16} className="text-primary shrink-0" />
            <span className="font-medium text-on-surface">
              Household Node Administration: 5 Accounts active • D1 Security Audit Stream nominal.
            </span>
          </div>
          <button
            onClick={() => onNavigate('admin')}
            className="text-primary hover:underline font-bold font-mono shrink-0 cursor-pointer flex items-center gap-1"
            type="button"
          >
            <span>Launch Admin Console</span>
            <IconArrowUpRight size={13} />
          </button>
        </section>
      )}

      {/* ─── 6. Footer Cockpit Telemetry / Edge Status Info ─── */}
      <footer className="pt-2 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-on-surface-variant font-mono text-xs border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span>
            Node: <strong className="text-on-surface">production-ap-south</strong> (TLS 1.3 256-bit encrypted)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Worker v2.4.1</span>
          <span>•</span>
          <span>D1 SQLite: 12ms</span>
          <span>•</span>
          <button
            onClick={handleForceResync}
            disabled={syncing}
            className="text-primary hover:underline font-semibold cursor-pointer flex items-center gap-1"
            type="button"
          >
            <IconRefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : resyncSuccess ? 'Synced ✓' : 'Force Resync'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
