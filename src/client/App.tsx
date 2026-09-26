import React, { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { ToastProvider } from './components/ui/Toast';
import { LoadingState } from './components/ui/States';
import { AppShell } from './components/layout/AppShell';
import { AuthView } from './components/views/AuthView';
import { DashboardView } from './components/views/DashboardView';
import { SettingsView } from './components/views/SettingsView';
import { AdminView } from './components/views/AdminView';

export function App() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { applyToDom } = useThemeStore();
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    applyToDom();
    checkAuth();
  }, [applyToDom, checkAuth]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Connecting to secure edge session..." />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <AuthView />
      </ToastProvider>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'settings':
        return <SettingsView />;
      case 'admin':
        return <AdminView onNavigate={setCurrentView} />;
      case 'tasks':
      case 'finance':
      case 'notes':
      case 'trackers':
        return (
          <div className="p-8 border border-dashed border-border rounded-token bg-card text-center space-y-2">
            <h3 className="text-base font-bold capitalize">{currentView} Module</h3>
            <p className="text-xs text-foreground/60 max-w-sm mx-auto">
              This domain module will be implemented sequentially in the upcoming phase per the approved architecture plan.
            </p>
          </div>
        );
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <ToastProvider>
      <AppShell currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </AppShell>
    </ToastProvider>
  );
}
