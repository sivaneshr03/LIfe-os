import React, { createContext, useContext, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IconCheck, IconAlertTriangle, IconInfo, IconX } from './Icons';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, addToast: toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-5 right-0 md:right-5 left-0 md:left-auto z-50 flex flex-col space-y-2 pointer-events-none md:max-w-sm w-full px-4 items-center md:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={twMerge(
              clsx(
                'pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-xs font-medium w-full max-w-sm',
                'animate-slide-up-toast transition-all duration-200',
                t.type === 'success' && 'bg-emerald-950/90 text-emerald-100 border-emerald-800/80 backdrop-blur-md',
                t.type === 'error' && 'bg-rose-950/90 text-rose-100 border-rose-800/80 backdrop-blur-md',
                t.type === 'warning' && 'bg-amber-950/90 text-amber-100 border-amber-800/80 backdrop-blur-md',
                t.type === 'info' && 'bg-card/95 text-foreground border-border/80 backdrop-blur-md shadow-md'
              )
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0">
                {t.type === 'success' && <IconCheck size={16} className="text-emerald-400" />}
                {t.type === 'error' && <IconAlertTriangle size={16} className="text-rose-400" />}
                {t.type === 'warning' && <IconAlertTriangle size={16} className="text-amber-400" />}
                {t.type === 'info' && <IconInfo size={16} className="text-primary" />}
              </span>
              <span className="truncate leading-relaxed">{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 rounded-lg text-current opacity-70 hover:opacity-100 hover:bg-white/10 active:scale-95 transition-all touch-manipulation focus-visible:outline-none"
              aria-label="Dismiss notification"
            >
              <IconX size={15} />
            </button>
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
