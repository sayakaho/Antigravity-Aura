import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  applyConfigPatch,
  createDefaultConfig,
  normalizeAuraConfig,
  resolveRuntimeModules
} from '../shared/config-schema';
import type {
  AuraConfig,
  BootPayload,
  ResolvedRuntimeModules,
  TypographyConfig
} from '../types';
import {
  CORE_DIR,
  EMBEDDED_ASSETS,
  USER_DIR,
  getAppVersion,
  getFileMtimeSig,
  readJsonSafe,
  readTextSafe
} from './paths';
import { hasSqlite } from './sqlite-proto';

const execFileAsync = promisify(execFile);

const CURATED_FALLBACK_FONTS = [
  'Anthropic Sans',
  'Anthropic Mono',
  'Sarasa UI SC',
  '更纱黑体 UI SC',
  'Sarasa Mono Slab SC',
  '等距更纱黑体 Slab SC',
  'PingFang SC',
  'LXGW WenKai',
  'JetBrains Mono',
  'Fira Code'
];

let cachedSystemFonts: string[] | null = null;
let cachedBundleSig = '';
let cachedInjectScript = '';
let cachedPatchVersion = '';
let currentCssBytes = 0;
let activeConfig: AuraConfig = createDefaultConfig();

export interface BundleStateSnapshot {
  injectScript: string;
  patchVersion: string;
  cssBytes: number;
  config: AuraConfig;
  modules: ResolvedRuntimeModules;
}

export function getActiveConfig(): AuraConfig {
  return activeConfig;
}

export function getBundleSnapshot(): BundleStateSnapshot {
  return {
    injectScript: cachedInjectScript,
    patchVersion: cachedPatchVersion,
    cssBytes: currentCssBytes,
    config: activeConfig,
    modules: resolveRuntimeModules(activeConfig, hasSqlite())
  };
}

function normalizeOverrideDict(rawObj: unknown): Record<string, string> {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) return {};
  const obj = rawObj as Record<string, unknown>;
  const source =
    obj.exact && typeof obj.exact === 'object' && !Array.isArray(obj.exact)
      ? (obj.exact as Record<string, unknown>)
      : obj;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string') clean[k] = v;
  }
  return clean;
}

export function resolveTypographyVars(typography: Partial<TypographyConfig> = {}): Record<string, string> {
  const primaryKey = (typography.primarySans || 'default').trim();
  const fallbackKey = (typography.fallbackSans || 'default').trim();
  const isCustomSans = primaryKey !== 'default' || fallbackKey !== 'default';

  let fullSans = '';
  if (isCustomSans) {
    let primarySans = '';
    if (primaryKey === 'default') {
      primarySans = 'system-ui, -apple-system, BlinkMacSystemFont';
    } else if (primaryKey === 'custom') {
      primarySans = (typography.customPrimarySans || '').trim() || 'system-ui';
    } else {
      primarySans = `'${primaryKey.replace(/'/g, '')}'`;
    }

    let fallbackSans = '';
    if (fallbackKey === 'default') {
      fallbackSans = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei'";
    } else if (fallbackKey === 'custom') {
      fallbackSans = (typography.customFallbackSans || '').trim() || "'PingFang SC'";
    } else {
      const cleanKey = fallbackKey.replace(/'/g, '');
      const baseKey = cleanKey
        .replace(/\s+(Regular|Medium|Bold|Light|Thin|SemiBold|Heavy|Black|W[0-9]+)$/i, '')
        .trim();
      fallbackSans =
        baseKey && baseKey !== cleanKey ? `'${cleanKey}', '${baseKey}'` : `'${cleanKey}'`;
    }

    fullSans = `${primarySans}, ${fallbackSans}, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  }

  const monoKey = (typography.mono || 'default').trim();
  const isCustomMono = monoKey !== 'default';
  let mono = '';
  if (isCustomMono) {
    if (monoKey === 'custom') {
      mono = `${(typography.customMono || '').trim() || 'ui-monospace'}, ui-monospace, monospace`;
    } else {
      mono = `'${monoKey.replace(/'/g, '')}', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`;
    }
  }

  const fontSize = Number(typography.fontSize) || 15;
  const fontSizePx = `${fontSize}px`;

  return {
    '--ag-cfg-chat-font-size': fontSizePx,
    '--ag-chat-font-size': fontSizePx,
    '--ag-cfg-font-sans': isCustomSans ? fullSans : '',
    '--font-sans': isCustomSans ? fullSans : '',
    '--ag-cfg-font-mono': isCustomMono ? mono : ''
  };
}

export function resolveThemeAttrs(cfg: AuraConfig): Record<string, string | null> {
  const isCustomSans =
    cfg.typography.primarySans.trim() !== 'default' ||
    cfg.typography.fallbackSans.trim() !== 'default';
  const isCustomMono = cfg.typography.mono.trim() !== 'default';

  return {
    'data-ag-wax-seal': cfg.composer.waxSeal ? 'on' : 'off',
    'data-ag-collinear': cfg.composer.collinear ? 'on' : 'off',
    'data-ag-hide-arrows': cfg.composer.hideArrows ? 'on' : 'off',
    'data-ag-light-preset': cfg.presets.light,
    'data-ag-dark-preset': cfg.presets.dark,
    'data-ag-custom-font': isCustomSans ? 'true' : null,
    'data-ag-custom-mono': isCustomMono ? 'true' : null,
    'data-ag-custom-font-size': 'true'
  };
}

export function rebuildBundleIfNeeded(force = false): boolean {
  const coreSig = EMBEDDED_ASSETS
    ? `embedded:${getAppVersion()}`
    : [
        path.join(CORE_DIR, 'theme.css'),
        path.join(CORE_DIR, 'i18n.json'),
        path.join(CORE_DIR, 'runtime.js')
      ]
        .map(getFileMtimeSig)
        .join('|');
  const userFiles = [
    path.join(USER_DIR, 'config.json'),
    path.join(USER_DIR, 'custom.css'),
    path.join(USER_DIR, 'i18n.override.json'),
    path.join(USER_DIR, 'custom.js')
  ];

  const sig = `${coreSig}|${userFiles.map(getFileMtimeSig).join('|')}`;
  if (!force && sig === cachedBundleSig && cachedInjectScript) {
    return false;
  }

  const rawUserCfg = readJsonSafe<unknown>(path.join(USER_DIR, 'config.json'), {});
  const normalizedCfg = normalizeAuraConfig(rawUserCfg);
  const modules = resolveRuntimeModules(normalizedCfg, hasSqlite());

  const typoVars = resolveTypographyVars(normalizedCfg.typography);
  const mergedThemeVars: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...typoVars, ...normalizedCfg.themeVars })) {
    if (v) mergedThemeVars[k] = v;
  }
  activeConfig = { ...normalizedCfg, themeVars: mergedThemeVars };

  const baseCss = EMBEDDED_ASSETS
    ? EMBEDDED_ASSETS.coreThemeCss
    : readTextSafe(path.join(CORE_DIR, 'theme.css'), '');
  const customCss = modules.customCss ? readTextSafe(path.join(USER_DIR, 'custom.css'), '') : '';
  currentCssBytes = Buffer.byteLength(baseCss, 'utf8') + Buffer.byteLength(customCss, 'utf8');

  let mergedDict: Record<string, string> = {};
  if (modules.i18n) {
    const baseDict = EMBEDDED_ASSETS
      ? EMBEDDED_ASSETS.coreI18n
      : readJsonSafe<Record<string, string>>(path.join(CORE_DIR, 'i18n.json'), {});
    const rawOverride = readJsonSafe<unknown>(path.join(USER_DIR, 'i18n.override.json'), {});
    mergedDict = { ...baseDict, ...normalizeOverrideDict(rawOverride) };
  }

  const customJs = modules.customJs ? readTextSafe(path.join(USER_DIR, 'custom.js'), '') : '';
  const runtimeTemplate = EMBEDDED_ASSETS
    ? EMBEDDED_ASSETS.coreRuntimeJs
    : readTextSafe(path.join(CORE_DIR, 'runtime.js'), '');

  const hash = crypto
    .createHash('sha256')
    .update(String(normalizedCfg.enabled))
    .update(runtimeTemplate)
    .update(baseCss)
    .update(customCss)
    .update(JSON.stringify(mergedDict))
    .update(customJs)
    .update(
      JSON.stringify({
        presets: normalizedCfg.presets,
        modules,
        themeVars: mergedThemeVars,
        selectors: normalizedCfg.selectors,
        advanced: normalizedCfg.advanced
      })
    )
    .digest('hex')
    .slice(0, 8);

  cachedPatchVersion = `v${getAppVersion()}-${hash}`;

  const bootPayload: BootPayload = {
    version: cachedPatchVersion,
    platform: process.platform,
    enabled: normalizedCfg.enabled,
    language: normalizedCfg.language,
    themeMode: normalizedCfg.channel,
    preset: normalizedCfg.presets.light,
    presets: normalizedCfg.presets,
    cssText: baseCss,
    customCss,
    themeVars: mergedThemeVars,
    advanced: normalizedCfg.advanced,
    i18nDict: mergedDict,
    modules,
    selectors: normalizedCfg.selectors,
    config: activeConfig,
    customJs
  };

  const payloadJson = JSON.stringify(bootPayload);
  cachedInjectScript = runtimeTemplate.includes('})(__AG_BOOT_PAYLOAD__);')
    ? runtimeTemplate.replace('})(__AG_BOOT_PAYLOAD__);', () => `})(${payloadJson});`)
    : `(function(){globalThis.__AG_BOOT_PAYLOAD__=${payloadJson};try{\n${runtimeTemplate}\n}finally{try{delete globalThis.__AG_BOOT_PAYLOAD__;}catch{}}})();`;

  cachedBundleSig = sig;
  return true;
}

export function loadAndNormalizeDiskConfig(): AuraConfig {
  const raw = readJsonSafe<unknown>(path.join(USER_DIR, 'config.json'), {});
  return normalizeAuraConfig(raw);
}

export function saveConfigPatch(rawPatch: unknown): {
  nextConfig: AuraConfig;
  bundleChanged: boolean;
  languageChanged: boolean;
} {
  const userCfgPath = path.join(USER_DIR, 'config.json');
  const prevConfig = loadAndNormalizeDiskConfig();
  const nextConfig = applyConfigPatch(prevConfig, rawPatch);
  const languageChanged = prevConfig.language !== nextConfig.language;

  const tmpPath = `${userCfgPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(nextConfig, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, userCfgPath);

  const bundleChanged = rebuildBundleIfNeeded(true);
  return { nextConfig: activeConfig, bundleChanged, languageChanged };
}

export async function getSystemFonts(
  queryHostFonts: () => Promise<string[]>
): Promise<string[]> {
  if (cachedSystemFonts && cachedSystemFonts.length > 0) {
    return cachedSystemFonts;
  }

  const fontSet = new Set<string>(CURATED_FALLBACK_FONTS);

  try {
    const hostFonts = await queryHostFonts();
    for (const f of hostFonts) {
      if (f) fontSet.add(f);
    }
  } catch {
    // Non-fatal: host window may not expose queryLocalFonts
  }

  try {
    const { stdout } = await execFileAsync('fc-list', [':', 'family'], {
      encoding: 'utf8',
      timeout: 1500
    });
    const fcFonts = stdout
      .split('\n')
      .flatMap((line) => line.split(','))
      .map((f) => f.trim())
      .filter((f) => f && !f.startsWith('.'));
    for (const f of fcFonts) fontSet.add(f);
  } catch {
    // Non-fatal: fc-list is optional on systems without fontconfig
  }

  cachedSystemFonts = Array.from(fontSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  return cachedSystemFonts;
}
