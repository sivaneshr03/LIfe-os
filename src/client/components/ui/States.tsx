import React from 'react';
import { Button } from './Button';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center" role="status">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-foreground/70">{message}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

export function EmptyState({ title, description, actionLabel, onAction, icon = '📂' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-token bg-card/50">
      <div className="text-4xl mb-3 select-none" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm text-foreground/60 max-w-sm mt-1 mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
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

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-8 text-center bg-red-500/10 border border-red-500/20 rounded-token text-red-600 dark:text-red-400"
    >
      <div className="text-3xl mb-2 select-none" aria-hidden="true">
        ⚠️
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="text-sm opacity-90 max-w-sm mt-1 mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="border-red-500/30 text-current hover:bg-red-500/10">
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
    <div className="flex flex-col items-center justify-center p-12 text-center border border-border rounded-token bg-card">
      <div className="text-4xl mb-3 select-none" aria-hidden="true">
        🔒
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <p className="text-sm text-foreground/60 max-w-md mt-1 mb-6">{message}</p>
      {onBack && (
        <Button onClick={onBack} variant="secondary" size="md">
          Return to Dashboard
        </Button>
      )}
    </div>
  );
}
