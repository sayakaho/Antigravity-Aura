import type {
  AuraConfig,
  PanelConfigDTO,
  ResolvedRuntimeModules,
  SelectorsConfig,
  AdvancedConfig,
  ReleaseChannelOption,
  HostVariantOption
} from '../types';

export const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1',
  'https://127.0.0.1',
  'http://localhost',
  'https://localhost',
  'vscode-file://'
];

export const DEFAULT_EXPERIMENTAL_FLAGS: Record<string, boolean> = {
  'enable-developer-mode': true,
  'enable-context-usage-indicator': true,
  'enable-resource-manager': true,
  'enable-split-view': true,
  'enable-code-search-palette': true,
  'enable-trajectory-debug-tools': true,
  'labs-autonomous-mode': true,
  'labs-inline-actions': true,
  'configure-artifact-width': true,
  'enable-bottom-terminal-panel': true,
  'enable-file-explorer-tab': true,
  'enable-pane-selection-actions': true,
  'enable-input-autocomplete': true,
  'enable-file-viewer-keyboard-navigation': true,
  'enable-conversation-groups': true,
  'enable-conversation-forking': true,
  'enable-fork-at-historical-step': true,
  'enable-fork-in-new-worktree': true,
  'enable-conversation-scoped-permissions': true,
  'enable-auto-permission-preset': true,
  'enable-github-decorator': true,
  'enable-browser-subagent-webview': true,
  'enable-browser-subagent-webview-script': true,
  'enable-browser-subagent-webview-ux': true,
  'enable-battle-mode': true,
  'enable-battle-contrib-variants': true,
  'enable-conversation-selection-quoting': true,
  'enable-paste-text-as-snippet': true,
  'enable-thought-editing': true,
  'enable-thought-steering-from-selection': true,
  'enable-conversation-navigator': true,
  'enable-conversation-navigator-chapter-titles': true,
  'enable-conversation-search-v2': true,
  'enable-text-transitions': true,
  'markdown-virtualize-long-documents': true,
  'markdown-table-v2': true,
  'enable-enhanced-file-viewer': true,
  'enable-notebook-rendering': true,
  'enable-pdf-viewer': true,
  'enable-context-menu-system': true,
  'enable-browser-element-picker': true,
  'enable-composer-connectors': true,
  'enable-upload-html-artifact-to-drive': true,
  'enable-sidecar-pill-auto-open': true
};

export const DEFAULT_SELECTORS: SelectorsConfig = {
  inputBoxId: 'antigravity.agentSidePanelInputBox',
  branchPillInBox:
    '#antigravity\\.agentSidePanelInputBox [data-testid="branch-pill-trigger"], [id="antigravity.agentSidePanelInputBox"] [data-testid="branch-pill-trigger"], #antigravity\\.agentSidePanelInputBox [aria-label^="Select project"], [id="antigravity.agentSidePanelInputBox"] [aria-label^="Select project"], #antigravity\\.agentSidePanelInputBox [aria-label^="选择项目"], [id="antigravity.agentSidePanelInputBox"] [aria-label^="选择项目"]',
  homeGreeting: '[data-testid="home-greeting"]',
  excludeI18n:
    'code, pre, kbd, samp, textarea, input, style, script, noscript, [contenteditable="true"], .prose, .markdown, [class*="chat-message"], [class*="group/file-title"], [data-testid="conversation-row-sidebar"] a[href^="/c/"], [data-testid="conversation-row-sidebar"] span.truncate, #ag-live-metrics-pill, #ag-live-metrics-tooltip'
};

export function normalizeReleaseChannel(
  val: unknown,
  fallback: ReleaseChannelOption = 'stable'
): ReleaseChannelOption {
  if (typeof val !== 'string') return fallback;
  const v = val.trim().toLowerCase();
  if (v === 'dev' || v === 'dogfood' || v === 'internal' || v === 'canary' || v === 'stable') {
    return v as ReleaseChannelOption;
  }
  return fallback;
}

export function normalizeHostVariant(
  val: unknown,
  fallback: HostVariantOption = 'default'
): HostVariantOption {
  if (typeof val !== 'string') return fallback;
  const v = val.trim().toLowerCase();
  if (v === 'antigravity-ide' || v === 'default') {
    return v as HostVariantOption;
  }
  return fallback;
}

export function createDefaultConfig(): AuraConfig {
  return {
    enabled: true,
    channel: 'auto',
    language: 'default',
    presets: {
      light: 'high-contrast',
      dark: 'claude-dark'
    },
    typography: {
      primarySans: 'Anthropic Serif Web',
      fallbackSans: 'LXGW WenKai Medium',
      customPrimarySans: '',
      customFallbackSans: '',
      mono: 'Anthropic Mono',
      customMono: '',
      fontSize: 15
    },
    composer: {
      collinear: true,
      waxSeal: true,
      hideArrows: true
    },
    telemetry: {
      enabled: true,
      interval: 2000
    },
    modules: {
      deadlockHealer: true,
      customCss: true,
      customJs: true
    },
    advanced: {
      labsDeveloperMode: true,
      releaseChannel: 'stable',
      isByoa: false,
      cde: false,
      isEnterpriseDisabled: false,
      hostVariant: 'default',
      enableMicrophone: false,
      experimentalFlags: { ...DEFAULT_EXPERIMENTAL_FLAGS }
    },
    themeVars: {},
    selectors: { ...DEFAULT_SELECTORS },
    allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS]
  };
}

export function normalizeLightPreset(val: unknown, fallback = 'high-contrast'): string {
  if (typeof val !== 'string' || !val.trim()) return fallback;
  const v = val.trim();
  if (v === 'chuanban-warm-white' || v === '高对比版') return 'high-contrast';
  if (v === 'claude-desktop-official' || v === 'ClaudeDesktop 净白') return 'claude-desktop-purewhite';
  return v;
}

export function normalizeDarkPreset(val: unknown, fallback = 'claude-dark'): string {
  if (typeof val !== 'string' || !val.trim()) return fallback;
  const v = val.trim();
  if (v === 'vintage-deep' || v === 'absoulutely-chuanban' || v === '复古深色') return 'vintage-dark';
  return v;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function clampFontSize(v: unknown, fallback = 15): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(28, Math.max(10, Math.round(n)));
}

function clampInterval(v: unknown, fallback = 2000): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(30000, Math.max(500, Math.round(n)));
}

/**
 * 强类型边界校验与旧版 config.json 一次性平滑迁移：
 * 读取磁盘或外部 JSON 时将历史冗余键（preset/lightPreset/darkPreset/features/metricsCapsule）
 * 无损收敛为统一 AuraConfig。
 */
export function normalizeAuraConfig(rawInput: unknown): AuraConfig {
  const raw = asRecord(rawInput);
  const def = createDefaultConfig();

  const rawPresets = asRecord(raw.presets);
  const legacyPreset = typeof raw.preset === 'string' ? raw.preset.trim() : '';
  const rawLight = rawPresets.light ?? raw.lightPreset ?? (legacyPreset && legacyPreset !== 'vintage-deep' && legacyPreset !== 'claude-dark' && legacyPreset !== 'vintage-dark' ? legacyPreset : undefined);
  const rawDark = rawPresets.dark ?? raw.darkPreset ?? (legacyPreset === 'vintage-deep' || legacyPreset === 'absoulutely-chuanban' || legacyPreset === '复古深色' || legacyPreset === 'vintage-dark' || legacyPreset === 'claude-dark' ? legacyPreset : undefined);

  const rawTypo = asRecord(raw.typography);
  const rawComposer = asRecord(raw.composer);
  const rawTelemetry = asRecord(raw.telemetry);
  const rawModules = { ...asRecord(raw.features), ...asRecord(raw.modules) };
  const rawAdv = asRecord(raw.advanced);
  const rawFlags = asRecord(rawAdv.experimentalFlags);
  const rawThemeVars = asRecord(raw.themeVars);
  const rawSelectors = asRecord(raw.selectors);

  const legacyMetrics =
    typeof rawModules.metrics === 'boolean'
      ? rawModules.metrics
      : typeof rawModules.metricsCapsule === 'boolean'
        ? rawModules.metricsCapsule
        : def.telemetry.enabled;

  const experimentalFlags: Record<string, boolean> = { ...def.advanced.experimentalFlags };
  for (const [k, v] of Object.entries(rawFlags)) {
    if (typeof v === 'boolean' && k !== 'labs-concierge-agent' && k !== 'context-window-selector') {
      experimentalFlags[k] = v;
    }
  }

  const themeVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawThemeVars)) {
    if (typeof v === 'string' && v.trim()) themeVars[k] = v;
  }

  const channelRaw = raw.channel;
  const channel: AuraConfig['channel'] =
    channelRaw === 'light' || channelRaw === 'dark' || channelRaw === 'auto' ? channelRaw : def.channel;

  const langRaw = raw.language;
  const language: AuraConfig['language'] =
    langRaw === 'zh-CN' || langRaw === 'default'
      ? langRaw
      : rawModules.i18n === true
        ? 'zh-CN'
        : def.language;

  const contextLimitNum = Number(raw.contextLimit);

  return {
    enabled: asBool(raw.enabled, def.enabled),
    channel,
    language,
    presets: {
      light: normalizeLightPreset(rawLight, def.presets.light),
      dark: normalizeDarkPreset(rawDark, def.presets.dark)
    },
    typography: {
      primarySans: asString(rawTypo.primarySans, def.typography.primarySans),
      customPrimarySans: asString(rawTypo.customPrimarySans, ''),
      fallbackSans: asString(rawTypo.fallbackSans, def.typography.fallbackSans),
      customFallbackSans: asString(rawTypo.customFallbackSans, ''),
      mono: asString(rawTypo.mono, def.typography.mono),
      customMono: asString(rawTypo.customMono, ''),
      fontSize: clampFontSize(rawTypo.fontSize, def.typography.fontSize)
    },
    composer: {
      collinear: asBool(rawComposer.collinear, asBool(rawModules.composerCollinear, def.composer.collinear)),
      waxSeal: asBool(rawComposer.waxSeal, asBool(rawModules.composerWaxSeal, def.composer.waxSeal)),
      hideArrows: asBool(rawComposer.hideArrows, asBool(rawModules.composerHideArrows, def.composer.hideArrows))
    },
    telemetry: {
      enabled: asBool(rawTelemetry.enabled, legacyMetrics),
      interval: clampInterval(rawTelemetry.interval, def.telemetry.interval)
    },
    modules: {
      deadlockHealer: asBool(rawModules.deadlockHealer, def.modules.deadlockHealer),
      customCss: asBool(rawModules.customCss, def.modules.customCss),
      customJs: asBool(rawModules.customJs, def.modules.customJs)
    },
    advanced: {
      labsDeveloperMode: asBool(rawAdv.labsDeveloperMode, def.advanced.labsDeveloperMode),
      releaseChannel: normalizeReleaseChannel(rawAdv.releaseChannel, def.advanced.releaseChannel),
      isByoa: asBool(rawAdv.isByoa, def.advanced.isByoa),
      cde: asBool(rawAdv.cde, def.advanced.cde),
      isEnterpriseDisabled: asBool(rawAdv.isEnterpriseDisabled, def.advanced.isEnterpriseDisabled),
      hostVariant: normalizeHostVariant(rawAdv.hostVariant, def.advanced.hostVariant),
      enableMicrophone: asBool(rawAdv.enableMicrophone, def.advanced.enableMicrophone),
      experimentalFlags
    },
    themeVars,
    selectors: {
      inputBoxId: asString(rawSelectors.inputBoxId, def.selectors.inputBoxId),
      branchPillInBox: asString(rawSelectors.branchPillInBox, def.selectors.branchPillInBox),
      homeGreeting: asString(rawSelectors.homeGreeting, def.selectors.homeGreeting),
      excludeI18n: asString(rawSelectors.excludeI18n, def.selectors.excludeI18n)
    },
    allowedOrigins: Array.isArray(raw.allowedOrigins)
      ? raw.allowedOrigins.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : [...def.allowedOrigins],
    ...(Number.isFinite(contextLimitNum) && contextLimitNum > 0 ? { contextLimit: contextLimitNum } : {})
  };
}

function assertPlainObject(val: unknown, label: string): Record<string, unknown> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(`Invalid ${label}: expected JSON object`);
  }
  return val as Record<string, unknown>;
}

function assertBooleanField(obj: Record<string, unknown>, key: string, ctx: string): boolean | undefined {
  if (!(key in obj) || obj[key] === undefined) return undefined;
  if (typeof obj[key] !== 'boolean') {
    throw new Error(`Invalid ${ctx}.${key}: expected boolean`);
  }
  return obj[key] as boolean;
}

function assertStringField(obj: Record<string, unknown>, key: string, ctx: string): string | undefined {
  if (!(key in obj) || obj[key] === undefined) return undefined;
  if (typeof obj[key] !== 'string') {
    throw new Error(`Invalid ${ctx}.${key}: expected string`);
  }
  return obj[key] as string;
}

function assertFiniteNumberField(
  obj: Record<string, unknown>,
  key: string,
  ctx: string,
  min: number,
  max: number
): number | undefined {
  if (!(key in obj) || obj[key] === undefined) return undefined;
  if (typeof obj[key] !== 'number' || !Number.isFinite(obj[key])) {
    throw new Error(`Invalid ${ctx}.${key}: expected finite number`);
  }
  const n = obj[key] as number;
  if (n < min || n > max) {
    throw new Error(`Invalid ${ctx}.${key}: must be between ${min} and ${max}`);
  }
  return Math.round(n);
}

/**
 * API 边界强类型校验并合并配置补丁；遇到非法字段类型或枚举越界直接抛错拦截，拒绝静默回退。
 */
export function applyConfigPatch(current: AuraConfig, rawPatch: unknown): AuraConfig {
  const root = assertPlainObject(rawPatch, 'config patch');

  const enabled = assertBooleanField(root, 'enabled', 'config');

  let channel = current.channel;
  if ('channel' in root && root.channel !== undefined) {
    if (root.channel !== 'auto' && root.channel !== 'light' && root.channel !== 'dark') {
      throw new Error('Invalid config.channel: expected auto | light | dark');
    }
    channel = root.channel;
  }

  let language = current.language;
  if ('language' in root && root.language !== undefined) {
    if (root.language !== 'default' && root.language !== 'zh-CN') {
      throw new Error('Invalid config.language: expected default | zh-CN');
    }
    language = root.language;
  }

  const nextPresets = { ...current.presets };
  if ('presets' in root && root.presets !== undefined) {
    const pObj = assertPlainObject(root.presets, 'config.presets');
    const light = assertStringField(pObj, 'light', 'presets');
    const dark = assertStringField(pObj, 'dark', 'presets');
    if (light !== undefined) nextPresets.light = normalizeLightPreset(light, current.presets.light);
    if (dark !== undefined) nextPresets.dark = normalizeDarkPreset(dark, current.presets.dark);
  }

  const nextTypo = { ...current.typography };
  if ('typography' in root && root.typography !== undefined) {
    const tObj = assertPlainObject(root.typography, 'config.typography');
    const primarySans = assertStringField(tObj, 'primarySans', 'typography');
    const customPrimarySans = assertStringField(tObj, 'customPrimarySans', 'typography');
    const fallbackSans = assertStringField(tObj, 'fallbackSans', 'typography');
    const customFallbackSans = assertStringField(tObj, 'customFallbackSans', 'typography');
    const mono = assertStringField(tObj, 'mono', 'typography');
    const customMono = assertStringField(tObj, 'customMono', 'typography');
    const fontSize = assertFiniteNumberField(tObj, 'fontSize', 'typography', 10, 28);
    if (primarySans !== undefined) nextTypo.primarySans = primarySans;
    if (customPrimarySans !== undefined) nextTypo.customPrimarySans = customPrimarySans;
    if (fallbackSans !== undefined) nextTypo.fallbackSans = fallbackSans;
    if (customFallbackSans !== undefined) nextTypo.customFallbackSans = customFallbackSans;
    if (mono !== undefined) nextTypo.mono = mono;
    if (customMono !== undefined) nextTypo.customMono = customMono;
    if (fontSize !== undefined) nextTypo.fontSize = fontSize;
  }

  const nextComposer = { ...current.composer };
  if ('composer' in root && root.composer !== undefined) {
    const cObj = assertPlainObject(root.composer, 'config.composer');
    const collinear = assertBooleanField(cObj, 'collinear', 'composer');
    const waxSeal = assertBooleanField(cObj, 'waxSeal', 'composer');
    const hideArrows = assertBooleanField(cObj, 'hideArrows', 'composer');
    if (collinear !== undefined) nextComposer.collinear = collinear;
    if (waxSeal !== undefined) nextComposer.waxSeal = waxSeal;
    if (hideArrows !== undefined) nextComposer.hideArrows = hideArrows;
  }

  const nextTelemetry = { ...current.telemetry };
  if ('telemetry' in root && root.telemetry !== undefined) {
    const tmObj = assertPlainObject(root.telemetry, 'config.telemetry');
    const tmEnabled = assertBooleanField(tmObj, 'enabled', 'telemetry');
    const interval = assertFiniteNumberField(tmObj, 'interval', 'telemetry', 500, 30000);
    if (tmEnabled !== undefined) nextTelemetry.enabled = tmEnabled;
    if (interval !== undefined) nextTelemetry.interval = interval;
  }

  const nextModules = { ...current.modules };
  if ('modules' in root && root.modules !== undefined) {
    const mObj = assertPlainObject(root.modules, 'config.modules');
    const deadlockHealer = assertBooleanField(mObj, 'deadlockHealer', 'modules');
    const customCss = assertBooleanField(mObj, 'customCss', 'modules');
    const customJs = assertBooleanField(mObj, 'customJs', 'modules');
    if (deadlockHealer !== undefined) nextModules.deadlockHealer = deadlockHealer;
    if (customCss !== undefined) nextModules.customCss = customCss;
    if (customJs !== undefined) nextModules.customJs = customJs;
  }

  const nextAdv: AdvancedConfig = {
    ...current.advanced,
    experimentalFlags: { ...current.advanced.experimentalFlags }
  };
  if ('advanced' in root && root.advanced !== undefined) {
    const aObj = assertPlainObject(root.advanced, 'config.advanced');
    const labsDeveloperMode = assertBooleanField(aObj, 'labsDeveloperMode', 'advanced');
    if (labsDeveloperMode !== undefined) nextAdv.labsDeveloperMode = labsDeveloperMode;
    if ('releaseChannel' in aObj && aObj.releaseChannel !== undefined) {
      nextAdv.releaseChannel = normalizeReleaseChannel(aObj.releaseChannel, nextAdv.releaseChannel);
    }
    const isByoa = assertBooleanField(aObj, 'isByoa', 'advanced');
    if (isByoa !== undefined) nextAdv.isByoa = isByoa;
    const cde = assertBooleanField(aObj, 'cde', 'advanced');
    if (cde !== undefined) nextAdv.cde = cde;
    const isEnterpriseDisabled = assertBooleanField(aObj, 'isEnterpriseDisabled', 'advanced');
    if (isEnterpriseDisabled !== undefined) nextAdv.isEnterpriseDisabled = isEnterpriseDisabled;
    if ('hostVariant' in aObj && aObj.hostVariant !== undefined) {
      nextAdv.hostVariant = normalizeHostVariant(aObj.hostVariant, nextAdv.hostVariant);
    }
    const enableMicrophone = assertBooleanField(aObj, 'enableMicrophone', 'advanced');
    if (enableMicrophone !== undefined) nextAdv.enableMicrophone = enableMicrophone;
    if ('experimentalFlags' in aObj && aObj.experimentalFlags !== undefined) {
      const fObj = assertPlainObject(aObj.experimentalFlags, 'advanced.experimentalFlags');
      for (const [k, v] of Object.entries(fObj)) {
        if (typeof v !== 'boolean') {
          throw new Error(`Invalid advanced.experimentalFlags.${k}: expected boolean`);
        }
        if (k !== 'labs-concierge-agent' && k !== 'context-window-selector') {
          nextAdv.experimentalFlags[k] = v;
        }
      }
    }
  }

  const nextThemeVars = { ...current.themeVars };
  if ('themeVars' in root && root.themeVars !== undefined) {
    const tvObj = assertPlainObject(root.themeVars, 'config.themeVars');
    for (const [k, v] of Object.entries(tvObj)) {
      if (v === null || v === '') {
        delete nextThemeVars[k];
      } else if (typeof v === 'string') {
        nextThemeVars[k] = v;
      } else {
        throw new Error(`Invalid themeVars.${k}: expected string`);
      }
    }
  }

  const nextSelectors = { ...current.selectors };
  if ('selectors' in root && root.selectors !== undefined) {
    const sObj = assertPlainObject(root.selectors, 'config.selectors');
    for (const key of ['inputBoxId', 'branchPillInBox', 'homeGreeting', 'excludeI18n'] as const) {
      const v = assertStringField(sObj, key, 'selectors');
      if (v !== undefined) nextSelectors[key] = v;
    }
  }

  let nextContextLimit = current.contextLimit;
  if ('contextLimit' in root && root.contextLimit !== undefined) {
    nextContextLimit = assertFiniteNumberField(root, 'contextLimit', 'config', 1000, 10_000_000);
  }

  return {
    ...current,
    ...(enabled !== undefined ? { enabled } : {}),
    channel,
    language,
    presets: nextPresets,
    typography: nextTypo,
    composer: nextComposer,
    telemetry: nextTelemetry,
    modules: nextModules,
    advanced: nextAdv,
    themeVars: nextThemeVars,
    selectors: nextSelectors,
    ...(nextContextLimit !== undefined ? { contextLimit: nextContextLimit } : {})
  };
}

export function resolveRuntimeModules(cfg: AuraConfig, hasSqlite = true): ResolvedRuntimeModules {
  return {
    i18n: cfg.language === 'zh-CN',
    metrics: cfg.telemetry.enabled && hasSqlite,
    composerWaxSeal: cfg.composer.waxSeal,
    composerCollinear: cfg.composer.collinear,
    composerHideArrows: cfg.composer.hideArrows,
    deadlockHealer: cfg.modules.deadlockHealer,
    customCss: cfg.modules.customCss,
    customJs: cfg.modules.customJs
  };
}

export const DEFAULT_CONTEXT_LIMIT_TOKENS = 256000;

export function resolveContextLimitTokens(cfg: AuraConfig): number {
  if (typeof cfg.contextLimit === 'number' && cfg.contextLimit > 0) {
    return cfg.contextLimit;
  }
  return DEFAULT_CONTEXT_LIMIT_TOKENS;
}

export function toPanelConfigDTO(cfg: AuraConfig): PanelConfigDTO {
  return {
    language: cfg.language,
    presets: cfg.presets,
    typography: cfg.typography,
    composer: cfg.composer,
    telemetry: cfg.telemetry,
    modules: cfg.modules,
    advanced: cfg.advanced
  };
}
