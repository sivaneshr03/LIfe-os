import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button';
import { IconAlertTriangle, IconX } from './Icons';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'primary';
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = 'This action cannot be undone. Are you sure you want to proceed?',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  isLoading = false,
}: ConfirmationModalProps) {
  const titleId = useId();
  const descId = useId();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      // Focus the cancel button by default to prevent accidental confirmation
      cancelBtnRef.current?.focus();
    }, 50);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [isOpen]);

  // Keyboard navigation: Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const modalContent = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-contain bg-black/60 dark:bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={twMerge(
          clsx(
            'relative w-full max-w-md text-card-foreground outline-none',
            'bg-card/95 backdrop-blur-2xl border border-border/80 dark:border-white/10 rounded-2xl sm:rounded-3xl',
            'shadow-float glass-inner p-6 sm:p-7 space-y-5 animate-scale-in'
          )
        )}
      >
        {/* Header with Warning Icon */}
        <div className="flex items-start gap-4">
          <div
            className={clsx(
              'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs',
              variant === 'destructive'
                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-primary/15 text-primary border border-primary/30'
            )}
          >
            <IconAlertTriangle size={22} />
          </div>

          <div className="space-y-1 flex-1 pr-6">
            <h2 id={titleId} className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p id={descId} className="text-xs text-foreground/60 leading-relaxed">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close confirmation dialog"
            className="absolute top-4 right-4 p-2 text-foreground/40 hover:text-foreground hover:bg-muted/70 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-border/50">
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto justify-center min-h-[42px] sm:min-h-[36px]"
          >
            {cancelLabel}
          </Button>

          <Button
            ref={confirmBtnRef}
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            size="sm"
            isLoading={isLoading}
            onClick={onConfirm}
            className="w-full sm:w-auto justify-center min-h-[42px] sm:min-h-[36px] font-semibold"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
