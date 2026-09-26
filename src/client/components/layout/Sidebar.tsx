import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'tasks', label: 'Tasks (Planned)', icon: '✓' },
  { id: 'finance', label: 'Finance (Planned)', icon: '💳' },
  { id: 'notes', label: 'Notes (Planned)', icon: '📝' },
  { id: 'trackers', label: 'Habits (Planned)', icon: '📈' },
  { id: 'admin', label: 'Admin Panel', icon: '🛡️', adminOnly: true },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
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
          'hidden md:flex flex-col border-r border-border bg-card text-card-foreground transition-all duration-200 h-screen sticky top-0 z-40',
          sidebarCollapsed ? 'w-18' : 'w-64'
        )
      )}
    >
      <div className="flex items-center h-14 px-4 border-b border-border justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-token bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm select-none">
            L
          </div>
          {!sidebarCollapsed && (
            <span className="font-extrabold text-base tracking-tight text-foreground truncate">
              Life<span className="text-primary">OS</span>
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={twMerge(
                clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-token transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/70 hover:text-foreground hover:bg-muted'
                )
              )}
            >
              <span className="text-base select-none" aria-hidden="true">
                {item.icon}
              </span>
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!sidebarCollapsed && (
        <div className="p-4 border-t border-border text-xs text-foreground/50 space-y-1">
          <p className="font-semibold text-foreground/70">Private Household App</p>
          <p>Cloudflare Edge + D1</p>
        </div>
      )}
    </aside>
  );
}
