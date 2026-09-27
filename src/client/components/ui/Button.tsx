import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
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
      'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:brightness-105 active:brightness-95 border border-primary/20',
    secondary:
      'bg-muted/80 text-foreground hover:bg-muted active:bg-muted/90 border border-border/50',
    outline:
      'border border-border bg-card/50 text-foreground hover:bg-muted/60 hover:border-border/80 active:bg-muted',
    ghost:
      'text-foreground/80 hover:text-foreground hover:bg-muted/60 active:bg-muted',
    destructive:
      'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-500 active:bg-red-700 border border-red-500/20 focus-visible:ring-red-500',
    glass:
      'glass text-foreground hover:bg-card/80 active:bg-card/60 shadow-xs',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 min-h-[38px] sm:min-h-[32px] gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 min-h-[44px] sm:min-h-[40px] gap-2 font-medium',
    lg: 'text-base px-6 py-2.5 min-h-[48px] sm:min-h-[46px] gap-2.5 font-semibold',
    icon: 'w-10 h-10 sm:w-9 sm:h-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center',
  };

  return (
    <button
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
}
