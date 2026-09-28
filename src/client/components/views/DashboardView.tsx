import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card3D } from '../ui/Card3D';
import {
  IconCheckSquare,
  IconCreditCard,
  IconTrendingUp,
  IconFileText,
  IconTarget,
  IconShield,
  IconSettings,
  IconArrowUpRight,
  IconPlus,
} from '../ui/Icons';
import type { HealthCheckData, ApiResponse } from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

export function DashboardView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { user } = useAuthStore();
  const [health, setHealth] = useState<HealthCheckData | null>(null);

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

  const modules = [
    {
      id: 'tasks',
      title: 'Tasks & Projects',
      desc: 'Kanban boards, checklist milestones, priority queues, and recurrences.',
      icon: <IconCheckSquare size={22} className="text-primary" />,
      actionText: 'Manage Tasks',
      tag: 'Productivity',
    },
    {
      id: 'finance',
      title: 'Personal Finance & Ledger',
      desc: 'Double-entry balance tracking, category budgets, debt payoff, and CSV exports.',
      icon: <IconCreditCard size={22} className="text-emerald-500" />,
      actionText: 'Open Ledger',
      tag: 'Finance',
    },
    {
      id: 'investments',
      title: 'Investments & Holdings',
      desc: 'Asset allocation, cost basis, realized & unrealized P&L, and price quotes.',
      icon: <IconTrendingUp size={22} className="text-cyan-500" />,
      actionText: 'View Portfolio',
      tag: 'Wealth',
    },
    {
      id: 'notes',
      title: 'Notes & AI Prompts',
      desc: 'Markdown documents, daily logs, structured prompt library, and search.',
      icon: <IconFileText size={22} className="text-amber-500" />,
      actionText: 'Open Notes',
      tag: 'Knowledge',
    },
    {
      id: 'trackers',
      title: 'Habits & Fitness Logs',
      desc: 'Streak analytics, daily habit checklists, workout sets, and measurements.',
      icon: <IconTarget size={22} className="text-rose-500" />,
      actionText: 'Track Habits',
      tag: 'Wellness',
    },
    {
      id: 'settings',
      title: 'Settings & Theming',
      desc: 'Accent palettes, typography scale, motion controls, and system preferences.',
      icon: <IconSettings size={22} className="text-foreground/60" />,
      actionText: 'Customize',
      tag: 'System',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Executive Welcome Hero */}
      <section className="relative overflow-hidden bg-card/85 backdrop-blur-xl border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xs glass-inner group hover:shadow-md transition-all duration-300">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -left-20 -bottom-20 w-56 h-56 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"
        />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Good day, {user?.name || 'Commander'}
              </h1>
              <Badge variant={user?.role === 'admin' ? 'primary' : 'default'} size="md">
                {user?.role || 'Member'}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-foreground/60 max-w-xl leading-relaxed">
              Your household intelligence node is active. All financial ledgers, task queues, and habit streaks are synchronized to Cloudflare edge storage.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto shrink-0">
            <Button
              onClick={() => onNavigate('tasks')}
              size="sm"
              variant="outline"
              className="shadow-xs w-full sm:w-auto justify-center min-h-[44px] sm:min-h-[36px]"
            >
              <IconPlus size={14} />
              <span>Quick Task</span>
            </Button>
            <Button
              onClick={() => onNavigate('finance')}
              size="sm"
              variant="primary"
              className="shadow-xs w-full sm:w-auto justify-center min-h-[44px] sm:min-h-[36px]"
            >
              <IconCreditCard size={14} />
              <span>Log Transaction</span>
            </Button>
          </div>
        </div>
      </section>

      {/* System Telemetry Strips */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-border/80 bg-card/70 backdrop-blur-sm space-y-1 shadow-xs hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-foreground/45 uppercase font-mono font-bold tracking-wider block">
            Edge Engine
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-breathe" />
            <span className="text-xs sm:text-sm font-bold text-foreground">Cloudflare Worker</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/70 backdrop-blur-sm space-y-1 shadow-xs hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-foreground/45 uppercase font-mono font-bold tracking-wider block">
            Storage Engine
          </span>
          <span className="text-xs sm:text-sm font-bold text-foreground mt-1 block">
            D1 Database ({health?.services.database || 'Active'})
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/70 backdrop-blur-sm space-y-1 shadow-xs hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-foreground/45 uppercase font-mono font-bold tracking-wider block">
            Auth Boundary
          </span>
          <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            HttpOnly Secure Sessions
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/70 backdrop-blur-sm space-y-1 shadow-xs hover:shadow-md transition-all duration-300">
          <span className="text-[10px] text-foreground/45 uppercase font-mono font-bold tracking-wider block">
            Environment
          </span>
          <span className="text-xs sm:text-sm font-bold text-foreground mt-1 block font-mono capitalize">
            {health?.environment || 'Edge Local'}
          </span>
        </div>
      </section>

      {/* Primary Workspaces Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/50 font-mono">
            Active Operating Modules
          </h2>
          <span className="text-xs text-foreground/40 font-medium">6 modules ready</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m) => (
            <Card3D
              key={m.id}
              onClick={() => onNavigate(m.id)}
              maxTilt={8}
              className="group p-5 rounded-2xl border border-border/80 bg-card/75 hover:bg-card/95 hover:border-primary/40 transition-all duration-300 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 glass-inner"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-muted/70 flex items-center justify-center group-hover:scale-110 transition-transform duration-200 translate-z-20 shadow-xs">
                    {m.icon}
                  </div>
                  <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-muted/80 text-foreground/70 border border-border/50 translate-z-12">
                    {m.tag}
                  </span>
                </div>
                <div className="translate-z-12">
                  <h3 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>{m.title}</span>
                    <IconArrowUpRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                    />
                  </h3>
                  <p className="text-xs text-foreground/60 leading-relaxed mt-1">{m.desc}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary translate-z-12">
                <span>{m.actionText}</span>
                <span className="group-hover:translate-x-1.5 transition-transform duration-150">→</span>
              </div>
            </Card3D>
          ))}
        </div>
      </section>

      {/* Admin Panel Quick Access Banner if user is admin */}
      {user?.role === 'admin' && (
        <section className="p-6 rounded-2xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
              <IconShield size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Household Admin Console</h3>
              <p className="text-xs text-foreground/60 mt-0.5">
                Manage household users, invites, app settings, and review immutable security audit logs.
              </p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate('admin')}
            size="sm"
            variant="primary"
            className="w-full sm:w-auto justify-center min-h-[44px] sm:min-h-[36px] shrink-0"
          >
            Launch Admin Console
          </Button>
        </section>
      )}
    </div>
  );
}
