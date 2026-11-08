/**
 * Aura Dashboard · Global Telemetry & Analytics Module (TypeScript)
 * English-only interface, dynamic SVG visualizations, and real-time metric cards.
 */

import type { GlobalAnalyticsOverview, ConversationSummary } from '../types';

export function formatCompactNumber(n: number): string {
  if (!n || n <= 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return Math.round(n / 1_000) + 'k';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
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

export function renderMetricCards(overview: GlobalAnalyticsOverview): void {
  const container = document.getElementById('analytics-cards-grid');
  if (!container) return;

  const totalTok = overview.totalTokens.total;
  const inTok = overview.totalTokens.input;
  const outTok = overview.totalTokens.output;
  const cacheTok = overview.totalTokens.cacheRead;

  container.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total Tokens Processed</div>
      <div class="kpi-value">${formatCompactNumber(totalTok)}</div>
      <div class="kpi-breakdown">
        <span class="kpi-tag tag-cached">Cache: ${formatCompactNumber(cacheTok)}</span>
        <span class="kpi-tag tag-input">In: ${formatCompactNumber(inTok)}</span>
        <span class="kpi-tag tag-output">Out: ${formatCompactNumber(outTok)}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-label">Cache Cost Efficiency</div>
      <div class="kpi-value">${overview.cacheEfficiency.toFixed(1)}%</div>
      <div class="kpi-subtext">Prompt caching saved ~${formatCompactNumber(cacheTok)} tokens from full reprocessing</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-label">Avg Streaming Speed</div>
      <div class="kpi-value">${overview.avgTokPerSec} <span class="kpi-unit">tok/s</span></div>
      <div class="kpi-subtext">Aggregated token generation throughput across active models</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-label">Avg Time to First Token</div>
      <div class="kpi-value">${overview.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
      <div class="kpi-subtext">Average latency between dispatch and the first streaming chunk</div>
    </div>
  `;
}

export function renderActivityChart(series: GlobalAnalyticsOverview['timeRangeSeries']): void {
  const chartWrapper = document.getElementById('analytics-activity-chart');
  if (!chartWrapper) return;

  if (!series || series.length === 0) {
    chartWrapper.innerHTML = `<div class="chart-empty">No activity data recorded in current range</div>`;
    return;
  }

  // Take up to the last 14 data points for crisp display
  const data = series.slice(-14);
  const maxVal = Math.max(...data.map(d => Math.max(d.inputTok + d.outTok, d.cacheRead)), 1000);

  const width = 620;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = Math.max(8, Math.min(24, Math.floor(chartWidth / (data.length * 1.6))));
  const step = chartWidth / data.length;

  let barsSvg = '';
  let labelsSvg = '';

  data.forEach((item, idx) => {
    const x = paddingLeft + idx * step + (step - barWidth) / 2;
    const totalOutHeight = Math.max(2, Math.round((item.outTok / maxVal) * chartHeight));
    const totalInHeight = Math.max(2, Math.round((item.inputTok / maxVal) * chartHeight));
    const cacheHeight = Math.max(1, Math.round((item.cacheRead / maxVal) * chartHeight));

    const yOut = paddingTop + chartHeight - totalOutHeight;
    const yIn = yOut - totalInHeight;

    // Format date MM-DD
    const labelDate = item.date.length >= 10 ? item.date.slice(5) : item.date;

    barsSvg += `
      <g class="chart-bar-group" data-date="${item.date}" data-in="${formatCompactNumber(item.inputTok)}" data-out="${formatCompactNumber(item.outTok)}" data-cache="${formatCompactNumber(item.cacheRead)}">
        <!-- Cache shadow pill -->
        <rect x="${x - 1}" y="${paddingTop + chartHeight - cacheHeight}" width="${barWidth + 2}" height="${cacheHeight}" rx="2" fill="var(--aura-active-pill)" opacity="0.35" />
        <!-- Input segment -->
        <rect x="${x}" y="${yIn}" width="${barWidth}" height="${totalInHeight}" rx="2" fill="var(--aura-fg-muted)" opacity="0.65" />
        <!-- Output segment (primary colored) -->
        <rect x="${x}" y="${yOut}" width="${barWidth}" height="${totalOutHeight}" rx="2" fill="var(--aura-primary)" />
      </g>
    `;

    // Date labels
    if (idx % 2 === 0 || idx === data.length - 1) {
      labelsSvg += `
        <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="9" fill="var(--aura-fg-muted)">${labelDate}</text>
      `;
    }
  });

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-title">Token Activity Over Time</div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-fg-muted)"></span>Input</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-active-pill); border: 1px solid var(--aura-border)"></span>Cache</span>
      </div>
    </div>
    <div class="chart-svg-container">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="analytics-svg">
        <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="var(--aura-border)" stroke-width="1" />
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="var(--aura-border)" stroke-dasharray="3 3" stroke-width="1" opacity="0.4" />
        ${barsSvg}
        ${labelsSvg}
      </svg>
    </div>
  `;
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
    // Clean up project name if it is a file path
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

export async function refreshAnalytics(): Promise<void> {
  const refreshBtn = document.getElementById('btn-refresh-analytics');
  if (refreshBtn) refreshBtn.classList.add('loading');

  const [overview, conversations] = await Promise.all([
    fetchOverview(),
    fetchConversations()
  ]);

  if (overview) {
    renderMetricCards(overview);
    renderActivityChart(overview.timeRangeSeries);
    renderProjectDistribution(overview.topProjects);
  }

  if (conversations) {
    renderSessionsTable(conversations);
  }

  if (refreshBtn) {
    setTimeout(() => refreshBtn.classList.remove('loading'), 300);
  }
}
