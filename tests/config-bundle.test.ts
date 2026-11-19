import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createDefaultConfig } from '../src/shared/config-schema';
import {
  getBundleSnapshot,
  rebuildBundleIfNeeded,
  resolveThemeAttrs,
  resolveTypographyVars,
  saveConfigPatch
} from '../src/server/config-bundle';
import { EMBEDDED_ASSETS, readCssWithImportsSafe } from '../src/server/paths';

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
    const css = readCssWithImportsSafe(path.resolve(import.meta.dir, '../src/injection/theme.css'), '');

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

  test('patchVersion changes uniquely across language transitions to prevent injection short-circuiting', () => {
    saveConfigPatch({ language: 'zh-CN' });
    const snapZh = getBundleSnapshot();
    const verZh = snapZh.patchVersion;

    saveConfigPatch({ language: 'ja-JP' });
    const snapJa = getBundleSnapshot();
    const verJa = snapJa.patchVersion;

    saveConfigPatch({ language: 'ko-KR' });
    const snapKo = getBundleSnapshot();
    const verKo = snapKo.patchVersion;

    saveConfigPatch({ language: 'default' });
    const snapEn = getBundleSnapshot();
    const verEn = snapEn.patchVersion;

    // 关键回归防线：不同语言的 patchVersion 必须互不相同，杜绝宿主端因相同版本号短路 return
    expect(verZh).not.toBe(verJa);
    expect(verJa).not.toBe(verKo);
    expect(verKo).not.toBe(verEn);
    expect(verZh).not.toBe(verEn);
  });
});
