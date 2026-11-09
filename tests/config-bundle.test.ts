import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createDefaultConfig } from '../src/shared/config-schema';
import {
  getBundleSnapshot,
  rebuildBundleIfNeeded,
  resolveThemeAttrs,
  resolveTypographyVars
} from '../src/server/config-bundle';
import { EMBEDDED_ASSETS } from '../src/server/paths';

describe('Config bundle assembly & disk fallback', () => {
  test('EMBEDDED_ASSETS defaults to null outside compiled production build and rebuilds valid injectScript', () => {
    expect(EMBEDDED_ASSETS).toBeNull();

    const rebuiltFirst = rebuildBundleIfNeeded(true);
    expect(rebuiltFirst).toBe(true);

    // Immediate non-force call hits signature cache when files are unchanged
    const rebuiltSecond = rebuildBundleIfNeeded(false);
    expect(rebuiltSecond).toBe(false);

    const snap = getBundleSnapshot();
    expect(snap.patchVersion).toMatch(/^v\d+\.\d+\.\d+-[a-f0-9]{8}$/);
    expect(snap.cssBytes).toBeGreaterThan(10000);
    expect(snap.injectScript.length).toBeGreaterThan(20000);

    // Ensure wrapped injection payload parses cleanly in V8/Node vm
    expect(() => new vm.Script(snap.injectScript)).not.toThrow();
  });

  test('resolveTypographyVars & resolveThemeAttrs format custom font stacks and attributes cleanly', () => {
    const vars = resolveTypographyVars({
      primarySans: 'Anthropic Sans',
      customPrimarySans: '',
      fallbackSans: 'PingFang SC Regular',
      customFallbackSans: '',
      mono: 'JetBrains Mono',
      customMono: '',
      fontSize: 16
    });
    expect(vars['--ag-chat-font-size']).toBe('16px');
    expect(vars['--ag-cfg-font-sans']).toContain("'Anthropic Sans'");
    expect(vars['--ag-cfg-font-sans']).toContain("'PingFang SC Regular', 'PingFang SC'");
    expect(vars['--ag-cfg-font-mono']).toContain("'JetBrains Mono'");

    const cfg = createDefaultConfig();
    const attrs = resolveThemeAttrs(cfg);
    expect(attrs['data-ag-wax-seal']).toBe('on');
    expect(attrs['data-ag-collinear']).toBe('on');
    expect(attrs['data-ag-custom-font-size']).toBe('true');
  });

  test('theme.css overrides body[data-agy-font] --font-sans and applies custom sans stack to menus/portals/dialogs', () => {
    const css = fs.readFileSync(path.resolve(import.meta.dir, '../src/injection/theme.css'), 'utf8');

    expect(css).toContain('html[data-ag-custom-font="true"] body[data-agy-font]');
    expect(css).toContain('html[data-ag-custom-font="true"] body[data-agy-font] .font-sans');
    expect(css).toContain('html body[data-agy-font]');
    expect(css).toContain('[data-base-ui-portal]');
    expect(css).toContain('[role="listbox"]');
    expect(css).toContain('[role="menu"]');
    expect(css).toContain('[role="dialog"]');
    expect(css).not.toMatch(
      /\[role="(?:menu|dialog)"\][^}]*font-family:\s*var\(--font-sans\)\s*!important/
    );
  });
});
