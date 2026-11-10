import { describe, expect, test } from 'bun:test';
import { renderModelTpsChart } from '../src/panel/analytics/charts';
import {
  computeApiCostAndSavings,
  computeProcessedColumns,
  computeRangePerf,
  renderModelDistribution
} from '../src/panel/analytics/metrics';
import {
  alignLocalBucketStartSec,
  buildSessionSpeedTimeline,
  computeBucketTps,
  computeStepTps,
  computeWeightedTps
} from '../src/shared/tps';
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

  test('renderModelDistribution keeps distinct modelIds separate and renders plain-text footer without lightning bolt or chip dots', () => {
    const overview = makeOverviewFixture();
    overview.dailyModelStats['2026-11-09'] = {
      'gemini-3.8-flash-s': {
        modelId: 'gemini-3.8-flash-s',
        modelName: 'Gemini 3.8 Flash (High)',
        inTok: 14000,
        outTok: 581,
        cacheRead: 0,
        thinkTok: 482,
        streamSec: 4.76,
        ttftSec: 1.0,
        effOutTok: 581,
        effSec: 4.76,
        requests: 1
      },
      'gemini-3.8-flash-n': {
        modelId: 'gemini-3.8-flash-n',
        modelName: 'Gemini 3.8 Flash (High)',
        inTok: 8000,
        outTok: 300,
        cacheRead: 4000,
        thinkTok: 0,
        streamSec: 3.0,
        ttftSec: 1.0,
        effOutTok: 300,
        effSec: 3.0,
        requests: 2
      }
    };

    const fakeContainer = { innerHTML: '' };
    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'analytics-models-list' ? fakeContainer : null)
    };

    try {
      renderModelDistribution(overview, 'custom', null, '2026-11-09', '2026-11-09');
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }

    const html = fakeContainer.innerHTML;
    expect(html).toContain('gemini-3.8-flash-s');
    expect(html).toContain('gemini-3.8-flash-n');
    expect(html.match(/class="model-stat-row"/g)?.length).toBe(2);
    expect(html).not.toContain('⚡');
    expect(html).not.toContain('chip-dot');
    expect(html).toContain('class="model-token-summary">Cache: 0% (0) · Out: 581 · In: 14k · Think: 482</span>');
    expect(html).toContain('<span class="model-speed-badge">122 tok/s</span>');

    const firstRow = html.split('class="model-stat-row"')[1] || '';
    const titleSection = firstRow.split('class="model-bar-track"')[0] || '';
    const footerSection = firstRow.split('class="model-chips"')[1] || '';
    expect(titleSection).not.toContain('model-speed-badge');
    expect(footerSection).toContain('model-speed-badge');
  });

  test('buildSessionSpeedTimeline adapts granularity via active buckets, aligns to local clock, and aggregates weighted TPS', () => {
    const baseSec = Math.floor(new Date('2026-11-10T10:00:12').getTime() / 1000);
    // Two bursts 14 hours apart: total calendar span >14h, but only 4 distinct 30s active buckets
    const burst2Sec = baseSec + 14 * 3600 + 45;
    const timeline = buildSessionSpeedTimeline([
      { ts: baseSec, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 400, effSec: 2 },
      { ts: baseSec + 10, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 200, effSec: 4 },
      { ts: baseSec + 35, modelId: 'gemini-3.8-flash-n', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 140, effSec: 2 },
      { ts: burst2Sec, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 500, effSec: 2 },
      { ts: 123, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 100, effSec: 1 },
      { ts: baseSec, modelId: 'unknown', modelName: 'Unknown Model', effOutTok: 100, effSec: 1 }
    ]);

    expect(timeline).toBeDefined();
    expect(timeline!.bucketSizeSec).toBe(30);
    expect(timeline!.slots.length).toBe(3);
    expect(timeline!.slots[0].bucketStartSec).toBe(alignLocalBucketStartSec(baseSec, 30));

    // Weighted TPS in first bucket: (400 + 200) / (2 + 4) = 100 (not unweighted 125)
    const firstStat = timeline!.slots[0].models['gemini-3.8-flash-s'];
    expect(firstStat.requests).toBe(2);
    expect(computeBucketTps(firstStat)).toBe(100);

    // Continuous 50-minute burst (100 distinct 30s buckets) steps up to 120s buckets to stay <=36 slots
    const denseSamples = Array.from({ length: 100 }, (_, i) => ({
      ts: baseSec + i * 30,
      modelId: 'gemini-3.8-flash-s',
      modelName: 'Gemini 3.8 Flash (High)',
      effOutTok: 300,
      effSec: 2
    }));
    const denseTimeline = buildSessionSpeedTimeline(denseSamples);
    expect(denseTimeline).toBeDefined();
    expect(denseTimeline!.bucketSizeSec).toBe(120);
    expect(denseTimeline!.slots.length).toBeLessThanOrEqual(36);
  });

  test('renderModelTpsChart renders multi-model speed lines, matching colors, time labels, and gap dividers in session mode', () => {
    const overview = makeOverviewFixture();
    const t0 = Math.floor(new Date('2026-11-10T10:00:00').getTime() / 1000);
    const session: SessionAnalyticsData = {
      cascadeId: '00000000-0000-0000-0000-000000000002',
      totalTokens: { input: 20000, output: 3000, cacheRead: 100000, thinking: 0, total: 123000 },
      totalRequests: 5,
      cacheEfficiency: 83.3,
      avgTtft: 1.0,
      avgTokPerSec: 180,
      steps: [
        {
          idx: 0,
          inTok: 1000,
          outTok: 400,
          cacheRead: 2000,
          ctx: 3000,
          thinkTok: 0,
          respTok: 400,
          ttft: 1.0,
          stream: 2.0,
          totDur: 3.0
        }
      ],
      models: [
        {
          modelId: 'gemini-3.8-flash-s',
          modelName: 'Gemini 3.8 Flash (High)',
          totalTokens: 84000,
          inputTok: 12000,
          outTok: 2000,
          cacheRead: 70000,
          thinkTok: 0,
          requests: 3,
          avgTps: 250,
          avgTtft: 1.0
        },
        {
          modelId: 'gemini-3.8-flash-n',
          modelName: 'Gemini 3.8 Flash (High)',
          totalTokens: 39000,
          inputTok: 8000,
          outTok: 1000,
          cacheRead: 30000,
          thinkTok: 0,
          requests: 2,
          avgTps: 75,
          avgTtft: 1.0
        }
      ],
      speedTimeline: buildSessionSpeedTimeline([
        // Burst 1: flash-s & flash-n interleaved across active burst
        { ts: t0, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 500, effSec: 2 },
        { ts: t0 + 120, modelId: 'gemini-3.8-flash-n', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 150, effSec: 2 },
        { ts: t0 + 240, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 520, effSec: 2 },
        { ts: t0 + 300, modelId: 'gemini-3.8-flash-n', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 180, effSec: 2 },
        // Burst 2 after 8-hour idle pause
        { ts: t0 + 8 * 3600, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 480, effSec: 2 },
        { ts: t0 + 8 * 3600 + 60, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 500, effSec: 2 },
        { ts: t0 + 8 * 3600 + 90, modelId: 'gemini-3.8-flash-n', modelName: 'Gemini 3.8 Flash (High)', effOutTok: 160, effSec: 2 }
      ])
    };

    const fakeModelsContainer = { innerHTML: '' };
    let slotHandler: (() => void) | null = null;
    const fakeHoverSlot = {
      getAttribute: (name: string) => (name === 'data-slot-idx' ? '0' : null),
      addEventListener: (evt: string, fn: () => void) => {
        if (evt === 'mouseenter') slotHandler = fn;
      }
    };
    const fakeTooltip = { innerHTML: '', style: {}, offsetWidth: 200, offsetHeight: 80 };
    const fakeScrubber = { setAttribute: () => {}, style: {} };
    const fakeTpsContainer = {
      innerHTML: '',
      querySelector: (sel: string) =>
        sel === '#tps-floating-tooltip'
          ? fakeTooltip
          : sel === '#tps-scrubber-line'
            ? fakeScrubber
            : sel === '.chart-body'
              ? {
                  getBoundingClientRect: () => ({ width: 800, height: 220, left: 0, top: 0 }),
                  addEventListener: () => {}
                }
              : null,
      querySelectorAll: (sel: string) => (sel === '.tps-hover-slot' ? [fakeHoverSlot] : [])
    };
    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) =>
        id === 'analytics-models-list'
          ? fakeModelsContainer
          : id === 'analytics-model-tps-chart'
            ? fakeTpsContainer
            : null
    };

    try {
      renderModelDistribution(overview, 'session', session);
      renderModelTpsChart(overview, 'session', session);
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }

    const html = fakeTpsContainer.innerHTML;
    expect(html).toContain('30s Buckets · Stream · E2E');
    expect(html).toContain('class="tps-legend-bar"');
    expect(html).toContain('Gemini 3.8 Flash (High) (gemini-3.8-flash-s)');
    expect(html).toContain('Gemini 3.8 Flash (High) (gemini-3.8-flash-n)');
    expect(html).toContain('class="tps-gap-divider"');
    expect(html).toContain('10:00:00');
    expect(html).not.toContain('>#1<');

    // Legend uses full disambiguated display name, while tooltip directly shows raw modelId
    expect(slotHandler).not.toBeNull();
    slotHandler!();
    expect(fakeTooltip.innerHTML).toContain('class="tooltip-label">gemini-3.8-flash-s</span>');
    expect(fakeTooltip.innerHTML).not.toContain('Gemini 3.8 Flash (High) (gemini-3.8-flash-s)');

    // Separate polyline path for each model + separate path segments across idle gap
    const pathMatches = html.match(/<path d="/g) || [];
    expect(pathMatches.length).toBeGreaterThanOrEqual(2);

    // Extract colors from Model Token Consumption and confirm Session Speed Trends reuses exact colors
    const distColors = Array.from(
      fakeModelsContainer.innerHTML.matchAll(/class="model-dot" style="background:\s*([^"]+)"/g)
    ).map((m) => m[1]);
    const legendColors = Array.from(
      html.matchAll(/class="tps-legend-swatch" style="background:\s*([^"]+)"/g)
    ).map((m) => m[1]);
    expect(legendColors).toEqual(distColors);

    // Fallback: legacy Session object without speedTimeline keeps turn-based #1 chart
    const legacySession: SessionAnalyticsData = { ...session, speedTimeline: undefined };
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'analytics-model-tps-chart' ? fakeTpsContainer : null)
    };
    try {
      renderModelTpsChart(overview, 'session', legacySession);
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }
    expect(fakeTpsContainer.innerHTML).toContain('#1');
    expect(fakeTpsContainer.innerHTML).not.toContain('tps-legend-bar');
  });
});
