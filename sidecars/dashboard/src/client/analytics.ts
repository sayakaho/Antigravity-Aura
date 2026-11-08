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

    // Fallback if no hourly activity exists for yesterday
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

  // 3. Daily Granularity (This Week, This Month, Last 7 Days, Last 30 Days)
  let startDate = '0000-00-00';
  let endDate = today;

  if (range === 'this-week') {
    startDate = getStartOfWeekString();
  } else if (range === 'this-month') {
    startDate = getStartOfMonthString();
  } else if (range === 'last-7-days') {
    startDate = getPastDaysString(7);
  } else if (range === 'last-30-days') {
    startDate = getPastDaysString(30);
  } else if (range === 'custom') {
    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    }
  }

  const validSeries = (overview.timeRangeSeries || []).filter(item => {
    if (!item.date || item.date.startsWith('0001')) return false;
    return item.date >= startDate && item.date <= endDate;
  });

  // Check if range spans over 90 days -> Aggregate Weekly
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const daySpan = Math.round((endMs - startMs) / 86400000);

  if (daySpan > 90 && validSeries.length > 28) {
    // 4. Weekly Aggregation
    const weeklyMap: Record<string, ChartColumnData> = {};
    for (const item of validSeries) {
      const d = new Date(item.date + 'T00:00:00');
      const weekNum = Math.floor(d.getDate() / 7) + 1;
      const weekKey = `${item.date.slice(0, 7)} W${weekNum}`;
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          label: weekKey.slice(5),
          tooltipHeader: `Week of ${item.date}`,
          inputTok: 0,
          outTok: 0,
          cacheRead: 0,
          requests: 0
        };
      }
      weeklyMap[weekKey].inputTok += item.inputTok;
      weeklyMap[weekKey].outTok += item.outTok;
      weeklyMap[weekKey].cacheRead += item.cacheRead;
      weeklyMap[weekKey].requests += item.requests || 1;
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

  // Standard Daily Columns
  const columns: ChartColumnData[] = validSeries.map(item => ({
    label: formatDateLabel(item.date),
    tooltipHeader: formatFullDate(item.date),
    inputTok: item.inputTok,
    outTok: item.outTok,
    cacheRead: item.cacheRead,
    requests: item.requests || 1
  }));

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
    columns: columns.length > 0 ? columns : (overview.timeRangeSeries || []).slice(-14).map(d => ({
      label: formatDateLabel(d.date),
      tooltipHeader: formatFullDate(d.date),
      inputTok: d.inputTok,
      outTok: d.outTok,
      cacheRead: d.cacheRead,
      requests: d.requests || 1
    })),
    totalTokens: columns.length > 0 ? { input: inTok, output: outTok, cacheRead: cacheTok, thinking: overview.totalTokens.thinking, total: totalTok } : overview.totalTokens,
    totalRequests: reqs || overview.totalRequests || (overview.totalConversations * 10),
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

  // Find max value across all columns
  const rawMax = Math.max(...columns.map(d => (d.inputTok + d.outTok + d.cacheRead)), 1000);
  
  // Nice tick calculation (e.g. 5M, 10M, 15M, 20M)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  let tickStep = magnitude;
  if (normalized <= 2) tickStep = 0.5 * magnitude;
  else if (normalized <= 5) tickStep = 1 * magnitude;
  else tickStep = 2 * magnitude;

  const yMax = Math.ceil(rawMax / (tickStep * 4)) * (tickStep * 4) || (tickStep * 4);
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  // Dynamic SVG width calculation: allow horizontal scrolling for extensive session steps
  const isScrollable = columns.length > 40;
  const colStepWidth = isScrollable ? 10 : Math.max(6, Math.floor(570 / columns.length));
  const svgWidth = isScrollable ? Math.max(640, columns.length * colStepWidth + 70) : 640;
  const svgHeight = 220;
  const paddingLeft = 52;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const step = chartWidth / columns.length;
  const barWidth = Math.max(3, Math.min(22, Math.floor(step * 0.72)));

  // Y-axis grid lines and labels
  let gridSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `
      <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.25'}" />
      <text x="${paddingLeft - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${formatCompactNumber(tickVal)}</text>
    `;
  });

  // Bars and X-axis labels
  let defsSvg = '<defs>';
  let barsSvg = '';
  let xLabelsSvg = '';

  const labelInterval = Math.max(1, Math.floor(columns.length / 8));

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

      // Rounded top cap path (flat bottom, smooth rounded top corners)
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
          
          <!-- Hover Container Highlight Band (Full Height Background) -->
          <rect class="bar-bg-band" x="${slotX}" y="${paddingTop}" width="${step}" height="${chartHeight}" rx="4" />
          
          <!-- Stacked Column Segments with Top Rounded Cap -->
          <g clip-path="url(#col-clip-${idx})">
            ${cacheHeight > 0 ? `<rect class="bar-segment bar-cache" x="${x}" y="${yCache}" width="${barWidth}" height="${cacheHeight}" fill="#00A67E" />` : ''}
            ${inHeight > 0 ? `<rect class="bar-segment bar-in" x="${x}" y="${yIn}" width="${barWidth}" height="${inHeight}" fill="#6366F1" opacity="0.85" />` : ''}
            ${outHeight > 0 ? `<rect class="bar-segment bar-out" x="${x}" y="${yOut}" width="${barWidth}" height="${outHeight}" fill="var(--aura-primary)" />` : ''}
          </g>
        </g>
      `;
    } else {
      // Empty column: clean baseline without artificial dummy bars
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
          
          <!-- Hover Container Highlight Band (Full Height Background) -->
          <rect class="bar-bg-band" x="${slotX}" y="${paddingTop}" width="${step}" height="${chartHeight}" rx="4" />
        </g>
      `;
    }

    // Display X-axis label
    if (idx % labelInterval === 0 || idx === columns.length - 1) {
      xLabelsSvg += `
        <text x="${centerX}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${item.label}</text>
      `;
    }
  });

  defsSvg += '</defs>';

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-title">Token Activity (${rangeTitle})</div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: #6366F1"></span>Input Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Cache Read</span>
      </div>
    </div>
    <div class="chart-stage ${isScrollable ? 'chart-stage-scrollable' : ''}" id="chart-stage-container">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${isScrollable ? `min-width: ${svgWidth}px;` : ''}">
        ${defsSvg}
        ${gridSvg}
        ${barsSvg}
        ${xLabelsSvg}
      </svg>
      <!-- Smart Fixed Hover Tooltip -->
      <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
    </div>
  `;

  if (isScrollable) {
    setTimeout(() => {
      const stage = chartWrapper.querySelector('#chart-stage-container') as HTMLElement | null;
      if (stage) stage.scrollLeft = stage.scrollWidth;
    }, 50);
  }

  attachSmartTooltipListeners(chartWrapper, svgWidth, svgHeight);
}

function attachSmartTooltipListeners(chartWrapper: HTMLElement, svgWidth: number, svgHeight: number): void {
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

      const svgCenterX = Number(target.getAttribute('data-center-x') || 0);
      const svgTopY = Number(target.getAttribute('data-top-y') || 0);

      const ctxRowHtml = ctxTok ? `
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${ctxTok}</span>
        </div>
      ` : '';

      // Render Tooltip content
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

      // Physical measurement of column slot and stage container
      const stageRect = stage.getBoundingClientRect();
      const bandEl = (target.querySelector('.bar-bg-band') || target) as SVGGraphicsElement;
      const bandRect = bandEl.getBoundingClientRect();

      // Physical pixel boundaries of the column background band relative to stage scroll coordinates
      const bandLeft = bandRect.left - stageRect.left + stage.scrollLeft;
      const bandRight = bandRect.right - stageRect.left + stage.scrollLeft;

      const tipWidth = tooltip.offsetWidth || 180;
      const tipHeight = tooltip.offsetHeight || 135;

      // Viewport window inside scrollable stage container
      const viewLeft = stage.scrollLeft;
      const viewRight = stage.scrollLeft + stageRect.width;

      // Clear space strictly outside the column's full background band
      const spaceRight = viewRight - (bandRight + 12);
      const spaceLeft = (bandLeft - 12) - viewLeft;

      let left = 0;
      // Absolute rule: Tooltip must NEVER overlap with the column width [bandLeft, bandRight]!
      // This ensures the mouse pointer on the column background will NEVER obscure the tooltip.
      if (spaceRight >= tipWidth + 6 && (spaceRight >= spaceLeft || spaceLeft < tipWidth)) {
        // Place strictly to the right of the column background
        left = bandRight + 12;
      } else if (spaceLeft >= tipWidth + 6) {
        // Place strictly to the left of the column background
        left = bandLeft - tipWidth - 12;
      } else {
        // Ultra-narrow viewport fallback: place on whichever side has more space, never in the band
        if (spaceRight >= spaceLeft) {
          left = Math.max(bandRight + 4, viewRight - tipWidth - 6);
        } else {
          left = Math.min(bandLeft - tipWidth - 4, viewLeft + 6);
        }
      }

      // Vertical positioning: Keep stable and high in the clear top area, avoiding bottom edge
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
    case 'session': {
      const stepTotal = activeSessionData?.steps?.length || 0;
      return stepTotal > 40
        ? `Current Active Session (Latest 40 of ${stepTotal} turns)`
        : 'Current Active Session (Turn-by-turn)';
    }
    case 'today': return 'Today (Hourly)';
    case 'yesterday': return 'Yesterday (Hourly)';
    case 'this-week': return 'This Week (Daily)';
    case 'this-month': return 'This Month (Daily)';
    case 'last-7-days': return 'Last 7 Days (Daily)';
    case 'last-30-days': return 'Last 30 Days (Daily)';
    case 'custom': return 'Custom Range';
    default: return 'Token Activity';
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
