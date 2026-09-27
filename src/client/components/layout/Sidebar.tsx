import React, { useEffect } from 'react';
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
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconLogOut,
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
  const { sidebarCollapsed, toggleSidebar, mobileDrawerOpen, setMobileDrawerOpen } = useThemeStore();
  const { user, logout } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'admin');

  // Global keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (mobileDrawerOpen) {
      setMobileDrawerOpen(false);
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR: Sticky, Smooth Width Transition, Icon-Only or Expanded */}
      {/* ========================================================================= */}
      <aside
        aria-label="Sidebar navigation"
        className={twMerge(
          clsx(
            'hidden md:flex flex-col border-r border-border/80 bg-card/85 backdrop-blur-2xl text-card-foreground',
            'sticky top-0 h-screen max-h-screen z-40 shrink-0 select-none shadow-xs',
            'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            sidebarCollapsed ? 'w-[72px]' : 'w-64'
          )
        )}
      >
        {/* Brand Header */}
        <div
          className={twMerge(
            clsx(
              'flex items-center h-16 border-b border-border/60 transition-all duration-300',
              sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
            )
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => onNavigate('dashboard')}
              aria-label="Go to Dashboard"
              className="p-1 rounded-xl hover:bg-muted/70 transition-transform active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative group/brand"
            >
              <img
                src="/logo.png"
                alt="LifeOS Logo"
                className="w-8 h-8 rounded-xl object-contain shadow-sm shadow-primary/25 ring-1 ring-border/50 shrink-0"
              />
              {sidebarCollapsed && (
                <div
                  role="tooltip"
                  className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-popover/95 text-popover-foreground text-xs font-bold rounded-lg shadow-float border border-border/80 backdrop-blur-md whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover/brand:opacity-100 group-hover/brand:translate-x-0 transition-all duration-150 ease-out z-50 flex items-center gap-1.5"
                >
                  <span>LifeOS</span>
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/80" />
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-popover" />
                </div>
              )}
            </button>

            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0 transition-opacity duration-200">
                <span className="font-extrabold text-base tracking-tight text-foreground truncate">
                  Life<span className="text-primary">OS</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-foreground/40 font-mono">
                  Sivanesh
                </span>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar (Ctrl+B)"
              title="Collapse sidebar (Ctrl+B)"
              className="p-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-muted/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer"
            >
              <IconChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav
          className={twMerge(
            clsx(
              'flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none',
              sidebarCollapsed ? 'p-2' : 'p-3'
            )
          )}
        >
          {visibleItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <div key={item.id} className="relative group/nav">
                <button
                  onClick={() => handleItemClick(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={twMerge(
                    clsx(
                      'text-xs font-semibold rounded-xl cursor-pointer select-none',
                      'transition-all duration-200 ease-in-out',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      sidebarCollapsed
                        ? 'w-11 h-11 mx-auto flex items-center justify-center p-0'
                        : 'w-full flex items-center gap-3 px-3.5 py-2.5 text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 font-bold ring-1 ring-primary/40'
                        : 'text-foreground/60 hover:text-foreground hover:bg-muted/80 dark:hover:bg-neutral-800/80 hover:shadow-xs active:scale-[0.97]'
                    )
                  )}
                >
                  <span
                    className={twMerge(
                      clsx(
                        'shrink-0 flex items-center justify-center transition-all duration-200 ease-in-out',
                        isActive
                          ? 'text-primary-foreground'
                          : 'text-foreground/45 dark:text-neutral-400 group-hover/nav:text-primary group-hover/nav:scale-110'
                      )
                    )}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  {!sidebarCollapsed && (
                    <span
                      className={twMerge(
                        clsx(
                          'truncate tracking-tight transition-all duration-200 ease-in-out',
                          isActive
                            ? 'text-primary-foreground font-bold'
                            : 'text-foreground/70 group-hover/nav:text-foreground'
                        )
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </button>

                {/* Sleek Floating Tooltip for Icon-Only Mode */}
                {sidebarCollapsed && (
                  <div
                    role="tooltip"
                    className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover/95 text-popover-foreground text-xs font-semibold rounded-lg shadow-float border border-border/80 backdrop-blur-md whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 group-focus-visible/nav:opacity-100 group-focus-visible/nav:translate-x-0 transition-all duration-200 ease-in-out z-50 flex items-center gap-2"
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                    )}
                    {/* Tooltip Arrow pointing back to icon */}
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/80" />
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-popover" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/60 bg-muted/20">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleSidebar}
                aria-label="Expand sidebar (Ctrl+B)"
                className="w-11 h-11 flex items-center justify-center rounded-xl text-foreground/50 hover:text-foreground hover:bg-muted/80 dark:hover:bg-neutral-800/80 transition-all duration-200 ease-in-out active:scale-95 cursor-pointer relative group/expander"
              >
                <span className="shrink-0 transition-all duration-200 ease-in-out group-hover/expander:text-primary group-hover/expander:scale-110">
                  <IconChevronRight size={18} />
                </span>
                <div
                  role="tooltip"
                  className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-popover/95 text-popover-foreground text-xs font-semibold rounded-lg shadow-float border border-border/80 backdrop-blur-md whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover/expander:opacity-100 group-hover/expander:translate-x-0 transition-all duration-200 ease-in-out z-50 flex items-center gap-1.5"
                >
                  <span>Expand Sidebar</span>
                  <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted text-foreground/60 border border-border/60">
                    Ctrl+B
                  </kbd>
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/80" />
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-popover" />
                </div>
              </button>

              <div
                className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse my-1"
                title="Household App • Online"
                aria-label="Online"
              />
            </div>
          ) : (
            <div className="text-[11px] text-foreground/50 space-y-2">
              <div className="flex items-center justify-between font-semibold text-foreground/70">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Household App</span>
                </div>
                <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted/80 text-foreground/50 border border-border/50">
                  Ctrl+B
                </kbd>
              </div>
              <p className="font-mono text-[10px] text-foreground/40">Cloudflare Edge + D1</p>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE DRAWER: Full Slide-Out Navigation for Small Screens              */}
      {/* ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-card/95 backdrop-blur-2xl text-card-foreground border-r border-border/80 flex flex-col shadow-float z-10 animate-slide-right">
            {/* Drawer Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="LifeOS Logo"
                  className="w-8 h-8 rounded-xl object-contain shadow-sm shadow-primary/20"
                />
                <div className="flex flex-col">
                  <span className="font-extrabold text-base tracking-tight text-foreground">
                    Life<span className="text-primary">OS</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-foreground/40 font-mono">
                    Sivanesh
                  </span>
                </div>
              </div>

              <button
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation drawer"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted active:scale-95 touch-manipulation"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
              {visibleItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={twMerge(
                      clsx(
                        'w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-xl text-left active:scale-[0.98] touch-manipulation group/mob',
                        'transition-all duration-200 ease-in-out cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 font-bold ring-1 ring-primary/40'
                          : 'text-foreground/75 hover:text-foreground hover:bg-muted/80 dark:hover:bg-neutral-800/80'
                      )
                    )}
                  >
                    <span
                      className={twMerge(
                        clsx(
                          'shrink-0 flex items-center justify-center transition-all duration-200 ease-in-out',
                          isActive
                            ? 'text-primary-foreground'
                            : 'text-foreground/50 dark:text-neutral-400 group-hover/mob:text-primary group-hover/mob:scale-110'
                        )
                      )}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Drawer Footer with Session & Signout */}
            <div className="p-4 border-t border-border/60 bg-muted/20 space-y-3">
              {user && (
                <div className="flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-[11px] text-foreground/50 truncate capitalize">{user.role}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      logout();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 font-semibold transition-colors touch-manipulation min-h-[40px]"
                  >
                    <IconLogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-foreground/45 pt-1 border-t border-border/40">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Cloudflare Edge
                </span>
                <span className="font-mono">v0.1.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
