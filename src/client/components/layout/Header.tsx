import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { Badge } from '../ui/Badge';

export interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { themeMode, setThemeMode, toggleSidebar } = useThemeStore();
  const { user, logout } = useAuthStore();

  const cycleTheme = () => {
    if (themeMode === 'system') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('light');
    else setThemeMode('system');
  };

  const themeIcon = {
    system: '💻',
    light: '☀️',
    dark: '🌙',
  }[themeMode];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-card/90 backdrop-blur-md border-b border-border transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          aria-label="Toggle sidebar collapse"
          className="hidden md:flex p-1.5 rounded-token border border-border text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        >
          ☰
        </button>
        <span className="font-bold text-base capitalize tracking-tight text-foreground">
          {currentView}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user?.role === 'admin' && (
          <Badge variant="primary">Admin</Badge>
        )}

        <button
          onClick={cycleTheme}
          type="button"
          aria-label={`Current theme: ${themeMode}. Click to toggle`}
          className="p-1.5 text-sm rounded-token border border-border bg-background hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          title={`Theme: ${themeMode}`}
        >
          {themeIcon}
        </button>

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-foreground/80 hover:text-primary transition-colors text-left"
              title="Open Settings"
            >
              <span className="block font-semibold truncate max-w-[120px]">{user.name}</span>
            </button>
            <button
              onClick={logout}
              className="text-xs px-2 py-1 rounded-token border border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors"
              title="Sign Out"
            >
              Exit
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
