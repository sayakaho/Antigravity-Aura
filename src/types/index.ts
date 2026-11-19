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
  activitySummary: boolean;
}

export interface ResolvedRuntimeModules extends ModulesConfig {
  i18n: boolean;
  metrics: boolean;
  composerWaxSeal: boolean;
  composerCollinear: boolean;
  composerHideArrows: boolean;
}

export type ReleaseChannelOption = 'stable' | 'dev' | 'dogfood' | 'internal' | 'canary';
export type HostVariantOption = 'default' | 'antigravity-ide';

export interface AdvancedConfig {
  labsDeveloperMode: boolean;
  releaseChannel: ReleaseChannelOption;
  isByoa: boolean;
  cde: boolean;
  isEnterpriseDisabled: boolean;
  hostVariant: HostVariantOption;
  enableMicrophone: boolean;
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
  language: 'default' | 'zh-CN' | 'ja-JP' | 'ko-KR';
  presets: PresetConfig;
  composer: ComposerConfig;
  typography: TypographyConfig;
  telemetry: TelemetryConfig;
  modules: ModulesConfig;
  advanced: AdvancedConfig;
  themeVars: Record<string, string>;
  selectors: SelectorsConfig;
  allowedOrigins: string[];
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
  parentConversationId?: string;
  nestingDepth?: number;
}

export interface SubagentStatItem {
  agentName: string;
  runs: number;
  totalTokens: number;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  requests: number;
}

export interface SubagentDailyStat {
  agentName: string;
  runs: number;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  requests: number;
  conversationIds: string[];
}

export interface SubagentBreakdownSummary {
  mainTokens: number;
  subagentTokens: number;
  mainRequests: number;
  subagentRequests: number;
  totalRuns: number;
  items: SubagentStatItem[];
}

export interface ToolStatItem {
  rawName: string;
  name: string;
  category: string;
  color: string;
  count: number;
  percentage: number;
}

export interface AccountTimelineEntry {
  account: string;
  start: number; // Unix timestamp in seconds
  end: number | null; // null if currently active
}

export interface AccountPlanDetails {
  planName?: string;
  teamsTier?: string;
  monthlyPromptCredits?: number;
  monthlyFlowCredits?: number;
  userTierId?: string;
  userTierName?: string;
}

export interface CalibrationSnapshot {
  timestamp: number;
  dateKey: string;
  fiveHourCost?: number;
  fiveHourTokens?: number;
  sevenDayCost?: number;
  sevenDayTokens?: number;
  userTier?: string;
  planName?: string;
  deltaCost: number;
  deltaTokens: number;
  deltaQ5h?: number;
  deltaQWeekly?: number;
  groupName?: string;
}

export interface QuotaWindowTransition {
  timestamp: number;
  account: string;
  windowType: '5h' | 'weekly';
  prevFraction: number;
  currFraction: number;
  deltaFraction: number;
  deltaTokens: number;
  deltaCost?: number;
  measuredCapacityTokens: number;
  measuredCapacityCost?: number;
}

export interface AccountQuotaCapacity {
  fiveHourTokens?: number;
  sevenDayTokens?: number;
  fiveHourCost?: number;
  sevenDayCost?: number;
  fiveHourUsed?: number;
  sevenDayUsed?: number;
  fiveHourFraction?: number;
  weeklyFraction?: number;
  status: 'calibrated' | 'calibrating';
  userTier?: string;
  planName?: string;
  planDetails?: AccountPlanDetails;
  history?: CalibrationSnapshot[];
  recentTransitions?: QuotaWindowTransition[];
}

export interface AccountTokenStat {
  account: string;
  totalTokens: number;
  cost?: number;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  requests: number;
  conversationCount: number;
  isCurrent?: boolean;
  isUntracked?: boolean;
  userTier?: string;
  planName?: string;
  planDetails?: AccountPlanDetails;
  quotaCapacity?: AccountQuotaCapacity;
}

export interface AccountDailyStat {
  account: string;
  cost?: number;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  requests: number;
  conversationIds: string[];
}

export interface AccountHourlyStat {
  account: string;
  cost?: number;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  requests: number;
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

export interface TimedSpeedSample {
  ts: number;
  modelId: string;
  modelName: string;
  effOutTok: number;
  effSec: number;
}

export interface SessionSpeedModelStat {
  modelId: string;
  modelName: string;
  effOutTok: number;
  effSec: number;
  requests: number;
}

export interface SessionSpeedSlot {
  bucketStartSec: number;
  models: Record<string, SessionSpeedModelStat>;
}

export interface SessionSpeedTimeline {
  bucketSizeSec: number;
  slots: SessionSpeedSlot[];
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
  sessionTurns?: number;
  cacheEfficiency: number;
  avgTtft: number;
  avgTokPerSec: number;
  p50TokPerSec?: number;
  e2eTokPerSec?: number;
  avgTurnLatency?: number;
  steps: ConversationStepMetric[];
  models?: ModelTokenStat[];
  accounts?: AccountTokenStat[];
  tools?: ToolStatItem[];
  subagents?: SubagentBreakdownSummary;
  speedTimeline?: SessionSpeedTimeline;
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

export interface TurnLatencySample {
  ts: number;
  ttft: number;
  totDur: number;
  stream: number;
  outTok: number;
  speed: number;
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
  thinkTok?: number;
  requests: number;
  userTurns?: number;
  latencySamples?: TurnLatencySample[];
}

export interface HourlySeriesPoint extends RangePerfFields {
  hourKey: string; // YYYY-MM-DD HH:00
  inputTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok?: number;
  requests: number;
  userTurns?: number;
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
  subagentDistribution?: SubagentStatItem[];
  dailySubagentStats?: Record<string, Record<string, SubagentDailyStat>>;
  accountDistribution?: AccountTokenStat[];
  dailyAccountStats?: Record<string, Record<string, AccountDailyStat>>;
  hourlyAccountStats?: Record<string, Record<string, AccountHourlyStat>>;
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
  analyticsRevision?: number;
  hostHealState?: {
    healed: boolean;
    alreadyPatched: boolean;
    needsRestart: boolean;
  };
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
