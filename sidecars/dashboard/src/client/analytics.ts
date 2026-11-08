/**
 * Aura Dashboard · Global Telemetry & Analytics Module (TypeScript)
 * English-only interface, dynamic SVG visualizations, floating tooltips, and time-range filtering.
 */

import type { GlobalAnalyticsOverview, ConversationSummary } from '../types';

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

export type TimeRangeOption = 'today' | 'yesterday' | 'last-week' | 'last-month' | 'custom';

let rawOverview: GlobalAnalyticsOverview | null = null;
let currentRange: TimeRangeOption = 'last-month';
let customStartDate = '';
let customEndDate = '';

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

function getFilterDateThresholds(range: TimeRangeOption): { start: string; end: string } {
  const now = new Date();
  const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = toYMD(now);

  if (range === 'today') {
    return { start: todayStr, end: todayStr };
  } else if (range === 'yesterday') {
    const yest = new Date(now.getTime() - 86400000);
    const yestStr = toYMD(yest);
    return { start: yestStr, end: yestStr };
  } else if (range === 'last-week') {
    const past7 = new Date(now.getTime() - 7 * 86400000);
    return { start: toYMD(past7), end: todayStr };
  } else if (range === 'last-month') {
    const past30 = new Date(now.getTime() - 30 * 86400000);
    return { start: toYMD(past30), end: todayStr };
  } else {
    // Custom
    if (customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    return { start: '0000-00-00', end: '9999-99-99' };
  }
}

export function computeFilteredOverview(overview: GlobalAnalyticsOverview, range: TimeRangeOption) {
  const { start, end } = getFilterDateThresholds(range);
  const validSeries = (overview.timeRangeSeries || []).filter(item => {
    // Exclude invalid dates like 0001-01-01
    if (!item.date || item.date.startsWith('0001')) return false;
    return item.date >= start && item.date <= end;
  });

  // If filtered series has records, recalculate totals
  if (validSeries.length > 0 && range !== 'custom') {
    let inTok = 0;
    let outTok = 0;
    let cacheTok = 0;
    let reqs = 0;

    for (const d of validSeries) {
      inTok += d.inputTok;
      outTok += d.outTok;
      cacheTok += d.cacheRead;
      reqs += d.requests || 1;
    }

    const totalTok = inTok + outTok + cacheTok;
    const rawTotal = inTok + cacheTok;
    const efficiency = rawTotal > 0 ? (cacheTok / rawTotal) * 100 : overview.cacheEfficiency;

    return {
      series: validSeries,
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
      avgTokPerSec: overview.avgTokPerSec,
      topProjects: overview.topProjects
    };
  }

  // Fallback to full overview
  return {
    series: (overview.timeRangeSeries || []).filter(item => item.date && !item.date.startsWith('0001')),
    totalTokens: overview.totalTokens,
    totalRequests: overview.totalRequests || (overview.totalConversations * 10),
    cacheEfficiency: overview.cacheEfficiency,
    avgTtft: overview.avgTtft,
    avgTokPerSec: overview.avgTokPerSec,
    topProjects: overview.topProjects
  };
}

export function renderMetricCards(filteredData: ReturnType<typeof computeFilteredOverview>): void {
  const container = document.getElementById('analytics-cards-grid');
  if (!container) return;

  const totalTok = filteredData.totalTokens.total;
  const inTok = filteredData.totalTokens.input;
  const outTok = filteredData.totalTokens.output;
  const cacheTok = filteredData.totalTokens.cacheRead;
  const totalReq = filteredData.totalRequests;

  container.innerHTML = `
    <!-- Row 1: Primary Large Metrics -->
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
        <div class="kpi-subtext">Completed model inferences across active dialog sessions</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${filteredData.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${formatCompactNumber(cacheTok)} tokens from reprocessing</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Streaming Speed</div>
        <div class="kpi-value">${filteredData.avgTokPerSec} <span class="kpi-unit">tok/s</span></div>
        <div class="kpi-subtext">Real-time generation throughput across connected models</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Time to First Token</div>
        <div class="kpi-value">${filteredData.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
        <div class="kpi-subtext">Average latency from prompt dispatch to initial token chunk</div>
      </div>
    </div>
  `;
}

export function renderActivityChart(series: GlobalAnalyticsOverview['timeRangeSeries']): void {
  const chartWrapper = document.getElementById('analytics-activity-chart');
  if (!chartWrapper) return;

  if (!series || series.length === 0) {
    chartWrapper.innerHTML = `
      <div class="chart-header">
        <div class="chart-title">Token Activity Over Time</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected time range</div>
    `;
    return;
  }

  // Use up to 30 data points for optimal spacing
  const data = series.slice(-30);
  
  // Calculate maximum value for Y-axis scale (using total tokens per day)
  const rawMax = Math.max(...data.map(d => (d.inputTok + d.outTok + d.cacheRead)), 10000);
  
  // Round up max value to crisp human ticks (e.g., 5M, 10M, 15M, 20M)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  let tickStep = magnitude;
  if (normalized <= 2) tickStep = 0.5 * magnitude;
  else if (normalized <= 5) tickStep = 1 * magnitude;
  else tickStep = 2 * magnitude;

  const yMax = Math.ceil(rawMax / (tickStep * 4)) * (tickStep * 4) || (tickStep * 4);
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const svgWidth = 640;
  const svgHeight = 220;
  const paddingLeft = 52;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const step = chartWidth / data.length;
  const barWidth = Math.max(6, Math.min(22, Math.floor(step * 0.68)));

  // Y-axis grid lines and labels
  let gridSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `
      <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="${tickVal === 0 ? 'none' : '3 3'}" opacity="${tickVal === 0 ? '0.8' : '0.4'}" />
      <text x="${paddingLeft - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${formatCompactNumber(tickVal)}</text>
    `;
  });

  // Bars and X-axis labels
  let barsSvg = '';
  let xLabelsSvg = '';

  const labelInterval = Math.max(1, Math.floor(data.length / 6));

  data.forEach((item, idx) => {
    const x = paddingLeft + idx * step + (step - barWidth) / 2;
    const total = item.inputTok + item.outTok + item.cacheRead;

    // Heights for stacked bar segments
    const totalBarHeight = Math.max(2, Math.round((total / yMax) * chartHeight));
    const outHeight = Math.max(1, Math.round((item.outTok / yMax) * chartHeight));
    const inHeight = Math.max(1, Math.round((item.inputTok / yMax) * chartHeight));
    const cacheHeight = Math.max(1, totalBarHeight - outHeight - inHeight);

    const yBottom = paddingTop + chartHeight;
    const yCache = yBottom - cacheHeight;
    const yIn = yCache - inHeight;
    const yOut = yIn - outHeight;

    const formattedDate = formatDateLabel(item.date);
    const fullDate = formatFullDate(item.date);

    barsSvg += `
      <g class="chart-column-group" 
         data-date="${fullDate}" 
         data-in="${formatFullNumber(item.inputTok)}" 
         data-out="${formatFullNumber(item.outTok)}" 
         data-cache="${formatFullNumber(item.cacheRead)}"
         data-total="${formatFullNumber(total)}"
         data-reqs="${formatFullNumber(item.requests || 1)}"
         data-x="${x + barWidth / 2}"
         data-y="${yOut}">
        <!-- Hover highlight slot -->
        <rect class="bar-hover-slot" x="${x - (step - barWidth) / 2}" y="${paddingTop}" width="${step}" height="${chartHeight}" fill="transparent" />
        
        <!-- Stacked Bar Segments (Rounded top) -->
        <rect class="bar-segment bar-cache" x="${x}" y="${yCache}" width="${barWidth}" height="${cacheHeight}" fill="#34A853" opacity="0.85" rx="1" />
        <rect class="bar-segment bar-in" x="${x}" y="${yIn}" width="${barWidth}" height="${inHeight}" fill="var(--aura-fg-muted)" opacity="0.75" rx="1" />
        <rect class="bar-segment bar-out" x="${x}" y="${yOut}" width="${barWidth}" height="${outHeight}" fill="var(--aura-primary)" rx="2" />
      </g>
    `;

    // Display X-axis labels at calculated intervals
    if (idx % labelInterval === 0 || idx === data.length - 1) {
      xLabelsSvg += `
        <text x="${x + barWidth / 2}" y="${svgHeight - 10}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${formattedDate}</text>
      `;
    }
  });

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-title">Token Activity Over Time</div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-fg-muted)"></span>Input Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: #34A853"></span>Cache Read</span>
      </div>
    </div>
    <div class="chart-stage">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element">
        ${gridSvg}
        ${barsSvg}
        ${xLabelsSvg}
      </svg>
      <!-- Floating Hover Tooltip -->
      <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
    </div>
  `;

  attachChartHoverListeners(chartWrapper);
}

function attachChartHoverListeners(chartWrapper: HTMLElement): void {
  const tooltip = chartWrapper.querySelector('#chart-floating-tooltip') as HTMLElement | null;
  const groups = chartWrapper.querySelectorAll('.chart-column-group');

  groups.forEach(group => {
    group.addEventListener('mouseenter', (e) => {
      if (!tooltip) return;
      const target = group as SVGElement;
      const date = target.getAttribute('data-date') || '';
      const inTok = target.getAttribute('data-in') || '0';
      const outTok = target.getAttribute('data-out') || '0';
      const cacheTok = target.getAttribute('data-cache') || '0';
      const totalTok = target.getAttribute('data-total') || '0';
      const reqs = target.getAttribute('data-reqs') || '1';

      tooltip.innerHTML = `
        <div class="tooltip-header">${date}</div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output</span>
          <span class="tooltip-val">${outTok}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-fg-muted)"></span>
          <span class="tooltip-label">Input</span>
          <span class="tooltip-val">${inTok}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #34A853"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${cacheTok}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${totalTok}</span>
        </div>
        <div class="tooltip-subline">${reqs} generation requests</div>
      `;
      tooltip.style.display = 'block';
    });

    group.addEventListener('mousemove', (e: any) => {
      if (!tooltip) return;
      const wrapperRect = chartWrapper.getBoundingClientRect();
      const mouseX = e.clientX - wrapperRect.left;
      const mouseY = e.clientY - wrapperRect.top;

      const tooltipWidth = tooltip.offsetWidth || 180;
      let left = mouseX + 14;
      if (left + tooltipWidth > wrapperRect.width - 12) {
        left = mouseX - tooltipWidth - 14;
      }
      const top = Math.max(10, mouseY - 60);

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    group.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
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

export function applyTimeRangeFilter(range: TimeRangeOption): void {
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

  if (rawOverview) {
    const filtered = computeFilteredOverview(rawOverview, range);
    renderMetricCards(filtered);
    renderActivityChart(filtered.series);
  }
}

export async function refreshAnalytics(): Promise<void> {
  const refreshBtn = document.getElementById('btn-refresh-analytics');
  if (refreshBtn) refreshBtn.classList.add('loading');

  const [overview, conversations] = await Promise.all([
    fetchOverview(),
    fetchConversations()
  ]);

  if (overview) {
    rawOverview = overview;
    applyTimeRangeFilter(currentRange);
    renderProjectDistribution(overview.topProjects);
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
