/**
 * Aura Dashboard · Core Contract Types
 */

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends Record<string, any>
      ? DeepPartial<T[K]>
      : T[K];
};

export type LightPreset = 'high-contrast' | 'claude-desktop-purewhite' | 'default' | string;
export type DarkPreset = 'claude-dark' | 'vintage-dark' | 'default' | string;

export interface PresetConfig {
  light: LightPreset;
  dark: DarkPreset;
}

export interface ComposerConfig {
  waxSeal: boolean;
  collinear: boolean;
  hideArrows: boolean;
}

export interface TypographyConfig {
  primarySans: string;
  customPrimarySans: string;
  fallbackSans: string;
  customFallbackSans: string;
  mono: string;
  customMono: string;
  fontSize: number;
}

export interface TelemetryConfig {
  enabled: boolean;
  interval: number;
}

export interface ModulesConfig {
  deadlockHealer: boolean;
  customCss: boolean;
  customJs: boolean;
}

export interface ResolvedRuntimeModules extends ModulesConfig {
  i18n: boolean;
  metrics: boolean;
  composerWaxSeal: boolean;
  composerCollinear: boolean;
  composerHideArrows: boolean;
}

export interface AdvancedConfig {
  labsDeveloperMode: boolean;
  experimentalFlags: Record<string, boolean>;
}

export interface SelectorsConfig {
  inputBoxId: string;
  branchPillInBox: string;
  homeGreeting: string;
  excludeI18n: string;
}

export interface AuraConfig {
  enabled: boolean;
  channel: 'auto' | 'light' | 'dark';
  language: 'default' | 'zh-CN';
  presets: PresetConfig;
  composer: ComposerConfig;
  typography: TypographyConfig;
  telemetry: TelemetryConfig;
  modules: ModulesConfig;
  advanced: AdvancedConfig;
  themeVars: Record<string, string>;
  selectors: SelectorsConfig;
  allowedOrigins: string[];
  /** Optional explicit context token limit override (defaults to 256,000) */
  contextLimit?: number;
}

export interface PanelConfigDTO {
  language: AuraConfig['language'];
  presets: PresetConfig;
  typography: TypographyConfig;
  composer: ComposerConfig;
  telemetry: TelemetryConfig;
  modules: ModulesConfig;
  advanced: AdvancedConfig;
}

export interface ConversationStepMetric {
  idx: number;
  inTok: number;
  outTok: number;
  cacheRead: number;
  ctx: number;
  thinkTok: number;
  respTok: number;
  ttft: number;
  stream: number;
  totDur: number;
}

export interface ConversationSummary {
  conversationId: string;
  title: string;
  stepCount: number;
  lastModifiedTime: string;
  projectId: string;
  agentName: string;
  workspaceUris: string;
  status: string;
}

export interface ToolStatItem {
  rawName: string;
  name: string;
  category: string;
  color: string;
  count: number;
  percentage: number;
}

export interface ModelTokenStat {
  modelId: string;
  modelName: string;
  totalTokens: number;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  requests: number;
  avgTps: number;
  avgTtft: number;
}

export interface ProjectStatItem {
  projectKey: string;
  name: string;
  fullPath: string;
  displayPath: string;
  badgeText?: string;
  isWorkspace: boolean;
  conversationCount: number;
  tokenCount: number;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  requests: number;
}

export interface ProjectDailyStat {
  projectKey: string;
  name: string;
  fullPath: string;
  displayPath: string;
  badgeText?: string;
  isWorkspace: boolean;
  inTok: number;
  outTok: number;
  cacheRead: number;
  requests: number;
  conversationIds: string[];
}

export interface SessionProjectMeta {
  projectKey: string;
  name: string;
  fullPath: string;
  displayPath: string;
  badgeText?: string;
  isWorkspace: boolean;
}

export interface SessionAnalyticsData {
  cascadeId: string;
  project?: SessionProjectMeta;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    thinking: number;
    total: number;
  };
  totalRequests: number;
  cacheEfficiency: number;
  avgTtft: number;
  avgTokPerSec: number;
  p50TokPerSec?: number;
  e2eTokPerSec?: number;
  avgTurnLatency?: number;
  steps: ConversationStepMetric[];
  models?: ModelTokenStat[];
  tools?: ToolStatItem[];
}

export interface ModelDailyStat {
  modelId?: string;
  modelName?: string;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  streamSec: number;
  ttftSec: number;
  effOutTok?: number;
  effSec?: number;
  requests: number;
}

export interface RangePerfFields {
  effOutTok?: number;
  effSec?: number;
  ttftSum?: number;
  ttftCount?: number;
  turnDurSum?: number;
  validTurnCount?: number;
  tpsHist?: Record<string, number>;
}

export interface DailySeriesPoint extends RangePerfFields {
  date: string;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  requests: number;
}

export interface HourlySeriesPoint extends RangePerfFields {
  hourKey: string; // YYYY-MM-DD HH:00
  inputTok: number;
  outTok: number;
  cacheRead: number;
  requests: number;
}

export interface GlobalAnalyticsOverview {
  totalConversations: number;
  totalRequests: number;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    thinking: number;
    total: number;
  };
  cacheEfficiency: number; // 0 - 100 percentage
  avgTtft: number; // in seconds
  avgTokPerSec: number; // tokens/second (weighted unified capsule speed)
  p50TokPerSec?: number; // tokens/second (P50 median unified capsule speed)
  e2eTokPerSec?: number; // legacy alias mirroring p50TokPerSec
  avgTurnLatency?: number; // in seconds (average turn duration)
  topProjects: Array<{ projectId: string; conversationCount: number; tokenCount: number }>;
  projects?: ProjectStatItem[];
  dailyProjectStats?: Record<string, Record<string, ProjectDailyStat>>;
  timeRangeSeries: DailySeriesPoint[];
  hourlySeries?: HourlySeriesPoint[];
  modelDistribution: ModelTokenStat[];
  dailyModelStats: Record<string, Record<string, ModelDailyStat>>;
  hourlyModelStats?: Record<string, Record<string, ModelDailyStat>>;
  toolDistribution: ToolStatItem[];
  dailyToolStats: Record<string, Record<string, number>>;
}

export interface LiveMetricsPayload {
  cascadeId: string;
  hasData: boolean;
  sig?: string;
  displayTps?: number;
  ttft?: number;
  ctxTok?: number;
  ctxPct?: number;
  outTok?: number;
  inlineHtml?: string;
  tooltipHtml?: string;
}

export interface BootPayload {
  version: string;
  platform: string;
  enabled: boolean;
  language: AuraConfig['language'];
  themeMode?: 'light' | 'dark' | 'auto';
  preset: string;
  presets: PresetConfig;
  cssText: string;
  customCss: string;
  themeVars: Record<string, string>;
  advanced: AdvancedConfig;
  i18nDict: Record<string, string>;
  modules: ResolvedRuntimeModules;
  selectors: SelectorsConfig;
  config: AuraConfig;
  customJs: string;
}

export interface EmbeddedAssets {
  panelHtml: string;
  panelCss: string;
  panelJs: string;
  coreThemeCss: string;
  coreRuntimeJs: string;
  coreI18n: Record<string, string>;
}

export interface SidecarStatusResponse {
  connected: boolean;
  targetCount: number;
  cdpPort: number | null;
  patchVersion: string;
  cssLength: number;
  preset: string;
  modules: ResolvedRuntimeModules;
  metrics: LiveMetricsPayload | null;
  activeCascadeId?: string;
}

export interface SidecarBridge {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  conversationId?: string | null;
  getWorkspaceUris?: () => Promise<string[]>;
  onWorkspaceChange?: (listener: (uris: string[]) => void) => () => void;
  agent?: {
    sendMessage?: (message: string, conversationId?: string) => Promise<void>;
    startConversation?: (message: string) => Promise<string>;
    getConversationMetadata?: (conversationId: string) => Promise<unknown>;
  };
  ui?: {
    toggleAuxPane?: (options?: { open?: boolean }) => void;
    toggleConversation?: (conversationId: string) => void;
  };
}

declare global {
  interface Window {
    sidecar: SidecarBridge;
  }
}
