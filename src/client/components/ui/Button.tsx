import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  const baseStyles = [
    'relative inline-flex items-center justify-center font-medium select-none touch-manipulation',
    'rounded-token transition-all duration-150 ease-out',
    'active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
    'cursor-pointer',
  ].join(' ');

  const variants = {
    primary:
      'bg-primary text-primary-foreground shadow-xs hover:brightness-105 active:brightness-95 border border-primary/20',
    secondary:
      'bg-surface-container-low text-on-surface hover:bg-surface-container border border-border/70',
    outline:
      'border border-border/70 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low hover:border-border active:bg-surface-container shadow-xs',
    ghost:
      'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low active:bg-surface-container',
    destructive:
      'bg-red-600 text-white shadow-xs hover:bg-red-500 active:bg-red-700 border border-red-500/20 focus-visible:ring-red-500',
    glass:
      'bg-surface-container-lowest/80 backdrop-blur-md text-on-surface hover:bg-surface-container-lowest active:bg-surface-container-low border border-border/70 shadow-xs',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 min-h-[38px] sm:min-h-[32px] gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 min-h-[44px] sm:min-h-[40px] gap-2 font-medium',
    lg: 'text-base px-6 py-2.5 min-h-[48px] sm:min-h-[46px] gap-2.5 font-semibold',
    icon: 'w-10 h-10 sm:w-9 sm:h-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center',
  };

  return (
    <button
      ref={ref}
      type={type}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span
          className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
