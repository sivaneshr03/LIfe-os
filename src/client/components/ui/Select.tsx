import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IconChevronDown } from './Icons';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const selectId = id || React.useId();
    const errorId = `${selectId}-error`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold tracking-tight text-foreground/80">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={twMerge(
              clsx(
                'w-full px-3.5 py-2.5 sm:py-2 pr-9 text-base sm:text-sm min-h-[44px] sm:min-h-[40px] bg-card text-foreground border rounded-token appearance-none touch-manipulation',
                'transition-all duration-150 ease-out shadow-xs cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:opacity-50 disabled:bg-muted/40 disabled:cursor-not-allowed',
                error ? 'border-red-500/80 focus:ring-red-500/20 focus:border-red-500' : 'border-border/80 hover:border-border',
                className
              )
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/40">
            <IconChevronDown size={16} />
          </div>
        </div>
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

Select.displayName = 'Select';
