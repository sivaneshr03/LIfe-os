import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { IconLock } from '../ui/Icons';
import type { ApiResponse, AuthSessionData } from '../../../shared/types';

import { safeParseJson } from '../../lib/api';

export function AuthView() {
  const { setupRequired, setUser } = useAuthStore();
  const { toast } = useToast();

  const [mode, setMode] = useState<'login' | 'invite'>('login');
  const [email, setEmail] = useState(() =>
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'admin@example.com'
      : ''
  );
  const [password, setPassword] = useState(() =>
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'Administrator123'
      : ''
  );
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    let endpoint = '/api/auth/login';
    let payload: Record<string, string> = { email, password };

    if (setupRequired) {
      endpoint = '/api/auth/bootstrap';
      payload = { name, email, password };
    } else if (mode === 'invite') {
      endpoint = '/api/auth/register';
      payload = { code: inviteCode.trim(), name, password };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const { data: json, error: parseError } = await safeParseJson<ApiResponse<AuthSessionData>>(res);

      if (res.ok && json && json.success) {
        setUser(json.data.user);
        toast(
          setupRequired
            ? 'Administrator account created successfully!'
            : mode === 'invite'
            ? `Welcome to LifeOS, ${json.data.user.name}!`
            : `Welcome back, ${json.data.user.name}!`,
          'success'
        );
      } else {
        const errorMsg =
          json && !json.success && json.error?.message
            ? json.error.message
            : parseError || `Authentication request failed (${res.status}). Ensure backend worker is running.`;
        setError(errorMsg);
      }
    } catch (err) {
      setError(
        err instanceof Error && !err.message.includes('Unexpected end')
          ? err.message
          : 'Backend service unreachable. Please ensure the backend worker (npm run dev:server) is running on port 8787.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 sm:p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] bg-background relative overflow-hidden">
      {/* Ambient background light gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-card/90 backdrop-blur-2xl text-card-foreground border border-border/80 rounded-2xl sm:rounded-3xl shadow-float p-5 sm:p-8 space-y-6 glass-inner animate-scale-in">
        <div className="text-center space-y-2">
          <img
            src="/logo.png"
            alt="LifeOS Logo"
            className="w-14 h-14 rounded-2xl mx-auto object-contain shadow-lg shadow-emerald-500/20 select-none animate-breathe"
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {setupRequired
                ? 'Initialize LifeOS'
                : mode === 'invite'
                ? 'Claim Your LifeOS Invite'
                : 'Sign in to LifeOS'}
            </h1>
            <p className="text-xs text-foreground/60 max-w-xs mx-auto mt-1 leading-relaxed">
              {setupRequired
                ? 'Create the primary Administrator account for your private household instance.'
                : mode === 'invite'
                ? 'Enter your invitation code and configure your credentials.'
                : 'Private personal intelligence, ledger, and household management.'}
            </p>
          </div>
        </div>

        {/* Local Mock Mode Button (Development Only) */}
        {import.meta.env.DEV && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Local In-Memory Mock Mode Active</span>
            </div>
            <p className="text-[11px] text-foreground/60 leading-normal">
              60+ realistic dummy records preloaded. Zero backend/D1 writes. Instant preview.
            </p>
            <button
              type="button"
              onClick={() => {
                setUser({
                  id: 'usr_mock_dev',
                  email: 'admin@lifeos.local',
                  name: 'Local Dev User',
                  role: 'admin',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                toast('⚡ Entered Local Mock Mode! 60 dummy records loaded.', 'success');
              }}
              className="w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:brightness-105 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer"
            >
              <span>⚡ Enter App with 60+ Dummy Records Loaded</span>
            </button>
          </div>
        )}

        {!setupRequired && (
          <div className="flex neo-inset rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 min-h-[42px] sm:min-h-[36px] py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer touch-manipulation flex items-center justify-center neo-pill ${
                mode === 'login'
                  ? 'neo-pill-active font-bold'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('invite');
                setError(null);
              }}
              className={`flex-1 min-h-[42px] sm:min-h-[36px] py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer touch-manipulation flex items-center justify-center neo-pill ${
                mode === 'invite'
                  ? 'neo-pill-active font-bold'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Claim Invite Code
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium animate-fade-in"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'invite' && !setupRequired && (
            <Input
              label="Invitation Code"
              type="text"
              placeholder="e.g. a7f9b2c4e1d3"
              required
              autoFocus
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              hint="Paste the invite code provided by your household administrator"
            />
          )}

          {(setupRequired || mode === 'invite') && (
            <Input
              label="Your Full Name"
              type="text"
              placeholder="Alex Johnson"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          {mode === 'login' && !setupRequired && (
            <Input
              label="Email Address"
              type="email"
              placeholder="alex@example.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          {setupRequired && (
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@example.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            required
            autoComplete={setupRequired || mode === 'invite' ? 'new-password' : 'current-password'}
            hint={
              setupRequired
                ? 'Minimum 10 characters for admin accounts'
                : mode === 'invite'
                ? 'Minimum 8 characters'
                : undefined
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" isLoading={isLoading} className="w-full mt-2" size="lg">
            {setupRequired
              ? 'Complete Setup & Sign In'
              : mode === 'invite'
              ? 'Accept Invite & Join'
              : 'Sign In'}
          </Button>

          {/* Quick Local Mock Mode Demo Button (Development Only) */}
          {import.meta.env.DEV && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setUser({
                    id: 'usr_mock_dev',
                    email: 'admin@lifeos.local',
                    name: 'Local Dev User',
                    role: 'admin',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });
                  toast('Logged in to Local Mock Mode! Zero D1 writes.', 'success');
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer"
              >
                <span>⚡ Enter Local Mock Mode (Instant Demo)</span>
              </button>
            </div>
          )}
        </form>

        <footer className="text-center text-[11px] text-foreground/40 pt-4 border-t border-border/60 flex items-center justify-center gap-1.5">
          <IconLock size={12} className="text-foreground/40" />
          <span>Protected Edge Session • HttpOnly Lax Cookies</span>
        </footer>
      </div>
    </div>
  );
}
