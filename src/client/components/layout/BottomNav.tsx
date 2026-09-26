import React, { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../../stores/authStore';

export interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainItems = [
    { id: 'dashboard', label: 'Home', icon: '⚡' },
    { id: 'tasks', label: 'Tasks', icon: '✓' },
    { id: 'finance', label: 'Finance', icon: '💳' },
    { id: 'notes', label: 'Notes', icon: '📝' },
  ];

  const handleSelect = (id: string) => {
    onNavigate(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-t border-border z-40 flex items-center justify-around px-2"
      >
        {mainItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={twMerge(
                clsx(
                  'flex flex-col items-center justify-center w-14 h-12 rounded-token text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
                  isActive ? 'text-primary font-bold' : 'text-foreground/60 hover:text-foreground'
                )
              )}
            >
              <span className="text-lg leading-none mb-1 select-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-[10px] leading-tight">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setDrawerOpen(true)}
          className={twMerge(
            clsx(
              'flex flex-col items-center justify-center w-14 h-12 rounded-token text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
              ['admin', 'settings'].includes(currentView)
                ? 'text-primary font-bold'
                : 'text-foreground/60 hover:text-foreground'
            )
          )}
        >
          <span className="text-lg leading-none mb-1 select-none" aria-hidden="true">
            ☰
          </span>
          <span className="text-[10px] leading-tight">More</span>
        </button>
      </nav>

      {/* Slide-over Drawer for secondary actions on Mobile */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-card text-card-foreground border-t border-border rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-sm font-bold text-foreground">Menu & Areas</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-foreground/50 hover:text-foreground p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleSelect('trackers')}
                className="flex items-center gap-2 p-3 rounded-token border border-border bg-background text-sm font-medium text-left hover:bg-muted"
              >
                <span>📈</span> Habits & Trackers
              </button>
              <button
                onClick={() => handleSelect('settings')}
                className="flex items-center gap-2 p-3 rounded-token border border-border bg-background text-sm font-medium text-left hover:bg-muted"
              >
                <span>⚙️</span> Settings
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => handleSelect('admin')}
                  className="flex items-center gap-2 p-3 rounded-token border border-primary/30 bg-primary/5 text-primary text-sm font-medium text-left hover:bg-primary/10 col-span-2"
                >
                  <span>🛡️</span> Admin Panel
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-between items-center text-xs text-foreground/60">
              <span>Signed in as <strong>{user?.name}</strong></span>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                className="text-red-500 font-semibold"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
