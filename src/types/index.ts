/**
 * Aura Dashboard · Core Contract Types
 */

export interface PresetConfig {
  light: 'high-contrast' | 'claude-desktop-purewhite' | 'default' | string;
  dark: 'claude-dark' | 'vintage-dark' | 'default' | string;
}

export interface ComposerConfig {
  waxSeal: boolean;
  collinear: boolean;
  hideArrows: boolean;
}

export interface TypographyConfig {
  primarySans: string;
  customPrimarySans?: string;
  fallbackSans: string;
  customFallbackSans?: string;
  mono: string;
  customMono?: string;
  fontSize: number;
}

export interface TelemetryConfig {
  enabled: boolean;
  interval: number;
}

export interface AuraConfig {
  language: 'default' | 'zh-CN';
  presets: PresetConfig;
  composer: ComposerConfig;
  typography: TypographyConfig;
  telemetry: TelemetryConfig;
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

export interface SessionAnalyticsData {
  cascadeId: string;
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
  steps: ConversationStepMetric[];
  models?: ModelTokenStat[];
  tools?: ToolStatItem[];
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

export interface ModelDailyStat {
  modelId?: string;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  streamSec: number;
  ttftSec: number;
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
  avgTokPerSec: number; // tokens/second (weighted average)
  p50TokPerSec?: number; // tokens/second (P50 median)
  topProjects: Array<{ projectId: string; conversationCount: number; tokenCount: number }>;
  timeRangeSeries: Array<{
    date: string;
    inputTok: number;
    outTok: number;
    cacheRead: number;
    requests: number;
  }>;
  hourlySeries?: Array<{
    hourKey: string; // YYYY-MM-DD HH:00
    inputTok: number;
    outTok: number;
    cacheRead: number;
    requests: number;
  }>;
  modelDistribution: ModelTokenStat[];
  dailyModelStats: Record<string, Record<string, ModelDailyStat>>;
  hourlyModelStats?: Record<string, Record<string, ModelDailyStat>>;
  toolDistribution: ToolStatItem[];
  dailyToolStats: Record<string, Record<string, number>>;
}

export interface SidecarBridge {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  conversationId?: string | null;
  getWorkspaceUris?: () => Promise<string[]>;
  onWorkspaceChange?: (listener: (uris: string[]) => void) => () => void;
  agent?: {
    sendMessage?: (message: string, conversationId?: string) => Promise<void>;
    startConversation?: (message: string) => Promise<string>;
    getConversationMetadata?: (conversationId: string) => Promise<any>;
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
