import React, { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { AccentColor, Density, FontSize, BorderRadius, ReducedMotion, ThemeMode, ApiResponse } from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

const ACCENTS: { id: AccentColor; label: string; colorClass: string }[] = [
  { id: 'emerald', label: 'Emerald', colorClass: 'bg-emerald-500' },
  { id: 'indigo', label: 'Indigo', colorClass: 'bg-indigo-500' },
  { id: 'violet', label: 'Violet', colorClass: 'bg-violet-500' },
  { id: 'amber', label: 'Amber', colorClass: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', colorClass: 'bg-rose-500' },
  { id: 'cyan', label: 'Cyan', colorClass: 'bg-cyan-500' },
];

export function SettingsView() {
  const {
    themeMode,
    accentColor,
    fontSize,
    density,
    borderRadius,
    reducedMotion,
    baseCurrency,
    setThemeMode,
    setAccentColor,
    setFontSize,
    setDensity,
    setBorderRadius,
    setReducedMotion,
    setBaseCurrency,
  } = useThemeStore();

  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const savePreferences = async (patch: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        toast('Preferences saved', 'success');
      }
    } catch {
      // Ignored for offline/optimistic
    }
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    savePreferences({ themeMode: mode });
  };

  const handleAccentChange = (color: AccentColor) => {
    setAccentColor(color);
    savePreferences({ accentColor: color });
  };

  const handleFontChange = (size: FontSize) => {
    setFontSize(size);
    savePreferences({ fontSize: size });
  };

  const handleDensityChange = (d: Density) => {
    setDensity(d);
    savePreferences({ density: d });
  };

  const handleRadiusChange = (r: BorderRadius) => {
    setBorderRadius(r);
    savePreferences({ borderRadius: r });
  };

  const handleMotionChange = (m: ReducedMotion) => {
    setReducedMotion(m);
    savePreferences({ reducedMotion: m });
  };

  const handleCurrencyChange = (currency: string) => {
    setBaseCurrency(currency);
    savePreferences({ baseCurrency: currency });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPassword(true);
    setPasswordError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const { data: json, error: parseError } = await safeParseJson<ApiResponse<{ message: string }>>(res);

      if (res.ok && json && json.success) {
        toast('Password updated successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        const errorMsg =
          json && !json.success && json.error?.message
            ? json.error.message
            : parseError || 'Failed to update password';
        setPasswordError(errorMsg);
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Global Preferences & Settings</h2>
        <p className="text-xs text-foreground/60 mt-0.5">
          Customize design tokens, typography scale, information density, and security credentials.
        </p>
      </div>

      {/* Theme Mode & Accents */}
      <section className="bg-card/70 backdrop-blur-sm text-card-foreground border border-border/80 rounded-2xl p-4 sm:p-6 space-y-6 glass-inner shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground">Theme & Appearance</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Select your color scheme and global accent tone.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Color Scheme</label>
            <div className="grid grid-cols-3 gap-2.5 max-w-sm">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleThemeChange(mode)}
                  className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-semibold rounded-xl border capitalize transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                    themeMode === mode
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs'
                      : 'border-border/80 text-foreground/80 hover:bg-muted/50'
                  }`}
                >
                  {mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Global Accent Color</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 max-w-lg">
              {ACCENTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleAccentChange(acc.id)}
                  className={`min-h-[44px] sm:min-h-[38px] flex items-center justify-center sm:justify-start gap-2 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer touch-manipulation ${
                    accentColor === acc.id
                      ? 'border-primary ring-2 ring-primary/30 font-bold bg-primary/10 shadow-xs'
                      : 'border-border/80 hover:bg-muted/50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${acc.colorClass} shadow-xs shrink-0`} />
                  <span className="truncate">{acc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Density, Typography & Radius */}
      <section className="bg-card/70 backdrop-blur-sm text-card-foreground border border-border/80 rounded-2xl p-4 sm:p-6 space-y-6 glass-inner shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground">Layout & Design Tokens</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Control layout compactness, corner rounding, and accessibility.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Information Density</label>
            <div className="flex gap-2">
              {(['compact', 'comfortable', 'spacious'] as Density[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDensityChange(d)}
                  className={`flex-1 min-h-[44px] sm:min-h-[38px] py-2 px-2 sm:px-3 text-xs font-semibold rounded-xl border capitalize transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                    density === d
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30'
                      : 'border-border/80 hover:bg-muted/50 text-foreground/80'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Font Size Scaling</label>
            <div className="flex gap-2">
              {(['small', 'normal', 'large'] as FontSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleFontChange(s)}
                  className={`flex-1 min-h-[44px] sm:min-h-[38px] py-2 px-2 sm:px-3 text-xs font-semibold rounded-xl border capitalize transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                    fontSize === s
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30'
                      : 'border-border/80 hover:bg-muted/50 text-foreground/80'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Border Radius</label>
            <div className="grid grid-cols-4 gap-2">
              {(['none', 'small', 'medium', 'large'] as BorderRadius[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRadiusChange(r)}
                  className={`min-h-[44px] sm:min-h-[38px] py-2 px-2 text-xs font-semibold border capitalize transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                    r === 'none' ? 'rounded-none' : r === 'small' ? 'rounded-md' : r === 'medium' ? 'rounded-xl' : 'rounded-2xl'
                  } ${
                    borderRadius === r
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30'
                      : 'border-border/80 hover:bg-muted/50 text-foreground/80'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Reduced Motion</label>
            <div className="flex gap-2">
              {(['system', 'reduce', 'no-preference'] as ReducedMotion[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMotionChange(m)}
                  className={`flex-1 min-h-[44px] sm:min-h-[38px] py-2 px-2 text-xs font-semibold rounded-xl border capitalize transition-all cursor-pointer touch-manipulation flex items-center justify-center text-center ${
                    reducedMotion === m
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30'
                      : 'border-border/80 hover:bg-muted/50 text-foreground/80'
                  }`}
                >
                  {m === 'reduce' ? 'Reduced' : m === 'system' ? 'System' : 'Standard'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Currency & Financial Preferences */}
      <section className="bg-card/70 backdrop-blur-sm text-card-foreground border border-border/80 rounded-2xl p-4 sm:p-6 space-y-6 glass-inner shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground">Currency & Localization</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Select your primary display currency for financial accounts, budgets, and investments.</p>
        </div>

        <div className="max-w-md">
          <label className="block text-xs font-semibold text-foreground/80 mb-2">Base Currency</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {[
              { code: 'INR', label: 'INR (₹)' },
              { code: 'USD', label: 'USD ($)' },
              { code: 'EUR', label: 'EUR (€)' },
              { code: 'GBP', label: 'GBP (£)' },
              { code: 'CAD', label: 'CAD ($)' },
              { code: 'JPY', label: 'JPY (¥)' },
            ].map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCurrencyChange(c.code)}
                className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-semibold rounded-xl border font-mono transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                  (baseCurrency || 'INR') === c.code
                    ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs font-bold'
                    : 'border-border/80 text-foreground/80 hover:bg-muted/50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Password Change */}
      <section className="bg-card/70 backdrop-blur-sm text-card-foreground border border-border/80 rounded-2xl p-4 sm:p-6 space-y-4 max-w-xl glass-inner shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground">Security & Password</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Update your account authentication credentials.</p>
        </div>

        {passwordError && (
          <div role="alert" className="p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label="New Password"
            type="password"
            required
            hint="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Button type="submit" isLoading={isUpdatingPassword} size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center">
            Update Password
          </Button>
        </form>
      </section>
    </div>
  );
}
