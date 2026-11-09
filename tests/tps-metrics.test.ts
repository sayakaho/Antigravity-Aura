import { describe, expect, test } from 'bun:test';
import {
  computeApiCostAndSavings,
  computeProcessedColumns,
  computeRangePerf
} from '../src/panel/analytics/metrics';
import { computeBucketTps, computeStepTps, computeWeightedTps } from '../src/shared/tps';
import type { GlobalAnalyticsOverview, SessionAnalyticsData } from '../src/types';

function makeOverviewFixture(): GlobalAnalyticsOverview {
  return {
    totalConversations: 2,
    totalRequests: 6,
    totalTokens: { input: 6000, output: 1500, cacheRead: 12000, thinking: 200, total: 19500 },
    cacheEfficiency: 66.7,
    avgTtft: 3.0,
    avgTokPerSec: 120,
    p50TokPerSec: 115,
    avgTurnLatency: 6.5,
    topProjects: [],
    timeRangeSeries: [
      {
        date: '2026-11-01',
        inputTok: 2000,
        outTok: 500,
        cacheRead: 4000,
        requests: 2,
        effOutTok: 500,
        effSec: 5,
        ttftSum: 2.0,
        ttftCount: 2,
        turnDurSum: 6.0,
        validTurnCount: 2,
        tpsHist: { '100': 2 }
      },
      {
        date: '2026-11-09',
        inputTok: 4000,
        outTok: 1000,
        cacheRead: 8000,
        requests: 4,
        effOutTok: 1000,
        effSec: 5,
        ttftSum: 10.0,
        ttftCount: 2,
        turnDurSum: 14.0,
        validTurnCount: 2,
        tpsHist: { '200': 2 }
      }
    ],
    hourlySeries: [
      {
        hourKey: '2026-11-09 10:00',
        inputTok: 4000,
        outTok: 1000,
        cacheRead: 8000,
        requests: 4,
        effOutTok: 1000,
        effSec: 5,
        ttftSum: 10.0,
        ttftCount: 2,
        turnDurSum: 14.0,
        validTurnCount: 2,
        tpsHist: { '200': 2 }
      }
    ],
    modelDistribution: [],
    dailyModelStats: {
      '2026-11-09': {
        'Gemini 3.8 Flash': {
          modelId: 'gemini-3.8-flash',
          inTok: 4000,
          outTok: 1000,
          cacheRead: 8000,
          thinkTok: 0,
          streamSec: 5,
          ttftSec: 10,
          effOutTok: 1000,
          effSec: 5,
          requests: 4
        }
      }
    },
    hourlyModelStats: {},
    toolDistribution: [],
    dailyToolStats: {}
  };
}

describe('Unified TPS & Analytics Metrics', () => {
  test('computeStepTps follows unified capsule rule (stream in (0, 600] else E2E)', () => {
    const normalStream = computeStepTps(500, 1.0, 5.0);
    expect(normalStream.usedStream).toBe(true);
    expect(normalStream.displayTps).toBe(100);
    expect(normalStream.effectiveSec).toBe(5.0);

    const shortStream = computeStepTps(200, 1.9, 0.1);
    expect(shortStream.usedStream).toBe(false);
    expect(shortStream.e2eTps).toBeCloseTo(100, 6);
    expect(shortStream.displayTps).toBeCloseTo(100, 6);
    expect(shortStream.effectiveSec).toBe(2.0);

    const burstStream = computeStepTps(400, 1.5, 0.5); // 800 > 600 cap
    expect(burstStream.usedStream).toBe(false);
    expect(burstStream.displayTps).toBeCloseTo(200, 6);

    const emptyOut = computeStepTps(0, 1.0, 2.0);
    expect(emptyOut.displayTps).toBe(0);
    expect(emptyOut.effectiveSec).toBe(0);
  });

  test('computeWeightedTps and computeBucketTps agree on token-weighted rate', () => {
    expect(computeWeightedTps(1500, 10)).toBe(150);
    expect(computeBucketTps({ effOutTok: 1000, effSec: 4 })).toBe(250);
    expect(computeBucketTps({ outTok: 200, ttftSec: 1, streamSec: 2 })).toBe(100);
  });

  test('computeRangePerf dynamically recalculates TPS & TTFT across ranges (Bug 1 regression)', () => {
    const overview = makeOverviewFixture();
    const fixedNow = new Date('2026-11-09T12:00:00');

    const todayMetrics = computeProcessedColumns(overview, 'today', null, '', '', fixedNow);
    expect(todayMetrics.avgTokPerSec).toBe(200);
    expect(todayMetrics.p50TokPerSec).toBe(200);
    expect(todayMetrics.avgTtft).toBe(5.0);
    expect(todayMetrics.avgTurnLatency).toBe(7.0);

    const day1Only = computeProcessedColumns(
      overview,
      'custom',
      null,
      '2026-11-01',
      '2026-11-01',
      fixedNow
    );
    expect(day1Only.avgTokPerSec).toBe(100);
    expect(day1Only.p50TokPerSec).toBe(100);
    expect(day1Only.avgTtft).toBe(1.0);
    expect(day1Only.avgTurnLatency).toBe(3.0);

    const zeroReq = computeRangePerf(overview.timeRangeSeries, 0, overview);
    expect(zeroReq).toEqual({ avgTokPerSec: 0, p50TokPerSec: 0, avgTtft: 0, avgTurnLatency: 0 });
  });

  test('computeApiCostAndSavings uses session model pricing rather than hardcoded Flash (Bug 5 regression)', () => {
    const overview = makeOverviewFixture();
    const session: SessionAnalyticsData = {
      cascadeId: '00000000-0000-0000-0000-000000000001',
      totalTokens: { input: 1_000_000, output: 1_000_000, cacheRead: 0, thinking: 0, total: 2_000_000 },
      totalRequests: 1,
      cacheEfficiency: 0,
      avgTtft: 1.0,
      avgTokPerSec: 100,
      steps: [
        {
          idx: 0,
          inTok: 1_000_000,
          outTok: 1_000_000,
          cacheRead: 0,
          ctx: 1_000_000,
          thinkTok: 0,
          respTok: 1_000_000,
          ttft: 1.0,
          stream: 10.0,
          totDur: 11.0
        }
      ],
      models: [
        {
          modelId: 'claude-opus-4-6-thinking',
          modelName: 'Claude Opus 4.6 Thinking',
          totalTokens: 2_000_000,
          inputTok: 1_000_000,
          outTok: 1_000_000,
          cacheRead: 0,
          thinkTok: 0,
          requests: 1,
          avgTps: 100,
          avgTtft: 1.0
        }
      ]
    };

    const metrics = computeProcessedColumns(overview, 'session', session);
    const cost = computeApiCostAndSavings(metrics, 'session', overview, session);
    // Opus rates: $2/1M input + $10/1M output = $12 (not Flash's $0.75 + $3.75 = $4.50)
    expect(cost.actualCost).toBeCloseTo(12.0, 5);
  });

  test('computeProcessedColumns aggregates ranges >90 days into weekly buckets and handles empty custom dates', () => {
    const overview = makeOverviewFixture();
    const longRange = computeProcessedColumns(
      overview,
      'custom',
      null,
      '2026-01-01',
      '2026-06-01'
    );
    expect(longRange.columns.some((c) => c.label.includes('W'))).toBe(true);

    const emptyCustom = computeProcessedColumns(
      overview,
      'custom',
      null,
      '',
      '',
      new Date('2026-11-09T12:00:00')
    );
    expect(emptyCustom.columns.length).toBe(30);
  });
});
