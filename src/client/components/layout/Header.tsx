import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { Badge } from '../ui/Badge';
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

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { themeMode, setThemeMode, toggleSidebar, toggleMobileDrawer } = useThemeStore();
  const { user, logout } = useAuthStore();

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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 bg-card/80 backdrop-blur-xl border-b border-border/70 transition-colors shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              toggleMobileDrawer();
            } else {
              toggleSidebar();
            }
          }}
          aria-label="Toggle navigation menu"
          className="flex p-2 rounded-token border border-border/80 text-foreground/70 hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer min-h-[38px] min-w-[38px] items-center justify-center touch-manipulation"
        >
          <IconMenu size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="LifeOS Logo"
            className="w-7 h-7 rounded-lg md:hidden object-contain shrink-0"
          />
          <span className="font-extrabold text-base capitalize tracking-tight text-foreground">
            {currentView}
          </span>
          {user?.role === 'admin' && (
            <Badge variant="primary" size="sm">
              Admin
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick Find Mobile Trigger */}
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          type="button"
          aria-label="Open Quick Find"
          className="sm:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground/70 hover:text-foreground rounded-token border border-border/80 bg-card/60 active:scale-95 cursor-pointer shadow-xs touch-manipulation"
        >
          <IconSearch size={18} />
        </button>

        {/* Quick Find Desktop (Ctrl+K) */}
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          type="button"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground/60 border border-border/80 rounded-token bg-background/80 hover:bg-muted hover:text-foreground transition-all duration-150 cursor-pointer shadow-xs active:scale-98 touch-manipulation"
          title="Command Palette (Ctrl+K)"
        >
          <IconSearch size={14} className="text-foreground/40" />
          <span>Quick Find</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-muted border border-border/60 rounded text-foreground/70">
            ⌘K
          </kbd>
        </button>

        {/* In-App Notifications */}
        <NotificationCenter onNavigate={onNavigate} />

        {/* Theme Cycler */}
        <button
          onClick={cycleTheme}
          type="button"
          aria-label={`Current theme: ${themeMode}. Click to toggle`}
          className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center text-foreground/70 hover:text-foreground rounded-token border border-border/80 bg-card/60 hover:bg-muted/70 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shadow-xs touch-manipulation"
          title={`Theme: ${themeMode}`}
        >
          <ThemeIcon size={18} />
        </button>

        {/* User Account / Session */}
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-border/70">
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-foreground/80 hover:text-primary transition-colors text-left px-2 py-1.5 rounded-token hover:bg-muted/60 cursor-pointer min-h-[44px] sm:min-h-[32px] flex items-center touch-manipulation"
              title="Open Settings"
            >
              <span className="block truncate max-w-[90px] sm:max-w-[120px]">{user.name}</span>
            </button>
            <button
              onClick={logout}
              className="p-2 sm:p-1.5 rounded-token border border-border/80 text-foreground/60 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-all active:scale-95 cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center touch-manipulation"
              title="Sign Out"
              aria-label="Sign out"
            >
              <IconLogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
