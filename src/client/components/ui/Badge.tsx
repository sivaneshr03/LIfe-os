import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, className, variant = 'default', size = 'sm', ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-semibold tracking-wider uppercase transition-colors select-none rounded-full';

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const variants = {
    default: 'bg-muted/80 text-foreground/70 border border-border/60',
    primary: 'bg-primary/10 text-primary border border-primary/25 shadow-xs',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
    destructive: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25',
    info: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25',
    outline: 'border border-border/80 text-foreground/80 bg-transparent',
  };

  return (
    <span className={twMerge(clsx(baseStyles, sizes[size], variants[variant], className))} {...props}>
      {children}
    </span>
  );
}
