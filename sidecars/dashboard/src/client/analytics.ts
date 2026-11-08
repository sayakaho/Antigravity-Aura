/**
 * Aura Dashboard · Global Telemetry & Analytics Module (TypeScript)
 * Features:
 * - 8 Time Range Filters: Session, Today, Yesterday, This Week, This Month, Last 7 Days, Last 30 Days, Custom
 * - Dynamic Granularity: Step (Session), Hourly (Today/Yesterday), Daily (Week/Month), Weekly (>90 Days)
 * - Column Hover Full-height Highlight Band
 * - Smart Non-jittering Tooltip with Boundary-aware Anchor Positioning
 */

import type { GlobalAnalyticsOverview, ConversationSummary, SessionAnalyticsData } from '../types';

export function formatCompactNumber(n: number): string {
  if (!n || n <= 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return Math.round(n / 1_000) + 'k';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function formatFullNumber(n: number): string {
  return (n || 0).toLocaleString('en-US');
}

export function formatRelativeTime(isoStr: string): string {
  if (!isoStr) return 'Recently';
  try {
    const past = new Date(isoStr).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - past) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return 'Recently';
  }
}

export function formatDateLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(5);
  }
}

export function formatFullDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export type TimeRangeOption =
  | 'session'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'last-7-days'
  | 'last-30-days'
  | 'custom';

export interface ChartColumnData {
  label: string;
  tooltipHeader: string;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  ctx?: number;
  requests: number;
  subText?: string;
}

let rawOverview: GlobalAnalyticsOverview | null = null;
let currentRange: TimeRangeOption = 'last-30-days';
let customStartDate = '';
let customEndDate = '';
let activeSessionData: SessionAnalyticsData | null = null;

export async function fetchOverview(): Promise<GlobalAnalyticsOverview | null> {
  try {
    const res = await window.sidecar.fetch('/api/analytics/overview', { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch overview:', err);
    return null;
  }
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  try {
    const res = await window.sidecar.fetch('/api/analytics/conversations', { method: 'GET' });
    if (!res.ok) return [];
    const json = await res.json();
    return json.ok && Array.isArray(json.conversations) ? json.conversations : [];
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch conversations:', err);
    return [];
  }
}

export async function fetchActiveSession(): Promise<SessionAnalyticsData | null> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversationId') || '';
    const endpoint = convId ? `/api/analytics/session?id=${encodeURIComponent(convId)}` : '/api/analytics/session';
    const res = await window.sidecar.fetch(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch active session:', err);
    return null;
  }
}

function getTodayString(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getYesterdayString(): string {
  const d = new Date(Date.now() - 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getStartOfWeekString(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
}

function getStartOfMonthString(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
}

function getPastDaysString(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function generateContinuousDateList(startStr: string, endStr: string): string[] {
  const result: string[] = [];
  const curr = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr > end) {
    return [startStr];
  }
  while (curr <= end) {
    const yr = curr.getFullYear();
    const mo = String(curr.getMonth() + 1).padStart(2, '0');
    const dy = String(curr.getDate()).padStart(2, '0');
    result.push(`${yr}-${mo}-${dy}`);
    curr.setDate(curr.getDate() + 1);
  }
  return result;
}

export function computeProcessedColumns(overview: GlobalAnalyticsOverview, range: TimeRangeOption): {
  columns: ChartColumnData[];
  totalTokens: { input: number; output: number; cacheRead: number; thinking: number; total: number };
  totalRequests: number;
  cacheEfficiency: number;
  avgTtft: number;
  avgTokPerSec: number;
} {
  const today = getTodayString();
  const yesterday = getYesterdayString();

  // 1. Session Mode - Render all turns continuously to visualize Context Window trajectory
  if (range === 'session' && activeSessionData && activeSessionData.steps.length > 0) {
    const s = activeSessionData;
    const columns: ChartColumnData[] = s.steps.map((st) => {
      const ctx = st.ctx || (st.inTok + st.cacheRead);
      return {
        label: `#${st.idx + 1}`,
        tooltipHeader: `Session Turn #${st.idx + 1}`,
        inputTok: st.inTok,
        outTok: st.outTok,
        cacheRead: st.cacheRead,
        ctx,
        requests: 1,
        subText: `Context: ${formatCompactNumber(ctx)} · Speed: ${Math.round(st.stream > 0 ? st.outTok / st.stream : 0)} tok/s`
      };
    });

    return {
      columns,
      totalTokens: s.totalTokens,
      totalRequests: s.totalRequests,
      cacheEfficiency: s.cacheEfficiency,
      avgTtft: s.avgTtft,
      avgTokPerSec: s.avgTokPerSec
    };
  }

  // 2. Hourly Granularity (Today / Yesterday)
  if (range === 'today' || range === 'yesterday') {
    const targetDate = range === 'today' ? today : yesterday;
    const hourlyMap: Record<string, ChartColumnData> = {};

    // Initialize all 24 hours of the day
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const hourKey = `${targetDate} ${hh}:00`;
      hourlyMap[hourKey] = {
        label: `${hh}:00`,
        tooltipHeader: `${targetDate} ${hh}:00 - ${hh}:59`,
        inputTok: 0,
        outTok: 0,
        cacheRead: 0,
        requests: 0
      };
    }

    // Populate from hourlySeries
    for (const hItem of overview.hourlySeries || []) {
      if (hItem.hourKey && hItem.hourKey.startsWith(targetDate)) {
        const key = hItem.hourKey.slice(0, 16);
        if (hourlyMap[key]) {
          hourlyMap[key].inputTok += hItem.inputTok;
          hourlyMap[key].outTok += hItem.outTok;
          hourlyMap[key].cacheRead += hItem.cacheRead;
          hourlyMap[key].requests += hItem.requests;
        }
      }
    }

    const columns = Object.values(hourlyMap);
    let inTok = 0, outTok = 0, cacheTok = 0, reqs = 0;
    for (const c of columns) {
      inTok += c.inputTok;
      outTok += c.outTok;
      cacheTok += c.cacheRead;
      reqs += c.requests;
    }

    const totalTok = inTok + outTok + cacheTok;
    const rawTotal = inTok + cacheTok;
    const efficiency = rawTotal > 0 ? (cacheTok / rawTotal) * 100 : overview.cacheEfficiency;

    return {
      columns,
      totalTokens: {
        input: inTok,
        output: outTok,
        cacheRead: cacheTok,
        thinking: overview.totalTokens.thinking,
        total: totalTok
      },
      totalRequests: reqs,
      cacheEfficiency: efficiency,
      avgTtft: overview.avgTtft,
      avgTokPerSec: overview.avgTokPerSec
    };
  }

  // 3. Daily Granularity (This Week, This Month, Last 7 Days, Last 30 Days, Custom)
  let startDate = '0000-00-00';
  let endDate = today;

  if (range === 'this-week') {
    startDate = getStartOfWeekString();
    // Render full Monday to Sunday week range
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    endDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } else if (range === 'this-month') {
    startDate = getStartOfMonthString();
    endDate = today;
  } else if (range === 'last-7-days') {
    startDate = getPastDaysString(6);
    endDate = today;
  } else if (range === 'last-30-days') {
    startDate = getPastDaysString(29);
    endDate = today;
  } else if (range === 'custom') {
    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    }
  }

  // Create date lookup map from timeRangeSeries
  const dateMap: Record<string, { inputTok: number; outTok: number; cacheRead: number; requests: number }> = {};
  for (const item of overview.timeRangeSeries || []) {
    if (item.date && !item.date.startsWith('0001')) {
      dateMap[item.date] = {
        inputTok: item.inputTok,
        outTok: item.outTok,
        cacheRead: item.cacheRead,
        requests: item.requests || 1
      };
    }
  }

  const dateList = generateContinuousDateList(startDate, endDate);
  const startMs = new Date(startDate + 'T00:00:00').getTime();
  const endMs = new Date(endDate + 'T00:00:00').getTime();
  const daySpan = Math.round((endMs - startMs) / 86400000);

  // Over 90 days: aggregate by week
  if (daySpan > 90) {
    const weeklyMap: Record<string, ChartColumnData> = {};
    for (const dStr of dateList) {
      const item = dateMap[dStr] || { inputTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
      const d = new Date(dStr + 'T00:00:00');
      const weekNum = Math.floor(d.getDate() / 7) + 1;
      const weekKey = `${dStr.slice(0, 7)} W${weekNum}`;
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          label: weekKey.slice(5),
          tooltipHeader: `Week of ${dStr}`,
          inputTok: 0,
          outTok: 0,
          cacheRead: 0,
          requests: 0
        };
      }
      weeklyMap[weekKey].inputTok += item.inputTok;
      weeklyMap[weekKey].outTok += item.outTok;
      weeklyMap[weekKey].cacheRead += item.cacheRead;
      weeklyMap[weekKey].requests += item.requests;
    }

    const columns = Object.values(weeklyMap);
    let inTok = 0, outTok = 0, cacheTok = 0, reqs = 0;
    for (const c of columns) {
      inTok += c.inputTok;
      outTok += c.outTok;
      cacheTok += c.cacheRead;
      reqs += c.requests;
    }
    const totalTok = inTok + outTok + cacheTok;
    const rawTotal = inTok + cacheTok;
    const efficiency = rawTotal > 0 ? (cacheTok / rawTotal) * 100 : overview.cacheEfficiency;

    return {
      columns,
      totalTokens: { input: inTok, output: outTok, cacheRead: cacheTok, thinking: overview.totalTokens.thinking, total: totalTok },
      totalRequests: reqs,
      cacheEfficiency: efficiency,
      avgTtft: overview.avgTtft,
      avgTokPerSec: overview.avgTokPerSec
    };
  }

  // Standard continuous daily columns
  const columns: ChartColumnData[] = dateList.map(dateStr => {
    const item = dateMap[dateStr] || { inputTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
    return {
      label: formatDateLabel(dateStr),
      tooltipHeader: formatFullDate(dateStr),
      inputTok: item.inputTok,
      outTok: item.outTok,
      cacheRead: item.cacheRead,
      requests: item.requests
    };
  });

  let inTok = 0, outTok = 0, cacheTok = 0, reqs = 0;
  for (const c of columns) {
    inTok += c.inputTok;
    outTok += c.outTok;
    cacheTok += c.cacheRead;
    reqs += c.requests;
  }
  const totalTok = inTok + outTok + cacheTok;
  const rawTotal = inTok + cacheTok;
  const efficiency = rawTotal > 0 ? (cacheTok / rawTotal) * 100 : overview.cacheEfficiency;

  return {
    columns,
    totalTokens: { input: inTok, output: outTok, cacheRead: cacheTok, thinking: overview.totalTokens.thinking, total: totalTok },
    totalRequests: reqs,
    cacheEfficiency: efficiency,
    avgTtft: overview.avgTtft,
    avgTokPerSec: overview.avgTokPerSec
  };
}

export function renderMetricCards(metrics: ReturnType<typeof computeProcessedColumns>): void {
  const container = document.getElementById('analytics-cards-grid');
  if (!container) return;

  const totalTok = metrics.totalTokens.total;
  const inTok = metrics.totalTokens.input;
  const outTok = metrics.totalTokens.output;
  const cacheTok = metrics.totalTokens.cacheRead;
  const totalReq = metrics.totalRequests;

  container.innerHTML = `
    <!-- Row 1: Primary Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${formatCompactNumber(totalTok)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${formatCompactNumber(cacheTok)}</span>
          <span class="kpi-tag tag-input">In: ${formatCompactNumber(inTok)}</span>
          <span class="kpi-tag tag-output">Out: ${formatCompactNumber(outTok)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${formatFullNumber(totalReq)}</div>
        <div class="kpi-subtext">Completed model inferences for the selected range</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${metrics.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${formatCompactNumber(cacheTok)} tokens from reprocessing</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Streaming Speed</div>
        <div class="kpi-value">${metrics.avgTokPerSec} <span class="kpi-unit">tok/s</span></div>
        <div class="kpi-subtext">Real-time generation throughput across models</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Time to First Token</div>
        <div class="kpi-value">${metrics.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
        <div class="kpi-subtext">Average latency from prompt dispatch to first chunk</div>
      </div>
    </div>
  `;
}

let sessionViewMode: 'overview' | 'timeline' = 'overview';

export function renderActivityChart(columns: ChartColumnData[], rangeTitle: string): void {
  const chartWrapper = document.getElementById('analytics-activity-chart');
  if (!chartWrapper) return;

  if (!columns || columns.length === 0) {
    chartWrapper.innerHTML = `
      <div class="chart-header">
        <div class="chart-title">${rangeTitle}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;
    return;
  }

  const isSession = currentRange === 'session' && !!activeSessionData && activeSessionData.steps.length > 0;

  if (isSession && sessionViewMode === 'overview') {
    renderSessionOverviewArea(chartWrapper, activeSessionData!, rangeTitle, columns);
  } else {
    renderStandardTimelineChart(chartWrapper, columns, rangeTitle, isSession);
  }
}

function attachViewModeSwitchListeners(chartWrapper: HTMLElement, columns: ChartColumnData[], rangeTitle: string): void {
  const buttons = chartWrapper.querySelectorAll('#session-view-segmented .segment-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute('data-mode') as 'overview' | 'timeline';
      if (mode && mode !== sessionViewMode) {
        sessionViewMode = mode;
        renderActivityChart(columns, rangeTitle);
      }
    });
  });
}

function renderSessionOverviewArea(
  chartWrapper: HTMLElement,
  session: SessionAnalyticsData,
  rangeTitle: string,
  columns: ChartColumnData[]
): void {
  const steps = session.steps;
  const totalTurns = steps.length;
  if (totalTurns === 0) return;

  const rawMax = Math.max(...steps.map(s => s.ctx || (s.inTok + s.cacheRead)), 1000);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  let tickStep = magnitude;
  if (normalized <= 2) tickStep = 0.5 * magnitude;
  else if (normalized <= 5) tickStep = 1 * magnitude;
  else tickStep = 2 * magnitude;

  const yMax = Math.ceil(rawMax / (tickStep * 4)) * (tickStep * 4) || (tickStep * 4);
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const svgHeight = 220;
  const paddingTop = 24;
  const paddingBottom = 30;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Fixed Left Y-Axis
  let yAxisSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    yAxisSvg += `
      <text x="40" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${formatCompactNumber(tickVal)}</text>
      <line x1="43" y1="${y}" x2="48" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.7' : '0.3'}" />
    `;
  });

  // Viewport Area Chart
  const svgWidth = 590;
  const chartWidth = svgWidth - 10;

  let gridSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `
      <line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.2'}" />
    `;
  });

  let areaD = `M 0,${paddingTop + chartHeight}`;
  let lineD = '';
  let xLabelsSvg = '';

  const labelInterval = Math.max(1, Math.floor(totalTurns / 6));

  steps.forEach((st, idx) => {
    const ctx = st.ctx || (st.inTok + st.cacheRead);
    const x = totalTurns > 1 ? (idx / (totalTurns - 1)) * chartWidth : 0;
    const y = paddingTop + chartHeight - (ctx / yMax) * chartHeight;

    if (idx === 0) {
      areaD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      lineD = `M ${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      areaD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      lineD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    }

    if (idx % labelInterval === 0 || idx === totalTurns - 1) {
      xLabelsSvg += `
        <text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="${idx === 0 ? 'start' : idx === totalTurns - 1 ? 'end' : 'middle'}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${idx + 1}</text>
      `;
    }
  });

  areaD += ` L ${chartWidth},${paddingTop + chartHeight} Z`;

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${rangeTitle})</div>
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
        <svg viewBox="0 0 48 ${svgHeight}" class="y-axis-svg">
          ${yAxisSvg}
        </svg>
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
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `;

  attachViewModeSwitchListeners(chartWrapper, columns, rangeTitle);
  attachOverviewScrubberListeners(chartWrapper, steps);
}

function attachOverviewScrubberListeners(
  chartWrapper: HTMLElement,
  steps: SessionAnalyticsData['steps']
): void {
  const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
  const scrubber = chartWrapper.querySelector('#chart-scrubber-line') as HTMLElement | null;
  const tooltip = chartWrapper.querySelector('#chart-floating-tooltip') as HTMLElement | null;

  if (!stage || !scrubber || !tooltip) return;

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    const relX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = rect.width > 0 ? relX / rect.width : 0;
    const stepIdx = Math.min(steps.length - 1, Math.max(0, Math.round(pct * (steps.length - 1))));
    const st = steps[stepIdx];
    if (!st) return;

    const ctx = st.ctx || (st.inTok + st.cacheRead);
    const speed = Math.round(st.stream > 0 ? st.outTok / st.stream : 0);

    scrubber.style.display = 'block';
    scrubber.style.transform = `translateX(${relX}px)`;

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
      <div class="tooltip-subline">Speed: ${speed} tok/s · TTFT: ${st.ttft.toFixed(2)}s</div>
    `;
    tooltip.style.display = 'block';

    const tipWidth = tooltip.offsetWidth || 180;
    const tipHeight = tooltip.offsetHeight || 135;

    let left = 0;
    if (relX > rect.width / 2) {
      left = relX - tipWidth - 16;
    } else {
      left = relX + 16;
    }
    left = Math.max(8, Math.min(left, rect.width - tipWidth - 8));

    let top = 10;
    const maxSafeTop = rect.height - tipHeight - 12;
    if (maxSafeTop > 10) top = Math.min(top, maxSafeTop);

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  });

  stage.addEventListener('mouseleave', () => {
    scrubber.style.display = 'none';
    tooltip.style.display = 'none';
  });
}

function renderStandardTimelineChart(
  chartWrapper: HTMLElement,
  columns: ChartColumnData[],
  rangeTitle: string,
  isSession: boolean
): void {
  const rawMax = Math.max(...columns.map(d => (d.inputTok + d.outTok + d.cacheRead)), 1000);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  let tickStep = magnitude;
  if (normalized <= 2) tickStep = 0.5 * magnitude;
  else if (normalized <= 5) tickStep = 1 * magnitude;
  else tickStep = 2 * magnitude;

  const yMax = Math.ceil(rawMax / (tickStep * 4)) * (tickStep * 4) || (tickStep * 4);
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

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

  // Fixed Left Y-Axis
  let yAxisSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    yAxisSvg += `
      <text x="40" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${formatCompactNumber(tickVal)}</text>
      <line x1="43" y1="${y}" x2="48" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.7' : '0.3'}" />
    `;
  });

  // Background Grid Lines
  let gridSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `
      <line x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.2'}" />
    `;
  });

  let defsSvg = '<defs>';
  let barsSvg = '';
  let xLabelsSvg = '';

  const isHourly = columns.length === 24 && (columns[0]?.label.includes(':00') || false);
  const labelInterval = isHourly ? 3 : Math.max(1, Math.floor(columns.length / 8));

  columns.forEach((item, idx) => {
    const x = paddingLeft + idx * step + (step - barWidth) / 2;
    const total = item.inputTok + item.outTok + item.cacheRead;
    const slotX = paddingLeft + idx * step;
    const centerX = x + barWidth / 2;

    if (total > 0) {
      const totalBarHeight = Math.max(3, Math.round((total / yMax) * chartHeight));
      const outHeight = item.outTok > 0 ? Math.max(1, Math.round((item.outTok / yMax) * chartHeight)) : 0;
      const inHeight = item.inputTok > 0 ? Math.max(1, Math.round((item.inputTok / yMax) * chartHeight)) : 0;
      let cacheHeight = item.cacheRead > 0 ? Math.max(1, totalBarHeight - outHeight - inHeight) : 0;
      if (cacheHeight < 0) cacheHeight = 0;

      const yBottom = paddingTop + chartHeight;
      const yCache = yBottom - cacheHeight;
      const yIn = yCache - inHeight;
      const yOut = yIn - outHeight;
      const yTop = yOut;

      const r = Math.min(3.5, barWidth / 2, totalBarHeight);
      defsSvg += `
        <clipPath id="col-clip-${idx}">
          <path d="M ${x} ${yBottom} L ${x} ${yTop + r} A ${r} ${r} 0 0 1 ${x + r} ${yTop} L ${x + barWidth - r} ${yTop} A ${r} ${r} 0 0 1 ${x + barWidth} ${yTop + r} L ${x + barWidth} ${yBottom} Z" />
        </clipPath>
      `;

      barsSvg += `
        <g class="chart-column-group" 
           data-header="${item.tooltipHeader}" 
           data-in="${formatFullNumber(item.inputTok)}" 
           data-out="${formatFullNumber(item.outTok)}" 
           data-cache="${formatFullNumber(item.cacheRead)}"
           data-total="${formatFullNumber(total)}"
           data-ctx="${item.ctx ? formatCompactNumber(item.ctx) + ' (' + formatFullNumber(item.ctx) + ')' : ''}"
           data-reqs="${formatFullNumber(item.requests || 1)}"
           data-subtext="${item.subText || ''}"
           data-center-x="${centerX}"
           data-slot-x="${slotX}"
           data-slot-w="${step}"
           data-top-y="${yOut}"
           data-idx="${idx}">
          
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
        <g class="chart-column-group" 
           data-header="${item.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${item.ctx ? formatCompactNumber(item.ctx) + ' (' + formatFullNumber(item.ctx) + ')' : ''}"
           data-reqs="0"
           data-subtext="${item.subText || ''}"
           data-center-x="${centerX}"
           data-slot-x="${slotX}"
           data-slot-w="${step}"
           data-top-y="${paddingTop + chartHeight}"
           data-idx="${idx}">
          
          <rect class="bar-bg-band" x="${slotX}" y="${paddingTop}" width="${step}" height="${chartHeight}" rx="4" />
        </g>
      `;
    }

    const showLabel = isHourly
      ? (idx % 3 === 0)
      : (idx % labelInterval === 0 || (idx === columns.length - 1 && (columns.length - 1) % labelInterval >= Math.floor(labelInterval / 2)));

    if (showLabel) {
      xLabelsSvg += `
        <text x="${centerX}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${item.label}</text>
      `;
    }
  });

  defsSvg += '</defs>';

  const switchHtml = isSession ? `
    <div class="segmented-control mini-segmented" id="session-view-segmented">
      <button class="segment-btn" data-mode="overview">Overview</button>
      <button class="segment-btn active" data-mode="timeline">Timeline</button>
    </div>
  ` : '';

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${rangeTitle})</div>
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
        <svg viewBox="0 0 48 ${svgHeight}" class="y-axis-svg">
          ${yAxisSvg}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        ${isScrollable ? `
          <div class="chart-fade-mask mask-left" id="chart-mask-left" style="opacity: 0;">
            <span class="mask-indicator">‹</span>
          </div>
          <div class="chart-fade-mask mask-right" id="chart-mask-right" style="opacity: 0;">
            <span class="mask-indicator">›</span>
          </div>
        ` : ''}
        <div class="chart-stage ${isScrollable ? 'chart-stage-scrollable' : ''}" id="chart-stage-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${isScrollable ? `min-width: ${svgWidth}px;` : ''}">
            ${defsSvg}
            ${gridSvg}
            ${barsSvg}
            ${xLabelsSvg}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `;

  if (isSession) {
    attachViewModeSwitchListeners(chartWrapper, columns, rangeTitle);
  }

  if (isScrollable) {
    setTimeout(() => {
      const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
      const maskLeft = chartWrapper.querySelector('#chart-mask-left') as HTMLElement | null;
      const maskRight = chartWrapper.querySelector('#chart-mask-right') as HTMLElement | null;
      if (stage) {
        stage.scrollLeft = stage.scrollWidth;
        if (maskLeft && maskRight) {
          attachScrollMaskListeners(stage, maskLeft, maskRight);
        }
      }
    }, 50);
  }

  attachSmartTooltipListeners(chartWrapper, svgWidth);
}

function attachScrollMaskListeners(stage: HTMLElement, maskLeft: HTMLElement, maskRight: HTMLElement): void {
  function updateMasks() {
    const maxScroll = stage.scrollWidth - stage.clientWidth;
    if (maxScroll <= 0) {
      maskLeft.style.opacity = '0';
      maskRight.style.opacity = '0';
      return;
    }
    maskLeft.style.opacity = stage.scrollLeft > 14 ? '1' : '0';
    maskRight.style.opacity = (maxScroll - stage.scrollLeft) > 14 ? '1' : '0';
  }

  stage.addEventListener('scroll', updateMasks, { passive: true });
  updateMasks();
}

function attachSmartTooltipListeners(chartWrapper: HTMLElement, svgWidth: number): void {
  const tooltip = chartWrapper.querySelector('#chart-floating-tooltip') as HTMLElement | null;
  const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
  const groups = chartWrapper.querySelectorAll('.chart-column-group');

  if (!tooltip || !stage) return;

  groups.forEach(group => {
    group.addEventListener('mouseenter', () => {
      const target = group as SVGElement;
      const header = target.getAttribute('data-header') || '';
      const inTok = target.getAttribute('data-in') || '0';
      const outTok = target.getAttribute('data-out') || '0';
      const cacheTok = target.getAttribute('data-cache') || '0';
      const totalTok = target.getAttribute('data-total') || '0';
      const ctxTok = target.getAttribute('data-ctx') || '';
      const reqs = target.getAttribute('data-reqs') || '0';
      const subText = target.getAttribute('data-subtext') || '';

      const ctxRowHtml = ctxTok ? `
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${ctxTok}</span>
        </div>
      ` : '';

      tooltip.innerHTML = `
        <div class="tooltip-header">${header}</div>
        ${ctxRowHtml}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${outTok}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${inTok}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${cacheTok}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${totalTok}</span>
        </div>
        <div class="tooltip-subline">${reqs} generation requests${subText ? ' · ' + subText : ''}</div>
      `;

      tooltip.style.display = 'block';

      const stageRect = stage.getBoundingClientRect();
      const bandEl = (target.querySelector('.bar-bg-band') || target) as SVGGraphicsElement;
      const bandRect = bandEl.getBoundingClientRect();

      const bandLeft = bandRect.left - stageRect.left + stage.scrollLeft;
      const bandRight = bandRect.right - stageRect.left + stage.scrollLeft;

      const tipWidth = tooltip.offsetWidth || 180;
      const tipHeight = tooltip.offsetHeight || 135;

      const viewLeft = stage.scrollLeft;
      const viewRight = stage.scrollLeft + stageRect.width;

      const spaceRight = viewRight - (bandRight + 12);
      const spaceLeft = (bandLeft - 12) - viewLeft;

      let left = 0;
      if (spaceRight >= tipWidth + 6 && (spaceRight >= spaceLeft || spaceLeft < tipWidth)) {
        left = bandRight + 12;
      } else if (spaceLeft >= tipWidth + 6) {
        left = bandLeft - tipWidth - 12;
      } else {
        if (spaceRight >= spaceLeft) {
          left = Math.max(bandRight + 4, viewRight - tipWidth - 6);
        } else {
          left = Math.min(bandLeft - tipWidth - 4, viewLeft + 6);
        }
      }

      let top = 10;
      const maxSafeTop = stageRect.height - tipHeight - 12;
      if (maxSafeTop > 10) {
        top = Math.min(top, maxSafeTop);
      }

      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `${Math.round(top)}px`;
    });

    group.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

export function renderProjectDistribution(projects: GlobalAnalyticsOverview['topProjects']): void {
  const container = document.getElementById('analytics-projects-list');
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML = `<div class="chart-empty">No workspace activity recorded</div>`;
    return;
  }

  const maxTokens = Math.max(...projects.map(p => p.tokenCount), 1);

  const itemsHtml = projects.map(p => {
    const pct = Math.max(4, Math.round((p.tokenCount / maxTokens) * 100));
    const name = p.projectId.split('/').filter(Boolean).pop() || p.projectId;
    return `
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${p.projectId}">${name}</div>
          <div class="project-counts">${p.conversationCount} sessions · ${formatCompactNumber(p.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = itemsHtml;
}

export function renderSessionsTable(conversations: ConversationSummary[]): void {
  const container = document.getElementById('analytics-sessions-tbody');
  if (!container) return;

  if (!conversations || conversations.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="empty-cell">No recent conversation sessions detected</td></tr>`;
    return;
  }

  const rows = conversations.slice(0, 15).map(c => {
    const title = c.title || 'Untitled Session';
    let proj = 'Default';
    if (c.workspaceUris) {
      try {
        const uris = JSON.parse(c.workspaceUris);
        if (Array.isArray(uris) && uris.length > 0) {
          const lastPart = uris[0].replace(/^file:\/\//, '').split('/').filter(Boolean).pop();
          if (lastPart) proj = decodeURIComponent(lastPart);
        }
      } catch {}
    } else if (c.projectId) {
      proj = c.projectId.split('/').filter(Boolean).pop() || c.projectId;
    }
    const time = formatRelativeTime(c.lastModifiedTime);
    return `
      <tr class="session-row">
        <td class="session-title-cell" title="${title}">${title}</td>
        <td class="session-project-cell"><span class="project-pill" title="${c.workspaceUris || c.projectId}">${proj}</span></td>
        <td class="session-steps-cell">${c.stepCount} steps</td>
        <td class="session-time-cell">${time}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = rows;
}

function getRangeDisplayTitle(range: TimeRangeOption): string {
  switch (range) {
    case 'session': return 'Active Session';
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'this-week': return 'This Week';
    case 'this-month': return 'This Month';
    case 'last-7-days': return 'Last 7 Days';
    case 'last-30-days': return 'Last 30 Days';
    case 'custom': return 'Custom Range';
    default: return 'Overview';
  }
}

export async function applyTimeRangeFilter(range: TimeRangeOption): Promise<void> {
  currentRange = range;
  const segmented = document.getElementById('analytics-timerange-segmented');
  if (segmented) {
    segmented.querySelectorAll('.segment-btn').forEach(btn => {
      if (btn.getAttribute('data-range') === range) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  const customInputs = document.getElementById('custom-range-inputs');
  if (customInputs) {
    customInputs.style.display = range === 'custom' ? 'flex' : 'none';
  }

  if (range === 'session') {
    if (!activeSessionData) {
      activeSessionData = await fetchActiveSession();
    }
  }

  if (rawOverview) {
    const processed = computeProcessedColumns(rawOverview, range);
    renderMetricCards(processed);
    renderActivityChart(processed.columns, getRangeDisplayTitle(range));
  }
}

export async function refreshAnalytics(): Promise<void> {
  const refreshBtn = document.getElementById('btn-refresh-analytics');
  if (refreshBtn) refreshBtn.classList.add('loading');

  const [overview, conversations, session] = await Promise.all([
    fetchOverview(),
    fetchConversations(),
    fetchActiveSession()
  ]);

  if (overview) {
    rawOverview = overview;
  }
  if (session) {
    activeSessionData = session;
  }

  if (rawOverview) {
    await applyTimeRangeFilter(currentRange);
    renderProjectDistribution(rawOverview.topProjects);
  }

  if (conversations) {
    renderSessionsTable(conversations);
  }

  if (refreshBtn) {
    setTimeout(() => refreshBtn.classList.remove('loading'), 300);
  }
}

export function initTimeRangeControls(): void {
  const segmented = document.getElementById('analytics-timerange-segmented');
  if (segmented) {
    segmented.querySelectorAll('.segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range') as TimeRangeOption;
        if (range) applyTimeRangeFilter(range);
      });
    });
  }

  const startInput = document.getElementById('custom-date-start') as HTMLInputElement | null;
  const endInput = document.getElementById('custom-date-end') as HTMLInputElement | null;
  const applyCustomBtn = document.getElementById('btn-apply-custom-range');

  applyCustomBtn?.addEventListener('click', () => {
    if (startInput?.value && endInput?.value) {
      customStartDate = startInput.value;
      customEndDate = endInput.value;
      applyTimeRangeFilter('custom');
    }
  });
}
