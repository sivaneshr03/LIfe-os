import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ApiResponse, AuthSessionData } from '../../../shared/types';

export function AuthView() {
  const { setupRequired, setUser } = useAuthStore();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const endpoint = setupRequired ? '/api/auth/bootstrap' : '/api/auth/login';
    const payload = setupRequired ? { name, email, password } : { email, password };

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
          setupRequired ? 'Administrator account created successfully!' : `Welcome back, ${json.data.user.name}!`,
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
            {setupRequired ? 'Initialize LifeOS' : 'Sign in to LifeOS'}
          </h1>
          <p className="text-xs text-foreground/60 max-w-xs mx-auto">
            {setupRequired
              ? 'Welcome! Create the initial primary Administrator account for your private instance.'
              : 'Private personal productivity and household management system.'}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-token bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {setupRequired && (
            <Input
              label="Your Full Name"
              type="text"
              placeholder="Alex Johnson"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="alex@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            required
            autoComplete={setupRequired ? 'new-password' : 'current-password'}
            hint={setupRequired ? 'Minimum 10 characters for admin accounts' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" isLoading={isLoading} className="w-full mt-2" size="lg">
            {setupRequired ? 'Complete Setup & Sign In' : 'Sign In'}
          </Button>
        </form>

        <footer className="text-center text-[11px] text-foreground/40 pt-4 border-t border-border">
          <span>Protected Edge Session • HttpOnly Cookies</span>
        </footer>
      </div>
    </div>
  );
}
