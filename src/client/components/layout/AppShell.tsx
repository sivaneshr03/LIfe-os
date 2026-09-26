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
    <div className="flex min-h-screen bg-background text-foreground antialiased transition-colors">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />

      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header currentView={currentView} onNavigate={onNavigate} />

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto overflow-y-auto">
          {children}
        </main>

        <BottomNav currentView={currentView} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
