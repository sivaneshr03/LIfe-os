import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Manifest & Safe Service Worker Offline Configuration Suite', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('PWA Web App Manifest Specification', () => {
    it('manifest.json exists and is valid JSON', () => {
      const manifestPath = path.join(rootDir, 'public', 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = fs.readFileSync(manifestPath, 'utf8');
      const json = JSON.parse(content);
      expect(json.name).toBe('LifeOS: Private Household Intelligence');
      expect(json.short_name).toBe('LifeOS');
      expect(json.display).toBe('standalone');
      expect(json.start_url).toBe('/');
      expect(json.scope).toBe('/');
      expect(json.background_color).toBe('#090d16');
      expect(json.theme_color).toBe('#10b981');
      expect(Array.isArray(json.icons)).toBe(true);
      expect(json.icons.length).toBeGreaterThanOrEqual(1);
    });

    it('manifest includes quick app shortcuts for key domains', () => {
      const manifestPath = path.join(rootDir, 'public', 'manifest.json');
      const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(Array.isArray(json.shortcuts)).toBe(true);
      expect(json.shortcuts.length).toBeGreaterThanOrEqual(4);

      const shortcutUrls = json.shortcuts.map((s: { url: string }) => s.url);
      expect(shortcutUrls).toContain('/tasks');
      expect(shortcutUrls).toContain('/finance');
      expect(shortcutUrls).toContain('/notes');
      expect(shortcutUrls).toContain('/trackers');
    });
  });

  describe('Service Worker Offline Caching & API Bypass Rules', () => {
    it('sw.js exists and implements strict network-only bypass for /api/ routes', () => {
      const swPath = path.join(rootDir, 'public', 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf8');
      // Verify API routes are bypassed
      expect(swContent).toContain("url.pathname.startsWith('/api/')");
      expect(swContent).toContain("event.request.method !== 'GET'");
      // Verify app shell precaching
      expect(swContent).toContain('PRECACHE_ASSETS');
      expect(swContent).toContain('/index.html');
      // Verify navigation fallback
      expect(swContent).toContain("event.request.mode === 'navigate'");
    });

    it('HTML shell links correctly to manifest and icon svg', () => {
      const htmlPath = path.join(rootDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      expect(html).toContain('rel="manifest"');
      expect(html).toContain('href="/manifest.json"');
      expect(html).toContain('href="/icon.svg"');
    });
  });
});
