import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || React.useId();
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-foreground/80">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={twMerge(
            clsx(
              'w-full px-3 py-2 text-sm bg-background text-foreground border rounded-token placeholder:text-foreground/40 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
              'disabled:opacity-50 disabled:bg-muted/50',
              error ? 'border-red-500 focus:ring-red-500' : 'border-border',
              className
            )
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-foreground/60">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
