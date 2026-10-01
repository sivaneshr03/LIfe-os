import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { NotificationCenter } from '../notifications/NotificationCenter';
import {
  IconMenu,
  IconSearch,
  IconSun,
  IconMoon,
  IconLaptop,
  IconLogOut,
} from '../ui/Icons';

export interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Executive Dashboard',
  tasks: 'Tasks & Projects',
  finance: 'Finance & Ledger',
  lending: 'Lending & Payees',
  investments: 'Investments & Portfolio',
  notes: 'Notes & AI Prompts',
  trackers: 'Habits & Fitness',
  culinary: 'Cooking & Culinary',
  admin: 'Admin Console',
  settings: 'System Settings',
};

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { themeMode, setThemeMode, toggleSidebar, toggleMobileDrawer } = useThemeStore();
  const { user, logout } = useAuthStore();
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cycleTheme = () => {
    if (themeMode === 'system') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('light');
    else setThemeMode('system');
  };

  const ThemeIcon = {
    system: IconLaptop,
    light: IconSun,
    dark: IconMoon,
  }[themeMode];

  const viewTitle = VIEW_TITLES[currentView] || currentView;

  return (
    <header className="sticky top-0 z-30 w-full bg-surface-container-lowest/80 backdrop-blur-xl border-b border-border/70 transition-colors shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-[env(safe-area-inset-top,0px)]">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 md:px-8 max-w-full">
        {/* Left: Mobile Toggle & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                toggleMobileDrawer();
              } else {
                toggleSidebar();
              }
            }}
            aria-label="Toggle navigation menu"
            className="flex p-2 rounded-xl border border-border/70 text-outline hover:text-on-surface hover:bg-surface-container transition-colors focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer min-h-[44px] min-w-[44px] items-center justify-center touch-manipulation shrink-0"
          >
            <IconMenu size={18} />
          </button>

          <div className="flex items-center gap-1.5 font-label-md text-label-md min-w-0">
            <span
              onClick={() => onNavigate('dashboard')}
              className="text-on-surface-variant hover:text-on-surface cursor-pointer font-medium transition-colors"
            >
              LifeOS
            </span>
            <span className="text-outline-variant font-light">/</span>
            <span className="text-on-surface font-semibold truncate">
              {viewTitle}
            </span>

            {isOffline && (
              <span
                role="status"
                className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse shadow-xs shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="hidden xs:inline">Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Search capsule, Notifications, Theme, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Find Trigger Capsule */}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
            }}
            type="button"
            className="hidden md:flex items-center gap-2 bg-surface-container-low hover:bg-surface-container px-3 py-1.5 rounded-xl w-64 lg:w-72 text-on-surface-variant cursor-pointer transition-colors border border-transparent hover:border-border/60"
            title="Search or execute (⌘K)"
          >
            <IconSearch size={16} className="text-outline" />
            <span className="font-body-sm text-body-sm flex-1 text-left text-outline truncate">
              Search or execute command...
            </span>
            <kbd className="font-label-caps text-label-caps bg-surface-container-highest px-1.5 py-0.5 rounded text-on-surface-variant shadow-sm font-mono">
              ⌘K
            </kbd>
          </button>

          {/* Quick Find Mobile Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
            }}
            type="button"
            aria-label="Open Quick Find"
            className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-outline hover:text-on-surface rounded-xl border border-border/70 bg-surface-container-low active:scale-95 cursor-pointer touch-manipulation"
          >
            <IconSearch size={18} />
          </button>

          {/* Notifications Center */}
          <NotificationCenter onNavigate={onNavigate} />

          {/* Theme Cycler */}
          <button
            onClick={cycleTheme}
            type="button"
            aria-label={`Current theme: ${themeMode}. Click to toggle`}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-outline hover:text-on-surface rounded-xl border border-border/70 bg-surface-container-low hover:bg-surface-container transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer touch-manipulation"
            title={`Theme: ${themeMode}`}
          >
            <ThemeIcon size={18} />
          </button>

          <div className="h-6 w-px bg-surface-container hidden sm:block" />

          {/* User Account Capsule */}
          {user && (
            <div className="flex items-center gap-2 bg-surface-container-low px-2 py-1 rounded-full border border-border/40">
              <div
                onClick={() => onNavigate('settings')}
                className="flex items-center gap-2 cursor-pointer group"
                title="Open Settings"
              >
                <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary font-bold text-xs flex items-center justify-center ring-2 ring-surface-container-lowest">
                  {user.name?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div className="hidden sm:flex flex-col text-left pr-1">
                  <span className="font-label-md text-label-md text-on-surface font-semibold leading-tight group-hover:text-primary transition-colors">
                    {user.name}
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary font-medium leading-none">
                    {user.role === 'admin' ? 'Owner • Synced' : 'Member • Synced'}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer touch-manipulation"
                title="Sign out"
                aria-label="Sign out"
              >
                <IconLogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
