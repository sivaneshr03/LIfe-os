import React, { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { AccentColor, Density, FontSize, BorderRadius, ReducedMotion, ThemeMode, ApiResponse } from '../../../shared/types';

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
    setThemeMode,
    setAccentColor,
    setFontSize,
    setDensity,
    setBorderRadius,
    setReducedMotion,
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

      const json = (await res.json()) as ApiResponse<{ message: string }>;

      if (json.success) {
        toast('Password updated successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPasswordError(json.error.message);
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
      <section className="bg-card text-card-foreground border border-border rounded-token p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-foreground">Theme & Appearance</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Select your color scheme and global accent tone.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Color Scheme</label>
            <div className="grid grid-cols-3 gap-2.5 max-w-sm">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleThemeChange(mode)}
                  className={`px-3 py-2 text-xs font-semibold rounded-token border capitalize transition-all ${
                    themeMode === mode
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {mode === 'system' ? '💻 System' : mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-2">Global Accent Color</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 max-w-lg">
              {ACCENTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleAccentChange(acc.id)}
                  className={`flex items-center gap-2 p-2 rounded-token border text-xs font-medium transition-all ${
                    accentColor === acc.id
                      ? 'border-primary ring-2 ring-primary/30 font-bold'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${acc.colorClass} shadow-sm`} />
                  <span>{acc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Density, Typography & Radius */}
      <section className="bg-card text-card-foreground border border-border rounded-token p-6 space-y-6">
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
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-token border capitalize transition-all ${
                    density === d
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted'
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
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-token border capitalize transition-all ${
                    fontSize === s
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted'
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
                  className={`py-1.5 px-2 text-xs font-medium border capitalize transition-all ${
                    r === 'none' ? 'rounded-none' : r === 'small' ? 'rounded-sm' : r === 'medium' ? 'rounded-md' : 'rounded-lg'
                  } ${
                    borderRadius === r
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted'
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
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-token border capitalize transition-all ${
                    reducedMotion === m
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {m === 'reduce' ? 'Always Reduce' : m === 'system' ? 'Follow OS' : 'Enable Motion'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Password Change */}
      <section className="bg-card text-card-foreground border border-border rounded-token p-6 space-y-4 max-w-xl">
        <div>
          <h3 className="text-sm font-bold text-foreground">Security & Password</h3>
          <p className="text-xs text-foreground/60 mt-0.5">Update your account authentication credentials.</p>
        </div>

        {passwordError && (
          <div role="alert" className="p-3 text-xs rounded-token bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
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

          <Button type="submit" isLoading={isUpdatingPassword} size="sm">
            Update Password
          </Button>
        </form>
      </section>
    </div>
  );
}
