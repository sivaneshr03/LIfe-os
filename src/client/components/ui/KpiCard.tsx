import React from 'react';
import { clsx } from 'clsx';
import { Card3D } from './Card3D';

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  color?: 'primary' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'violet' | 'cyan' | 'default';
  progressBar?: {
    value: number; // 0 to 100
    color?: string;
  };
  className?: string;
  onClick?: () => void;
}

const COLOR_MAP = {
  primary: {
    text: 'text-primary',
    bg: 'bg-primary-fixed',
    border: 'border-primary/20',
    iconText: 'text-primary',
    bar: 'bg-primary',
  },
  emerald: {
    text: 'text-secondary',
    bg: 'bg-secondary-container/50',
    border: 'border-secondary/20',
    iconText: 'text-secondary',
    bar: 'bg-secondary',
  },
  rose: {
    text: 'text-rose-500',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/20',
    iconText: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
  },
  amber: {
    text: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-400/20',
    iconText: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-400',
  },
  indigo: {
    text: 'text-primary',
    bg: 'bg-primary-fixed',
    border: 'border-primary/20',
    iconText: 'text-primary',
    bar: 'bg-primary',
  },
  violet: {
    text: 'text-indigo-500',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/20',
    iconText: 'text-indigo-500',
    bar: 'bg-indigo-500',
  },
  cyan: {
    text: 'text-tertiary',
    bg: 'bg-tertiary-container/30',
    border: 'border-tertiary/20',
    iconText: 'text-tertiary',
    bar: 'bg-tertiary',
  },
  default: {
    text: 'text-on-surface',
    bg: 'bg-surface-container',
    border: 'border-border/60',
    iconText: 'text-on-surface-variant',
    bar: 'bg-primary',
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'default',
  progressBar,
  className = '',
  onClick,
}: KpiCardProps) {
  const scheme = COLOR_MAP[color] || COLOR_MAP.default;

  return (
    <Card3D
      maxTilt={onClick ? 6 : 4}
      onClick={onClick}
      className={clsx(
        'group relative flex flex-col justify-between min-w-0 overflow-hidden',
        'p-4 sm:p-5 rounded-2xl border border-border/70 bg-surface-container-lowest',
        'shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'hover:shadow-[0_6px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:border-primary/40',
        className
      )}
    >
      {/* Top Header Row: Label & Optional Mini Icon */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 mb-2 translate-z-12">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 truncate block select-none">
          {title}
        </span>
        {icon && (
          <div
            className={clsx(
              'w-8 h-8 sm:w-10 sm:h-10 rounded-xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs',
              scheme.bg,
              scheme.iconText
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main Metric Value Row with Crisp Tabular Typography */}
      <div className="space-y-1 min-w-0 my-auto">
        <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1 min-w-0 translate-z-20">
          <div
            className={clsx(
              'text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums truncate leading-none py-0.5',
              scheme.text
            )}
          >
            {value}
          </div>

          {/* Compact Inline Trend Badge */}
          {trend && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded-full shrink-0',
                trend.isPositive !== false
                  ? 'bg-secondary-container/40 text-secondary'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              )}
            >
              <span>{trend.isPositive !== false ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </span>
          )}
        </div>

        {/* Subtitle / Micro details */}
        {subtitle && (
          <div className="text-xs text-on-surface-variant/80 truncate leading-normal translate-z-12 mt-1">
            {subtitle}
          </div>
        )}
      </div>

      {/* Progress Bar (e.g. for Savings Rate or Goals) */}
      {progressBar && (
        <div className="w-full bg-surface-container rounded-full h-1.5 mt-2.5 overflow-hidden translate-z-12 shrink-0">
          <div
            className={clsx('h-full rounded-full transition-all duration-300', scheme.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progressBar.value))}%` }}
          />
        </div>
      )}
    </Card3D>
  );
}

export function KpiGrid({
  children,
  className = '',
  cols = '4',
}: {
  children: React.ReactNode;
  className?: string;
  cols?: '4' | '5' | '3';
}) {
  const colClass =
    cols === '5'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      : cols === '3'
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={clsx(
        'grid gap-3 sm:gap-4 w-full min-w-0',
        colClass,
        className
      )}
    >
      {children}
    </div>
  );
}
