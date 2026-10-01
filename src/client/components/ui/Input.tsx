import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightAction, id, ...props }, ref) => {
    const inputId = id || React.useId();
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block font-label-caps text-on-surface-variant">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-on-surface-variant/60">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={twMerge(
              clsx(
                'w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[42px] sm:min-h-[40px] bg-surface-container-low text-on-surface border rounded-xl placeholder:text-on-surface-variant/40 touch-manipulation',
                'transition-all duration-150 ease-out shadow-xs',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:opacity-50 disabled:bg-surface-container-high disabled:cursor-not-allowed',
                leftIcon ? 'pl-9' : '',
                rightAction ? 'pr-9' : '',
                error
                  ? 'border-red-500/80 focus:ring-red-500/20 focus:border-red-500'
                  : 'border-border/70 hover:border-border',
                className
              )
            )}
            {...props}
          />
          {rightAction && (
            <div className="absolute right-2.5 flex items-center">
              {rightAction}
            </div>
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="font-body-sm text-on-surface-variant leading-relaxed">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-[11px] text-red-500 dark:text-red-400 font-medium leading-relaxed flex items-center gap-1">
            <span>•</span>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
