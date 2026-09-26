import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ApiResponse, AuthSessionData } from '../../../shared/types';

export function AuthView() {
  const { setupRequired, setUser } = useAuthStore();
  const { toast } = useToast();

  const [mode, setMode] = useState<'login' | 'invite'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      const json = (await res.json()) as ApiResponse<AuthSessionData>;

      if (json.success) {
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
        setError(json.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please check network.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card text-card-foreground border border-border rounded-token shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-token bg-primary text-primary-foreground mx-auto flex items-center justify-center font-extrabold text-xl shadow-md select-none">
            L
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {setupRequired
              ? 'Initialize LifeOS'
              : mode === 'invite'
              ? 'Claim Your LifeOS Invite'
              : 'Sign in to LifeOS'}
          </h1>
          <p className="text-xs text-foreground/60 max-w-xs mx-auto">
            {setupRequired
              ? 'Welcome! Create the initial primary Administrator account for your private instance.'
              : mode === 'invite'
              ? 'Enter your invitation code and configure your account credentials.'
              : 'Private personal productivity and household management system.'}
          </p>
        </div>

        {!setupRequired && (
          <div className="flex border border-border rounded-token p-1 bg-muted/40">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-token transition-all ${
                mode === 'login'
                  ? 'bg-card text-foreground shadow-sm'
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
              className={`flex-1 py-1.5 text-xs font-semibold rounded-token transition-all ${
                mode === 'invite'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Have an Invite Code?
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-token bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium"
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
        </form>

        <footer className="text-center text-[11px] text-foreground/40 pt-4 border-t border-border">
          <span>Protected Edge Session • HttpOnly Cookies</span>
        </footer>
      </div>
    </div>
  );
}
