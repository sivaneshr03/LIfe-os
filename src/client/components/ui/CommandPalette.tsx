import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  IconDashboard,
  IconCheckSquare,
  IconCreditCard,
  IconTrendingUp,
  IconFileText,
  IconTarget,
  IconSettings,
  IconSearch,
} from './Icons';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll with scrollbar shift compensation
  useEffect(() => {
    if (!isOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);

  const commands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      category: 'Navigation',
      icon: <IconDashboard size={18} />,
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-tasks',
      title: 'Go to Tasks & Projects',
      category: 'Navigation',
      icon: <IconCheckSquare size={18} />,
      action: () => {
        onNavigate('tasks');
        onClose();
      },
    },
    {
      id: 'nav-finance',
      title: 'Go to Personal Finance & Ledger',
      category: 'Navigation',
      icon: <IconCreditCard size={18} />,
      action: () => {
        onNavigate('finance');
        onClose();
      },
    },
    {
      id: 'nav-investments',
      title: 'Go to Investments & Portfolio',
      category: 'Navigation',
      icon: <IconTrendingUp size={18} />,
      action: () => {
        onNavigate('investments');
        onClose();
      },
    },
    {
      id: 'nav-notes',
      title: 'Go to Notes & AI Prompts',
      category: 'Navigation',
      icon: <IconFileText size={18} />,
      action: () => {
        onNavigate('notes');
        onClose();
      },
    },
    {
      id: 'nav-trackers',
      title: 'Go to Habits, Trackers & Fitness',
      category: 'Navigation',
      icon: <IconTarget size={18} />,
      action: () => {
        onNavigate('trackers');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings & Theming',
      category: 'Navigation',
      icon: <IconSettings size={18} />,
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
  ];

  const filtered = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Universal Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[calc(4rem+env(safe-area-inset-top,0px))] sm:pt-24 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-black/60 dark:bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border/80 dark:border-white/10 rounded-2xl shadow-float overflow-hidden flex flex-col max-h-[70dvh] glass-inner animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-border/60 bg-muted/20">
          <IconSearch size={18} className="text-foreground/40 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search anything..."
            className="w-full py-4 bg-transparent text-base sm:text-sm text-foreground focus:outline-none placeholder:text-foreground/40 font-medium touch-manipulation"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-medium text-foreground/50 bg-muted border border-border/60 rounded">
            ESC
          </kbd>
        </div>

        <div className="p-2 overflow-y-auto divide-y divide-border/20">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-foreground/50">
              No matching commands or navigation links found.
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={twMerge(
                      clsx(
                        'w-full flex items-center justify-between px-3.5 py-3 sm:py-2.5 min-h-[44px] sm:min-h-[38px] text-xs font-semibold rounded-xl transition-all duration-100 text-left focus:outline-none cursor-pointer touch-manipulation',
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-foreground/80 hover:bg-muted/70'
                      )
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={clsx(
                          'shrink-0',
                          isSelected ? 'text-primary-foreground' : 'text-foreground/50'
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <span
                      className={clsx(
                        'text-[10px] uppercase font-mono font-bold tracking-wider shrink-0',
                        isSelected ? 'text-primary-foreground/80' : 'text-foreground/40'
                      )}
                    >
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-foreground/50 font-medium">
          <span>Navigation</span>
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted border border-border/60 rounded font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-muted border border-border/60 rounded font-mono text-[10px]">↓</kbd> to
              navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted border border-border/60 rounded font-mono text-[10px]">↵</kbd> to
              select
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
