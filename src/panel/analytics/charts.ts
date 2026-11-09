import { getModelColor } from '../../shared/catalog';
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

interface OverviewStepPoint extends ConversationStepMetric {
  effectiveCtx: number;
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
}

interface TpsPoint {
  x: number;
  y: number;
  tps: number;
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

export function renderActivityChart(
  columns: ChartColumnData[],
  rangeTitle: string,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null
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
    renderStandardTimelineChart(chartWrapper, columns, rangeTitle, isSession, range, activeSessionData);
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

  let lastValidCtx = 0;
  const sanitizedSteps: OverviewStepPoint[] = steps.map((st) => {
    let c = st.ctx || st.inTok + st.cacheRead;
    if (c === 0 && st.inTok === 0 && st.outTok === 0) {
      c = lastValidCtx;
    } else {
      lastValidCtx = c;
    }
    return { ...st, effectiveCtx: c };
  });

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

  const yAxisSvg = renderStickyYAxis(yTicks, yMax, paddingTop, chartHeight);

  let gridSvg = '';
  for (const tickVal of yTicks) {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + chartWidth}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.2'}" />`;
  }

  let areaD = '';
  let lineD = '';
  let xLabelsSvg = '';
  const labelInterval = Math.max(1, Math.floor(totalTurns / 6));

  if (totalTurns === 1) {
    const y = paddingTop + chartHeight - (sanitizedSteps[0].effectiveCtx / yMax) * chartHeight;
    areaD = `M ${paddingLeft},${paddingTop + chartHeight} L ${paddingLeft},${y.toFixed(1)} L ${paddingLeft + chartWidth},${y.toFixed(1)} L ${paddingLeft + chartWidth},${paddingTop + chartHeight} Z`;
    lineD = `M ${paddingLeft},${y.toFixed(1)} L ${paddingLeft + chartWidth},${y.toFixed(1)}`;
    xLabelsSvg = `<text x="${paddingLeft}" y="${svgHeight - 8}" text-anchor="start" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#1</text>`;
  } else {
    areaD = `M ${paddingLeft},${paddingTop + chartHeight}`;
    let lastRenderedLabelIdx = -999;

    sanitizedSteps.forEach((st, idx) => {
      const x = paddingLeft + (idx / (totalTurns - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (st.effectiveCtx / yMax) * chartHeight;
      areaD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      lineD = idx === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)}` : `${lineD} L ${x.toFixed(1)},${y.toFixed(1)}`;

      const isTooCloseToRight = totalTurns - 1 - idx < labelInterval * 0.7;
      if (idx % labelInterval === 0 && !isTooCloseToRight) {
        const textAnchor = idx === 0 ? 'start' : 'middle';
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="${textAnchor}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${idx + 1}</text>`;
        lastRenderedLabelIdx = idx;
      }
    });

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
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Context Window Watermark</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${svgHeight}" class="y-axis-svg">${yAxisSvg}</svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage" id="chart-stage-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            ${gridSvg}
            <path d="${areaD}" fill="url(#aura-ctx-grad)" />
            <path d="${lineD}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${xLabelsSvg}
          </svg>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-scrubber-dot" id="chart-scrubber-dot" style="display: none;"></div>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `;

  attachViewModeSwitchListeners(chartWrapper, columns, rangeTitle, range, session);
  attachOverviewScrubberListeners(chartWrapper, sanitizedSteps, yMax, {
    svgWidth,
    svgHeight,
    paddingLeft,
    paddingTop,
    chartWidth,
    chartHeight
  });
}

function attachOverviewScrubberListeners(
  chartWrapper: HTMLElement,
  steps: OverviewStepPoint[],
  yMax: number,
  coord: OverviewCoord
): void {
  const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
  const scrubber = chartWrapper.querySelector('#chart-scrubber-line') as HTMLElement | null;
  const scrubberDot = chartWrapper.querySelector('#chart-scrubber-dot') as HTMLElement | null;
  const tooltip = chartWrapper.querySelector('#chart-floating-tooltip') as HTMLElement | null;
  if (!stage || !scrubber || !tooltip) return;

  const { svgWidth, svgHeight, paddingLeft, paddingTop, chartWidth, chartHeight } = coord;
  const totalTurns = steps.length;

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;

    const mouseX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const mouseSvgX = (mouseX / rect.width) * svgWidth;
    const clampedSvgX = Math.max(paddingLeft, Math.min(paddingLeft + chartWidth, mouseSvgX));
    const ratio = chartWidth > 0 ? (clampedSvgX - paddingLeft) / chartWidth : 0;
    const stepIdx = Math.min(totalTurns - 1, Math.max(0, Math.round(ratio * (totalTurns - 1))));

    const st = steps[stepIdx];
    if (!st) return;

    const ctx = st.effectiveCtx;
    const isActionTurn = st.inTok === 0 && st.outTok === 0 && st.cacheRead === 0;
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

    tooltip.innerHTML = `
      <div class="tooltip-header">Session Turn #${st.idx + 1}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${formatCompactNumber(ctx)} (${formatFullNumber(ctx)})</span>
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
    scrubber.style.display = 'none';
    if (scrubberDot) scrubberDot.style.display = 'none';
    tooltip.style.display = 'none';
  });
}

function renderStandardTimelineChart(
  chartWrapper: HTMLElement,
  columns: ChartColumnData[],
  rangeTitle: string,
  isSession: boolean,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null
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
  let xLabelsSvg = '';

  const isHourly = columns.length === 24 && (columns[0]?.label.includes(':00') || false);
  const isSessionTimeline = columns[0]?.label.startsWith('#') || false;
  const labelInterval = isHourly ? 3 : Math.max(1, Math.floor(columns.length / 8));

  columns.forEach((item, idx) => {
    const x = paddingLeft + idx * step + (step - barWidth) / 2;
    const total = item.inputTok + item.outTok + item.cacheRead;
    const slotX = paddingLeft + idx * step;
    const centerX = x + barWidth / 2;

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
        stage.scrollLeft = stage.scrollWidth;
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
  if (!tooltip || !stage) return;

  let activeIdx = -1;

  chartWrapper.querySelectorAll('.chart-column-group').forEach((group) => {
    group.addEventListener('mouseenter', () => {
      const target = group as SVGElement;
      const idx = Number(target.getAttribute('data-idx') || '-1');
      if (idx < 0 || idx >= columns.length || idx === activeIdx) return;
      activeIdx = idx;

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

  const isSession = range === 'session' && Boolean(activeSessionData && activeSessionData.steps.length > 0);
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
  const subtitle = '(Stream · E2E Fallback)';

  const series: NormalizedTpsModelSeries[] = [];
  const slotMeta: TpsSlotMeta[] = [];
  let totalSlots = 0;
  let maxTps = 80;
  let xLabelsSvg = '';

  if (isSession) {
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
  } else if (isHourly) {
    const targetDate =
      range === 'today'
        ? formatLocalDateKey(now)
        : formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const hourKeys = Array.from({ length: 24 }, (_, h) => `${targetDate} ${String(h).padStart(2, '0')}:00`);

    const activeModelsSet = new Set<string>();
    for (const hKey of hourKeys) {
      const hModels = overview.hourlyModelStats?.[hKey];
      if (!hModels) continue;
      for (const [mName, st] of Object.entries(hModels)) {
        if (!mName.toLowerCase().includes('unknown') && computeBucketTps(st) > 0) {
          activeModelsSet.add(mName);
        }
      }
    }

    const activeModelNames = Array.from(activeModelsSet);
    if (activeModelNames.length === 0) {
      renderEmptyChartCard(
        chartWrapper,
        title,
        `No throughput data recorded for ${range === 'today' ? 'today' : 'yesterday'}`,
        subtitle
      );
      return;
    }

    let rawMaxTps = 0;
    for (const mName of activeModelNames) {
      for (const hKey of hourKeys) {
        const st = overview.hourlyModelStats?.[hKey]?.[mName];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > rawMaxTps) rawMaxTps = tps;
        }
      }
    }
    maxTps = computeNiceYScale(rawMaxTps, 60, 4).yMax;

    totalSlots = hourKeys.length;
    const stepX = chartWidth / (hourKeys.length - 1);

    activeModelNames.forEach((mName, mIdx) => {
      const color = getModelColor(mName, mIdx);
      const pts: Array<TpsPoint | null> = hourKeys.map((hKey, idx) => {
        const st = overview.hourlyModelStats?.[hKey]?.[mName];
        const tps = st ? computeBucketTps(st) : 0;
        if (tps <= 0) return null;
        const x = paddingLeft + idx * stepX;
        const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
        return { x, y, tps };
      });
      series.push({ name: mName, color, points: pts });
    });

    hourKeys.forEach((hKey, idx) => {
      const x = paddingLeft + idx * stepX;
      const items: TpsSlotEntry[] = [];
      activeModelNames.forEach((mName, mIdx) => {
        const st = overview.hourlyModelStats?.[hKey]?.[mName];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > 0) {
            items.push({ model: mName, color: getModelColor(mName, mIdx), tps, reqs: st.requests });
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
    const activeModelsSet = new Set<string>();
    for (const d of dateList) {
      const dayStats = overview.dailyModelStats?.[d];
      if (!dayStats) continue;
      for (const [mName, st] of Object.entries(dayStats)) {
        if (!mName.toLowerCase().includes('unknown') && computeBucketTps(st) > 0) {
          activeModelsSet.add(mName);
        }
      }
    }

    const activeModelNames = Array.from(activeModelsSet);
    if (activeModelNames.length === 0) {
      renderEmptyChartCard(chartWrapper, title, 'No throughput data recorded in this period', subtitle);
      return;
    }

    let rawMaxTps = 0;
    for (const mName of activeModelNames) {
      for (const dStr of dateList) {
        const st = overview.dailyModelStats?.[dStr]?.[mName];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > rawMaxTps) rawMaxTps = tps;
        }
      }
    }
    maxTps = computeNiceYScale(rawMaxTps, 60, 4).yMax;

    totalSlots = dateList.length;
    const stepX = chartWidth / Math.max(1, dateList.length - 1);

    activeModelNames.forEach((mName, mIdx) => {
      const color = getModelColor(mName, mIdx);
      const pts: Array<TpsPoint | null> = dateList.map((dStr, idx) => {
        const st = overview.dailyModelStats?.[dStr]?.[mName];
        const tps = st ? computeBucketTps(st) : 0;
        if (tps <= 0) return null;
        const x = paddingLeft + (dateList.length > 1 ? idx * stepX : chartWidth / 2);
        const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
        return { x, y, tps };
      });
      series.push({ name: mName, color, points: pts });
    });

    const labelInterval = Math.max(2, Math.floor(dateList.length / 6));
    let lastRenderedIdx = -999;

    dateList.forEach((dStr, idx) => {
      const x = paddingLeft + (dateList.length > 1 ? idx * stepX : chartWidth / 2);
      const items: TpsSlotEntry[] = [];
      activeModelNames.forEach((mName, mIdx) => {
        const st = overview.dailyModelStats?.[dStr]?.[mName];
        if (st) {
          const tps = computeBucketTps(st);
          if (tps > 0) {
            items.push({ model: mName, color: getModelColor(mName, mIdx), tps, reqs: st.requests });
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
  const showDots = !isSession || totalSlots <= 50;

  for (const s of series) {
    let currentPath = '';
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
        <h3 class="chart-title">${title}<span class="chart-subtitle">${subtitle}</span></h3>
      </div>
    </div>
    <div class="chart-body" style="position: relative;">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
        ${yAxisLinesSvg}
        ${yAxisTextsSvg}
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

      tooltip.innerHTML = `
        <div class="tooltip-header">${escapeHtml(meta.title)}</div>
        ${rowsHtml}
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
