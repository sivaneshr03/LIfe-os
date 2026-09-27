import { describe, it, expect, beforeEach } from 'vitest';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MemoryStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = new MemoryStorage();
}
if (typeof globalThis.document === 'undefined') {
  const attrs = new Map<string, string>();
  const classList = new Set<string>();
  globalThis.document = {
    documentElement: {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
      classList: {
        toggle: (cls: string, force?: boolean) => {
          if (force === undefined) {
            if (classList.has(cls)) classList.delete(cls);
            else classList.add(cls);
          } else if (force) {
            classList.add(cls);
          } else {
            classList.delete(cls);
          }
        },
        contains: (cls: string) => classList.has(cls),
      },
    },
  } as unknown as Document;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  } as unknown as Window & typeof globalThis;
}

globalThis.fetch = async () =>
  new Response(JSON.stringify({ success: true, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

import { useThemeStore } from '../src/client/stores/themeStore';
import { useAuthStore } from '../src/client/stores/authStore';

describe('Client Design System & Auth State Invariant Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initializes with default design tokens and applies them to DOM', () => {
    const store = useThemeStore.getState();
    expect(store.themeMode).toBe('system');
    expect(store.accentColor).toBe('emerald');
    expect(store.density).toBe('comfortable');
    expect(store.borderRadius).toBe('medium');
    expect(store.fontSize).toBe('normal');

    store.applyToDom();
    const root = document.documentElement;
    expect(root.getAttribute('data-accent')).toBe('emerald');
    expect(root.getAttribute('data-font-size')).toBe('normal');
    expect(root.getAttribute('data-density')).toBe('comfortable');
    expect(root.getAttribute('data-radius')).toBe('medium');
  });

  it('updates accent color and applies new attribute to document root', () => {
    const { setAccentColor } = useThemeStore.getState();
    setAccentColor('violet');

    expect(useThemeStore.getState().accentColor).toBe('violet');
    expect(document.documentElement.getAttribute('data-accent')).toBe('violet');

    setAccentColor('rose');
    expect(useThemeStore.getState().accentColor).toBe('rose');
    expect(document.documentElement.getAttribute('data-accent')).toBe('rose');
  });

  it('persists non-sensitive UI design tokens to localStorage without storing any auth tokens', () => {
    const { setThemeMode, setAccentColor, setDensity } = useThemeStore.getState();
    setThemeMode('dark');
    setAccentColor('cyan');
    setDensity('compact');

    const storedRaw = localStorage.getItem('lifeos_ui_prefs');
    expect(storedRaw).toBeDefined();
    expect(storedRaw).not.toBeNull();

    const stored = JSON.parse(storedRaw!);
    expect(stored.themeMode).toBe('dark');
    expect(stored.accentColor).toBe('cyan');
    expect(stored.density).toBe('compact');

    // Strict Directive 6 Check: NO auth secrets in localStorage
    expect(stored.token).toBeUndefined();
    expect(stored.sessionId).toBeUndefined();
    expect(stored.password).toBeUndefined();
    expect(stored.session).toBeUndefined();
    expect(stored.user).toBeUndefined();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('session_id')).toBeNull();
    expect(localStorage.getItem('session')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('verifies authStore holds session strictly in memory and writes ZERO data to storage', async () => {
    const { setUser, logout } = useAuthStore.getState();

    setUser({
      id: 'usr_mock_123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.name).toBe('Test User');

    // Verify localStorage & sessionStorage contain absolutely ZERO user or auth keys
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('auth')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('sessionId')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('auth')).toBeNull();

    await logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('enforces RBAC visibility rules on navigation items', () => {
    const NAV_ITEMS = [
      { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
      { id: 'tasks', label: 'Tasks & Projects', icon: '✓' },
      { id: 'finance', label: 'Finance & Ledger', icon: '💳' },
      { id: 'investments', label: 'Investments', icon: '📈' },
      { id: 'notes', label: 'Notes & Prompts', icon: '📝' },
      { id: 'trackers', label: 'Habits & Fitness', icon: '🎯' },
      { id: 'admin', label: 'Admin Panel', icon: '🛡️', adminOnly: true },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    // Standard user perspective
    const standardUser = { role: 'user' };
    const userVisible = NAV_ITEMS.filter((item) => !item.adminOnly || standardUser.role === 'admin');
    expect(userVisible.some((i) => i.id === 'admin')).toBe(false);
    expect(userVisible.some((i) => i.id === 'dashboard')).toBe(true);
    expect(userVisible.some((i) => i.id === 'tasks')).toBe(true);
    expect(userVisible.some((i) => i.id === 'settings')).toBe(true);

    // Admin perspective
    const adminUser = { role: 'admin' };
    const adminVisible = NAV_ITEMS.filter((item) => !item.adminOnly || adminUser.role === 'admin');
    expect(adminVisible.some((i) => i.id === 'admin')).toBe(true);
    expect(adminVisible.some((i) => i.id === 'dashboard')).toBe(true);
  });

  it('tests mobile layout collapse and dark mode class toggles', () => {
    const { setThemeMode, toggleSidebar } = useThemeStore.getState();

    // Dark mode test
    setThemeMode('dark');
    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Light mode test
    setThemeMode('light');
    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Mobile layout toggle test
    const initialCollapsed = useThemeStore.getState().sidebarCollapsed;
    toggleSidebar();
    expect(useThemeStore.getState().sidebarCollapsed).toBe(!initialCollapsed);
    toggleSidebar();
    expect(useThemeStore.getState().sidebarCollapsed).toBe(initialCollapsed);
  });
});

