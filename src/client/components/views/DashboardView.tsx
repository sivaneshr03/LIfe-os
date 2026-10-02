import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  IconZap,
  IconTrash,
} from '../ui/Icons';
import { KpiCard, KpiGrid } from '../ui/KpiCard';
import type {
  HealthCheckData,
  ApiResponse,
  TodayDashboardData,
  HabitData,
  FinanceOverviewData,
  FinanceTransactionData,
  FinanceSpendingAnalysisData,
  InvestmentPortfolioSummary,
} from '../../../shared/types';
import { safeParseJson, apiFetch } from '../../lib/api';
import { formatMoney } from '../../../shared/utils/money';

function safeFormatMoney(cents: number, cur: string = 'INR'): string {
  try {
    return formatMoney(Math.round(cents || 0), cur);
  } catch {
    return `₹${((cents || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}

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

interface CategorySpendItem {
  label: string;
  amountK: number;
  color: string;
  textColor: string;
  icon: string;
}

interface AssetAllocationItem {
  label: string;
  percentage: number;
  value: string;
  color: string;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user } = useAuthStore();
  const [_health, setHealth] = useState<HealthCheckData | null>(null);
  const [overview, setOverview] = useState<FinanceOverviewData | null>(null);
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<FinanceTransactionData[]>([]);
  const [cashflowPoints, setCashflowPoints] = useState<MonthlyCashflowPoint[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpendItem[]>([]);
  const [totalCategorySpendCents, setTotalCategorySpendCents] = useState<number>(0);
  const [assetAllocation, setAssetAllocation] = useState<AssetAllocationItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [resyncSuccess, setResyncSuccess] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'cashflow' | 'savings'>('cashflow');
  const [hoveredPoint, setHoveredPoint] = useState<MonthlyCashflowPoint | null>(null);

  // Operational priority checklist state - zero mock baseline
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Fetch all live entity state
  const fetchAllData = useCallback(async () => {
    try {
      // 1. Health check
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

      // 2. Finance overview telemetry
      fetch('/api/finance/overview')
        .then(async (res) => {
          if (!res.ok) return null;
          const { data } = await safeParseJson<ApiResponse<FinanceOverviewData>>(res);
          return data;
        })
        .then((json) => {
          if (json?.success && json.data) setOverview(json.data);
        })
        .catch(() => {});

      // 3. Today's task telemetry
      fetch('/api/dashboard/today')
        .then(async (res) => {
          if (!res.ok) return null;
          const { data } = await safeParseJson<ApiResponse<TodayDashboardData>>(res);
          return data;
        })
        .then((json) => {
          if (json?.success && json.data) {
            const d = json.data;
            const fetchedTasks: OperationalTask[] = [];
            for (const t of d.overdueTasks || []) {
              fetchedTasks.push({
                id: t.id,
                title: t.title,
                category: 'HIGH',
                statusText: 'Overdue',
                completed: false,
              });
            }
            for (const t of d.todayTasks || []) {
              fetchedTasks.push({
                id: t.id,
                title: t.title,
                category: t.priority === 3 ? 'HIGH' : t.priority === 2 ? 'FINANCE' : 'HABIT',
                statusText: 'Today',
                completed: false,
              });
            }
            for (const t of d.completedTodayTasks || []) {
              fetchedTasks.push({
                id: t.id,
                title: t.title,
                category: 'FINANCE',
                statusText: 'Done',
                completed: true,
              });
            }
            setTasks(fetchedTasks);
          } else {
            setTasks([]);
          }
        })
        .catch(() => {
          setTasks([]);
        });

      // 4. Habits telemetry
      fetch('/api/habits')
        .then(async (res) => {
          if (!res.ok) return null;
          const { data } = await safeParseJson<ApiResponse<HabitData[]>>(res);
          return data;
        })
        .then((json) => {
          if (json?.success && Array.isArray(json.data)) {
            setHabits(json.data);
          } else {
            setHabits([]);
          }
        })
        .catch(() => {
          setHabits([]);
        });

      // 5. Recent transactions
      fetch('/api/finance/transactions?limit=5')
        .then(async (res) => {
          if (!res.ok) return null;
          const { data } = await safeParseJson<ApiResponse<FinanceTransactionData[]>>(res);
          return data;
        })
        .then((json) => {
          if (json?.success && Array.isArray(json.data)) {
            setRecentTransactions(json.data);
          } else {
            setRecentTransactions([]);
          }
        })
        .catch(() => {
          setRecentTransactions([]);
        });

      // 6. Live Spending Report & Time Trends (dynamic cashflow and category spend)
      fetch('/api/finance/reports/spending')
        .then(async (res) => {
          if (!res.ok) return null;
          const { data } = await safeParseJson<ApiResponse<FinanceSpendingAnalysisData>>(res);
          return data;
        })
        .then((json) => {
          if (json?.success && json.data) {
            const report = json.data;
            if (report.timeTrend && report.timeTrend.length > 0) {
              const points: MonthlyCashflowPoint[] = report.timeTrend.map((pt) => {
                const parts = pt.periodKey.split('-');
                let monthLabel = pt.periodKey;
                if (parts.length >= 2) {
                  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
                  monthLabel = d.toLocaleString('default', { month: 'short' });
                }
                return {
                  month: monthLabel,
                  inflow: Math.round(pt.incomeCents / 100000), // in ₹k
                  outflow: Math.round(pt.expenseCents / 100000), // in ₹k
                  savingsRate: pt.savingsRatePercentage,
                };
              });
              setCashflowPoints(points);
            } else {
              setCashflowPoints([]);
            }

            if (report.categories && report.categories.length > 0) {
              const palette = [
                { color: 'bg-indigo-500', textColor: 'text-indigo-400', icon: '🛒' },
                { color: 'bg-cyan-500', textColor: 'text-cyan-400', icon: '⚡' },
                { color: 'bg-amber-500', textColor: 'text-amber-400', icon: '☕' },
                { color: 'bg-rose-500', textColor: 'text-rose-400', icon: '💪' },
                { color: 'bg-violet-500', textColor: 'text-violet-400', icon: '🚗' },
                { color: 'bg-emerald-500', textColor: 'text-emerald-400', icon: '🎬' },
              ];
              const catList = report.categories.map((c, i) => ({
                label: c.categoryName,
                amountK: Number((c.totalCents / 100000).toFixed(1)),
                color: palette[i % palette.length].color,
                textColor: palette[i % palette.length].textColor,
                icon: c.icon || palette[i % palette.length].icon,
              }));
              setCategorySpend(catList);
            } else {
              setCategorySpend([]);
            }

            setTotalCategorySpendCents(report.totalSpentCents || 0);
          }
        })
        .catch(() => {});

      // 7. Live Investment Portfolio Allocation
      fetch('/api/investments/portfolio')
        .then(async (res) => {
          if (!res.ok) return null;
          const { data } = await safeParseJson<ApiResponse<InvestmentPortfolioSummary>>(res);
          return data;
        })
        .then((json) => {
          if (json?.success && json.data) {
            const p = json.data;
            if (p.allocation && p.allocation.length > 0) {
              const colorMap: Record<string, string> = {
                equity: 'bg-primary',
                etf: 'bg-secondary',
                crypto: 'bg-amber-500',
                bond: 'bg-tertiary',
                commodity: 'bg-emerald-500',
                real_estate: 'bg-violet-500',
                cash: 'bg-cyan-500',
                other: 'bg-slate-500',
              };
              const typeLabelMap: Record<string, string> = {
                equity: 'Equities & Stocks',
                etf: 'Index & Mutual Funds',
                crypto: 'Digital Assets & Crypto',
                bond: 'Fixed Income & Bonds',
                commodity: 'Gold & Commodities',
                real_estate: 'Real Estate',
                cash: 'Liquid Cash & Vault',
                other: 'Other Assets',
              };
              const allocList = p.allocation.map((a) => ({
                label: typeLabelMap[a.assetType] || a.assetType,
                percentage: a.percentage,
                value: safeFormatMoney(a.marketValueCents, 'INR'),
                color: colorMap[a.assetType] || 'bg-primary',
              }));
              setAssetAllocation(allocList);
            } else {
              setAssetAllocation([]);
            }
          }
        })
        .catch(() => {
          // ignore background fetch error
        });
    } catch {
      // ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Real-time task mutation handlers
  const toggleTask = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const newCompleted = !target.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: newCompleted } : t))
    );
    if (!id.startsWith('task-')) {
      await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newCompleted ? 'done' : 'todo' }),
      });
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    const tempId = `task-${Date.now()}`;
    const newTask: OperationalTask = {
      id: tempId,
      title: newTaskInput.trim(),
      category: 'HIGH',
      statusText: 'Today',
      completed: false,
    };
    setTasks([newTask, ...tasks]);
    const title = newTaskInput.trim();
    setNewTaskInput('');
    setIsAddingTask(false);

    const todayStr = new Date().toISOString().slice(0, 10);
    const res = await apiFetch<{ id: string }>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        priority: 2,
        dueDate: todayStr,
      }),
    });
    if (res.ok && res.data) {
      const createdTask = res.data;
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? { ...t, id: createdTask.id } : t))
      );
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!id.startsWith('task-')) {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    }
  };

  const handleForceResync = async () => {
    setSyncing(true);
    await fetchAllData();
    setTimeout(() => {
      setSyncing(false);
      setResyncSuccess(true);
      setTimeout(() => setResyncSuccess(false), 3000);
    }, 500);
  };

  // ─── Reactive Dynamic Metrics ───
  const pendingCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const completionPercentage = useMemo(
    () => (tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0),
    [completedCount, tasks.length]
  );

  const netWorthCents = overview?.netWorth?.netWorthCents ?? 0;
  const totalAssetsCents = overview?.netWorth?.totalAssetsCents ?? 0;
  const totalLiabilitiesCents = overview?.netWorth?.totalLiabilitiesCents ?? 0;
  const baseCurrency = overview?.netWorth?.baseCurrency ?? 'INR';
  const monthlyExpenseCents = overview?.monthlyExpenseCents ?? 0;
  const savingsRate = overview?.monthlySavingsRatePercentage ?? 0;
  const activeBudgets = overview?.activeBudgets ?? [];
  const budgetCeilingCents = activeBudgets.reduce((sum, b) => sum + b.limitCents, 0);
  const budgetBufferCents = budgetCeilingCents - monthlyExpenseCents;
  const budgetUsedPercent = budgetCeilingCents > 0
    ? Math.min(100, Math.round((monthlyExpenseCents / budgetCeilingCents) * 100))
    : 0;

  const longestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.currentStreak || 0), 0) : 0;
  const habitsCompletedCount = habits.filter((h) => h.completedToday).length;
  const habitConsistencyPct = habits.length > 0
    ? Math.round((habitsCompletedCount / habits.length) * 100)
    : 0;

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
                Good day, {user?.name || 'User'}
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
          value={safeFormatMoney(netWorthCents, baseCurrency)}
          subtitle={
            overview && (totalAssetsCents > 0 || totalLiabilitiesCents > 0)
              ? `Assets: ${safeFormatMoney(totalAssetsCents, baseCurrency)} • Liab: ${safeFormatMoney(totalLiabilitiesCents, baseCurrency)}`
              : 'Reconciled atomic balance'
          }
          trend={{
            value: `${savingsRate}%`,
            isPositive: savingsRate >= 0,
            label: 'savings rate',
          }}
          color="emerald"
          onClick={() => onNavigate('investments')}
        />

        {/* KPI 2: Monthly Outflow vs Ceiling */}
        <KpiCard
          title="Monthly Outflow"
          value={safeFormatMoney(monthlyExpenseCents, baseCurrency)}
          subtitle={
            budgetCeilingCents > 0
              ? `Cap: ${safeFormatMoney(budgetCeilingCents, baseCurrency)} • Buffer: ${budgetBufferCents >= 0 ? '+' : ''}${safeFormatMoney(budgetBufferCents, baseCurrency)}`
              : monthlyExpenseCents > 0
              ? 'Logged expense outflow'
              : 'Zero monthly expense recorded'
          }
          progressBar={{ value: budgetUsedPercent }}
          trend={{
            value: `${budgetUsedPercent}%`,
            isPositive: monthlyExpenseCents <= (budgetCeilingCents || 1),
            label: budgetCeilingCents > 0 ? 'of budget ceiling' : 'budget limit unset',
          }}
          color="primary"
          onClick={() => onNavigate('finance')}
        />

        {/* KPI 3: Actionable Tasks */}
        <KpiCard
          title="Tasks Due Today"
          value={`${pendingCount} Pending`}
          subtitle={`${completedCount} of ${tasks.length} items done • ${completionPercentage}% velocity`}
          progressBar={{ value: completionPercentage }}
          trend={{
            value: `${completionPercentage}%`,
            isPositive: completionPercentage >= 50,
            label: 'completion rate',
          }}
          color="rose"
          onClick={() => onNavigate('tasks')}
        />

        {/* KPI 4: Habit & Vitality Score */}
        <KpiCard
          title="Discipline & Streaks"
          value={`${longestStreak > 0 ? `${longestStreak}-Day Streak` : '0-Day Streak'}`}
          subtitle={
            habits.length > 0
              ? `${habitsCompletedCount} of ${habits.length} habits done today`
              : 'No habit trackers configured'
          }
          trend={{
            value: `${habitConsistencyPct}%`,
            isPositive: habitConsistencyPct >= 70,
            label: 'consistency rate',
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
            {cashflowPoints.length === 0 ? (
              <div className="h-44 sm:h-48 w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/70 rounded-xl bg-surface-container-low/30">
                <IconTrendingUp size={24} className="text-on-surface-variant/60 mb-2" />
                <p className="text-xs font-semibold text-on-surface">No monthly cashflow trends recorded</p>
                <p className="text-[11px] text-on-surface-variant max-w-xs mt-1">
                  Log transactions in Finance to populate live inflow, outflow, and savings velocity charts.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('finance')}
                  className="mt-2.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Log Ledger Transaction
                </button>
              </div>
            ) : (
              <div className="h-44 sm:h-48 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 relative">
                {/* Background grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                  <div className="border-b border-dashed border-border" />
                  <div className="border-b border-dashed border-border" />
                  <div className="border-b border-dashed border-border" />
                </div>

                {cashflowPoints.map((pt) => {
                  const maxVal = Math.max(1, ...cashflowPoints.map((p) => Math.max(p.inflow, p.outflow, 10)));
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
                            style={{ height: `${Math.max(0, pt.savingsRate)}%` }}
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
            )}
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
                <span>{cashflowPoints.length > 0 ? 'Hover over any month for exact atomic values' : 'No monthly transactions logged yet'}</span>
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

            {assetAllocation.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-surface-container-low border border-dashed border-border/70 my-3 text-xs text-on-surface-variant space-y-1">
                <p className="font-semibold text-on-surface">No investment holdings recorded</p>
                <p className="text-[11px]">Add stocks, mutual funds, or assets in Investments to view allocation balance.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('investments')}
                  className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Add Investment Asset
                </button>
              </div>
            ) : (
              <>
                {/* Segmented Distribution Bar */}
                <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden flex my-3">
                  {assetAllocation.map((item) => (
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
                  {assetAllocation.map((item) => (
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
              </>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Portfolio Target Alignment</span>
            <span className="font-mono text-secondary font-semibold">
              {assetAllocation.length > 0 ? `${assetAllocation.length} Asset Classes Active` : 'Zero Holdings'}
            </span>
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
              Total: <strong className="text-on-surface">{safeFormatMoney(totalCategorySpendCents, baseCurrency)}</strong>
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

        {categorySpend.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-surface-container-low border border-dashed border-border/70 text-xs text-on-surface-variant space-y-1.5 my-2">
            <p className="font-semibold text-on-surface">No monthly category spending logged</p>
            <p className="text-[11px] max-w-sm mx-auto">
              Categorized expense transactions logged in Finance will automatically generate spending distribution and category breakdown bars here.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              + Record Expense
            </button>
          </div>
        ) : (
          <>
            {/* Horizontal Bar Chart */}
            <div className="space-y-3">
              {(() => {
                const maxVal = Math.max(1, ...categorySpend.map((c) => c.amountK));
                const totalK = categorySpend.reduce((s, c) => s + c.amountK, 0) || 1;
                return categorySpend.map((cat) => {
                  const pct = Math.round((cat.amountK / totalK) * 100);
                  const barWidth = Math.max(4, (cat.amountK / maxVal) * 100);
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
              {categorySpend.map((cat) => (
                <span
                  key={cat.label}
                  className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-surface-container-low border border-border/40"
                >
                  <span className={clsx('w-2 h-2 rounded-full shrink-0', cat.color)} />
                  <span className="text-on-surface-variant">{cat.label.split(' ')[0]}</span>
                </span>
              ))}
            </div>
          </>
        )}
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
              {tasks.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-surface-container-low border border-dashed border-border/60 text-xs text-on-surface-variant space-y-1">
                  <p className="font-semibold text-on-surface">No priority operational tasks</p>
                  <p className="text-[11px]">Tasks assigned for today or created in the Tasks module will populate here dynamically.</p>
                </div>
              ) : (
                tasks.map((task) => (
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                        title="Delete task"
                        aria-label="Delete task"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
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
                {recentTransactions.length > 0 ? (
                  recentTransactions.slice(0, 3).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={clsx(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold font-mono',
                            tx.type === 'income'
                              ? 'bg-secondary-container/40 text-secondary'
                              : 'bg-surface-container text-on-surface-variant'
                          )}
                        >
                          {tx.type === 'income' ? '↓' : '↑'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-on-surface truncate">
                            {tx.payee || tx.description || 'Ledger entry'}
                          </span>
                          <span className="text-[10px] text-on-surface-variant capitalize truncate">
                            {tx.type} • {tx.transactionDate}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span
                          className={clsx(
                            'font-bold block',
                            tx.type === 'income' ? 'text-secondary' : 'text-on-surface'
                          )}
                        >
                          {tx.type === 'income' ? '+' : '-'} {safeFormatMoney(tx.amountCents, baseCurrency)}
                        </span>
                        <span className="text-[10px] text-on-surface-variant capitalize">
                          {tx.paymentMethod || 'D1'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center rounded-xl bg-surface-container-low border border-dashed border-border/40 text-on-surface-variant text-xs space-y-1.5">
                    <p className="font-semibold text-on-surface">No ledger transactions recorded yet</p>
                    <p className="text-[11px]">Transactions entered in the Finance module will populate here dynamically.</p>
                  </div>
                )}
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
              <span className="font-mono text-xs font-bold text-secondary">
                {habits.length > 0 ? `${habitConsistencyPct}% Consistency` : '0% Base'}
              </span>
            </div>

            {habits.length === 0 ? (
              <div className="p-5 text-center rounded-xl bg-surface-container-low border border-dashed border-border/60 text-xs text-on-surface-variant space-y-1.5 my-3">
                <p className="font-semibold text-on-surface">No habits tracked yet</p>
                <p className="text-[11px]">Configure daily habits in the Habit Tracker to generate weekly streak analytics.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('trackers')}
                  className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Add Habit Tracker
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5 mt-3">
                  {(() => {
                    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const currentDayIdx = (new Date().getDay() + 6) % 7; // 0=Mon ... 6=Sun
                    return days.map((day, idx) => {
                      const isToday = idx === currentDayIdx;
                      const isPast = idx < currentDayIdx;
                      return (
                        <div key={day} className="text-center">
                          <span className="font-label-caps text-[10px] text-on-surface-variant block mb-1">
                            {day[0]}
                          </span>
                          <div
                            className={clsx(
                              'w-full h-8 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono transition-colors',
                              isToday
                                ? habitConsistencyPct >= 80
                                  ? 'bg-secondary text-white ring-2 ring-secondary/40'
                                  : 'bg-primary text-on-primary ring-2 ring-primary/40'
                                : isPast
                                ? 'bg-secondary/80 text-white'
                                : 'bg-surface-container-high text-on-surface-variant'
                            )}
                          >
                            {isToday ? `${habitConsistencyPct}%` : isPast ? '✓' : '-'}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>Daily Execution</span>
                  <span className="font-bold text-on-surface font-mono">
                    {habitsCompletedCount} of {habits.length} habits done
                  </span>
                </div>
              </>
            )}
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
