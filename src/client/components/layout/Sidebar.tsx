import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import {
  IconDashboard,
  IconCheckSquare,
  IconCreditCard,
  IconPayments,
  IconTrendingUp,
  IconFileText,
  IconTarget,
  IconChefHat,
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

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard size={19} /> },
  { id: 'tasks', label: 'Tasks & Projects', icon: <IconCheckSquare size={19} /> },
  { id: 'finance', label: 'Finance & Ledger', icon: <IconCreditCard size={19} /> },
  { id: 'lending', label: 'Lending & Payees', icon: <IconPayments size={19} /> },
  { id: 'investments', label: 'Investments & Portfolio', icon: <IconTrendingUp size={19} /> },
  { id: 'notes', label: 'Notes & AI Prompts', icon: <IconFileText size={19} /> },
  { id: 'trackers', label: 'Habits & Fitness', icon: <IconTarget size={19} /> },
  { id: 'culinary', label: 'Cooking & Culinary', icon: <IconChefHat size={19} /> },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
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

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => !item.adminOnly || user?.role === 'admin');

  const visiblePrimary = filterItems(PRIMARY_NAV_ITEMS);
  const visibleSecondary = filterItems(SECONDARY_NAV_ITEMS);

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

  const renderNavButton = (item: NavItem) => {
    const isActive = currentView === item.id;
    return (
      <div key={item.id} className="relative group/nav">
        <button
          onClick={() => handleItemClick(item.id)}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          className={twMerge(
            clsx(
              'font-title-sm text-title-sm rounded-xl cursor-pointer select-none',
              'transition-all duration-200 ease-in-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              sidebarCollapsed
                ? 'w-11 h-11 mx-auto flex items-center justify-center p-0'
                : 'w-full flex items-center gap-3 px-3 py-2 text-left',
              isActive
                ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface active:scale-[0.98]'
            )
          )}
        >
          <span
            className={twMerge(
              clsx(
                'shrink-0 flex items-center justify-center transition-all duration-200 ease-in-out',
                isActive
                  ? 'text-on-primary-container'
                  : 'text-outline group-hover/nav:text-on-surface group-hover/nav:scale-105'
              )
            )}
            aria-hidden="true"
          >
            {item.icon}
          </span>

          {!sidebarCollapsed && (
            <span className="truncate tracking-tight font-medium">
              {item.label}
            </span>
          )}
        </button>

        {/* Sleek Floating Tooltip for Icon-Only Mode */}
        {sidebarCollapsed && (
          <div
            role="tooltip"
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-surface-container-lowest text-on-surface text-xs font-semibold rounded-lg shadow-float border border-border/80 whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 group-focus-visible/nav:opacity-100 group-focus-visible/nav:translate-x-0 transition-all duration-200 ease-in-out z-50 flex items-center gap-2"
          >
            <span>{item.label}</span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
            )}
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/80" />
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-container-lowest" />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP COCKPIT SIDEBAR                                                */}
      {/* ========================================================================= */}
      <aside
        aria-label="Sidebar navigation"
        className={twMerge(
          clsx(
            'hidden md:flex flex-col border-r border-border/70 bg-surface-container-lowest text-on-surface',
            'sticky top-0 h-dvh max-h-dvh z-40 shrink-0 select-none shadow-[0_1px_8px_rgba(0,0,0,0.03)]',
            'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            sidebarCollapsed ? 'w-[72px]' : 'w-64'
          )
        )}
      >
        {/* Brand Header */}
        <div
          className={twMerge(
            clsx(
              'flex items-center h-16 border-b border-border/60 transition-all duration-300 bg-surface-container-lowest',
              sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
            )
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => onNavigate('dashboard')}
              aria-label="Go to Dashboard"
              className="p-1 rounded-xl hover:bg-surface-container transition-transform active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative group/brand"
            >
              <img
                src="/logo.png"
                alt="LifeOS Logo"
                className="w-8 h-8 rounded-xl object-contain shadow-sm ring-1 ring-border/50 shrink-0"
              />
              {sidebarCollapsed && (
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-surface-container-lowest text-on-surface text-xs font-bold rounded-lg shadow-float border border-border/80 whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover/brand:opacity-100 group-hover/brand:translate-x-0 transition-all duration-150 ease-out z-50 flex items-center gap-1.5"
                >
                  <span>LifeOS</span>
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/80" />
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-container-lowest" />
                </div>
              )}
            </button>

            {!sidebarCollapsed && (
              <div className="flex flex-col leading-none min-w-0 transition-opacity duration-200">
                <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
                  Life<span className="text-primary">OS</span>
                </span>
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-semibold">
                  {user?.name || 'User'}
                </span>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar (Ctrl+B)"
              title="Collapse sidebar (Ctrl+B)"
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer"
            >
              <IconChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav
          className={twMerge(
            clsx(
              'flex-1 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-none',
              sidebarCollapsed ? 'p-2' : 'px-3 py-2'
            )
          )}
        >
          {visiblePrimary.map(renderNavButton)}

          {/* Module Divider */}
          <div className="my-2 h-px bg-surface-container" />

          {visibleSecondary.map(renderNavButton)}
        </nav>

        {/* Sidebar Footer: Household Node Telemetry */}
        <div className="p-3 border-t border-border/60 bg-surface-container-lowest">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleSidebar}
                aria-label="Expand sidebar (Ctrl+B)"
                className="w-10 h-10 flex items-center justify-center rounded-xl text-outline hover:text-on-surface hover:bg-surface-container transition-all active:scale-95 cursor-pointer relative group/expander"
              >
                <IconChevronRight size={18} />
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-surface-container-lowest text-on-surface text-xs font-semibold rounded-lg shadow-float border border-border/80 whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover/expander:opacity-100 group-hover/expander:translate-x-0 transition-all duration-200 z-50 flex items-center gap-1.5"
                >
                  <span>Expand Sidebar</span>
                  <kbd className="text-[10px] font-label-caps px-1 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    ⌘B
                  </kbd>
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/80" />
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-container-lowest" />
                </div>
              </button>

              <span
                className="w-2 h-2 rounded-full bg-secondary ring-4 ring-secondary-container/40 my-1"
                title="Household Node • Healthy"
                aria-label="Household Node Online"
              />
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-xl p-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-secondary ring-4 ring-secondary-container/40" />
                  <span className="font-label-caps text-label-caps text-on-surface font-semibold">
                    Household Node
                  </span>
                </div>
                <span className="font-label-caps text-label-caps bg-surface-container-highest px-1.5 py-0.5 rounded text-on-surface-variant font-mono">
                  ⌘B
                </span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant pt-0.5">
                <span className="font-body-sm text-body-sm truncate text-outline">
                  Cloudflare Edge + D1
                </span>
                <span className="font-label-caps text-label-caps text-secondary font-medium">
                  Healthy
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE DRAWER: Bento Slide-Out Navigation                              */}
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
          <div className="relative w-72 max-w-[85vw] h-full bg-surface-container-lowest text-on-surface border-r border-border/80 flex flex-col shadow-float z-10 animate-slide-right pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="LifeOS Logo"
                  className="w-8 h-8 rounded-xl object-contain shadow-sm"
                />
                <div className="flex flex-col leading-none">
                  <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
                    Life<span className="text-primary">OS</span>
                  </span>
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-semibold">
                    {user?.name || 'User'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation drawer"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container active:scale-95 touch-manipulation"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visiblePrimary.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={twMerge(
                      clsx(
                        'w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 font-title-sm text-title-sm rounded-xl text-left active:scale-[0.98] touch-manipulation',
                        'transition-all duration-200 ease-in-out cursor-pointer',
                        isActive
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      )
                    )}
                  >
                    <span className={isActive ? 'text-on-primary-container' : 'text-outline'} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              <div className="my-2 h-px bg-surface-container" />

              {visibleSecondary.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={twMerge(
                      clsx(
                        'w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 font-title-sm text-title-sm rounded-xl text-left active:scale-[0.98] touch-manipulation',
                        'transition-all duration-200 ease-in-out cursor-pointer',
                        isActive
                          ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      )
                    )}
                  >
                    <span className={isActive ? 'text-on-primary-container' : 'text-outline'} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Drawer Footer with Session & Signout */}
            <div className="p-4 border-t border-border/60 bg-surface-container-low space-y-3">
              {user && (
                <div className="flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-on-surface truncate">{user.name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate capitalize">
                      {user.role}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      logout();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 font-semibold transition-colors touch-manipulation min-h-[44px]"
                  >
                    <IconLogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between text-on-surface-variant pt-1 border-t border-border/40">
                <span className="flex items-center gap-1.5 font-label-caps text-label-caps">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  Cloudflare Edge + D1
                </span>
                <span className="font-mono text-[10px]">Healthy</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
