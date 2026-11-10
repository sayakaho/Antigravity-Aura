import { canonicalModelName, getModelColor } from '../../shared/catalog';
import {
  escapeHtml,
  formatCompactNumber,
  formatDateLabel,
  formatFullDate,
  formatFullNumber,
  formatLocalDateKey
} from '../../shared/format';
import { computeBucketTps, computeStepTps } from '../../shared/tps';
import type {
  ConversationStepMetric,
  GlobalAnalyticsOverview,
  ModelDailyStat,
  SessionAnalyticsData
} from '../../types';
import {
  buildYAxisGridSvg,
  computeNiceYScale,
  computePercentile,
  positionTooltipNearAnchor,
  renderEmptyChartCard,
  type ChartColumnData
} from './charts-base';
import { getFilterDatesForRange, type TimeRangeOption } from './time-range';

type ActivityViewMode = 'overview' | 'timeline';

export interface OverviewStepPoint extends ConversationStepMetric {
  effectiveCtx: number;
  isActionTurn: boolean;
  cacheHitRate: number | null;
  isCacheBreak: boolean;
}

interface OverviewCoord {
  svgWidth: number;
  svgHeight: number;
  paddingLeft: number;
  paddingTop: number;
  chartWidth: number;
  chartHeight: number;
}

interface TpsSlotEntry {
  model: string;
  color: string;
  tps: number;
  reqs: number;
}

interface TpsSlotMeta {
  title: string;
  centerX: number;
  items: TpsSlotEntry[];
  subline?: string;
}

interface TpsPoint {
  x: number;
  y: number;
  tps: number;
  ts?: number;
}

interface NormalizedTpsModelSeries {
  name: string;
  color: string;
  points: Array<TpsPoint | null>;
}

interface ScatterPointMeta {
  idx: number;
  ttft: number;
  totDur: number;
  stream: number;
  outTok: number;
  speed: number;
  cx: number;
  cy: number;
}

let sessionViewMode: ActivityViewMode = 'overview';

export function buildSessionOverviewSeries(steps: ConversationStepMetric[]): OverviewStepPoint[] {
  let lastValidCtx = 0;
  let prevLlmHitRate: number | null = null;
  let prevLlmPromptTok = 0;
  let prevLlmInTok = 0;

  return steps.map((st) => {
    const promptTok = st.inTok + st.cacheRead;
    const rawCtx = st.ctx || promptTok;
    const isActionTurn = rawCtx === 0 && st.inTok === 0 && st.outTok === 0 && st.cacheRead === 0;

    if (isActionTurn) {
      return {
        ...st,
        effectiveCtx: lastValidCtx,
        isActionTurn: true,
        cacheHitRate: null,
        isCacheBreak: false
      };
    }

    lastValidCtx = rawCtx;
    const cacheHitRate =
      promptTok > 0 ? Math.max(0, Math.min(100, (st.cacheRead / promptTok) * 100)) : null;

    const isCacheBreak =
      cacheHitRate !== null &&
      prevLlmHitRate !== null &&
      prevLlmPromptTok >= 2000 &&
      prevLlmHitRate >= 40 &&
      st.inTok >= 2000 &&
      (cacheHitRate <= 20 || (prevLlmHitRate - cacheHitRate >= 45 && st.inTok > prevLlmInTok));

    if (cacheHitRate !== null && promptTok > 0) {
      prevLlmHitRate = cacheHitRate;
      prevLlmPromptTok = promptTok;
      prevLlmInTok = st.inTok;
    }

    return {
      ...st,
      effectiveCtx: rawCtx,
      isActionTurn: false,
      cacheHitRate,
      isCacheBreak
    };
  });
}

export function renderActivityChart(
  columns: ChartColumnData[],
  rangeTitle: string,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  focusColumnIdx?: number
): void {
  const chartWrapper = document.getElementById('analytics-activity-chart');
  if (!chartWrapper) return;

  if (!columns || columns.length === 0) {
    renderEmptyChartCard(chartWrapper, `Token Activity (${rangeTitle})`, 'No activity data recorded in the selected range');
    return;
  }

  const isSession =
    range === 'session' && Boolean(activeSessionData && activeSessionData.steps.length > 0);

  if (isSession && sessionViewMode === 'overview') {
    renderSessionOverviewArea(chartWrapper, activeSessionData!, rangeTitle, columns, range);
  } else {
    renderStandardTimelineChart(
      chartWrapper,
      columns,
      rangeTitle,
      isSession,
      range,
      activeSessionData,
      focusColumnIdx
    );
  }
}

function attachViewModeSwitchListeners(
  chartWrapper: HTMLElement,
  columns: ChartColumnData[],
  rangeTitle: string,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null
): void {
  chartWrapper.querySelectorAll('#session-view-segmented .segment-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute('data-mode') as ActivityViewMode | null;
      if (mode && mode !== sessionViewMode) {
        sessionViewMode = mode;
        renderActivityChart(columns, rangeTitle, range, activeSessionData);
      }
    });
  });
}

function renderStickyYAxis(yTicks: number[], yMax: number, paddingTop: number, chartHeight: number): string {
  let yAxisSvg = '';
  for (const tickVal of yTicks) {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    yAxisSvg += `
      <text x="40" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${escapeHtml(formatCompactNumber(tickVal))}</text>
      <line x1="43" y1="${y}" x2="48" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.7' : '0.3'}" />
    `;
  }
  return yAxisSvg;
}

function renderStickyPercentYAxis(paddingTop: number, chartHeight: number): string {
  const ticks = [0, 25, 50, 75, 100];
  let axisSvg = '';
  for (const pct of ticks) {
    const y = paddingTop + chartHeight - (pct / 100) * chartHeight;
    axisSvg += `<line x1="0" y1="${y}" x2="5" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${pct === 0 ? '0.6' : '0.25'}" />`;
    if (pct === 0 || pct === 50 || pct === 100) {
      axisSvg += `<text x="8" y="${y + 3.5}" text-anchor="start" font-size="10" font-family="var(--aura-font-mono)" fill="#F59E0B" opacity="0.72">${pct}%</text>`;
    }
  }
  return axisSvg;
}

type HealthStripTier = 'neutral' | 'healthy' | 'degraded' | 'break';

function buildCacheHealthStripSvg(
  steps: OverviewStepPoint[],
  stripX: number,
  stripY: number,
  stripW: number,
  stripH: number
): string {
  const totalTurns = steps.length;
  if (totalTurns === 0 || stripW <= 0) return '';

  let hasSeenLlmTurn = false;
  let lastTier: HealthStripTier = 'neutral';
  const tiers: HealthStripTier[] = steps.map((st) => {
    if (st.isActionTurn || st.cacheHitRate === null) {
      return lastTier;
    }
    let tier: HealthStripTier;
    if (!hasSeenLlmTurn) {
      hasSeenLlmTurn = true;
      tier = st.cacheHitRate >= 75 ? 'healthy' : 'neutral';
    } else if (st.isCacheBreak || st.cacheHitRate < 35) {
      tier = 'break';
    } else if (st.cacheHitRate < 75) {
      tier = 'degraded';
    } else {
      tier = 'healthy';
    }
    lastTier = tier;
    return tier;
  });

  const runs: Array<{ tier: HealthStripTier; x1: number; x2: number }> = [];
  if (totalTurns === 1) {
    runs.push({ tier: tiers[0], x1: stripX, x2: stripX + stripW });
  } else {
    const slotStep = stripW / (totalTurns - 1);
    for (let idx = 0; idx < totalTurns; idx++) {
      const centerX = stripX + idx * slotStep;
      const segLeft = idx === 0 ? stripX : centerX - slotStep / 2;
      const segRight = idx === totalTurns - 1 ? stripX + stripW : centerX + slotStep / 2;
      const tier = tiers[idx];
      const prev = runs[runs.length - 1];
      if (prev && prev.tier === tier) {
        prev.x2 = segRight;
      } else {
        runs.push({ tier, x1: segLeft, x2: segRight });
      }
    }
  }

  const baseRects: string[] = [];
  const degradedRects: string[] = [];
  const breakRects: string[] = [];

  for (const r of runs) {
    const rawW = Math.max(0.5, r.x2 - r.x1);
    if (r.tier === 'neutral') {
      baseRects.push(
        `<rect x="${r.x1.toFixed(2)}" y="${stripY}" width="${rawW.toFixed(2)}" height="${stripH}" fill="var(--aura-fg-muted)" opacity="0.22" />`
      );
    } else if (r.tier === 'healthy') {
      baseRects.push(
        `<rect x="${r.x1.toFixed(2)}" y="${stripY}" width="${rawW.toFixed(2)}" height="${stripH}" fill="#00A67E" opacity="0.44" />`
      );
    } else if (r.tier === 'degraded') {
      const w = Math.max(rawW, 1.6);
      const center = (r.x1 + r.x2) / 2;
      const x = Math.max(stripX, Math.min(stripX + stripW - w, center - w / 2));
      degradedRects.push(
        `<rect class="strip-seg-degraded" x="${x.toFixed(2)}" y="${stripY}" width="${w.toFixed(2)}" height="${stripH}" fill="#F59E0B" opacity="0.78" />`
      );
    } else {
      const w = Math.max(rawW, 2.2);
      const center = (r.x1 + r.x2) / 2;
      const x = Math.max(stripX, Math.min(stripX + stripW - w, center - w / 2));
      breakRects.push(
        `<rect class="strip-seg-break" x="${x.toFixed(2)}" y="${stripY}" width="${w.toFixed(2)}" height="${stripH}" fill="#EF4444" opacity="0.92" />`
      );
    }
  }

  return `
    <g class="overview-health-strip" clip-path="url(#aura-strip-clip)">
      <rect x="${stripX}" y="${stripY}" width="${stripW}" height="${stripH}" fill="var(--aura-border)" opacity="0.24" />
      ${baseRects.join('')}
      ${degradedRects.join('')}
      ${breakRects.join('')}
    </g>
  `;
}

function renderSessionOverviewArea(
  chartWrapper: HTMLElement,
  session: SessionAnalyticsData,
  rangeTitle: string,
  columns: ChartColumnData[],
  range: TimeRangeOption
): void {
  const steps = session.steps;
  const totalTurns = steps.length;
  if (totalTurns === 0) return;

  const sanitizedSteps = buildSessionOverviewSeries(steps);

  const rawMax = sanitizedSteps.reduce((m, s) => Math.max(m, s.effectiveCtx), 0);
  const { yMax, yTicks } = computeNiceYScale(rawMax, 1000, 4);

  const svgHeight = 220;
  const paddingTop = 24;
  const paddingBottom = 30;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const svgWidth = 600;
  const paddingLeft = 10;
  const paddingRight = 10;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const stripY = paddingTop + chartHeight + 3;
  const stripH = 5;

  const yAxisSvg = renderStickyYAxis(yTicks, yMax, paddingTop, chartHeight);
  const rightYAxisSvg = renderStickyPercentYAxis(paddingTop, chartHeight);
  const healthStripSvg = buildCacheHealthStripSvg(
    sanitizedSteps,
    paddingLeft,
    stripY,
    chartWidth,
    stripH
  );

  let gridSvg = '';
  for (const tickVal of yTicks) {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + chartWidth}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.2'}" />`;
  }

  let areaD = '';
  let lineD = '';
  let hitLineD = '';
  let breakGuidesSvg = '';
  let breakDotsHtml = '';
  let xLabelsSvg = '';
  const labelInterval = Math.max(1, Math.floor(totalTurns / 6));

  if (totalTurns === 1) {
    const st = sanitizedSteps[0];
    const y = paddingTop + chartHeight - (st.effectiveCtx / yMax) * chartHeight;
    areaD = `M ${paddingLeft},${paddingTop + chartHeight} L ${paddingLeft},${y.toFixed(1)} L ${paddingLeft + chartWidth},${y.toFixed(1)} L ${paddingLeft + chartWidth},${paddingTop + chartHeight} Z`;
    lineD = `M ${paddingLeft},${y.toFixed(1)} L ${paddingLeft + chartWidth},${y.toFixed(1)}`;
    if (st.cacheHitRate !== null) {
      const hitY = paddingTop + chartHeight - (st.cacheHitRate / 100) * chartHeight;
      hitLineD = `M ${paddingLeft},${hitY.toFixed(1)} L ${paddingLeft + chartWidth},${hitY.toFixed(1)}`;
    }
    xLabelsSvg = `<text x="${paddingLeft}" y="${svgHeight - 8}" text-anchor="start" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#1</text>`;
  } else {
    areaD = `M ${paddingLeft},${paddingTop + chartHeight}`;
    let lastRenderedLabelIdx = -999;
    let singleHitPt: { x: number; y: number } | null = null;
    let hitPtCount = 0;

    sanitizedSteps.forEach((st, idx) => {
      const x = paddingLeft + (idx / (totalTurns - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (st.effectiveCtx / yMax) * chartHeight;
      areaD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      lineD = idx === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)}` : `${lineD} L ${x.toFixed(1)},${y.toFixed(1)}`;

      if (st.cacheHitRate !== null) {
        const hitY = paddingTop + chartHeight - (st.cacheHitRate / 100) * chartHeight;
        hitLineD = hitLineD
          ? `${hitLineD} L ${x.toFixed(1)},${hitY.toFixed(1)}`
          : `M ${x.toFixed(1)},${hitY.toFixed(1)}`;
        singleHitPt = { x, y: hitY };
        hitPtCount++;

        if (st.isCacheBreak) {
          breakGuidesSvg += `<line class="overview-break-guide" x1="${x.toFixed(1)}" y1="${paddingTop}" x2="${x.toFixed(1)}" y2="${paddingTop + chartHeight}" stroke="#EF4444" stroke-width="1" stroke-dasharray="2.5 2.5" opacity="0.24" vector-effect="non-scaling-stroke" />`;
          const leftPct = (x / svgWidth) * 100;
          const topPct = (hitY / svgHeight) * 100;
          breakDotsHtml += `<div class="chart-break-dot" data-turn-idx="${idx}" style="left: ${leftPct.toFixed(2)}%; top: ${topPct.toFixed(2)}%;"></div>`;
        }
      }

      const isTooCloseToRight = totalTurns - 1 - idx < labelInterval * 0.7;
      if (idx % labelInterval === 0 && !isTooCloseToRight) {
        const textAnchor = idx === 0 ? 'start' : 'middle';
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="${textAnchor}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${idx + 1}</text>`;
        lastRenderedLabelIdx = idx;
      }
    });

    if (hitPtCount === 1 && singleHitPt) {
      const pt = singleHitPt as { x: number; y: number };
      const leftPct = (pt.x / svgWidth) * 100;
      const topPct = (pt.y / svgHeight) * 100;
      breakDotsHtml += `<div class="chart-hit-single-dot" style="left: ${leftPct.toFixed(2)}%; top: ${topPct.toFixed(2)}%;"></div>`;
      hitLineD = '';
    }

    areaD += ` L ${paddingLeft + chartWidth},${paddingTop + chartHeight} Z`;
    if (totalTurns - 1 - lastRenderedLabelIdx >= Math.floor(labelInterval * 0.5)) {
      xLabelsSvg += `<text x="${(paddingLeft + chartWidth).toFixed(1)}" y="${svgHeight - 8}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${totalTurns}</text>`;
    }
  }

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${escapeHtml(rangeTitle)})</div>
      </div>
      <div class="chart-header-right">
        <div class="segmented-control mini-segmented" id="session-view-segmented">
          <button class="segment-btn active" data-mode="overview">Overview</button>
          <button class="segment-btn" data-mode="timeline">Timeline</button>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Context Window</span>
          <span class="legend-item legend-item-hit-trigger" id="overview-hit-legend-trigger" title="Hover strip below to overlay Cache Hit %"><span class="legend-strip-swatch"></span>Cache Health</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${svgHeight}" class="y-axis-svg">${yAxisSvg}</svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage chart-stage-clickable" id="chart-stage-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
              <clipPath id="aura-strip-clip">
                <rect x="${paddingLeft}" y="${stripY}" width="${chartWidth}" height="${stripH}" rx="2.5" ry="2.5" />
              </clipPath>
            </defs>
            ${gridSvg}
            <g class="overview-hit-layer">
              ${breakGuidesSvg}
              ${hitLineD ? `<path class="overview-hit-rate-line" d="${hitLineD}" fill="none" stroke="#F59E0B" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity="0.68" />` : ''}
            </g>
            <path d="${areaD}" fill="url(#aura-ctx-grad)" />
            <path d="${lineD}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
            ${healthStripSvg}
            ${xLabelsSvg}
          </svg>
          <div class="overview-hit-overlay-dots">${breakDotsHtml}</div>
          <div class="chart-health-strip-hitbox" id="chart-health-strip-hitbox"></div>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-scrubber-dot" id="chart-scrubber-dot" style="display: none;"></div>
          <div class="chart-scrubber-dot chart-scrubber-hit-dot" id="chart-scrubber-hit-dot" style="display: none;"></div>
          <div class="chart-floating-tooltip overview-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
      <div class="chart-y-axis-sticky chart-y-axis-right">
        <svg viewBox="0 0 38 ${svgHeight}" class="y-axis-right-svg">${rightYAxisSvg}</svg>
      </div>
    </div>
  `;

  attachViewModeSwitchListeners(chartWrapper, columns, rangeTitle, range, session);
  attachOverviewScrubberListeners(
    chartWrapper,
    sanitizedSteps,
    yMax,
    {
      svgWidth,
      svgHeight,
      paddingLeft,
      paddingTop,
      chartWidth,
      chartHeight
    },
    (selectedIdx) => {
      sessionViewMode = 'timeline';
      renderActivityChart(columns, rangeTitle, range, session, selectedIdx);
    }
  );
}

function attachOverviewScrubberListeners(
  chartWrapper: HTMLElement,
  steps: OverviewStepPoint[],
  yMax: number,
  coord: OverviewCoord,
  onSelectStep?: (stepIdx: number) => void
): void {
  const layoutRoot = chartWrapper.querySelector('.chart-layout-root') as HTMLElement | null;
  const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
  const stripHitbox = chartWrapper.querySelector('#chart-health-strip-hitbox') as HTMLElement | null;
  const legendTrigger = chartWrapper.querySelector('#overview-hit-legend-trigger') as HTMLElement | null;
  const scrubber = chartWrapper.querySelector('#chart-scrubber-line') as HTMLElement | null;
  const scrubberDot = chartWrapper.querySelector('#chart-scrubber-dot') as HTMLElement | null;
  const scrubberHitDot = chartWrapper.querySelector('#chart-scrubber-hit-dot') as HTMLElement | null;
  const tooltip = chartWrapper.querySelector('#chart-floating-tooltip') as HTMLElement | null;
  if (!stage || !scrubber || !tooltip) return;

  let stripHovered = false;
  let legendHovered = false;
  const syncHitOverlay = () => {
    const active = stripHovered || legendHovered;
    layoutRoot?.classList.toggle('overview-hit-active', active);
    legendTrigger?.classList.toggle('active', active);
  };

  stripHitbox?.addEventListener('mouseenter', () => {
    stripHovered = true;
    syncHitOverlay();
    tooltip.style.display = 'none';
  });
  stripHitbox?.addEventListener('mouseleave', () => {
    stripHovered = false;
    syncHitOverlay();
  });
  legendTrigger?.addEventListener('mouseenter', () => {
    legendHovered = true;
    syncHitOverlay();
  });
  legendTrigger?.addEventListener('mouseleave', () => {
    legendHovered = false;
    syncHitOverlay();
  });

  const { svgWidth, svgHeight, paddingLeft, paddingTop, chartWidth, chartHeight } = coord;
  const totalTurns = steps.length;
  let activeIdx = -1;

  const resolveStepIdxFromClientX = (clientX: number, rect: DOMRect): number => {
    const mouseX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const mouseSvgX = (mouseX / rect.width) * svgWidth;
    const clampedSvgX = Math.max(paddingLeft, Math.min(paddingLeft + chartWidth, mouseSvgX));
    const ratio = chartWidth > 0 ? (clampedSvgX - paddingLeft) / chartWidth : 0;
    return Math.min(totalTurns - 1, Math.max(0, Math.round(ratio * (totalTurns - 1))));
  };

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;

    const stepIdx = resolveStepIdxFromClientX(e.clientX, rect);
    const shouldShowTooltip = !stripHovered;
    if (
      stepIdx === activeIdx &&
      scrubber.style.display === 'block' &&
      (shouldShowTooltip ? tooltip.style.display === 'block' : tooltip.style.display === 'none')
    ) {
      return;
    }
    activeIdx = stepIdx;

    const st = steps[stepIdx];
    if (!st) return;

    const ctx = st.effectiveCtx;
    const isActionTurn = st.isActionTurn;
    const tps = computeStepTps(st.outTok, st.ttft, st.stream, st.totDur);

    const speedSubline = isActionTurn
      ? 'Action / Non-LLM Turn'
      : tps.usedStream
        ? `Stream: ${Math.round(tps.streamTps)} tok/s · E2E: ${Math.round(tps.e2eTps)} tok/s · TTFT: ${st.ttft.toFixed(2)}s`
        : `Throughput: ${Math.round(tps.e2eTps)} tok/s (E2E) · Latency: ${tps.totDur.toFixed(2)}s`;

    const ptSvgX =
      paddingLeft + (totalTurns > 1 ? (stepIdx / (totalTurns - 1)) * chartWidth : chartWidth / 2);
    const ptSvgY = paddingTop + chartHeight - (ctx / yMax) * chartHeight;
    const snapPixelX = (ptSvgX / svgWidth) * rect.width;
    const snapPixelY = (ptSvgY / svgHeight) * rect.height;

    scrubber.style.display = 'block';
    scrubber.style.left = `${snapPixelX.toFixed(1)}px`;

    if (scrubberDot) {
      scrubberDot.style.display = 'block';
      scrubberDot.style.left = `${snapPixelX.toFixed(1)}px`;
      scrubberDot.style.top = `${snapPixelY.toFixed(1)}px`;
    }

    if (scrubberHitDot) {
      if (st.cacheHitRate !== null) {
        const hitSvgY = paddingTop + chartHeight - (st.cacheHitRate / 100) * chartHeight;
        const hitPixelY = (hitSvgY / svgHeight) * rect.height;
        scrubberHitDot.style.display = 'block';
        scrubberHitDot.style.left = `${snapPixelX.toFixed(1)}px`;
        scrubberHitDot.style.top = `${hitPixelY.toFixed(1)}px`;
      } else {
        scrubberHitDot.style.display = 'none';
      }
    }

    if (!shouldShowTooltip) {
      tooltip.style.display = 'none';
      return;
    }

    const breakBadgeHtml = st.isCacheBreak
      ? '<span class="tooltip-break-badge">Cache Break</span>'
      : '';
    const hitRateText = st.cacheHitRate !== null ? `${st.cacheHitRate.toFixed(1)}%` : 'N/A';

    tooltip.innerHTML = `
      <div class="tooltip-header"><span>Session Turn #${st.idx + 1}</span>${breakBadgeHtml}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${formatCompactNumber(ctx)} (${formatFullNumber(ctx)})</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #F59E0B"></span>
        <span class="tooltip-label">Cache Hit Rate</span>
        <span class="tooltip-val">${hitRateText}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #00A67E"></span>
        <span class="tooltip-label">Cache Read</span>
        <span class="tooltip-val">${formatFullNumber(st.cacheRead)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #6366F1"></span>
        <span class="tooltip-label">Input Tokens</span>
        <span class="tooltip-val">${formatFullNumber(st.inTok)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
        <span class="tooltip-label">Output Tokens</span>
        <span class="tooltip-val">${formatFullNumber(st.outTok)}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-subline">${escapeHtml(speedSubline)}</div>
      <div class="tooltip-subline tooltip-click-hint">Click to inspect in Timeline →</div>
    `;
    tooltip.style.display = 'block';

    positionTooltipNearAnchor({
      tooltip,
      stageWidth: rect.width,
      stageHeight: rect.height,
      anchorLeft: snapPixelX,
      anchorRight: snapPixelX,
      preferredTop: 10
    });
  });

  stage.addEventListener('mouseleave', () => {
    activeIdx = -1;
    stripHovered = false;
    syncHitOverlay();
    scrubber.style.display = 'none';
    if (scrubberDot) scrubberDot.style.display = 'none';
    if (scrubberHitDot) scrubberHitDot.style.display = 'none';
    tooltip.style.display = 'none';
  });

  if (onSelectStep) {
    stage.addEventListener('click', (e) => {
      if (totalTurns === 0) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0) return;
      const stepIdx = resolveStepIdxFromClientX(e.clientX, rect);
      onSelectStep(stepIdx);
    });
  }
}

function renderStandardTimelineChart(
  chartWrapper: HTMLElement,
  columns: ChartColumnData[],
  rangeTitle: string,
  isSession: boolean,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  focusColumnIdx?: number
): void {
  const rawMax = columns.reduce((m, d) => Math.max(m, d.inputTok + d.outTok + d.cacheRead), 0);
  const { yMax, yTicks } = computeNiceYScale(rawMax, 1000, 4);

  const isScrollable = columns.length > 40;
  const colStepWidth = isScrollable ? 10 : Math.max(6, Math.floor(540 / columns.length));
  const svgWidth = isScrollable ? Math.max(580, columns.length * colStepWidth + 40) : 580;
  const svgHeight = 220;
  const paddingLeft = 10;
  const paddingRight = 14;
  const paddingTop = 24;
  const paddingBottom = 30;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const step = chartWidth / columns.length;
  const barWidth = Math.max(3, Math.min(22, Math.floor(step * 0.72)));

  const yAxisSvg = renderStickyYAxis(yTicks, yMax, paddingTop, chartHeight);

  let gridSvg = '';
  for (const tickVal of yTicks) {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `<line x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.2'}" />`;
  }

  let defsSvg = '<defs>';
  let barsSvg = '';
  let focusBandSvg = '';
  let xLabelsSvg = '';

  const isHourly = columns.length === 24 && (columns[0]?.label.includes(':00') || false);
  const isSessionTimeline = columns[0]?.label.startsWith('#') || false;
  const labelInterval = isHourly ? 3 : Math.max(1, Math.floor(columns.length / 8));

  columns.forEach((item, idx) => {
    const x = paddingLeft + idx * step + (step - barWidth) / 2;
    const total = item.inputTok + item.outTok + item.cacheRead;
    const slotX = paddingLeft + idx * step;
    const centerX = x + barWidth / 2;

    if (focusColumnIdx === idx) {
      focusBandSvg = `<rect id="chart-focus-band" class="chart-focus-band" x="${slotX}" y="${paddingTop}" width="${step}" height="${chartHeight}" rx="4" data-focus-idx="${idx}" />`;
    }

    if (total > 0) {
      const totalBarHeight = Math.max(3, Math.round((total / yMax) * chartHeight));
      const outHeight =
        item.outTok > 0 ? Math.max(1, Math.round((item.outTok / total) * totalBarHeight)) : 0;
      let inHeight =
        item.inputTok > 0 ? Math.max(1, Math.round((item.inputTok / total) * totalBarHeight)) : 0;
      const cacheHeight =
        item.cacheRead > 0 ? Math.max(0, totalBarHeight - outHeight - inHeight) : 0;
      if (item.cacheRead === 0 && item.inputTok > 0) {
        inHeight = Math.max(1, totalBarHeight - outHeight);
      }

      const yBottom = paddingTop + chartHeight;
      const yCache = yBottom - cacheHeight;
      const yIn = yCache - inHeight;
      const yOut = yIn - outHeight;
      const r = Math.min(3.5, barWidth / 2, totalBarHeight);

      defsSvg += `
        <clipPath id="col-clip-${idx}">
          <path d="M ${x} ${yBottom} L ${x} ${yOut + r} A ${r} ${r} 0 0 1 ${x + r} ${yOut} L ${x + barWidth - r} ${yOut} A ${r} ${r} 0 0 1 ${x + barWidth} ${yOut + r} L ${x + barWidth} ${yBottom} Z" />
        </clipPath>
      `;

      barsSvg += `
        <g class="chart-column-group" data-slot-x="${slotX}" data-slot-w="${step}" data-idx="${idx}">
          <rect class="bar-bg-band" x="${slotX}" y="${paddingTop}" width="${step}" height="${chartHeight}" rx="4" />
          <g clip-path="url(#col-clip-${idx})">
            ${cacheHeight > 0 ? `<rect class="bar-segment bar-cache" x="${x}" y="${yCache}" width="${barWidth}" height="${cacheHeight}" fill="#00A67E" />` : ''}
            ${inHeight > 0 ? `<rect class="bar-segment bar-in" x="${x}" y="${yIn}" width="${barWidth}" height="${inHeight}" fill="#6366F1" opacity="0.85" />` : ''}
            ${outHeight > 0 ? `<rect class="bar-segment bar-out" x="${x}" y="${yOut}" width="${barWidth}" height="${outHeight}" fill="var(--aura-primary)" />` : ''}
          </g>
        </g>
      `;
    } else {
      barsSvg += `
        <g class="chart-column-group" data-slot-x="${slotX}" data-slot-w="${step}" data-idx="${idx}">
          <rect class="bar-bg-band" x="${slotX}" y="${paddingTop}" width="${step}" height="${chartHeight}" rx="4" />
        </g>
      `;
    }

    let showLabel = false;
    if (isHourly) {
      showLabel = idx % 3 === 0 && idx < 23;
    } else if (isSessionTimeline) {
      const isTooCloseToRight = columns.length - 1 - idx < labelInterval * 0.7;
      showLabel = idx % labelInterval === 0 && !isTooCloseToRight;
    } else {
      const isTooCloseToRight = columns.length - 1 - idx < labelInterval * 0.45;
      showLabel =
        (idx % labelInterval === 0 && !isTooCloseToRight) ||
        (idx === columns.length - 1 &&
          (columns.length - 1) % labelInterval >= Math.floor(labelInterval / 2));
    }

    if (showLabel) {
      xLabelsSvg += `<text x="${centerX}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${escapeHtml(item.label)}</text>`;
    }
  });

  defsSvg += '</defs>';

  const switchHtml = isSession
    ? `
      <div class="segmented-control mini-segmented" id="session-view-segmented">
        <button class="segment-btn" data-mode="overview">Overview</button>
        <button class="segment-btn active" data-mode="timeline">Timeline</button>
      </div>
    `
    : '';

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${escapeHtml(rangeTitle)})</div>
      </div>
      <div class="chart-header-right">
        ${switchHtml}
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #6366F1"></span>Input Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Cache Read</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${svgHeight}" class="y-axis-svg">${yAxisSvg}</svg>
      </div>
      <div class="chart-viewport-wrapper">
        ${
          isScrollable
            ? `
          <div class="chart-fade-mask mask-left" id="chart-mask-left" style="opacity: 0;"><span class="mask-indicator">‹</span></div>
          <div class="chart-fade-mask mask-right" id="chart-mask-right" style="opacity: 0;"><span class="mask-indicator">›</span></div>
        `
            : ''
        }
        <div class="chart-stage ${isScrollable ? 'chart-stage-scrollable' : ''}" id="chart-stage-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element" style="${isScrollable ? `min-width: ${svgWidth}px;` : ''}">
            ${defsSvg}
            ${gridSvg}
            ${focusBandSvg}
            <rect id="chart-shared-hover-band" class="chart-shared-hover-band" x="0" y="${paddingTop}" width="0" height="${chartHeight}" rx="4" style="display: none;" />
            ${barsSvg}
            ${xLabelsSvg}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `;

  if (isSession) {
    attachViewModeSwitchListeners(chartWrapper, columns, rangeTitle, range, activeSessionData);
  }

  if (isScrollable) {
    setTimeout(() => {
      const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
      const maskLeft = chartWrapper.querySelector('#chart-mask-left') as HTMLElement | null;
      const maskRight = chartWrapper.querySelector('#chart-mask-right') as HTMLElement | null;
      if (stage) {
        if (
          typeof focusColumnIdx === 'number' &&
          focusColumnIdx >= 0 &&
          focusColumnIdx < columns.length &&
          stage.scrollWidth > stage.clientWidth
        ) {
          const targetCenterSvgX = paddingLeft + focusColumnIdx * step + step / 2;
          const targetCenterPx = (targetCenterSvgX / svgWidth) * stage.scrollWidth;
          const maxScroll = Math.max(0, stage.scrollWidth - stage.clientWidth);
          stage.scrollLeft = Math.max(0, Math.min(maxScroll, targetCenterPx - stage.clientWidth / 2));
        } else {
          stage.scrollLeft = stage.scrollWidth;
        }
        if (maskLeft && maskRight) {
          const updateMasks = () => {
            const maxScroll = stage.scrollWidth - stage.clientWidth;
            if (maxScroll <= 0) {
              maskLeft.style.opacity = '0';
              maskRight.style.opacity = '0';
              return;
            }
            maskLeft.style.opacity = stage.scrollLeft > 14 ? '1' : '0';
            maskRight.style.opacity = maxScroll - stage.scrollLeft > 14 ? '1' : '0';
          };
          stage.addEventListener('scroll', updateMasks, { passive: true });
          updateMasks();
        }
      }
    }, 50);
  }

  attachStandardTimelineTooltipListeners(chartWrapper, columns);
}

function attachStandardTimelineTooltipListeners(
  chartWrapper: HTMLElement,
  columns: ChartColumnData[]
): void {
  const tooltip = chartWrapper.querySelector('#chart-floating-tooltip') as HTMLElement | null;
  const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
  const hoverBand = chartWrapper.querySelector('#chart-shared-hover-band') as SVGGraphicsElement | null;
  const focusBand = chartWrapper.querySelector('#chart-focus-band') as SVGGraphicsElement | null;
  if (!tooltip || !stage) return;

  let activeIdx = -1;

  chartWrapper.querySelectorAll('.chart-column-group').forEach((group) => {
    group.addEventListener('mouseenter', () => {
      const target = group as SVGElement;
      const idx = Number(target.getAttribute('data-idx') || '-1');
      if (idx < 0 || idx >= columns.length || idx === activeIdx) return;
      activeIdx = idx;

      if (focusBand) {
        focusBand.style.display = 'none';
      }

      const col = columns[idx];
      const total = col.inputTok + col.outTok + col.cacheRead;
      const slotX = parseFloat(target.getAttribute('data-slot-x') || '0');
      const slotW = parseFloat(target.getAttribute('data-slot-w') || '0');

      if (hoverBand) {
        hoverBand.setAttribute('x', String(slotX));
        hoverBand.setAttribute('width', String(slotW));
        hoverBand.style.display = 'block';
        hoverBand.style.opacity = '1';
      }

      const ctxRowHtml = col.ctx
        ? `
          <div class="tooltip-row ctx-row">
            <span class="tooltip-dot" style="background: #3B82F6"></span>
            <span class="tooltip-label">Context Window</span>
            <span class="tooltip-val">${formatCompactNumber(col.ctx)} (${formatFullNumber(col.ctx)})</span>
          </div>
        `
        : '';

      tooltip.innerHTML = `
        <div class="tooltip-header">${escapeHtml(col.tooltipHeader)}</div>
        ${ctxRowHtml}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${formatFullNumber(col.outTok)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${formatFullNumber(col.inputTok)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${formatFullNumber(col.cacheRead)}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${formatFullNumber(total)}</span>
        </div>
        <div class="tooltip-subline">${formatFullNumber(total > 0 ? col.requests || 1 : col.requests)} generation requests${col.subText ? ' · ' + escapeHtml(col.subText) : ''}</div>
      `;

      tooltip.style.display = 'block';
      tooltip.style.opacity = '1';

      const stageRect = stage.getBoundingClientRect();
      const bandEl = (target.querySelector('.bar-bg-band') || target) as SVGGraphicsElement;
      const bandRect = bandEl.getBoundingClientRect();
      const bandLeft = bandRect.left - stageRect.left + stage.scrollLeft;
      const bandRight = bandRect.right - stageRect.left + stage.scrollLeft;

      positionTooltipNearAnchor({
        tooltip,
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        viewLeft: stage.scrollLeft,
        anchorLeft: bandLeft,
        anchorRight: bandRight,
        preferredTop: 10
      });
    });
  });

  stage.addEventListener('mouseleave', () => {
    activeIdx = -1;
    if (hoverBand) {
      hoverBand.setAttribute('width', '0');
      hoverBand.style.display = 'none';
    }
    tooltip.style.display = 'none';
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatBucketDurationBadge(bucketSizeSec: number): string {
  if (bucketSizeSec >= 86400) return `${Math.round(bucketSizeSec / 86400)}d`;
  if (bucketSizeSec >= 3600) return `${Math.round(bucketSizeSec / 3600)}h`;
  if (bucketSizeSec >= 60) return `${Math.round(bucketSizeSec / 60)}m`;
  return `${bucketSizeSec}s`;
}

function formatIdleGapLabel(gapSec: number): string {
  const mins = Math.round(gapSec / 60);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function formatSessionSlotAxisLabel(
  bucketStartSec: number,
  bucketSizeSec: number,
  isMultiDay: boolean
): string {
  const d = new Date(bucketStartSec * 1000);
  const md = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (bucketSizeSec >= 86400) return md;
  if (isMultiDay) return `${md} ${hm}`;
  if (bucketSizeSec < 60) return `${hm}:${pad2(d.getSeconds())}`;
  return hm;
}

function formatSessionSlotTooltipTitle(bucketStartSec: number, bucketSizeSec: number): string {
  const start = new Date(bucketStartSec * 1000);
  const startDate = formatLocalDateKey(start);
  if (bucketSizeSec >= 86400) return startDate;

  const end = new Date((bucketStartSec + bucketSizeSec) * 1000);
  const endDate = formatLocalDateKey(end);
  const startClock =
    bucketSizeSec < 60
      ? `${pad2(start.getHours())}:${pad2(start.getMinutes())}:${pad2(start.getSeconds())}`
      : `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const endClock =
    bucketSizeSec < 60
      ? `${pad2(end.getHours())}:${pad2(end.getMinutes())}:${pad2(end.getSeconds())}`
      : `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;

  if (startDate === endDate) {
    return `${startDate} ${startClock} - ${endClock}`;
  }
  return `${startDate} ${startClock} - ${endDate} ${endClock}`;
}

function resolveChartSeriesMeta(
  statsBySlot: Record<string, Record<string, ModelDailyStat>> | undefined,
  slotKeys: string[],
  preferredOrderIds?: string[]
): Array<{ key: string; label: string; tooltipLabel: string; color: string }> {
  const displayNameByKey = new Map<string, string>();
  for (const sKey of slotKeys) {
    const bucket = statsBySlot?.[sKey];
    if (!bucket) continue;
    for (const [mKey, st] of Object.entries(bucket)) {
      const resolvedName = st.modelName || (mKey === st.modelId ? canonicalModelName(mKey) : mKey);
      if (
        !mKey ||
        mKey.toLowerCase().includes('unknown') ||
        resolvedName.toLowerCase().includes('unknown')
      ) {
        continue;
      }
      if (computeBucketTps(st) > 0 && !displayNameByKey.has(mKey)) {
        displayNameByKey.set(mKey, resolvedName);
      }
    }
  }

  const orderedEntries = Array.from(displayNameByKey.entries());
  if (preferredOrderIds && preferredOrderIds.length > 0) {
    const rankMap = new Map<string, number>();
    preferredOrderIds.forEach((id, idx) => {
      if (id && !rankMap.has(id)) rankMap.set(id, idx);
    });
    orderedEntries.sort((a, b) => {
      const rankA = rankMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rankMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });
  }

  const nameCounts = new Map<string, number>();
  for (const [, name] of orderedEntries) {
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  const usedColors = new Set<string>();
  return orderedEntries.map(([key, displayName], idx) => {
    const isConflict = (nameCounts.get(displayName) || 0) > 1;
    const label = isConflict ? `${displayName} (${key})` : displayName;
    const tooltipLabel = key;
    const color = getModelColor(key || displayName, idx, usedColors);
    return { key, label, tooltipLabel, color };
  });
}

function resolveSessionTimelineModels(
  slots: NonNullable<SessionAnalyticsData['speedTimeline']>['slots'],
  sessionModels?: SessionAnalyticsData['models']
): Array<{ key: string; label: string; tooltipLabel: string; color: string }> {
  const modelMetaMap = new Map<
    string,
    { displayName: string; effOutTok: number; requests: number }
  >();

  for (const slot of slots) {
    for (const [mKey, st] of Object.entries(slot.models)) {
      const displayName = st.modelName || canonicalModelName(mKey);
      if (
        !mKey ||
        mKey.toLowerCase().includes('unknown') ||
        displayName.toLowerCase().includes('unknown') ||
        computeBucketTps(st) <= 0
      ) {
        continue;
      }
      const existing = modelMetaMap.get(mKey);
      if (!existing) {
        modelMetaMap.set(mKey, {
          displayName,
          effOutTok: st.effOutTok,
          requests: st.requests
        });
      } else {
        existing.effOutTok += st.effOutTok;
        existing.requests += st.requests;
      }
    }
  }

  // Match Model Token Consumption ordering so color-collision resolution stays identical across cards.
  const rankMap = new Map<string, number>();
  (sessionModels || []).forEach((m, idx) => {
    if (m.modelId && !rankMap.has(m.modelId)) rankMap.set(m.modelId, idx);
  });

  const sortedEntries = Array.from(modelMetaMap.entries()).sort((a, b) => {
    const rankA = rankMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
    const rankB = rankMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return b[1].effOutTok - a[1].effOutTok || b[1].requests - a[1].requests || a[0].localeCompare(b[0]);
  });

  const nameCounts = new Map<string, number>();
  for (const [, info] of sortedEntries) {
    nameCounts.set(info.displayName, (nameCounts.get(info.displayName) || 0) + 1);
  }

  const usedColors = new Set<string>();
  return sortedEntries.map(([key, info], idx) => {
    const isConflict = (nameCounts.get(info.displayName) || 0) > 1;
    const label = isConflict ? `${info.displayName} (${key})` : info.displayName;
    const tooltipLabel = key;
    const color = getModelColor(key || info.displayName, idx, usedColors);
    return { key, label, tooltipLabel, color };
  });
}

export function renderModelTpsChart(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const chartWrapper = document.getElementById('analytics-model-tps-chart');
  if (!chartWrapper) return;

  const isSession =
    range === 'session' &&
    Boolean(
      activeSessionData &&
        (activeSessionData.steps.length > 0 || (activeSessionData.speedTimeline?.slots.length || 0) > 0)
    );
  const isHourly = range === 'today' || range === 'yesterday';

  const svgWidth = 800;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 28;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const title = 'Model Speed Trends';
  let subtitle = '(Stream · E2E Fallback)';

  const series: NormalizedTpsModelSeries[] = [];
  const slotMeta: TpsSlotMeta[] = [];
  let totalSlots = 0;
  let maxTps = 80;
  let xLabelsSvg = '';
  let gapDividersSvg = '';
  let sessionGapThresholdSec = 0;
  let showModelLegend = true;

  if (isSession) {
    const timeline = activeSessionData!.speedTimeline;
    if (timeline && timeline.slots.length > 0) {
      const slots = timeline.slots;
      const bucketSizeSec = timeline.bucketSizeSec;
      const activeModels = resolveSessionTimelineModels(slots, activeSessionData!.models);
      if (activeModels.length === 0) {
        renderEmptyChartCard(chartWrapper, title, 'No throughput data recorded in this session', subtitle);
        return;
      }

      subtitle = `(${formatBucketDurationBadge(bucketSizeSec)} Buckets · Stream · E2E)`;
      sessionGapThresholdSec = Math.max(3600, bucketSizeSec * 6);

      let rawMaxTps = 0;
      for (const m of activeModels) {
        for (const slot of slots) {
          const st = slot.models[m.key];
          if (st) {
            const tps = computeBucketTps(st);
            if (tps > rawMaxTps) rawMaxTps = tps;
          }
        }
      }
      maxTps = computeNiceYScale(rawMaxTps, 60, 4).yMax;

      totalSlots = slots.length;
      const stepX = chartWidth / Math.max(1, totalSlots - 1);
      const isMultiDay =
        formatLocalDateKey(new Date(slots[0].bucketStartSec * 1000)) !==
        formatLocalDateKey(new Date(slots[slots.length - 1].bucketStartSec * 1000));

      activeModels.forEach((m) => {
        const pts: Array<TpsPoint | null> = slots.map((slot, idx) => {
          const st = slot.models[m.key];
          const tps = st ? computeBucketTps(st) : 0;
          if (tps <= 0) return null;
          const x = paddingLeft + (totalSlots > 1 ? idx * stepX : chartWidth / 2);
          const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
          return { x, y, tps, ts: slot.bucketStartSec };
        });
        series.push({ name: m.label, color: m.color, points: pts });
      });

      const gapBeforeSlot = new Array<number>(totalSlots).fill(0);
      for (let idx = 1; idx < totalSlots; idx++) {
        const delta = slots[idx].bucketStartSec - slots[idx - 1].bucketStartSec;
        if (delta > sessionGapThresholdSec) {
          gapBeforeSlot[idx] = delta;
          const prevX = paddingLeft + (idx - 1) * stepX;
          const currX = paddingLeft + idx * stepX;
          const midX = (prevX + currX) / 2;
          gapDividersSvg += `<line class="tps-gap-divider" x1="${midX.toFixed(1)}" y1="${paddingTop}" x2="${midX.toFixed(1)}" y2="${paddingTop + chartHeight}" stroke="var(--aura-fg-muted)" stroke-width="1" stroke-dasharray="2 3" opacity="0.45" />`;
        }
      }

      slots.forEach((slot, idx) => {
        const x = paddingLeft + (totalSlots > 1 ? idx * stepX : chartWidth / 2);
        const items: TpsSlotEntry[] = [];
        activeModels.forEach((m) => {
          const st = slot.models[m.key];
          if (st) {
            const tps = computeBucketTps(st);
            if (tps > 0) {
              items.push({ model: m.tooltipLabel || m.label, color: m.color, tps, reqs: st.requests });
            }
          }
        });
        const gapSec = gapBeforeSlot[idx];
        slotMeta.push({
          title: formatSessionSlotTooltipTitle(slot.bucketStartSec, bucketSizeSec),
          centerX: x,
          items,
          subline: gapSec > 0 ? `Resumed after ${formatIdleGapLabel(gapSec)} idle` : undefined
        });
      });

      if (totalSlots === 1) {
        const label = formatSessionSlotAxisLabel(slots[0].bucketStartSec, bucketSizeSec, isMultiDay);
        const x = paddingLeft + chartWidth / 2;
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${escapeHtml(label)}</text>`;
      } else {
        const maxLabels = isMultiDay ? 5 : 6;
        const labelInterval = Math.max(1, Math.ceil((totalSlots - 1) / Math.max(1, maxLabels - 1)));
        let lastRenderedIdx = -999;

        for (let idx = 0; idx < totalSlots - 1; idx++) {
          const isTooCloseToRight = totalSlots - 1 - idx < Math.ceil(labelInterval * 0.55);
          if (idx % labelInterval === 0 && !isTooCloseToRight) {
            const x = paddingLeft + idx * stepX;
            const anchor = idx === 0 ? 'start' : 'middle';
            const label = formatSessionSlotAxisLabel(
              slots[idx].bucketStartSec,
              bucketSizeSec,
              isMultiDay
            );
            xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="${anchor}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${escapeHtml(label)}</text>`;
            lastRenderedIdx = idx;
          }
        }

        if (totalSlots - 1 - lastRenderedIdx >= Math.max(1, Math.floor(labelInterval * 0.55))) {
          const lastIdx = totalSlots - 1;
          const lastX = paddingLeft + lastIdx * stepX;
          const label = formatSessionSlotAxisLabel(
            slots[lastIdx].bucketStartSec,
            bucketSizeSec,
            isMultiDay
          );
          xLabelsSvg += `<text x="${lastX.toFixed(1)}" y="${svgHeight - 8}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${escapeHtml(label)}</text>`;
        }
      }
    } else {
      showModelLegend = false;
      const steps = activeSessionData!.steps;
      totalSlots = steps.length;
      const rawValues = steps.map((st) => Math.round(computeStepTps(st.outTok, st.ttft, st.stream, st.totDur).displayTps));
      const rawMaxTps = rawValues.reduce((m, v) => (v <= 600 && v > m ? v : m), 0);
      maxTps = computeNiceYScale(rawMaxTps, 60, 4).yMax;

      const stepX = chartWidth / Math.max(1, totalSlots - 1);
      const pts: Array<TpsPoint | null> = steps.map((st, idx) => {
        const tps = Math.min(maxTps, rawValues[idx]);
        const x = paddingLeft + (totalSlots > 1 ? idx * stepX : chartWidth / 2);
        const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
        slotMeta.push({
          title: `Session Turn #${st.idx + 1}`,
          centerX: x,
          items: [{ model: `Turn #${st.idx + 1}`, color: '#3B82F6', tps, reqs: 1 }]
        });
        return { x, y, tps };
      });
      series.push({ name: 'Session', color: '#3B82F6', points: pts });

      const labelInterval = Math.max(1, Math.floor(totalSlots / 6));
      let lastRenderedIdx = -999;
      steps.forEach((st, idx) => {
        const isTooCloseToRight = totalSlots - 1 - idx < labelInterval * 0.7;
        if (idx % labelInterval === 0 && !isTooCloseToRight) {
          const x = paddingLeft + (totalSlots > 1 ? idx * stepX : chartWidth / 2);
          xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${st.idx + 1}</text>`;
          lastRenderedIdx = idx;
        }
      });
      if (totalSlots > 1 && totalSlots - 1 - lastRenderedIdx >= Math.floor(labelInterval * 0.5)) {
        const lastX = paddingLeft + chartWidth;
        xLabelsSvg += `<text x="${lastX.toFixed(1)}" y="${svgHeight - 8}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${totalSlots}</text>`;
      }
    }
  } else if (isHourly) {
    const targetDate =
      range === 'today'
        ? formatLocalDateKey(now)
        : formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const hourKeys = Array.from({ length: 24 }, (_, h) => `${targetDate} ${String(h).padStart(2, '0')}:00`);

    const preferredOrder = (overview.modelDistribution || []).map((m) => m.modelId);
    const activeModels = resolveChartSeriesMeta(overview.hourlyModelStats, hourKeys, preferredOrder);
    if (activeModels.length === 0) {
      renderEmptyChartCard(
        chartWrapper,
        title,
        `No throughput data recorded for ${range === 'today' ? 'today' : 'yesterday'}`,
        subtitle
      );
      return;
    }

    let rawMaxTps = 0;
    for (const m of activeModels) {
      for (const hKey of hourKeys) {
        const st = overview.hourlyModelStats?.[hKey]?.[m.key];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > rawMaxTps) rawMaxTps = tps;
        }
      }
    }
    maxTps = computeNiceYScale(rawMaxTps, 60, 4).yMax;

    totalSlots = hourKeys.length;
    const stepX = chartWidth / (hourKeys.length - 1);

    activeModels.forEach((m) => {
      const pts: Array<TpsPoint | null> = hourKeys.map((hKey, idx) => {
        const st = overview.hourlyModelStats?.[hKey]?.[m.key];
        const tps = st ? computeBucketTps(st) : 0;
        if (tps <= 0) return null;
        const x = paddingLeft + idx * stepX;
        const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
        return { x, y, tps };
      });
      series.push({ name: m.label, color: m.color, points: pts });
    });

    hourKeys.forEach((hKey, idx) => {
      const x = paddingLeft + idx * stepX;
      const items: TpsSlotEntry[] = [];
      activeModels.forEach((m) => {
        const st = overview.hourlyModelStats?.[hKey]?.[m.key];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > 0) {
            items.push({ model: m.tooltipLabel || m.label, color: m.color, tps, reqs: st.requests });
          }
        }
      });
      slotMeta.push({ title: hKey.slice(0, 16), centerX: x, items });
      if (idx % 3 === 0 && idx < 23) {
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${hKey.slice(11, 16)}</text>`;
      }
    });
  } else {
    const dateList = getFilterDatesForRange(range, customStart, customEnd, now);
    const preferredOrder = (overview.modelDistribution || []).map((m) => m.modelId);
    const activeModels = resolveChartSeriesMeta(overview.dailyModelStats, dateList, preferredOrder);
    if (activeModels.length === 0) {
      renderEmptyChartCard(chartWrapper, title, 'No throughput data recorded in this period', subtitle);
      return;
    }

    let rawMaxTps = 0;
    for (const m of activeModels) {
      for (const dStr of dateList) {
        const st = overview.dailyModelStats?.[dStr]?.[m.key];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > rawMaxTps) rawMaxTps = tps;
        }
      }
    }
    maxTps = computeNiceYScale(rawMaxTps, 60, 4).yMax;

    totalSlots = dateList.length;
    const stepX = chartWidth / Math.max(1, dateList.length - 1);

    activeModels.forEach((m) => {
      const pts: Array<TpsPoint | null> = dateList.map((dStr, idx) => {
        const st = overview.dailyModelStats?.[dStr]?.[m.key];
        const tps = st ? computeBucketTps(st) : 0;
        if (tps <= 0) return null;
        const x = paddingLeft + (dateList.length > 1 ? idx * stepX : chartWidth / 2);
        const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
        return { x, y, tps };
      });
      series.push({ name: m.label, color: m.color, points: pts });
    });

    const labelInterval = Math.max(2, Math.floor(dateList.length / 6));
    let lastRenderedIdx = -999;

    dateList.forEach((dStr, idx) => {
      const x = paddingLeft + (dateList.length > 1 ? idx * stepX : chartWidth / 2);
      const items: TpsSlotEntry[] = [];
      activeModels.forEach((m) => {
        const st = overview.dailyModelStats?.[dStr]?.[m.key];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > 0) {
            items.push({ model: m.tooltipLabel || m.label, color: m.color, tps, reqs: st.requests });
          }
        }
      });
      slotMeta.push({ title: formatFullDate(dStr), centerX: x, items });

      const isTooCloseToRight = dateList.length - 1 - idx < labelInterval * 0.75;
      if (idx % labelInterval === 0 && !isTooCloseToRight) {
        const anchor = idx === 0 ? 'start' : 'middle';
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="${anchor}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${escapeHtml(formatDateLabel(dStr))}</text>`;
        lastRenderedIdx = idx;
      }
    });

    if (
      dateList.length > 1 &&
      dateList.length - 1 - lastRenderedIdx >= Math.max(2, Math.floor(labelInterval * 0.5))
    ) {
      const lastX = paddingLeft + (dateList.length - 1) * stepX;
      xLabelsSvg += `<text x="${lastX.toFixed(1)}" y="${svgHeight - 8}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${escapeHtml(formatDateLabel(dateList[dateList.length - 1]))}</text>`;
    }
  }

  const yTicks = [0, maxTps * 0.25, maxTps * 0.5, maxTps * 0.75, maxTps];
  const { linesSvg: yAxisLinesSvg, textsSvg: yAxisTextsSvg } = buildYAxisGridSvg({
    yTicks,
    yMax: maxTps,
    paddingLeft,
    paddingRight,
    paddingTop,
    svgWidth,
    chartHeight
  });

  let pathsSvg = '';
  let dotsSvg = '';
  const showDots = totalSlots <= 50;

  for (const s of series) {
    let currentPath = '';
    let lastDrawnPt: TpsPoint | null = null;

    if (sessionGapThresholdSec > 0) {
      for (const p of s.points) {
        if (!p) continue;
        const breaksForGap =
          lastDrawnPt?.ts !== undefined &&
          p.ts !== undefined &&
          p.ts - lastDrawnPt.ts > sessionGapThresholdSec;

        if (breaksForGap && currentPath) {
          if (currentPath.includes(' L ')) {
            pathsSvg += `<path d="${currentPath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
          } else if (!showDots && lastDrawnPt) {
            dotsSvg += `<circle cx="${lastDrawnPt.x.toFixed(1)}" cy="${lastDrawnPt.y.toFixed(1)}" r="3.2" fill="${s.color}" stroke="var(--aura-bg, #1e1e1e)" stroke-width="1.5" />`;
          }
          currentPath = '';
        }

        currentPath = currentPath
          ? `${currentPath} L ${p.x.toFixed(1)},${p.y.toFixed(1)}`
          : `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        lastDrawnPt = p;
        if (showDots) {
          dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${s.color}" stroke="var(--aura-bg, #1e1e1e)" stroke-width="1.5" />`;
        }
      }
      if (currentPath) {
        if (currentPath.includes(' L ')) {
          pathsSvg += `<path d="${currentPath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
        } else if (!showDots && lastDrawnPt) {
          dotsSvg += `<circle cx="${lastDrawnPt.x.toFixed(1)}" cy="${lastDrawnPt.y.toFixed(1)}" r="3.2" fill="${s.color}" stroke="var(--aura-bg, #1e1e1e)" stroke-width="1.5" />`;
        }
      }
    } else {
      for (const p of s.points) {
        if (p) {
          currentPath = currentPath
            ? `${currentPath} L ${p.x.toFixed(1)},${p.y.toFixed(1)}`
            : `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          if (showDots) {
            dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${s.color}" stroke="var(--aura-bg, #1e1e1e)" stroke-width="1.5" />`;
          }
        } else if (currentPath) {
          pathsSvg += `<path d="${currentPath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
          currentPath = '';
        }
      }
      if (currentPath) {
        pathsSvg += `<path d="${currentPath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      }
    }
  }

  const legendHtml =
    showModelLegend && series.length > 0
      ? `<div class="tps-legend-bar">${series
          .map(
            (s) => `
              <span class="tps-legend-item">
                <span class="tps-legend-swatch" style="background: ${escapeHtml(s.color)}"></span>
                <span class="tps-legend-label">${escapeHtml(s.name)}</span>
              </span>
            `
          )
          .join('')}</div>`
      : '';

  const stepXForBand = chartWidth / Math.max(1, totalSlots - 1);
  const hoverBandsSvg = slotMeta
    .map((slot, idx) => {
      const bandX = Math.max(paddingLeft, slot.centerX - stepXForBand / 2);
      return `<rect class="tps-hover-slot" x="${bandX.toFixed(1)}" y="${paddingTop}" width="${stepXForBand.toFixed(1)}" height="${chartHeight}" fill="transparent" data-slot-idx="${idx}" />`;
    })
    .join('');

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <h3 class="chart-title">${title}<span class="chart-subtitle">${escapeHtml(subtitle)}</span></h3>
      </div>
    </div>
    ${legendHtml}
    <div class="chart-body" style="position: relative;">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
        ${yAxisLinesSvg}
        ${yAxisTextsSvg}
        ${gapDividersSvg}
        ${xLabelsSvg}
        ${pathsSvg}
        ${dotsSvg}
        <line id="tps-scrubber-line" x1="0" y1="${paddingTop}" x2="0" y2="${paddingTop + chartHeight}" stroke="var(--aura-border-focus, #3B82F6)" stroke-width="1.5" stroke-dasharray="2 2" style="display: none; pointer-events: none;" />
        ${hoverBandsSvg}
      </svg>
      <div class="chart-floating-tooltip" id="tps-floating-tooltip" style="display: none;"></div>
    </div>
  `;

  attachTpsTooltipListeners(chartWrapper, svgWidth, slotMeta);
}

function attachTpsTooltipListeners(
  chartWrapper: HTMLElement,
  svgWidth: number,
  slotMeta: TpsSlotMeta[]
): void {
  const stage = chartWrapper.querySelector('.chart-body') as HTMLElement | null;
  const scrubber = chartWrapper.querySelector('#tps-scrubber-line') as SVGLineElement | null;
  const tooltip = chartWrapper.querySelector('#tps-floating-tooltip') as HTMLElement | null;
  if (!stage || !tooltip || !scrubber) return;

  chartWrapper.querySelectorAll('.tps-hover-slot').forEach((slot) => {
    slot.addEventListener('mouseenter', () => {
      const idx = Number(slot.getAttribute('data-slot-idx') || '-1');
      const meta = slotMeta[idx];
      if (!meta) return;

      scrubber.setAttribute('x1', String(meta.centerX));
      scrubber.setAttribute('x2', String(meta.centerX));
      scrubber.style.display = 'block';

      const rowsHtml =
        meta.items.length > 0
          ? meta.items
              .map(
                (m) => `
                  <div class="tooltip-row">
                    <span class="tooltip-dot" style="background: ${escapeHtml(m.color)}"></span>
                    <span class="tooltip-label">${escapeHtml(m.model)}</span>
                    <span class="tooltip-val">${m.tps} tok/s (${formatFullNumber(m.reqs)} reqs)</span>
                  </div>
                `
              )
              .join('')
          : '<div class="tooltip-subline">No activity on this date</div>';

      const sublineHtml = meta.subline
        ? `<div class="tooltip-subline">${escapeHtml(meta.subline)}</div>`
        : '';

      tooltip.innerHTML = `
        <div class="tooltip-header">${escapeHtml(meta.title)}</div>
        ${rowsHtml}
        ${sublineHtml}
      `;

      tooltip.style.display = 'block';
      tooltip.style.opacity = '1';

      const stageRect = stage.getBoundingClientRect();
      const pxRatio = stageRect.width / svgWidth;
      const screenX = meta.centerX * pxRatio;

      positionTooltipNearAnchor({
        tooltip,
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        anchorLeft: screenX,
        anchorRight: screenX,
        preferredTop: 16
      });
    });
  });

  stage.addEventListener('mouseleave', () => {
    scrubber.style.display = 'none';
    tooltip.style.opacity = '0';
    setTimeout(() => {
      if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
    }, 120);
  });
}

export function renderLatencyTtftDistributionChart(
  activeSessionData: SessionAnalyticsData | null
): void {
  const chartWrapper = document.getElementById('analytics-latency-ttft-chart');
  if (!chartWrapper) return;

  const title = 'Turn Latency vs. TTFT Distribution';
  const subtitle = '(Active Session)';
  const steps = activeSessionData?.steps || [];

  if (steps.length === 0) {
    renderEmptyChartCard(
      chartWrapper,
      title,
      'No interaction turn latency metrics available',
      subtitle
    );
    return;
  }

  const validPoints: Array<Omit<ScatterPointMeta, 'cx' | 'cy'>> = [];
  const ttftList: number[] = [];
  const latList: number[] = [];

  for (const st of steps) {
    const dur = st.totDur > 0 ? st.totDur : st.ttft + st.stream;
    if (st.ttft > 0 && dur > 0) {
      validPoints.push({
        idx: st.idx + 1,
        ttft: st.ttft,
        totDur: dur,
        stream: st.stream,
        outTok: st.outTok,
        speed: Math.round(computeStepTps(st.outTok, st.ttft, st.stream, st.totDur).displayTps)
      });
      ttftList.push(st.ttft);
      latList.push(dur);
    }
  }

  if (validPoints.length === 0) {
    renderEmptyChartCard(chartWrapper, title, 'No valid TTFT/Latency data recorded', subtitle);
    return;
  }

  const p50Ttft = computePercentile(ttftList, 0.5);
  const p95Ttft = computePercentile(ttftList, 0.95);
  const p50Lat = computePercentile(latList, 0.5);
  const p95Lat = computePercentile(latList, 0.95);

  const svgWidth = 800;
  const svgHeight = 300;
  const paddingLeft = 52;
  const paddingRight = 44;
  const paddingTop = 32;
  const paddingBottom = 38;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxX = Math.max(35, Math.ceil((p95Ttft * 1.5) / 5) * 5);
  const maxY = Math.max(45, Math.ceil((p95Lat * 1.5) / 5) * 5);

  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((r) => Math.round(maxY * r));
  const xTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((r) => Math.round(maxX * r));

  const { linesSvg: yAxisLinesSvg, textsSvg: yAxisTextsSvg } = buildYAxisGridSvg({
    yTicks,
    yMax: maxY,
    paddingLeft,
    paddingRight,
    paddingTop,
    svgWidth,
    chartHeight,
    unitSuffix: 's',
    axisOpacityGrid: '0.2'
  });

  let xAxisLinesSvg = '';
  let xAxisTextsSvg = '';
  for (const tickVal of xTicks) {
    const x = paddingLeft + (tickVal / maxX) * chartWidth;
    xAxisLinesSvg += `<line x1="${x.toFixed(1)}" y1="${paddingTop}" x2="${x.toFixed(1)}" y2="${paddingTop + chartHeight}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="${tickVal === 0 ? '0.6' : '0.15'}" />`;
    xAxisTextsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 12}" text-anchor="middle" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${tickVal}s</text>`;
  }

  const diagMax = Math.min(maxX, maxY);
  const diagX2 = paddingLeft + (diagMax / maxX) * chartWidth;
  const diagY2 = paddingTop + chartHeight - (diagMax / maxY) * chartHeight;
  const diagonalSvg = `
    <line x1="${paddingLeft.toFixed(1)}" y1="${(paddingTop + chartHeight).toFixed(1)}" x2="${diagX2.toFixed(1)}" y2="${diagY2.toFixed(1)}"
          stroke="var(--aura-fg-muted)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" class="chart-ref-line" />
    <text x="${(diagX2 - 4).toFixed(1)}" y="${(diagY2 - 6).toFixed(1)}" text-anchor="end" font-size="9.5" font-family="inherit" fill="var(--aura-fg-muted)" opacity="0.55">y = x (Zero Stream)</text>
  `;

  const renderRefGroup = (label: string, color: string, ttftVal: number, latVal: number, cls: string) => {
    const px = paddingLeft + (ttftVal / maxX) * chartWidth;
    const py = paddingTop + chartHeight - (latVal / maxY) * chartHeight;
    return `
      <g class="${cls}" opacity="0.9">
        <line x1="${px.toFixed(1)}" y1="${paddingTop}" x2="${px.toFixed(1)}" y2="${paddingTop + chartHeight}" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 3" class="chart-ref-line" />
        <line x1="${paddingLeft}" y1="${py.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${py.toFixed(1)}" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 3" class="chart-ref-line" />
        <rect x="${(px - 26).toFixed(1)}" y="${(paddingTop - 18).toFixed(1)}" width="52" height="15" rx="3" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="0.8" />
        <text x="${px.toFixed(1)}" y="${(paddingTop - 7).toFixed(1)}" text-anchor="middle" font-size="9" font-family="var(--aura-font-mono)" font-weight="600" fill="${color}">${label} ${ttftVal.toFixed(1)}s</text>
        <rect x="${(svgWidth - paddingRight + 4).toFixed(1)}" y="${(py - 8).toFixed(1)}" width="36" height="15" rx="3" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="0.8" />
        <text x="${(svgWidth - paddingRight + 22).toFixed(1)}" y="${(py + 3).toFixed(1)}" text-anchor="middle" font-size="8.5" font-family="var(--aura-font-mono)" font-weight="600" fill="${color}">${latVal.toFixed(1)}s</text>
      </g>
    `;
  };

  const p50Svg = renderRefGroup('P50', '#3B82F6', p50Ttft, p50Lat, 'chart-ref-p50');
  const p95Svg = renderRefGroup('P95', '#F59E0B', p95Ttft, p95Lat, 'chart-ref-p95');

  const plottedPoints: ScatterPointMeta[] = [];
  let pointsSvg = '';

  for (const p of validPoints) {
    if (p.ttft > maxX || p.totDur > maxY) continue;
    const cx = paddingLeft + (p.ttft / maxX) * chartWidth;
    const cy = paddingTop + chartHeight - (p.totDur / maxY) * chartHeight;
    const ptIdx = plottedPoints.length;
    plottedPoints.push({ ...p, cx, cy });
    pointsSvg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.2" fill="#00A67E" fill-opacity="0.45" class="latency-scatter-pt" data-pt-idx="${ptIdx}" />`;
  }

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <h3 class="chart-title">${title}<span class="chart-subtitle">${subtitle}</span></h3>
      </div>
      <div class="scatter-legend">
        <div class="scatter-legend-item">
          <span class="scatter-legend-dot" style="background: #00A67E;"></span>
          <span>Turns (${formatFullNumber(plottedPoints.length)})</span>
        </div>
        <div class="scatter-legend-item">
          <span class="scatter-legend-line" style="border-color: #3B82F6;"></span>
          <span style="color: #3B82F6; font-weight: 500;">P50 (${p50Ttft.toFixed(1)}s · ${p50Lat.toFixed(1)}s)</span>
        </div>
        <div class="scatter-legend-item">
          <span class="scatter-legend-line" style="border-color: #F59E0B;"></span>
          <span style="color: #F59E0B; font-weight: 500;">P95 (${p95Ttft.toFixed(1)}s · ${p95Lat.toFixed(1)}s)</span>
        </div>
      </div>
    </div>
    <div class="chart-body" style="position: relative;">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="latency-ttft-svg">
        ${yAxisLinesSvg}
        ${xAxisLinesSvg}
        ${yAxisTextsSvg}
        ${xAxisTextsSvg}
        ${diagonalSvg}
        ${p50Svg}
        ${p95Svg}
        <g id="latency-scatter-points-group">${pointsSvg}</g>
        <circle id="scatter-hover-cursor" cx="0" cy="0" r="4.5" fill="#3B82F6" stroke="#FFFFFF" stroke-width="1.5" style="display: none; pointer-events: none;" />
        <text x="${(paddingLeft + chartWidth / 2).toFixed(1)}" y="${svgHeight - 1}" text-anchor="middle" font-size="10" font-weight="500" fill="var(--aura-fg-muted)">Time to First Token (TTFT, seconds)</text>
        <text x="${(paddingLeft - 36).toFixed(1)}" y="${(paddingTop + chartHeight / 2).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="500" fill="var(--aura-fg-muted)" transform="rotate(-90 ${(paddingLeft - 36).toFixed(1)} ${(paddingTop + chartHeight / 2).toFixed(1)})">Total Latency (seconds)</text>
      </svg>
      <div class="chart-floating-tooltip" id="latency-ttft-floating-tooltip" style="display: none;"></div>
    </div>
  `;

  attachLatencyScatterTooltipListeners(chartWrapper, svgWidth, plottedPoints);
}

function attachLatencyScatterTooltipListeners(
  chartWrapper: HTMLElement,
  svgWidth: number,
  points: ScatterPointMeta[]
): void {
  const stage = chartWrapper.querySelector('.chart-body') as HTMLElement | null;
  const cursor = chartWrapper.querySelector('#scatter-hover-cursor') as SVGCircleElement | null;
  const tooltip = chartWrapper.querySelector('#latency-ttft-floating-tooltip') as HTMLElement | null;
  if (!stage || !tooltip) return;

  chartWrapper.querySelectorAll('.latency-scatter-pt').forEach((circle) => {
    circle.addEventListener('mouseenter', () => {
      const pt = points[Number(circle.getAttribute('data-pt-idx') || '-1')];
      if (!pt) return;

      if (cursor) {
        cursor.setAttribute('cx', String(pt.cx));
        cursor.setAttribute('cy', String(pt.cy));
        cursor.style.display = 'block';
      }

      tooltip.innerHTML = `
        <div class="tooltip-header">Session Turn #${pt.idx}</div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">TTFT:</span>
          <span class="tooltip-val">${pt.ttft.toFixed(2)}s</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #F59E0B"></span>
          <span class="tooltip-label">Total Latency:</span>
          <span class="tooltip-val">${pt.totDur.toFixed(2)}s</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Stream Gen:</span>
          <span class="tooltip-val">${pt.stream.toFixed(2)}s (${formatFullNumber(pt.outTok)} tok)</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #8B5CF6"></span>
          <span class="tooltip-label">Speed:</span>
          <span class="tooltip-val">${pt.speed} tok/s</span>
        </div>
      `;

      tooltip.style.display = 'block';
      tooltip.style.opacity = '1';

      const stageRect = stage.getBoundingClientRect();
      const pxRatio = stageRect.width / svgWidth;
      const screenX = pt.cx * pxRatio;
      const screenY = pt.cy * pxRatio;

      positionTooltipNearAnchor({
        tooltip,
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        anchorLeft: screenX,
        anchorRight: screenX,
        preferredTop: screenY < 34 ? screenY + 12 : screenY - 24,
        minWidthFallback: 190
      });
    });
  });

  stage.addEventListener('mouseleave', () => {
    if (cursor) cursor.style.display = 'none';
    tooltip.style.opacity = '0';
    setTimeout(() => {
      if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
    }, 120);
  });
}
