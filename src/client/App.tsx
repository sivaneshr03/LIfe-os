import React, { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { ToastProvider, useToast } from './components/ui/Toast';
import { LoadingState } from './components/ui/States';
import { AppShell } from './components/layout/AppShell';
import { AuthView } from './components/views/AuthView';
import { DashboardView } from './components/views/DashboardView';
import { SettingsView } from './components/views/SettingsView';
import { AdminView } from './components/views/AdminView';
import { TasksView } from './components/views/TasksView';
import { FinanceView } from './components/views/FinanceView';
import { InvestmentsView } from './components/views/InvestmentsView';
import { NotesView } from './components/views/NotesView';
import { TrackersView } from './components/views/TrackersView';
import { CommandPalette } from './components/ui/CommandPalette';
import { IconAlertTriangle } from './components/ui/Icons';

function AppContent() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { applyToDom } = useThemeStore();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    applyToDom();
    checkAuth();
  }, [applyToDom, checkAuth]);

  // Online / Offline network listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast('Network connection restored. Online mode active.', 'success');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast('You are offline. Showing cached read-only view.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleSwUpdate = () => {
      toast('New version of LifeOS is available. Refresh to update.', 'info');
    };
    window.addEventListener('lifeos:sw-update', handleSwUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('lifeos:sw-update', handleSwUpdate);
    };
  }, [toast]);

  // Global Command Palette shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <LoadingState message="Connecting to secure edge session..." />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'tasks':
        return <TasksView />;
      case 'finance':
        return <FinanceView />;
      case 'investments':
        return <InvestmentsView />;
      case 'notes':
        return <NotesView />;
      case 'trackers':
        return <TrackersView />;
      case 'settings':
        return <SettingsView />;
      case 'admin':
        return <AdminView onNavigate={setCurrentView} />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      {/* Offline Status Ambient Banner */}
      {isOffline && (
        <div className="bg-amber-500/90 text-slate-950 px-4 py-1.5 text-xs font-semibold text-center sticky top-0 z-50 flex items-center justify-center gap-2 shadow-md">
          <IconAlertTriangle size={15} className="text-slate-950 shrink-0" />
          <span>Offline Mode Active — Viewing cached data. Financial writes are disabled.</span>
        </div>
      )}

      <AppShell currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </AppShell>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setCurrentView}
      />
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
