import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ children, className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase';

  const variants = {
    default: 'bg-muted text-foreground/80',
    primary: 'bg-primary/10 text-primary border border-primary/20',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    destructive: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    outline: 'border border-border text-foreground',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], className))} {...props}>
      {children}
    </span>
  );
}
