import { describe, expect, test } from 'bun:test';
import { buildSessionOverviewSeries, renderActivityChart } from '../src/panel/analytics/charts';
import { computeProcessedColumns, renderMetricCards } from '../src/panel/analytics/metrics';
import type { GlobalAnalyticsOverview, SessionAnalyticsData } from '../src/types';

function makeOverviewFixture(): GlobalAnalyticsOverview {
  return {
    totalConversations: 1,
    totalRequests: 5,
    totalTokens: { input: 24000, output: 2000, cacheRead: 22000, thinking: 0, total: 48000 },
    cacheEfficiency: 47.8,
    avgTtft: 1.0,
    avgTokPerSec: 120,
    topProjects: [],
    timeRangeSeries: [],
    hourlySeries: [],
    modelDistribution: [],
    dailyModelStats: {},
    hourlyModelStats: {},
    toolDistribution: [],
    dailyToolStats: {}
  };
}

function makeStep(idx: number, inTok: number, cacheRead: number, outTok = 300) {
  return {
    idx,
    inTok,
    outTok,
    cacheRead,
    ctx: inTok + cacheRead,
    thinkTok: 0,
    respTok: outTok,
    ttft: 0.8,
    stream: 2.0,
    totDur: 2.8
  };
}

function makeSessionFixture(steps: SessionAnalyticsData['steps']): SessionAnalyticsData {
  return {
    cascadeId: '00000000-0000-0000-0000-000000000099',
    totalTokens: {
      input: steps.reduce((s, x) => s + x.inTok, 0),
      output: steps.reduce((s, x) => s + x.outTok, 0),
      cacheRead: steps.reduce((s, x) => s + x.cacheRead, 0),
      thinking: 0,
      total: steps.reduce((s, x) => s + x.inTok + x.outTok + x.cacheRead, 0)
    },
    totalRequests: steps.length,
    cacheEfficiency: 50,
    avgTtft: 0.8,
    avgTokPerSec: 120,
    steps
  };
}

describe('Session Overview Cache Hit Rate & Timeline Jump', () => {
  test('buildSessionOverviewSeries computes hit rates, ignores action turns, and flags real cache breaks', () => {
    const series = buildSessionOverviewSeries([
      makeStep(0, 10000, 0), // cold start -> 0%, NOT a break
      makeStep(1, 1000, 10000), // 90.9%
      makeStep(2, 0, 0, 0), // action turn -> carries ctx, hitRate=null, NOT a break
      makeStep(3, 12000, 0), // cache break -> 0%, break=true
      makeStep(4, 1000, 12000), // recovered -> 92.3%
      makeStep(5, 15000, 85000) // huge user message while prefix stays cached -> 85%, NOT a break
    ]);

    expect(series[0].cacheHitRate).toBe(0);
    expect(series[0].isCacheBreak).toBe(false);

    expect(series[1].cacheHitRate).toBeCloseTo(90.91, 1);
    expect(series[1].isCacheBreak).toBe(false);

    expect(series[2].isActionTurn).toBe(true);
    expect(series[2].effectiveCtx).toBe(11000);
    expect(series[2].cacheHitRate).toBeNull();
    expect(series[2].isCacheBreak).toBe(false);

    expect(series[3].cacheHitRate).toBe(0);
    expect(series[3].isCacheBreak).toBe(true);

    expect(series[4].cacheHitRate).toBeCloseTo(92.31, 1);
    expect(series[4].isCacheBreak).toBe(false);

    expect(series[5].cacheHitRate).toBeCloseTo(85, 1);
    expect(series[5].isCacheBreak).toBe(false);
  });

  test('renderActivityChart overlays Cache Hit % line, break markers, tooltip info, and jumps to Timeline on click', async () => {
    // 60 turns so Timeline enters scrollable mode (> 40 columns) and verifies scroll centering
    const steps = Array.from({ length: 60 }, (_, idx) => {
      if (idx === 0) return makeStep(idx, 10000, 0);
      if (idx === 15) return makeStep(idx, 30000, 0); // Cache break at turn index 15
      if (idx === 16) return makeStep(idx, 0, 0, 0); // Action turn right after break
      return makeStep(idx, 1000, 29000 + idx * 200);
    });
    const session = makeSessionFixture(steps);
    const processed = computeProcessedColumns(makeOverviewFixture(), 'session', session);

    const stageListeners: Record<string, Array<(e: unknown) => void>> = {};
    const stripListeners: Record<string, Array<() => void>> = {};
    const legendListeners: Record<string, Array<() => void>> = {};
    const segmentListeners: Array<{ mode: string; cb: (e: { stopPropagation: () => void }) => void }> = [];

    const makeClassList = () => {
      const classes = new Set<string>();
      return {
        toggle: (cls: string, force?: boolean) => {
          if (force === undefined) {
            if (classes.has(cls)) classes.delete(cls);
            else classes.add(cls);
          } else if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
        },
        contains: (cls: string) => classes.has(cls)
      };
    };

    const fakeLayoutRoot = { classList: makeClassList() };
    const fakeLegendTrigger = {
      classList: makeClassList(),
      addEventListener: (evt: string, fn: () => void) => {
        legendListeners[evt] = legendListeners[evt] || [];
        legendListeners[evt].push(fn);
      }
    };
    const fakeStripHitbox = {
      addEventListener: (evt: string, fn: () => void) => {
        stripListeners[evt] = stripListeners[evt] || [];
        stripListeners[evt].push(fn);
      }
    };
    const fakeScrubber = { style: {} as Record<string, string> };
    const fakeScrubberDot = { style: {} as Record<string, string> };
    const fakeScrubberHitDot = { style: {} as Record<string, string> };
    const fakeTooltip = { innerHTML: '', style: {} as Record<string, string>, offsetWidth: 200, offsetHeight: 150 };
    const fakeHoverBand = { setAttribute: () => {}, style: {} as Record<string, string> };
    const fakeMaskLeft = { style: { opacity: '0' } };
    const fakeMaskRight = { style: { opacity: '0' } };

    const fakeStage = {
      scrollLeft: 0,
      scrollWidth: 640,
      clientWidth: 320,
      getBoundingClientRect: () => ({ width: 600, height: 220, left: 0, top: 0 }),
      addEventListener: (evt: string, fn: (e: unknown) => void) => {
        stageListeners[evt] = stageListeners[evt] || [];
        stageListeners[evt].push(fn);
      }
    };

    const fakeChartContainer = {
      innerHTML: '',
      querySelector: (sel: string) => {
        switch (sel) {
          case '.chart-layout-root':
            return fakeLayoutRoot;
          case '#chart-stage-container':
            return fakeStage;
          case '#chart-health-strip-hitbox':
            return fakeStripHitbox;
          case '#overview-hit-legend-trigger':
            return fakeLegendTrigger;
          case '#chart-scrubber-line':
            return fakeScrubber;
          case '#chart-scrubber-dot':
            return fakeScrubberDot;
          case '#chart-scrubber-hit-dot':
            return fakeScrubberHitDot;
          case '#chart-floating-tooltip':
            return fakeTooltip;
          case '#chart-shared-hover-band':
            return fakeHoverBand;
          case '#chart-mask-left':
            return fakeMaskLeft;
          case '#chart-mask-right':
            return fakeMaskRight;
          default:
            return null;
        }
      },
      querySelectorAll: (sel: string) => {
        if (sel === '#session-view-segmented .segment-btn') {
          return ['overview', 'timeline'].map((mode) => ({
            getAttribute: (name: string) => (name === 'data-mode' ? mode : null),
            addEventListener: (evt: string, cb: (e: { stopPropagation: () => void }) => void) => {
              if (evt === 'click') segmentListeners.push({ mode, cb });
            }
          }));
        }
        return [];
      }
    };

    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'analytics-activity-chart' ? fakeChartContainer : null)
    };

    try {
      renderActivityChart(processed.columns, 'Active Session', 'session', session);

      const overviewHtml = fakeChartContainer.innerHTML;
      expect(overviewHtml).toContain('class="overview-health-strip"');
      expect(overviewHtml).toContain('class="strip-seg-break"');
      expect(overviewHtml).toContain('id="chart-health-strip-hitbox"');
      expect(overviewHtml).toContain('class="overview-hit-layer"');
      expect(overviewHtml).toContain('class="overview-hit-rate-line"');
      expect(overviewHtml).toContain('class="chart-y-axis-sticky chart-y-axis-right"');
      expect(overviewHtml).toContain('Cache Health');
      expect(overviewHtml).toContain('class="overview-break-guide"');
      expect(overviewHtml).toContain('class="chart-break-dot" data-turn-idx="15"');
      expect(overviewHtml).toContain('class="chart-floating-tooltip overview-tooltip"');
      // Option A layer sits BEFORE Context Window curve so green waveform remains on top
      expect(overviewHtml.indexOf('class="overview-hit-layer"')).toBeLessThan(
        overviewHtml.indexOf('fill="url(#aura-ctx-grad)"')
      );

      // Default state keeps Option A overlay hidden until strip/legend hover
      expect(fakeLayoutRoot.classList.contains('overview-hit-active')).toBe(false);
      stripListeners.mouseenter?.[0]();
      expect(fakeLayoutRoot.classList.contains('overview-hit-active')).toBe(true);
      expect(fakeLegendTrigger.classList.contains('active')).toBe(true);
      stripListeners.mouseleave?.[0]();
      expect(fakeLayoutRoot.classList.contains('overview-hit-active')).toBe(false);

      legendListeners.mouseenter?.[0]();
      expect(fakeLayoutRoot.classList.contains('overview-hit-active')).toBe(true);
      legendListeners.mouseleave?.[0]();
      expect(fakeLayoutRoot.classList.contains('overview-hit-active')).toBe(false);

      // Hover over Turn #16 (index 15 -> cache break)
      const ptSvgX15 = 10 + (15 / 59) * 580;
      const mousemoveHandlers = stageListeners.mousemove || [];
      expect(mousemoveHandlers.length).toBe(1);
      mousemoveHandlers[0]({ clientX: ptSvgX15 });

      expect(fakeScrubberHitDot.style.display).toBe('block');
      expect(fakeTooltip.innerHTML).toContain('Session Turn #16');
      expect(fakeTooltip.innerHTML).toContain('Cache Break');
      expect(fakeTooltip.innerHTML).toContain('Cache Hit Rate');
      expect(fakeTooltip.innerHTML).toContain('0.0%');
      expect(fakeTooltip.innerHTML).toContain('Click to inspect in Timeline');

      // Hovering strip hides tooltip while keeping scrubber/dots active, then leaving restores tooltip
      stripListeners.mouseenter?.[0]();
      expect(fakeTooltip.style.display).toBe('none');
      mousemoveHandlers[0]({ clientX: ptSvgX15 });
      expect(fakeScrubber.style.display).toBe('block');
      expect(fakeScrubberHitDot.style.display).toBe('block');
      expect(fakeTooltip.style.display).toBe('none');

      stripListeners.mouseleave?.[0]();
      mousemoveHandlers[0]({ clientX: ptSvgX15 });
      expect(fakeTooltip.style.display).toBe('block');

      // Hover over Turn #17 (index 16 -> Action turn) hides hit-rate dot
      const ptSvgX16 = 10 + (16 / 59) * 580;
      mousemoveHandlers[0]({ clientX: ptSvgX16 });
      expect(fakeScrubberHitDot.style.display).toBe('none');
      expect(fakeTooltip.innerHTML).toContain('N/A');
      expect(fakeTooltip.innerHTML).toContain('Action / Non-LLM Turn');

      // Same-turn mousemove dedup avoids redundant tooltip DOM rebuilds
      fakeTooltip.innerHTML = 'SENTINEL';
      mousemoveHandlers[0]({ clientX: ptSvgX16 + 0.5 });
      expect(fakeTooltip.innerHTML).toBe('SENTINEL');
      stageListeners.mouseleave?.[0]({});
      mousemoveHandlers[0]({ clientX: ptSvgX16 });
      expect(fakeTooltip.innerHTML).toContain('Session Turn #17');

      // Click on index 15 switches to Timeline, highlights column 15, and scrolls near index 15
      const clickHandlers = stageListeners.click || [];
      expect(clickHandlers.length).toBe(1);
      clickHandlers[0]({ clientX: ptSvgX15 });

      const timelineHtml = fakeChartContainer.innerHTML;
      expect(timelineHtml).toContain('id="chart-focus-band"');
      expect(timelineHtml).toContain('data-focus-idx="15"');
      expect(timelineHtml).not.toContain('overview-hit-rate-line');

      await new Promise((resolve) => setTimeout(resolve, 70));
      // Index 15 out of 60 is near the left quarter (scrollLeft should stay well below maxScroll=320)
      expect(fakeStage.scrollLeft).toBeGreaterThan(0);
      expect(fakeStage.scrollLeft).toBeLessThan(120);

      // Restore module-level view mode back to overview
      const overviewBtn = segmentListeners.find((x) => x.mode === 'overview');
      expect(overviewBtn).toBeDefined();
      overviewBtn!.cb({ stopPropagation: () => {} });
      expect(fakeChartContainer.innerHTML).toContain('overview-hit-rate-line');
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }
  });

  test('renderMetricCards uses sessionTurns instead of steps.length for Session Turns and Avg Tokens / Turn', () => {
    const steps = [
      makeStep(0, 1000, 1000, 200),
      makeStep(1, 1000, 1000, 200),
      makeStep(2, 1000, 1000, 200),
      makeStep(3, 1000, 1000, 200),
      makeStep(4, 1000, 1000, 200)
    ];
    const session: SessionAnalyticsData = {
      ...makeSessionFixture(steps),
      totalTokens: { input: 5000, output: 1000, cacheRead: 4000, thinking: 0, total: 10000 },
      totalRequests: 5,
      sessionTurns: 2
    };
    const overview = makeOverviewFixture();
    const processed = computeProcessedColumns(overview, 'session', session);

    const fakeCardsGrid = { innerHTML: '', dataset: {} as Record<string, string> };
    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'analytics-cards-grid' ? fakeCardsGrid : null)
    };

    try {
      renderMetricCards(processed, 'session', overview, session);
      expect(fakeCardsGrid.innerHTML).toContain('5</span>\n          <span class="kpi-unit">requests</span>');
      expect(fakeCardsGrid.innerHTML).toContain('Session Turns:');
      expect(fakeCardsGrid.innerHTML).toContain('2 turns');
      expect(fakeCardsGrid.innerHTML).toContain('5,000');

      const singleSession: SessionAnalyticsData = { ...session, totalRequests: 1, sessionTurns: 1 };
      const singleProcessed = computeProcessedColumns(overview, 'session', singleSession);
      renderMetricCards(singleProcessed, 'session', overview, singleSession);
      expect(fakeCardsGrid.innerHTML).toContain('1</span>\n          <span class="kpi-unit">request</span>');
      expect(fakeCardsGrid.innerHTML).toContain('1 turn');

      const zeroTurnSession: SessionAnalyticsData = { ...session, sessionTurns: 0 };
      renderMetricCards(processed, 'session', overview, zeroTurnSession);
      expect(fakeCardsGrid.innerHTML).toContain('0 turns');
      expect(fakeCardsGrid.innerHTML).toContain('2,000');

      // Verify Thinking metric rendered between Cache Read and Output in kpi-breakdown-list
      const thinkingSession: SessionAnalyticsData = {
        ...session,
        totalTokens: { input: 19218, output: 672, cacheRead: 14606, thinking: 420, total: 34496 }
      };
      const thinkingProcessed = computeProcessedColumns(overview, 'session', thinkingSession);
      renderMetricCards(thinkingProcessed, 'session', overview, thinkingSession);

      const html = fakeCardsGrid.innerHTML;
      expect(html).toContain('kpi-dot-think');
      expect(html).toContain('<span>Thinking:</span>');
      expect(html).toContain('420');
      expect(html).toContain('hero-body-row');
      expect(html).toContain('kpi-ratio-seg-think');
      expect(html).toContain('class="kpi-breakdown-pct"');
      expect(html).toContain('(55.7%)');
      expect(html).toContain('(42.3%)');
      expect(html).toContain('(1.2%)');
      expect(html).toContain('(1.9%)');

      const cacheReadIdx = html.indexOf('<span>Cache Read:</span>');
      const thinkingIdx = html.indexOf('<span>Thinking:</span>');
      const outputIdx = html.indexOf('<span>Output:</span>');

      expect(cacheReadIdx).toBeGreaterThan(0);
      expect(thinkingIdx).toBeGreaterThan(cacheReadIdx);
      expect(outputIdx).toBeGreaterThan(thinkingIdx);
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }
  });
});
