import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IconCheck, IconAlertTriangle, IconInfo, IconX } from './Icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  duration?: number;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  duration?: number;
}

export interface ToastFn {
  (message: string, type?: ToastType, options?: ToastOptions): string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
}

interface ToastContextType {
  toast: ToastFn;
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id?: string) => {
    if (id) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    } else {
      setToasts([]);
    }
  }, []);

  const addToastInternal = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      options?: ToastOptions
    ): string => {
      const id = Math.random().toString(36).substring(2, 9);
      const duration = options?.duration ?? (options?.action ? 5000 : 4500);

      const newItem: ToastItem = {
        id,
        type,
        message,
        action: options?.action,
        duration,
      };

      setToasts((prev) => [...prev, newItem]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const toastFn: ToastFn = useMemo(() => {
    const fn = (message: string, type?: ToastType, options?: ToastOptions) => {
      return addToastInternal(message, type, options);
    };

    fn.success = (message: string, options?: ToastOptions) =>
      addToastInternal(message, 'success', options);
    fn.error = (message: string, options?: ToastOptions) =>
      addToastInternal(message, 'error', options);
    fn.info = (message: string, options?: ToastOptions) =>
      addToastInternal(message, 'info', options);
    fn.warning = (message: string, options?: ToastOptions) =>
      addToastInternal(message, 'warning', options);
    fn.dismiss = dismiss;

    return fn;
  }, [addToastInternal, dismiss]);

  return (
    <ToastContext.Provider value={{ toast: toastFn, addToast: addToastInternal }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-5 right-0 md:right-5 left-0 md:left-auto z-50 flex flex-col space-y-2 pointer-events-none md:max-w-md w-full px-4 items-center md:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={twMerge(
              clsx(
                'pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-float border text-xs font-medium w-full max-w-sm sm:max-w-md',
                'animate-slide-up transition-all duration-200 glass-inner backdrop-blur-2xl',
                t.type === 'success' && 'bg-emerald-950/90 text-emerald-100 border-emerald-700/60 shadow-emerald-950/30',
                t.type === 'error' && 'bg-rose-950/90 text-rose-100 border-rose-700/60 shadow-rose-950/30',
                t.type === 'warning' && 'bg-amber-950/90 text-amber-100 border-amber-700/60 shadow-amber-950/30',
                t.type === 'info' && 'bg-card/95 text-foreground border-border/80 shadow-md'
              )
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="shrink-0">
                {t.type === 'success' && <IconCheck size={17} className="text-emerald-400" />}
                {t.type === 'error' && <IconAlertTriangle size={17} className="text-rose-400" />}
                {t.type === 'warning' && <IconAlertTriangle size={17} className="text-amber-400" />}
                {t.type === 'info' && <IconInfo size={17} className="text-primary" />}
              </span>
              <span className="truncate leading-relaxed select-none">{t.message}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className={twMerge(
                    clsx(
                      'px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2',
                      t.type === 'success' && 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40 hover:bg-emerald-400/30 focus-visible:ring-emerald-400',
                      t.type === 'error' && 'bg-rose-400/20 text-rose-200 border-rose-400/40 hover:bg-rose-400/30 focus-visible:ring-rose-400',
                      t.type === 'warning' && 'bg-amber-400/20 text-amber-200 border-amber-400/40 hover:bg-amber-400/30 focus-visible:ring-amber-400',
                      t.type === 'info' && 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 focus-visible:ring-primary'
                    )
                  )}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center -mr-1 rounded-lg text-current opacity-70 hover:opacity-100 hover:bg-white/10 active:scale-95 transition-all touch-manipulation focus-visible:outline-none cursor-pointer"
                aria-label="Dismiss notification"
              >
                <IconX size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
