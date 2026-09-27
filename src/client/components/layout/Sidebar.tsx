import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import {
  IconDashboard,
  IconCheckSquare,
  IconCreditCard,
  IconTrendingUp,
  IconFileText,
  IconTarget,
  IconShield,
  IconSettings,
} from '../ui/Icons';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard size={19} /> },
  { id: 'tasks', label: 'Tasks & Projects', icon: <IconCheckSquare size={19} /> },
  { id: 'finance', label: 'Finance & Ledger', icon: <IconCreditCard size={19} /> },
  { id: 'investments', label: 'Investments', icon: <IconTrendingUp size={19} /> },
  { id: 'notes', label: 'Notes & Prompts', icon: <IconFileText size={19} /> },
  { id: 'trackers', label: 'Habits & Fitness', icon: <IconTarget size={19} /> },
  { id: 'admin', label: 'Admin Panel', icon: <IconShield size={19} />, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: <IconSettings size={19} /> },
];

export interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { sidebarCollapsed } = useThemeStore();
  const { user } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'admin');

  return (
    <aside
      aria-label="Sidebar navigation"
      className={twMerge(
        clsx(
          'hidden md:flex flex-col border-r border-border/80 bg-card/70 backdrop-blur-xl text-card-foreground',
          'transition-[width] duration-300 ease-out min-h-dvh h-dvh sticky top-0 z-40 select-none shadow-xs',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center h-16 px-4 border-b border-border/60 justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-sm shadow-sm shadow-primary/20 shrink-0">
            L
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base tracking-tight text-foreground truncate">
                Life<span className="text-primary">OS</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-foreground/40 font-mono">
                Sivanesh
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={twMerge(
                clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-token transition-all duration-150 text-left cursor-pointer group',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-bold'
                    : 'text-foreground/70 hover:text-foreground hover:bg-muted/70 active:scale-[0.98]'
                )
              )}
            >
              <span
                className={twMerge(
                  clsx(
                    'shrink-0 transition-transform duration-150 group-hover:scale-110',
                    isActive ? 'text-primary-foreground' : 'text-foreground/50 group-hover:text-foreground'
                  )
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {!sidebarCollapsed && <span className="truncate tracking-tight">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {!sidebarCollapsed && (
        <div className="p-4 border-t border-border/60 bg-muted/20 text-[11px] text-foreground/50 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-breathe" />
            <span>Private Household App</span>
          </div>
          <p className="font-mono text-[10px] text-foreground/40">Cloudflare Edge + D1</p>
        </div>
      )}
    </aside>
  );
}
