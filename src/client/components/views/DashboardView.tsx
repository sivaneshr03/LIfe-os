import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Badge } from '../ui/Badge';
import type { HealthCheckData, ApiResponse } from '../../../shared/types';

export function DashboardView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { user } = useAuthStore();
  const [health, setHealth] = useState<HealthCheckData | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((json: ApiResponse<HealthCheckData>) => {
        if (json.success) setHealth(json.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <section className="bg-card text-card-foreground border border-border rounded-token p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Hello, {user?.name || 'User'}
            </h2>
            <Badge variant={user?.role === 'admin' ? 'primary' : 'default'}>
              {user?.role}
            </Badge>
          </div>
          <p className="text-xs text-foreground/60">
            Welcome to LifeOS. Authentication, authorization, and design systems are active.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('settings')}
            className="px-3 py-1.5 rounded-token border border-border text-xs font-semibold hover:bg-muted transition-colors"
          >
            Customize Design Tokens
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className="px-3 py-1.5 rounded-token bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              Admin Panel
            </button>
          )}
        </div>
      </section>

      {/* Edge Health Snapshot */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-token border border-border bg-card text-card-foreground">
          <span className="text-[11px] text-foreground/50 uppercase font-semibold block">Authentication</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Cookie Sessions
          </span>
        </div>

        <div className="p-4 rounded-token border border-border bg-card text-card-foreground">
          <span className="text-[11px] text-foreground/50 uppercase font-semibold block">Database (D1)</span>
          <span className="text-sm font-bold text-foreground mt-1 block capitalize">
            {health?.services.database || 'Connected'}
          </span>
        </div>

        <div className="p-4 rounded-token border border-border bg-card text-card-foreground">
          <span className="text-[11px] text-foreground/50 uppercase font-semibold block">Environment</span>
          <span className="text-sm font-bold text-foreground mt-1 block">
            {health?.environment || 'local'}
          </span>
        </div>

        <div className="p-4 rounded-token border border-border bg-card text-card-foreground">
          <span className="text-[11px] text-foreground/50 uppercase font-semibold block">Runtime Engine</span>
          <span className="text-sm font-bold text-foreground mt-1 block">
            Hono Edge Worker
          </span>
        </div>
      </section>

      {/* Feature Modules Status Grid */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Upcoming Modules (Phased Roadmap)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[
            { title: 'Tasks & Projects', icon: '✓', status: 'Phase 3 Ready', desc: 'Lists, Kanban boards, recurrence rules, and reminders.' },
            { title: 'Personal Finance', icon: '💳', status: 'Phase 5 Ready', desc: 'Accounts, integer-cent atomic ledger, and category budgets.' },
            { title: 'Notes & Knowledge', icon: '📝', status: 'Phase 3 Ready', desc: 'Daily journals, Markdown notes, and prompt template manager.' },
            { title: 'Habits & Trackers', icon: '📈', status: 'Phase 4 Ready', desc: 'Consistency streaks, flexible metric trackers, and fitness logs.' },
            { title: 'Investments & Quotes', icon: '📊', status: 'Phase 6 Ready', desc: 'Portfolio holdings, manual price quotes, and CSV import.' },
            { title: 'PWA & Offline Sync', icon: '📱', status: 'Phase 7 Ready', desc: 'Installable home screen web app with offline static asset caching.' },
          ].map((m) => (
            <div key={m.title} className="p-4 rounded-token border border-border bg-card/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-lg select-none">{m.icon}</span>
                <span className="text-[10px] uppercase font-bold text-foreground/40 bg-muted px-2 py-0.5 rounded-full">
                  {m.status}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-foreground">{m.title}</h4>
              <p className="text-xs text-foreground/60 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
