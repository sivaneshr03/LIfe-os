import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  return (
    <div className="relative flex min-h-dvh bg-background text-foreground antialiased transition-colors selection:bg-primary/20 selection:text-primary overflow-x-clip">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />

      <div className="relative z-10 flex-1 flex flex-col min-w-0 max-w-full pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-8 overflow-x-clip">
        <Header currentView={currentView} onNavigate={onNavigate} />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto overflow-x-clip">
          <div key={currentView} className="animate-fade-up">
            <ErrorBoundary key={currentView}>
              {children}
            </ErrorBoundary>
          </div>
        </main>

        <BottomNav currentView={currentView} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
