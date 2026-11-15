import type {
  AccountDailyStat,
  AccountHourlyStat,
  ModelDailyStat,
  RangePerfFields,
  TurnLatencySample
} from '../../types';

export interface TokenBreakdown extends RangePerfFields {
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok?: number;
  requests: number;
}

export interface ModelBucket {
  modelId: string;
  modelName: string;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  streamSec: number;
  ttftSec: number;
  effOutTok: number;
  effSec: number;
  count: number;
}

export interface CacheEntry {
  sig: string;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  ttft: number;
  ttftSum?: number;
  ttftCount?: number;
  stream: number;
  reqCount: number;
  lastModified: number;
  dailyBreakdown?: Record<string, TokenBreakdown>;
  hourlyBreakdown?: Record<string, TokenBreakdown>;
  models?: Record<string, ModelBucket>;
  dailyModelStats?: Record<string, Record<string, ModelDailyStat>>;
  hourlyModelStats?: Record<string, Record<string, ModelDailyStat>>;
  tools?: Record<string, number>;
  dailyTools?: Record<string, Record<string, number>>;
  dailyUserTurns?: Record<string, number>;
  hourlyUserTurns?: Record<string, number>;
  dailyLatencySamples?: Record<string, TurnLatencySample[]>;
  effOutTok?: number;
  effSec?: number;
  tpsList?: number[];
  turnDurSum?: number;
  validTurnCount?: number;
  dailyAccountStats?: Record<string, Record<string, AccountDailyStat>>;
  hourlyAccountStats?: Record<string, Record<string, AccountHourlyStat>>;
}

export interface AnalyticsCache {
  version: number;
  sessions: Record<string, CacheEntry>;
}
