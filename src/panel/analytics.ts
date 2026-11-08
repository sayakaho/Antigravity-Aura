/**
 * Aura Dashboard · Global Telemetry & Analytics Module (TypeScript)
 * Features:
 * - 8 Time Range Filters: Session, Today, Yesterday, This Week, This Month, Last 7 Days, Last 30 Days, Custom
 * - Dynamic Granularity: Step (Session), Hourly (Today/Yesterday), Daily (Week/Month), Weekly (>90 Days)
 * - Column Hover Full-height Highlight Band
 * - Smart Non-jittering Tooltip with Boundary-aware Anchor Positioning
 */

import type { GlobalAnalyticsOverview, ConversationSummary, SessionAnalyticsData, ModelTokenStat, ToolStatItem } from '../types';

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
    const convId = urlParams.get('conversationId') || window.sidecar?.conversationId || '';
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

interface CostAndSavings {
  actualCost: number;
  savedCost: number;
  savedRatio: number;
}

function getModelPricingRates(nameOrId: string): { inputRate: number; outputRate: number; cacheRate: number } {
  const s = (nameOrId || '').toLowerCase();
  if (s.includes('argon') || s.includes('gemini-4') || s.includes('pro') || s.includes('sonnet') || s.includes('opus')) {
    return { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.10 };
  }
  if (s.includes('flash') || s.includes('3.8') || s.includes('3.7') || s.includes('gemini-2') || s.includes('haiku') || s.includes('mini')) {
    return { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 };
  }
  return { inputRate: 1.00, outputRate: 4.00, cacheRate: 0.10 };
}

export function computeApiCostAndSavings(
  metrics: ReturnType<typeof computeProcessedColumns>,
  range: TimeRangeOption,
  overview: GlobalAnalyticsOverview | null
): CostAndSavings {
  let actualCost = 0;
  let baselineCost = 0;

  if (range === 'session' && activeSessionData && activeSessionData.steps.length > 0) {
    for (const st of activeSessionData.steps) {
      const rates = getModelPricingRates((activeSessionData as any).model || 'gemini-3.8-flash');
      actualCost += (st.inTok * rates.inputRate + st.outTok * rates.outputRate + st.cacheRead * rates.cacheRate) / 1_000_000;
      baselineCost += ((st.inTok + st.cacheRead) * rates.inputRate + st.outTok * rates.outputRate) / 1_000_000;
    }
  } else if (overview && overview.dailyModelStats) {
    const dates = getFilterDatesForRange(range);
    let matchedAny = false;
    for (const d of dates) {
      const dayModels = overview.dailyModelStats[d];
      if (dayModels) {
        for (const [mName, st] of Object.entries(dayModels)) {
          if (!mName || mName.toLowerCase().includes('unknown')) continue;
          const rates = getModelPricingRates(mName);
          actualCost += (st.inTok * rates.inputRate + st.outTok * rates.outputRate + st.cacheRead * rates.cacheRate) / 1_000_000;
          baselineCost += ((st.inTok + st.cacheRead) * rates.inputRate + st.outTok * rates.outputRate) / 1_000_000;
          matchedAny = true;
        }
      }
    }
    if (!matchedAny) {
      const rates = getModelPricingRates('gemini-3.8-flash');
      actualCost = (metrics.totalTokens.input * rates.inputRate + metrics.totalTokens.output * rates.outputRate + metrics.totalTokens.cacheRead * rates.cacheRate) / 1_000_000;
      baselineCost = ((metrics.totalTokens.input + metrics.totalTokens.cacheRead) * rates.inputRate + metrics.totalTokens.output * rates.outputRate) / 1_000_000;
    }
  } else {
    const rates = getModelPricingRates('gemini-3.8-flash');
    actualCost = (metrics.totalTokens.input * rates.inputRate + metrics.totalTokens.output * rates.outputRate + metrics.totalTokens.cacheRead * rates.cacheRate) / 1_000_000;
    baselineCost = ((metrics.totalTokens.input + metrics.totalTokens.cacheRead) * rates.inputRate + metrics.totalTokens.output * rates.outputRate) / 1_000_000;
  }

  const savedCost = Math.max(0, baselineCost - actualCost);
  const savedRatio = baselineCost > 0 ? (savedCost / baselineCost) * 100 : 0;

  return { actualCost, savedCost, savedRatio };
}

export function renderMetricCards(metrics: ReturnType<typeof computeProcessedColumns>): void {
  const container = document.getElementById('analytics-cards-grid');
  if (!container) return;

  const totalTok = metrics.totalTokens.total;
  const inTok = metrics.totalTokens.input;
  const outTok = metrics.totalTokens.output;
  const cacheTok = metrics.totalTokens.cacheRead;
  const thinkTok = metrics.totalTokens.thinking || 0;
  const totalReq = metrics.totalRequests;

  const safeTotal = totalTok > 0 ? totalTok : 1;
  const cachePercent = ((cacheTok / safeTotal) * 100).toFixed(1);
  const inPercent = ((inTok / safeTotal) * 100).toFixed(1);
  const outPercent = ((outTok / safeTotal) * 100).toFixed(1);

  const { actualCost, savedCost, savedRatio } = computeApiCostAndSavings(metrics, currentRange, rawOverview);
  const baselineCost = actualCost + savedCost;

  const isSession = currentRange === 'session' && !!activeSessionData;
  const turnsCount = isSession ? activeSessionData!.steps.length : (rawOverview?.totalConversations || 0);
  const avgPerTurn = turnsCount > 0 ? Math.round(totalTok / turnsCount) : (totalReq > 0 ? Math.round(totalTok / totalReq) : 0);

  // Speed Metrics: prefer P50 median for perceptual accuracy, display weighted mean in subtext
  const p50Speed = (rawOverview?.p50TokPerSec && rawOverview.p50TokPerSec > 0) ? rawOverview.p50TokPerSec : 288;
  const weightedSpeed = metrics.avgTokPerSec > 0 ? metrics.avgTokPerSec : 336;
  const displaySpeed = p50Speed > 0 ? p50Speed : weightedSpeed;

  container.innerHTML = `
    <!-- Row 1: Hero Full-Width Card -->
    <div class="kpi-hero-card">
      <div class="hero-left">
        <div class="kpi-label-row">
          <span>Total Tokens Processed</span>
          <span>Across All Models</span>
        </div>
        <div class="kpi-hero-value">${formatFullNumber(totalTok)}</div>
        <div class="hero-ratio-wrapper">
          <div class="kpi-ratio-bar">
            <div class="kpi-ratio-seg-cache" style="width: ${cachePercent}%;"></div>
            <div class="kpi-ratio-seg-input" style="width: ${inPercent}%;"></div>
            <div class="kpi-ratio-seg-output" style="width: ${outPercent}%;"></div>
          </div>
          <div class="ratio-labels">
            <span>Cache Read (${cachePercent}%)</span>
            <span>Input (${inPercent}%) · Output (${outPercent}%)</span>
          </div>
        </div>
      </div>

      <!-- Right Key-Value List (Strictly Left Label, Right Pure Number) -->
      <div class="kpi-breakdown-list">
        <div class="kpi-breakdown-row">
          <div class="kpi-breakdown-key">
            <span class="kpi-dot kpi-dot-input"></span>
            <span>Input:</span>
          </div>
          <span class="kpi-breakdown-val">${formatFullNumber(inTok)}</span>
        </div>
        <div class="kpi-breakdown-row">
          <div class="kpi-breakdown-key">
            <span class="kpi-dot kpi-dot-cache"></span>
            <span>Cache Read:</span>
          </div>
          <span class="kpi-breakdown-val">${formatFullNumber(cacheTok)}</span>
        </div>
        <div class="kpi-breakdown-row">
          <div class="kpi-breakdown-key">
            <span class="kpi-dot kpi-dot-output"></span>
            <span>Output:</span>
          </div>
          <span class="kpi-breakdown-val">${formatFullNumber(outTok)}</span>
        </div>
        ${thinkTok > 0 ? `
        <div class="kpi-breakdown-row">
          <div class="kpi-breakdown-key">
            <span class="kpi-dot kpi-dot-think"></span>
            <span>Reasoning:</span>
          </div>
          <span class="kpi-breakdown-val">${formatFullNumber(thinkTok)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Row 2: Dual Core Cards -->
    <div class="kpi-grid-dual">
      <!-- Card 1: Est. Commercial Value & Cost -->
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span>Est. Commercial Value & Cost</span>
          ${savedCost > 0 ? `<span class="kpi-pill-savings">Saved $${savedCost.toFixed(2)}</span>` : ''}
        </div>
        <div class="cost-highlight-row">
          <div class="kpi-value-lg">$${actualCost.toFixed(2)}</div>
          ${savedRatio > 0 ? `<span class="cost-saved-text">已省 ${savedRatio.toFixed(1)}% 账单金额</span>` : ''}
        </div>
        <div class="kpi-savings-bar">
          <div class="kpi-savings-fill" style="width: ${Math.min(100, Math.max(0, savedRatio)).toFixed(1)}%;"></div>
        </div>
        <div class="cost-comparison-labels">
          <span>实际等效 API 成本: $${actualCost.toFixed(2)}</span>
          <span>若无缓存原价: $${baselineCost.toFixed(2)}</span>
        </div>
      </div>

      <!-- Card 2: Interaction Volume & Cadence -->
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span>Interaction Volume & Cadence</span>
          <span>Requests & Turns</span>
        </div>
        <div>
          <span class="kpi-value-lg">${formatFullNumber(totalReq)}</span>
          <span class="kpi-unit">requests</span>
        </div>
        <div class="cadence-rows">
          <div class="cadence-row">
            <span class="cadence-label">${isSession ? 'Session Turns:' : 'User Conversation Turns:'}</span>
            <span class="cadence-val">${formatFullNumber(turnsCount)} 轮</span>
          </div>
          <div class="cadence-row">
            <span class="cadence-label">Avg Tokens / Turn:</span>
            <span class="cadence-val">${formatFullNumber(avgPerTurn)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 3: Triplet Performance Cards -->
    <div class="kpi-grid-triplet">
      <div class="kpi-card kpi-card-compact">
        <div class="kpi-label-row">Cache Cost Efficiency</div>
        <div class="kpi-value-md">${metrics.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">避免了 ~${formatCompactNumber(cacheTok)} 重复 Token 计算</div>
      </div>

      <div class="kpi-card kpi-card-compact">
        <div class="kpi-label-row">Streaming Speed</div>
        <div class="kpi-value-md">${displaySpeed} <span class="kpi-unit">tok/s</span></div>
        <div class="kpi-subtext">P50 中位速 ${displaySpeed} tok/s · 加权均速: ${weightedSpeed} tok/s</div>
      </div>

      <div class="kpi-card kpi-card-compact">
        <div class="kpi-label-row">Avg Time to First Token</div>
        <div class="kpi-value-md">${metrics.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
        <div class="kpi-subtext">首响应分块等待时延</div>
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
  const svgWidth = 600;
  const paddingLeft = 14;
  const paddingRight = 28;
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  let gridSvg = '';
  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / yMax) * chartHeight;
    gridSvg += `
      <line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + chartWidth}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${tickVal === 0 ? '0.6' : '0.2'}" />
    `;
  });

  let areaD = `M ${paddingLeft},${paddingTop + chartHeight}`;
  let lineD = '';
  let xLabelsSvg = '';

  const labelInterval = Math.max(1, Math.floor(totalTurns / 6));

  steps.forEach((st, idx) => {
    const ctx = st.ctx || (st.inTok + st.cacheRead);
    const x = paddingLeft + (totalTurns > 1 ? (idx / (totalTurns - 1)) * chartWidth : 0);
    const y = paddingTop + chartHeight - (ctx / yMax) * chartHeight;

    if (idx === 0) {
      areaD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      lineD = `M ${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      areaD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      lineD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    }

    const isTooCloseToRight = (totalTurns - 1 - idx) < labelInterval * 0.7;
    if (idx % labelInterval === 0 && !isTooCloseToRight) {
      const textAnchor = idx === 0 ? 'start' : 'middle';
      xLabelsSvg += `
        <text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="${textAnchor}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${idx + 1}</text>
      `;
    }
  });

  areaD += ` L ${paddingLeft + chartWidth},${paddingTop + chartHeight} Z`;

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
  const isSessionTimeline = columns[0]?.label.startsWith('#') || false;
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

    let showLabel = false;
    if (isHourly) {
      // Explicitly show only 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00; NEVER show 23:00
      showLabel = idx % 3 === 0 && idx < 23;
    } else if (isSessionTimeline) {
      const isTooCloseToRight = (columns.length - 1 - idx) < labelInterval * 0.7;
      showLabel = (idx % labelInterval === 0 && !isTooCloseToRight);
    } else {
      const isTooCloseToRight = (columns.length - 1 - idx) < labelInterval * 0.45;
      showLabel = (idx % labelInterval === 0 && !isTooCloseToRight)
        || (idx === columns.length - 1 && (columns.length - 1) % labelInterval >= Math.floor(labelInterval / 2));
    }

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
  const hoverBand = chartWrapper.querySelector('#chart-shared-hover-band') as SVGGraphicsElement | null;
  const groups = chartWrapper.querySelectorAll('.chart-column-group');

  if (!tooltip || !stage) return;

  let activeIdx: string | null = null;

  groups.forEach(group => {
    group.addEventListener('mouseenter', () => {
      const target = group as SVGElement;
      const idx = target.getAttribute('data-idx');
      if (idx === activeIdx) return;
      activeIdx = idx;

      const header = target.getAttribute('data-header') || '';
      const inTok = target.getAttribute('data-in') || '0';
      const outTok = target.getAttribute('data-out') || '0';
      const cacheTok = target.getAttribute('data-cache') || '0';
      const totalTok = target.getAttribute('data-total') || '0';
      const ctxTok = target.getAttribute('data-ctx') || '';
      const reqs = target.getAttribute('data-reqs') || '0';
      const subText = target.getAttribute('data-subtext') || '';

      const slotX = parseFloat(target.getAttribute('data-slot-x') || '0');
      const slotW = parseFloat(target.getAttribute('data-slot-w') || '0');

      if (hoverBand) {
        hoverBand.setAttribute('x', String(slotX));
        hoverBand.setAttribute('width', String(slotW));
        hoverBand.style.display = 'block';
        hoverBand.style.opacity = '1';
      }

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
      tooltip.style.opacity = '1';

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
  });

  // Instantaneous zero-flicker hide: zero out width, hide immediately
  stage.addEventListener('mouseleave', () => {
    activeIdx = null;
    if (hoverBand) {
      hoverBand.setAttribute('width', '0');
      hoverBand.style.display = 'none';
    }
    tooltip.style.display = 'none';
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

const MODEL_COLORS: Record<string, string> = {
  'Gemini 3.8 Flash': '#00A67E',
  'Gemini 3.8 Flash (High)': '#8B5CF6',
  'Gemini 3.8 Flash (Exp)': '#3B82F6',
  'Gemini 3.7 Flash': '#EC4899',
  'Claude Opus 4.6 Thinking': '#D97706',
  'Gemini 4 Argon (Medium)': '#06B6D4',
  'Gemini 3.1 Pro': '#10B981',
  'Gemini 3.8 Flash (Tiered)': '#6366F1',
  'Gemini 3 Flash B': '#F59E0B',
  'Gemini 3.7 Flash (High)': '#A855F7'
};

const FALLBACK_COLORS = ['#00A67E', '#8B5CF6', '#3B82F6', '#D97706', '#EC4899', '#06B6D4', '#10B981', '#6366F1', '#F43F5E'];

function getModelColor(modelName: string, index = 0): string {
  if (MODEL_COLORS[modelName]) return MODEL_COLORS[modelName];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getFilterDatesForRange(range: TimeRangeOption): string[] {
  const today = getTodayString();
  if (range === 'today') return [today];
  if (range === 'yesterday') return [getYesterdayString()];
  if (range === 'this-week') {
    const monday = getStartOfWeekString();
    const d = new Date(monday + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const sunday = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return generateContinuousDateList(monday, sunday);
  }
  if (range === 'this-month') {
    return generateContinuousDateList(getStartOfMonthString(), today);
  }
  if (range === 'last-7-days') {
    return generateContinuousDateList(getPastDaysString(6), today);
  }
  if (range === 'last-30-days') {
    return generateContinuousDateList(getPastDaysString(29), today);
  }
  if (range === 'custom' && customStartDate && customEndDate) {
    return generateContinuousDateList(customStartDate, customEndDate);
  }
  return generateContinuousDateList(getPastDaysString(29), today);
}

export function getDefaultModelId(mName: string): string {
  switch (mName) {
    case 'Gemini 3.8 Flash': return 'gemini-3.8-flash';
    case 'Gemini 3.8 Flash (High)': return 'gemini-3.8-flash-n';
    case 'Gemini 3.8 Flash (Exp)': return 'gemini-3.8-flash-exp-a';
    case 'Gemini 3.8 Flash (Tiered)': return 'gemini-3.8-flash-tiered';
    case 'Gemini 3.7 Flash': return 'gemini-3.7-flash';
    case 'Gemini 3.7 Flash (High)': return 'gemini-3.7-flash-n';
    case 'Gemini 4 Argon (Medium)': return 'gemini-4-argon-m';
    case 'Gemini 3.1 Pro': return 'gemini-3.1-pro-low';
    case 'Claude Opus 4.6 Thinking': return 'claude-opus-4-6-thinking';
    default: return mName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}

export function renderModelDistribution(overview: GlobalAnalyticsOverview, range: TimeRangeOption): void {
  const container = document.getElementById('analytics-models-list');
  if (!container) return;

  let models: ModelTokenStat[] = [];
  if (range === 'session') {
    if (activeSessionData && (activeSessionData as any).models && (activeSessionData as any).models.length > 0) {
      models = (activeSessionData as any).models;
    } else {
      models = overview.modelDistribution || [];
    }
  } else {
    const dates = getFilterDatesForRange(range);
    const statsMap: Record<string, { modelId: string; inTok: number; outTok: number; cacheRead: number; thinkTok: number; streamSec: number; requests: number }> = {};

    for (const d of dates) {
      const dayModels = overview.dailyModelStats?.[d];
      if (dayModels) {
        for (const [mName, st] of Object.entries(dayModels)) {
          if (!mName || mName.toLowerCase().includes('unknown') || (st.inTok + st.outTok + st.cacheRead) === 0) continue;
          if (!statsMap[mName]) {
            const rawId = (st as any).modelId;
            const validId = (rawId && rawId !== 'unknown' && rawId !== mName) ? rawId : getDefaultModelId(mName);
            statsMap[mName] = { modelId: validId, inTok: 0, outTok: 0, cacheRead: 0, thinkTok: 0, streamSec: 0, requests: 0 };
          }
          statsMap[mName].inTok += st.inTok;
          statsMap[mName].outTok += st.outTok;
          statsMap[mName].cacheRead += st.cacheRead;
          statsMap[mName].thinkTok += st.thinkTok;
          statsMap[mName].streamSec += st.streamSec;
          statsMap[mName].requests += st.requests;
        }
      }
    }

    if (Object.keys(statsMap).length > 0) {
      models = Object.entries(statsMap).map(([mName, st]) => {
        const total = st.inTok + st.outTok + st.cacheRead;
        const avgTps = st.streamSec > 0 ? Math.round(st.outTok / st.streamSec) : 0;
        return {
          modelId: st.modelId,
          modelName: mName,
          totalTokens: total,
          inputTok: st.inTok,
          outTok: st.outTok,
          cacheRead: st.cacheRead,
          thinkTok: st.thinkTok,
          requests: st.requests,
          avgTps,
          avgTtft: 0
        };
      }).sort((a, b) => b.totalTokens - a.totalTokens);
    } else {
      models = [];
    }
  }

  models = models.filter(m => m.totalTokens > 0 && !m.modelName.toLowerCase().includes('unknown'));

  if (!models || models.length === 0) {
    container.innerHTML = `<div class="chart-empty">No model usage recorded in this range</div>`;
    return;
  }

  const maxTokens = Math.max(...models.map(m => m.totalTokens), 1);

  const itemsHtml = models.map((m, idx) => {
    const pct = Math.max(3, Math.round((m.totalTokens / maxTokens) * 100));
    const color = getModelColor(m.modelName, idx);
    const speedBadge = m.avgTps > 0 ? `<span class="model-speed-badge">⚡ ${m.avgTps} tok/s</span>` : '';
    const rawTotal = m.inputTok + m.cacheRead;
    const cacheRate = rawTotal > 0 ? Math.round((m.cacheRead / rawTotal) * 100) : 0;

    return `
      <div class="model-stat-row">
        <div class="model-meta">
          <div class="model-title-line">
            <span class="model-dot" style="background: ${color}"></span>
            <span class="model-name">${m.modelName}</span>
            <span class="model-id-badge" title="API Endpoint ID: ${m.modelId}">${m.modelId}</span>
            ${speedBadge}
          </div>
          <div class="model-token-count">
            <span class="model-tokens-strong">${formatCompactNumber(m.totalTokens)}</span> tokens
            <span class="model-req-count">(${formatFullNumber(m.requests)} reqs)</span>
          </div>
        </div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width: ${pct}%; background: ${color}"></div>
        </div>
        <div class="model-chips">
          <span class="model-chip"><span class="chip-dot" style="background: #00A67E"></span>Cache: ${cacheRate}% (${formatCompactNumber(m.cacheRead)})</span>
          <span class="model-chip"><span class="chip-dot" style="background: var(--aura-primary)"></span>Out: ${formatCompactNumber(m.outTok)}</span>
          <span class="model-chip"><span class="chip-dot" style="background: #6366F1"></span>In: ${formatCompactNumber(m.inputTok)}</span>
          ${m.thinkTok > 0 ? `<span class="model-chip"><span class="chip-dot" style="background: #A855F7"></span>Think: ${formatCompactNumber(m.thinkTok)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = itemsHtml;
}

export function canonicalizeTool(raw: string): { name: string; category: string; color: string } {
  switch (raw) {
    case 'run_command':
      return { name: 'Command & Terminal', category: 'Execution', color: '#F59E0B' };
    case 'view_file':
    case 'read_file':
    case 'list_dir':
    case 'read_url_content':
      return { name: 'File & Code Reading', category: 'Inspection', color: '#00A67E' };
    case 'replace_file_content':
    case 'edit_file':
    case 'write_to_file':
    case 'write_file':
      return { name: 'Code Editing & File Write', category: 'Modification', color: '#3B82F6' };
    case 'grep_search':
    case 'find_by_name':
      return { name: 'Codebase Search', category: 'Discovery', color: '#8B5CF6' };
    case 'search_web':
      return { name: 'Web Search & Docs', category: 'Search', color: '#06B6D4' };
    case 'invoke_subagent':
    case 'manage_subagents':
    case 'send_message':
    case 'define_subagent':
      return { name: 'Multi-Agent Coordination', category: 'Agentic', color: '#EC4899' };
    case 'schedule':
    case 'manage_task':
      return { name: 'Task Scheduling', category: 'Workflow', color: '#10B981' };
    case 'ask_question':
      return { name: 'User Interaction', category: 'Communication', color: '#6366F1' };
    default:
      return { name: raw, category: 'Extension', color: '#948F85' };
  }
}

export function renderToolDistribution(overview: GlobalAnalyticsOverview, range: TimeRangeOption): void {
  const container = document.getElementById('analytics-tools-list');
  if (!container) return;

  let tools: ToolStatItem[] = [];
  if (range === 'session') {
    if (activeSessionData && (activeSessionData as any).tools && (activeSessionData as any).tools.length > 0) {
      tools = (activeSessionData as any).tools;
    } else {
      tools = overview.toolDistribution || [];
    }
  } else {
    const dates = getFilterDatesForRange(range);
    const countsMap: Record<string, number> = {};

    for (const d of dates) {
      const dayTools = overview.dailyToolStats?.[d];
      if (dayTools) {
        for (const [tName, cnt] of Object.entries(dayTools)) {
          countsMap[tName] = (countsMap[tName] || 0) + cnt;
        }
      }
    }

    const totalCalls = Object.values(countsMap).reduce((a, b) => a + b, 0);
    if (totalCalls > 0) {
      tools = Object.entries(countsMap)
        .map(([rawName, count]) => {
          const info = canonicalizeTool(rawName);
          return {
            rawName,
            name: info.name,
            category: info.category,
            color: info.color,
            count,
            percentage: Math.round((count / totalCalls) * 1000) / 10
          };
        })
        .sort((a, b) => b.count - a.count);
    } else {
      tools = [];
    }
  }

  if (!tools || tools.length === 0) {
    container.innerHTML = `<div class="chart-empty">No tool executions recorded in this range</div>`;
    return;
  }

  const maxCount = Math.max(...tools.map(t => t.count), 1);
  const totalAll = tools.reduce((a, b) => a + b.count, 0);

  const itemsHtml = tools.map((t) => {
    // Progress bar width represents the exact share of total tool executions
    const pct = Math.max(0.5, t.percentage);
    return `
      <div class="tool-stat-row">
        <div class="tool-meta">
          <div class="tool-title-line">
            <span class="tool-category-badge" style="background: ${t.color}22; color: ${t.color}; border: 1px solid ${t.color}44">${t.category}</span>
            <span class="tool-name">${t.name}</span>
            <span class="tool-raw-badge" title="Raw invocation name: ${t.rawName}">${t.rawName}</span>
          </div>
          <div class="tool-call-count">
            <span class="tool-count-strong">${formatFullNumber(t.count)}</span> calls
            <span class="tool-pct-badge">${t.percentage.toFixed(1)}%</span>
          </div>
        </div>
        <div class="tool-bar-track">
          <div class="tool-bar-fill" style="width: ${pct.toFixed(1)}%; background: ${t.color}"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="tool-distribution-summary">
      <span class="tool-summary-text">Total Invocations: <strong>${formatFullNumber(totalAll)}</strong></span>
    </div>
    <div class="tool-distribution-grid">
      ${itemsHtml}
    </div>
  `;
}

export function renderModelTpsChart(overview: GlobalAnalyticsOverview, range: TimeRangeOption): void {
  const chartWrapper = document.getElementById('analytics-model-tps-chart');
  if (!chartWrapper) return;

  const isSession = range === 'session' && !!activeSessionData && activeSessionData.steps.length > 0;
  const isHourly = range === 'today' || range === 'yesterday';

  const svgWidth = 600;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 28;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // 1. Session Mode: Turn-by-Turn TPS
  if (isSession) {
    const steps = activeSessionData!.steps;
    const totalTurns = steps.length;
    let rawMaxTps = 0;
    const points: Array<{ x: number; y: number; tps: number; stepIdx: number }> = [];

    steps.forEach((st, idx) => {
      const tps = st.stream > 0 && st.outTok > 0 ? Math.round(st.outTok / st.stream) : 0;
      if (tps > rawMaxTps) rawMaxTps = tps;
    });

    const maxTps = Math.max(300, Math.ceil((rawMaxTps * 1.15) / 100) * 100);
    const stepX = chartWidth / Math.max(1, totalTurns - 1);

    steps.forEach((st, idx) => {
      const tps = st.stream > 0 && st.outTok > 0 ? Math.round(st.outTok / st.stream) : 0;
      const x = paddingLeft + (totalTurns > 1 ? idx * stepX : chartWidth / 2);
      const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
      points.push({ x, y, tps, stepIdx: st.idx + 1 });
    });

    const yTicks = [0, Math.round(maxTps * 0.33), Math.round(maxTps * 0.66), maxTps];
    let yAxisLinesSvg = '';
    let yAxisTextsSvg = '';
    yTicks.forEach(tickVal => {
      const y = paddingTop + chartHeight - (tickVal / maxTps) * chartHeight;
      yAxisLinesSvg += `<line x1="${paddingLeft}" y1="${y.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${y.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />`;
      yAxisTextsSvg += `<text x="${paddingLeft - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${tickVal}</text>`;
    });

    let xLabelsSvg = '';
    const labelInterval = Math.max(1, Math.floor(totalTurns / 6));
    steps.forEach((st, idx) => {
      const isTooCloseToRight = (totalTurns - 1 - idx) < labelInterval * 0.7;
      if (idx % labelInterval === 0 && !isTooCloseToRight) {
        const x = paddingLeft + (totalTurns > 1 ? idx * stepX : chartWidth / 2);
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${st.idx + 1}</text>`;
      }
    });

    let pathD = '';
    let dotsSvg = '';
    points.forEach((p, i) => {
      if (i === 0) pathD = `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      else pathD += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      if (totalTurns <= 50) {
        dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#8B5CF6" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" />`;
      }
    });

    let hoverBandsSvg = '';
    points.forEach((p, idx) => {
      const bandW = stepX;
      const bandX = Math.max(paddingLeft, p.x - bandW / 2);
      const dataPayload = JSON.stringify([{ model: 'Active Session Turn #' + p.stepIdx, color: '#8B5CF6', tps: p.tps, reqs: 1 }]);
      hoverBandsSvg += `
        <rect class="tps-hover-slot"
              x="${bandX.toFixed(1)}" y="${paddingTop}" width="${bandW.toFixed(1)}" height="${chartHeight}"
              fill="transparent"
              data-date="Session Turn #${p.stepIdx}"
              data-center-x="${p.x.toFixed(1)}"
              data-models="${encodeURIComponent(dataPayload)}" />
      `;
    });

    chartWrapper.innerHTML = `
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends</h3>
        </div>
      </div>
      <div class="chart-body" style="position: relative;">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
          ${yAxisLinesSvg}
          ${yAxisTextsSvg}
          ${xLabelsSvg}
          <path d="${pathD}" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          ${dotsSvg}
          <line id="tps-scrubber-line" x1="0" y1="${paddingTop}" x2="0" y2="${paddingTop + chartHeight}" stroke="var(--aura-border-focus, #3B82F6)" stroke-width="1.5" stroke-dasharray="2 2" style="display: none; pointer-events: none;" />
          ${hoverBandsSvg}
        </svg>
        <div class="chart-floating-tooltip" id="tps-floating-tooltip" style="display: none;"></div>
      </div>
    `;

    attachTpsTooltipListeners(chartWrapper, svgWidth);
    return;
  }

  // 2. Hourly Granularity (Today / Yesterday): 24 Hours
  if (isHourly) {
    const today = getTodayString();
    const yesterday = getYesterdayString();
    const targetDate = range === 'today' ? today : yesterday;
    const hourKeys: string[] = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      hourKeys.push(`${targetDate} ${hh}:00`);
    }

    const activeModelsSet = new Set<string>();
    hourKeys.forEach(hKey => {
      const hModels = overview.hourlyModelStats?.[hKey];
      if (hModels) {
        for (const [mName, st] of Object.entries(hModels)) {
          if (st.streamSec > 0 && st.outTok > 0 && !mName.toLowerCase().includes('unknown')) {
            activeModelsSet.add(mName);
          }
        }
      }
    });

    const activeModelNames = Array.from(activeModelsSet);
    if (activeModelNames.length === 0) {
      chartWrapper.innerHTML = `
        <div class="chart-header">
          <div class="chart-header-left">
            <h3 class="chart-title">Model Speed Trends</h3>
          </div>
        </div>
        <div class="chart-empty">No streaming latency data recorded for ${range === 'today' ? 'today' : 'yesterday'}</div>
      `;
      return;
    }

    let rawMaxTps = 0;
    const seriesByModel: Record<string, Array<{ x: number; y: number; tps: number; hourLabel: string; reqs: number } | null>> = {};
    const stepX = chartWidth / (hourKeys.length - 1);

    for (const mName of activeModelNames) {
      hourKeys.forEach(hKey => {
        const st = overview.hourlyModelStats?.[hKey]?.[mName];
        if (st && st.streamSec > 0 && st.outTok > 0) {
          const tps = Math.round(st.outTok / st.streamSec);
          if (tps > rawMaxTps) rawMaxTps = tps;
        }
      });
    }

    const maxTps = Math.max(300, Math.ceil((rawMaxTps * 1.15) / 100) * 100);

    for (const mName of activeModelNames) {
      seriesByModel[mName] = [];
      hourKeys.forEach((hKey, idx) => {
        const st = overview.hourlyModelStats?.[hKey]?.[mName];
        const x = paddingLeft + idx * stepX;
        const hh = hKey.slice(11, 16);
        if (st && st.streamSec > 0 && st.outTok > 0) {
          const tps = Math.round(st.outTok / st.streamSec);
          const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
          seriesByModel[mName].push({ x, y, tps, hourLabel: hh, reqs: st.requests });
        } else {
          seriesByModel[mName].push(null);
        }
      });
    }

    const yTicks = [0, Math.round(maxTps * 0.33), Math.round(maxTps * 0.66), maxTps];
    let yAxisLinesSvg = '';
    let yAxisTextsSvg = '';
    yTicks.forEach(tickVal => {
      const y = paddingTop + chartHeight - (tickVal / maxTps) * chartHeight;
      yAxisLinesSvg += `<line x1="${paddingLeft}" y1="${y.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${y.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />`;
      yAxisTextsSvg += `<text x="${paddingLeft - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${tickVal}</text>`;
    });

    let xLabelsSvg = '';
    hourKeys.forEach((hKey, idx) => {
      // Explicitly show only 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00; NEVER show 23:00
      if (idx % 3 === 0 && idx < 23) {
        const x = paddingLeft + idx * stepX;
        const hh = hKey.slice(11, 16);
        xLabelsSvg += `<text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${hh}</text>`;
      }
    });

    let pathsSvg = '';
    let dotsSvg = '';
    activeModelNames.forEach((mName, mIdx) => {
      const color = getModelColor(mName, mIdx);
      const pts = seriesByModel[mName];
      let currentPath = '';

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p) {
          if (!currentPath) {
            currentPath = `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          } else {
            currentPath += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          }
          dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" />`;
        } else {
          if (currentPath) {
            pathsSvg += `<path d="${currentPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
            currentPath = '';
          }
        }
      }
      if (currentPath) {
        pathsSvg += `<path d="${currentPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      }
    });

    let hoverBandsSvg = '';
    hourKeys.forEach((hKey, idx) => {
      const x = paddingLeft + idx * stepX;
      const bandW = stepX;
      const bandX = Math.max(paddingLeft, x - bandW / 2);
      const dayData: Array<{ model: string; color: string; tps: number; reqs: number }> = [];

      activeModelNames.forEach((mName, mIdx) => {
        const st = overview.hourlyModelStats?.[hKey]?.[mName];
        if (st && st.streamSec > 0 && st.outTok > 0) {
          dayData.push({
            model: mName,
            color: getModelColor(mName, mIdx),
            tps: Math.round(st.outTok / st.streamSec),
            reqs: st.requests
          });
        }
      });

      hoverBandsSvg += `
        <rect class="tps-hover-slot"
              x="${bandX.toFixed(1)}" y="${paddingTop}" width="${bandW.toFixed(1)}" height="${chartHeight}"
              fill="transparent"
              data-date="${hKey.slice(0, 16)}"
              data-center-x="${x.toFixed(1)}"
              data-models="${encodeURIComponent(JSON.stringify(dayData))}" />
      `;
    });

    chartWrapper.innerHTML = `
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends</h3>
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

    attachTpsTooltipListeners(chartWrapper, svgWidth);
    return;
  }

  // 3. Multi-day Granularity: Daily Avg TPS
  const dateList = getFilterDatesForRange(range);
  const activeModelsMap: Record<string, { totalOut: number; totalStream: number; daysCount: number }> = {};
  for (const d of dateList) {
    const dayStats = overview.dailyModelStats?.[d];
    if (dayStats) {
      for (const [mName, st] of Object.entries(dayStats)) {
        if (st.streamSec > 0 && st.outTok > 0) {
          if (!activeModelsMap[mName]) activeModelsMap[mName] = { totalOut: 0, totalStream: 0, daysCount: 0 };
          activeModelsMap[mName].totalOut += st.outTok;
          activeModelsMap[mName].totalStream += st.streamSec;
          activeModelsMap[mName].daysCount += 1;
        }
      }
    }
  }

  const activeModelNames = Object.keys(activeModelsMap).filter(m => !m.toLowerCase().includes('unknown'));

  if (activeModelNames.length === 0) {
    chartWrapper.innerHTML = `
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends</h3>
        </div>
      </div>
      <div class="chart-empty">No streaming latency data recorded in this period</div>
    `;
    return;
  }

  let rawMaxTps = 0;
  const seriesByModel: Record<string, Array<{ x: number; y: number; tps: number; date: string; reqs: number } | null>> = {};

  for (const mName of activeModelNames) {
    seriesByModel[mName] = [];
    dateList.forEach((dStr) => {
      const st = overview.dailyModelStats?.[dStr]?.[mName];
      if (st && st.streamSec > 0 && st.outTok > 0) {
        const tps = Math.round(st.outTok / st.streamSec);
        if (tps > rawMaxTps) rawMaxTps = tps;
      }
    });
  }

  const maxTps = Math.max(500, Math.ceil((rawMaxTps * 1.15) / 100) * 100);
  const stepX = chartWidth / Math.max(1, dateList.length - 1);

  for (const mName of activeModelNames) {
    dateList.forEach((dStr, idx) => {
      const st = overview.dailyModelStats?.[dStr]?.[mName];
      const x = paddingLeft + idx * stepX;
      if (st && st.streamSec > 0 && st.outTok > 0) {
        const tps = Math.round(st.outTok / st.streamSec);
        const y = paddingTop + chartHeight - (tps / maxTps) * chartHeight;
        seriesByModel[mName].push({ x, y, tps, date: dStr, reqs: st.requests });
      } else {
        seriesByModel[mName].push(null);
      }
    });
  }

  const yTicks = [0, Math.round(maxTps * 0.33), Math.round(maxTps * 0.66), maxTps];
  let yAxisLinesSvg = '';
  let yAxisTextsSvg = '';

  yTicks.forEach(tickVal => {
    const y = paddingTop + chartHeight - (tickVal / maxTps) * chartHeight;
    yAxisLinesSvg += `
      <line x1="${paddingLeft}" y1="${y.toFixed(1)}" x2="${svgWidth - paddingRight}" y2="${y.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />
    `;
    yAxisTextsSvg += `
      <text x="${paddingLeft - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${tickVal}</text>
    `;
  });

  let xLabelsSvg = '';
  const labelInterval = Math.max(1, Math.floor(dateList.length / 7));
  dateList.forEach((dStr, idx) => {
    const isEdge = idx === dateList.length - 1;
    const isTooClose = isEdge && (idx % labelInterval < Math.floor(labelInterval / 2)) && idx !== 0;
    if ((idx % labelInterval === 0 && !isTooClose) || isEdge) {
      const x = paddingLeft + idx * stepX;
      xLabelsSvg += `
        <text x="${x.toFixed(1)}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${formatDateLabel(dStr)}</text>
      `;
    }
  });

  let pathsSvg = '';
  let dotsSvg = '';

  activeModelNames.forEach((mName, mIdx) => {
    const color = getModelColor(mName, mIdx);
    const pts = seriesByModel[mName];

    let currentPath = '';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p) {
        if (!currentPath) {
          currentPath = `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        } else {
          currentPath += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }
        dotsSvg += `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" class="tps-point" />
        `;
      } else {
        if (currentPath) {
          pathsSvg += `<path d="${currentPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
          currentPath = '';
        }
      }
    }
    if (currentPath) {
      pathsSvg += `<path d="${currentPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    }
  });

  let hoverBandsSvg = '';
  dateList.forEach((dStr, idx) => {
    const x = paddingLeft + idx * stepX;
    const bandW = stepX;
    const bandX = Math.max(paddingLeft, x - bandW / 2);

    const dayData: Array<{ model: string; color: string; tps: number; reqs: number }> = [];
    activeModelNames.forEach((mName, mIdx) => {
      const st = overview.dailyModelStats?.[dStr]?.[mName];
      if (st && st.streamSec > 0 && st.outTok > 0) {
        dayData.push({
          model: mName,
          color: getModelColor(mName, mIdx),
          tps: Math.round(st.outTok / st.streamSec),
          reqs: st.requests
        });
      }
    });

    hoverBandsSvg += `
      <rect class="tps-hover-slot" 
            x="${bandX.toFixed(1)}" y="${paddingTop}" width="${bandW.toFixed(1)}" height="${chartHeight}" 
            fill="transparent" 
            data-date="${dStr}"
            data-center-x="${x.toFixed(1)}"
            data-models="${encodeURIComponent(JSON.stringify(dayData))}" />
    `;
  });

  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <h3 class="chart-title">Model Speed Trends</h3>
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

  attachTpsTooltipListeners(chartWrapper, svgWidth);
}

function attachTpsTooltipListeners(chartWrapper: HTMLElement, svgWidth: number): void {
  const stage = chartWrapper.querySelector('.chart-body') as HTMLElement | null;
  const scrubber = chartWrapper.querySelector('#tps-scrubber-line') as SVGLineElement | null;
  const tooltip = chartWrapper.querySelector('#tps-floating-tooltip') as HTMLElement | null;
  if (!stage || !tooltip || !scrubber) return;

  const slots = chartWrapper.querySelectorAll('.tps-hover-slot');
  slots.forEach(slot => {
    slot.addEventListener('mouseenter', () => {
      const centerX = parseFloat(slot.getAttribute('data-center-x') || '0');
      const dateStr = slot.getAttribute('data-date') || '';
      const rawData = slot.getAttribute('data-models') || '[]';
      let modelsData: Array<{ model: string; color: string; tps: number; reqs: number }> = [];
      try {
        modelsData = JSON.parse(decodeURIComponent(rawData));
      } catch {}

      scrubber.setAttribute('x1', String(centerX));
      scrubber.setAttribute('x2', String(centerX));
      scrubber.style.display = 'block';

      const rowsHtml = modelsData.length > 0 ? modelsData.map(m => `
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: ${m.color}"></span>
          <span class="tooltip-label">${m.model}</span>
          <span class="tooltip-val">${m.tps} tok/s (${m.reqs} reqs)</span>
        </div>
      `).join('') : '<div class="tooltip-subline">No activity on this date</div>';

      tooltip.innerHTML = `
        <div class="tooltip-header">${formatFullDate(dateStr)}</div>
        ${rowsHtml}
      `;

      tooltip.style.display = 'block';
      tooltip.style.opacity = '1';

      const stageRect = stage.getBoundingClientRect();
      const tipWidth = tooltip.offsetWidth || 180;
      const pxRatio = stageRect.width / svgWidth;
      const screenX = centerX * pxRatio;

      let left = screenX + 12;
      if (left + tipWidth > stageRect.width - 12) {
        left = screenX - tipWidth - 12;
      }
      left = Math.max(6, Math.min(left, stageRect.width - tipWidth - 6));

      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `16px`;
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
    renderModelDistribution(rawOverview, range);
    renderToolDistribution(rawOverview, range);
    renderModelTpsChart(rawOverview, range);
  }
}

export async function refreshAnalytics(): Promise<void> {
  const refreshBtn = document.getElementById('btn-refresh-analytics');
  if (refreshBtn) refreshBtn.classList.add('loading');

  const [overview, session] = await Promise.all([
    fetchOverview(),
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
    renderModelDistribution(rawOverview, currentRange);
    renderToolDistribution(rawOverview, currentRange);
    renderModelTpsChart(rawOverview, currentRange);
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
