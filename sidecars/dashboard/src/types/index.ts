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

export interface GlobalAnalyticsOverview {
  totalConversations: number;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    thinking: number;
    total: number;
  };
  cacheEfficiency: number; // 0 - 100 percentage
  avgTtft: number; // in seconds
  avgTokPerSec: number; // tokens/second
  topProjects: Array<{ projectId: string; conversationCount: number; tokenCount: number }>;
  timeRangeSeries: Array<{
    date: string;
    inputTok: number;
    outTok: number;
    cacheRead: number;
  }>;
}
