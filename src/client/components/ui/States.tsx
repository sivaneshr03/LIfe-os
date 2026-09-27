import React from 'react';
import { Button } from './Button';
import { IconAlertTriangle, IconLock, IconFolder, IconPlus } from './Icons';
import { SkeletonCard } from './Skeleton';

export function LoadingState({
  message = 'Loading data...',
  variant = 'spinner',
}: {
  message?: string;
  variant?: 'spinner' | 'skeleton';
}) {
  if (variant === 'skeleton') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full animate-fade-in" role="status">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center animate-fade-in" role="status">
      <div className="relative mb-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-primary animate-breathe" />
        </div>
      </div>
      <p className="text-xs font-semibold tracking-wide text-foreground/70 uppercase">{message}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center border border-dashed border-border/80 rounded-2xl bg-card/40 backdrop-blur-xs animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-muted/60 text-foreground/50 flex items-center justify-center mb-4 shadow-xs">
        {icon || <IconFolder size={24} />}
      </div>
      <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
      <p className="text-xs text-foreground/60 max-w-sm mt-1.5 mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="primary" className="shadow-xs min-h-[44px] sm:min-h-[36px] w-full sm:w-auto">
          <IconPlus size={14} />
          <span>{actionLabel}</span>
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Action Required', message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-5 sm:p-8 text-center bg-rose-500/5 border border-rose-500/20 rounded-2xl text-foreground animate-fade-in"
    >
      <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
        <IconAlertTriangle size={20} />
      </div>
      <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">{title}</h3>
      <p className="text-xs text-foreground/70 max-w-sm mt-1 mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto">
          Try Again
        </Button>
      )}
    </div>
  );
}

export interface UnauthorizedStateProps {
  title?: string;
  message?: string;
  onBack?: () => void;
}

export function UnauthorizedState({
  title = 'Access Restricted',
  message = 'You do not have permission to access this area. Administrator privileges required.',
  onBack,
}: UnauthorizedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center border border-border/80 rounded-2xl bg-card shadow-sm animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-muted/70 text-foreground/60 flex items-center justify-center mb-4">
        <IconLock size={24} />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
      <p className="text-xs text-foreground/60 max-w-md mt-1.5 mb-6 leading-relaxed">{message}</p>
      {onBack && (
        <Button onClick={onBack} variant="secondary" size="md" className="min-h-[44px] w-full sm:w-auto">
          Return to Dashboard
        </Button>
      )}
    </div>
  );
}
