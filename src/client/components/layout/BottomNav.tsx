import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../../stores/authStore';
import {
  IconDashboard,
  IconCheckSquare,
  IconCreditCard,
  IconFileText,
  IconMenu,
  IconTarget,
  IconSettings,
  IconShield,
  IconX,
  IconLogOut,
} from '../ui/Icons';

export interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard size={20} /> },
    { id: 'tasks', label: 'Tasks', icon: <IconCheckSquare size={20} /> },
    { id: 'finance', label: 'Finance', icon: <IconCreditCard size={20} /> },
    { id: 'notes', label: 'Notes', icon: <IconFileText size={20} /> },
  ];

  const handleSelect = (id: string) => {
    onNavigate(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Floating Cockpit Pill Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 h-16 bg-surface-container-lowest/90 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-float z-40 flex items-center justify-around px-2"
      >
        {mainItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={twMerge(
                clsx(
                  'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] rounded-xl text-xs transition-all duration-150 active:scale-90 cursor-pointer touch-manipulation',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                )
              )}
            >
              <span className="shrink-0 mb-0.5" aria-hidden="true">
                {item.icon}
              </span>
              <span className="font-label-caps text-[10px] tracking-tight leading-none">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-sm" />
              )}
            </button>
          );
        })}

        <button
          onClick={() => setDrawerOpen(true)}
          className={twMerge(
            clsx(
              'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] rounded-xl text-xs transition-all duration-150 active:scale-90 cursor-pointer touch-manipulation',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              ['admin', 'settings', 'trackers', 'investments'].includes(currentView)
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            )
          )}
        >
          <span className="shrink-0 mb-0.5" aria-hidden="true">
            <IconMenu size={20} />
          </span>
          <span className="font-label-caps text-[10px] tracking-tight leading-none">More</span>
          {['admin', 'settings', 'trackers', 'investments'].includes(currentView) && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-sm" />
          )}
        </button>
      </nav>

      {/* Slide-over Drawer for secondary actions on Mobile */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-sm animate-fade-in">
          <div
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-surface-container-lowest text-on-surface border-t border-border/80 rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-float animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="LifeOS Logo" className="w-6 h-6 rounded-lg object-contain" />
                <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
                  LifeOS
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-outline hover:text-on-surface p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-surface-container touch-manipulation"
                aria-label="Close menu"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => handleSelect('trackers')}
                className="flex items-center gap-2.5 p-3.5 min-h-[48px] rounded-xl border border-border/70 bg-surface-container-low text-xs font-semibold text-left hover:bg-surface-container active:scale-98 transition-all touch-manipulation"
              >
                <IconTarget size={18} className="text-primary" />
                <span className="font-title-sm text-title-sm">Habits & Trackers</span>
              </button>
              <button
                onClick={() => handleSelect('investments')}
                className="flex items-center gap-2.5 p-3.5 min-h-[48px] rounded-xl border border-border/70 bg-surface-container-low text-xs font-semibold text-left hover:bg-surface-container active:scale-98 transition-all touch-manipulation"
              >
                <IconCreditCard size={18} className="text-secondary" />
                <span className="font-title-sm text-title-sm">Investments</span>
              </button>
              <button
                onClick={() => handleSelect('settings')}
                className="flex items-center gap-2.5 p-3.5 min-h-[48px] rounded-xl border border-border/70 bg-surface-container-low text-xs font-semibold text-left hover:bg-surface-container active:scale-98 transition-all touch-manipulation"
              >
                <IconSettings size={18} className="text-outline" />
                <span className="font-title-sm text-title-sm">Settings</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => handleSelect('admin')}
                  className="flex items-center gap-2.5 p-3.5 min-h-[48px] rounded-xl border border-primary/30 bg-primary-fixed/40 text-primary text-xs font-bold text-left hover:bg-primary-fixed/60 active:scale-98 transition-all touch-manipulation"
                >
                  <IconShield size={18} />
                  <span className="font-title-sm text-title-sm">Admin Panel</span>
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-border/60 flex justify-between items-center text-xs text-on-surface-variant">
              <span>Signed in as <strong className="text-on-surface">{user?.name}</strong></span>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                className="text-rose-500 font-semibold inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] rounded-lg hover:bg-rose-500/10 touch-manipulation cursor-pointer"
              >
                <IconLogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
