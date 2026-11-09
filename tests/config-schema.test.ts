import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyConfigPatch,
  createDefaultConfig,
  DEFAULT_EXPERIMENTAL_FLAGS,
  normalizeAuraConfig,
  resolveContextLimitTokens
} from '../src/shared/config-schema';

describe('AuraConfig schema normalization & patch validation', () => {
  test('normalizeAuraConfig cleanly migrates legacy config keys and strips deprecated flags', () => {
    const migrated = normalizeAuraConfig({
      enabled: true,
      language: undefined,
      preset: 'vintage-deep',
      typography: { fontSize: 16 },
      modules: {
        i18n: true,
        metrics: false,
        composerWaxSeal: false,
        composerCollinear: false,
        composerHideArrows: false,
        deadlockHealer: false
      },
      advanced: {
        contextWindowSelector: true,
        defaultContextWindow: '512k',
        experimentalFlags: {
          'labs-concierge-agent': true,
          'context-window-selector': true,
          'enable-split-view': false
        }
      }
    });

    expect(migrated.language).toBe('zh-CN');
    expect(migrated.presets.dark).toBe('vintage-dark');
    expect(migrated.telemetry.enabled).toBe(false);
    expect(migrated.composer).toEqual({
      waxSeal: false,
      collinear: false,
      hideArrows: false
    });
    expect(migrated.modules.deadlockHealer).toBe(false);
    expect(migrated.advanced.experimentalFlags['labs-concierge-agent']).toBeUndefined();
    expect(migrated.advanced.experimentalFlags['context-window-selector']).toBeUndefined();
    expect(migrated.advanced.experimentalFlags['enable-split-view']).toBe(false);
    expect('contextWindowSelector' in (migrated.advanced as unknown as Record<string, unknown>)).toBe(false);
    expect('defaultContextWindow' in (migrated.advanced as unknown as Record<string, unknown>)).toBe(false);
    expect(resolveContextLimitTokens(migrated)).toBe(256000);
    expect('preset' in (migrated as unknown as Record<string, unknown>)).toBe(false);
  });

  test('normalizeAuraConfig safely ingests live user config.json when present (read-only)', () => {
    const livePath = path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'plugin_data',
      'aura-dashboard',
      'config.json'
    );
    if (!fs.existsSync(livePath)) return;

    const raw = JSON.parse(fs.readFileSync(livePath, 'utf8'));
    const normalized = normalizeAuraConfig(raw);
    expect(['auto', 'light', 'dark']).toContain(normalized.channel);
    expect(['default', 'zh-CN']).toContain(normalized.language);
    expect(normalized.typography.fontSize).toBeGreaterThanOrEqual(10);
    expect(normalized.typography.fontSize).toBeLessThanOrEqual(28);
    expect(normalized.telemetry.interval).toBeGreaterThanOrEqual(500);
  });

  test('applyConfigPatch merges valid partial updates and rejects malformed input strictly', () => {
    const base = createDefaultConfig();
    const updated = applyConfigPatch(base, {
      language: 'zh-CN',
      presets: { dark: 'vintage-deep' },
      composer: { waxSeal: false },
      typography: { fontSize: 17 }
    });

    expect(updated.language).toBe('zh-CN');
    expect(updated.presets.dark).toBe('vintage-dark');
    expect(updated.presets.light).toBe('high-contrast');
    expect(updated.composer.waxSeal).toBe(false);
    expect(updated.composer.collinear).toBe(true);
    expect(updated.typography.fontSize).toBe(17);

    expect(() => applyConfigPatch(base, null)).toThrow();
    expect(() => applyConfigPatch(base, { channel: 'invalid' })).toThrow();
    expect(() => applyConfigPatch(base, { language: 'fr' })).toThrow();
    expect(() => applyConfigPatch(base, { typography: { fontSize: 99 } })).toThrow();
    expect(() => applyConfigPatch(base, { telemetry: { interval: 100 } })).toThrow();
    expect(() => applyConfigPatch(base, { composer: { waxSeal: 'yes' } })).toThrow();
  });

  test('DEFAULT_EXPERIMENTAL_FLAGS matches preset config.json and preserves default desktop feature flags', () => {
    const presetPath = path.resolve(import.meta.dir, '../src/presets/config.json');
    const presetRaw = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
    expect(presetRaw.advanced.experimentalFlags).toEqual(DEFAULT_EXPERIMENTAL_FLAGS);

    const merged = normalizeAuraConfig({
      advanced: {
        labsDeveloperMode: true,
        experimentalFlags: {
          'enable-split-view': false
        }
      }
    });
    expect(merged.advanced.experimentalFlags['enable-split-view']).toBe(false);
    expect(merged.advanced.experimentalFlags['enable-bottom-terminal-panel']).toBe(true);
    expect(merged.advanced.experimentalFlags['enable-conversation-groups']).toBe(true);
    expect(merged.advanced.experimentalFlags['enable-browser-subagent-webview']).toBe(true);
  });
});
