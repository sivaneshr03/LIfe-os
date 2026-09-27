import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  return (
    <div className="relative flex min-h-dvh bg-background text-foreground antialiased transition-colors selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />

      <div className="relative z-10 flex-1 flex flex-col min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        <Header currentView={currentView} onNavigate={onNavigate} />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <div key={currentView} className="animate-fade-up">
            {children}
          </div>
        </main>

        <BottomNav currentView={currentView} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
