import {
  canonicalizeTool,
  canonicalModelName,
  getModelColor,
  getModelPricingRates,
  resolveCanonicalModelId
} from '../../shared/catalog';
import {
  escapeHtml,
  formatCompactNumber,
  formatDateLabel,
  formatFullDate,
  formatFullNumber,
  formatLocalDateKey
} from '../../shared/format';
import { computeBucketTps, computeStepTps, computeWeightedTps } from '../../shared/tps';
import type {
  DailySeriesPoint,
  GlobalAnalyticsOverview,
  HourlySeriesPoint,
  ModelDailyStat,
  ModelTokenStat,
  ProjectStatItem,
  RangePerfFields,
  SessionAnalyticsData,
  ToolStatItem
} from '../../types';
import type { ProjectScopeMode } from '../panel-state';
import { showToast } from '../settings';
import type { ChartColumnData } from './charts-base';
import {
  generateContinuousDateList,
  getFilterDatesForRange,
  getRangeBounds,
  getRangeDisplayTitle,
  type TimeRangeOption
} from './time-range';

export interface ProcessedRangeMetrics {
  columns: ChartColumnData[];
  totalTokens: { input: number; output: number; cacheRead: number; thinking: number; total: number };
  totalRequests: number;
  cacheEfficiency: number;
  avgTtft: number;
  avgTokPerSec: number;
  p50TokPerSec: number;
  avgTurnLatency: number;
}

export interface RangePerfResult {
  avgTokPerSec: number;
  p50TokPerSec: number;
  avgTtft: number;
  avgTurnLatency: number;
}

export function computeRangePerf(
  buckets: RangePerfFields[],
  requestsCount: number,
  overview: GlobalAnalyticsOverview
): RangePerfResult {
  if (requestsCount <= 0) {
    return { avgTokPerSec: 0, p50TokPerSec: 0, avgTtft: 0, avgTurnLatency: 0 };
  }

  let effOut = 0;
  let effSec = 0;
  let ttftSum = 0;
  let ttftCount = 0;
  let turnDurSum = 0;
  let validTurnCount = 0;
  const mergedHist: Record<number, number> = {};
  let histTotal = 0;
  let hasPerfFields = false;

  for (const b of buckets) {
    if (!b) continue;
    if (
      b.effSec !== undefined ||
      b.ttftCount !== undefined ||
      b.validTurnCount !== undefined ||
      b.tpsHist !== undefined
    ) {
      hasPerfFields = true;
    }
    effOut += b.effOutTok || 0;
    effSec += b.effSec || 0;
    ttftSum += b.ttftSum || 0;
    ttftCount += b.ttftCount || 0;
    turnDurSum += b.turnDurSum || 0;
    validTurnCount += b.validTurnCount || 0;
    if (b.tpsHist) {
      for (const [k, cnt] of Object.entries(b.tpsHist)) {
        const c = Number(cnt) || 0;
        if (c > 0) {
          const tpsVal = Number(k);
          mergedHist[tpsVal] = (mergedHist[tpsVal] || 0) + c;
          histTotal += c;
        }
      }
    }
  }

  if (!hasPerfFields) {
    return {
      avgTokPerSec: overview.avgTokPerSec,
      p50TokPerSec: overview.p50TokPerSec ?? overview.avgTokPerSec,
      avgTtft: overview.avgTtft,
      avgTurnLatency: overview.avgTurnLatency ?? 0
    };
  }

  const avgTokPerSec = effSec > 0 ? computeWeightedTps(effOut, effSec) : 0;

  let p50TokPerSec = avgTokPerSec;
  if (histTotal > 0) {
    const targetIdx = Math.floor(histTotal * 0.5);
    const keys = Object.keys(mergedHist)
      .map(Number)
      .sort((a, b) => a - b);
    let cum = 0;
    for (const k of keys) {
      cum += mergedHist[k];
      if (cum > targetIdx) {
        p50TokPerSec = k;
        break;
      }
    }
  }

  const avgTtft = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 100) / 100 : 0;
  const avgTurnLatency =
    validTurnCount > 0 ? Math.round((turnDurSum / validTurnCount) * 100) / 100 : 0;

  return { avgTokPerSec, p50TokPerSec, avgTtft, avgTurnLatency };
}

export function computeProcessedColumns(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): ProcessedRangeMetrics {
  if (range === 'session') {
    if (!activeSessionData || activeSessionData.steps.length === 0) {
      return {
        columns: [],
        totalTokens: { input: 0, output: 0, cacheRead: 0, thinking: 0, total: 0 },
        totalRequests: 0,
        cacheEfficiency: 0,
        avgTtft: 0,
        avgTokPerSec: 0,
        p50TokPerSec: 0,
        avgTurnLatency: 0
      };
    }

    const s = activeSessionData;
    const columns: ChartColumnData[] = s.steps.map((st) => {
      const ctx = st.ctx || st.inTok + st.cacheRead;
      const tps = computeStepTps(st.outTok, st.ttft, st.stream, st.totDur);
      return {
        label: `#${st.idx + 1}`,
        tooltipHeader: `Session Turn #${st.idx + 1}`,
        inputTok: st.inTok,
        outTok: st.outTok,
        cacheRead: st.cacheRead,
        ctx,
        requests: 1,
        subText: `Context: ${formatCompactNumber(ctx)} · Speed: ${Math.round(tps.displayTps)} tok/s`
      };
    });

    return {
      columns,
      totalTokens: s.totalTokens,
      totalRequests: s.totalRequests,
      cacheEfficiency: s.cacheEfficiency,
      avgTtft: s.avgTtft,
      avgTokPerSec: s.avgTokPerSec,
      p50TokPerSec: s.p50TokPerSec ?? s.avgTokPerSec,
      avgTurnLatency: s.avgTurnLatency ?? 0
    };
  }

  if (range === 'today' || range === 'yesterday') {
    const targetDate =
      range === 'today'
        ? formatLocalDateKey(now)
        : formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

    const hourlyMap: Record<string, ChartColumnData> = {};
    const matchedHourlyBuckets: HourlySeriesPoint[] = [];

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

    for (const hItem of overview.hourlySeries || []) {
      if (hItem.hourKey && hItem.hourKey.startsWith(targetDate)) {
        matchedHourlyBuckets.push(hItem);
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
    let inTok = 0;
    let outTok = 0;
    let cacheTok = 0;
    let reqs = 0;
    for (const c of columns) {
      inTok += c.inputTok;
      outTok += c.outTok;
      cacheTok += c.cacheRead;
      reqs += c.requests;
    }

    const perf = computeRangePerf(matchedHourlyBuckets, reqs, overview);
    const totalTok = inTok + outTok + cacheTok;
    const rawTotal = inTok + cacheTok;
    const efficiency = reqs === 0 || rawTotal <= 0 ? 0 : (cacheTok / rawTotal) * 100;

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
      avgTtft: perf.avgTtft,
      avgTokPerSec: perf.avgTokPerSec,
      p50TokPerSec: perf.p50TokPerSec,
      avgTurnLatency: perf.avgTurnLatency
    };
  }

  const { startDate, endDate } = getRangeBounds(range, customStart, customEnd, now);
  const dateMap: Record<string, DailySeriesPoint> = {};
  for (const item of overview.timeRangeSeries || []) {
    if (item.date && !item.date.startsWith('0001')) {
      dateMap[item.date] = item;
    }
  }

  const dateList = generateContinuousDateList(startDate, endDate);
  const startMs = new Date(`${startDate}T00:00:00`).getTime();
  const endMs = new Date(`${endDate}T00:00:00`).getTime();
  const daySpan = Math.round((endMs - startMs) / 86400000);

  const matchedDailyBuckets: DailySeriesPoint[] = [];
  for (const dStr of dateList) {
    if (dateMap[dStr]) matchedDailyBuckets.push(dateMap[dStr]);
  }

  let columns: ChartColumnData[];
  if (daySpan > 90) {
    const weeklyMap: Record<string, ChartColumnData> = {};
    for (const dStr of dateList) {
      const item = dateMap[dStr];
      const d = new Date(`${dStr}T00:00:00`);
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
      if (item) {
        weeklyMap[weekKey].inputTok += item.inputTok;
        weeklyMap[weekKey].outTok += item.outTok;
        weeklyMap[weekKey].cacheRead += item.cacheRead;
        weeklyMap[weekKey].requests += item.requests;
      }
    }
    columns = Object.values(weeklyMap);
  } else {
    columns = dateList.map((dateStr) => {
      const item = dateMap[dateStr];
      return {
        label: formatDateLabel(dateStr),
        tooltipHeader: formatFullDate(dateStr),
        inputTok: item?.inputTok || 0,
        outTok: item?.outTok || 0,
        cacheRead: item?.cacheRead || 0,
        requests: item?.requests || 0
      };
    });
  }

  let inTok = 0;
  let outTok = 0;
  let cacheTok = 0;
  let reqs = 0;
  for (const c of columns) {
    inTok += c.inputTok;
    outTok += c.outTok;
    cacheTok += c.cacheRead;
    reqs += c.requests;
  }

  const totalTok = inTok + outTok + cacheTok;
  const rawTotal = inTok + cacheTok;
  const efficiency = reqs === 0 || rawTotal <= 0 ? 0 : (cacheTok / rawTotal) * 100;
  const perf = computeRangePerf(matchedDailyBuckets, reqs, overview);

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
    avgTtft: perf.avgTtft,
    avgTokPerSec: perf.avgTokPerSec,
    p50TokPerSec: perf.p50TokPerSec,
    avgTurnLatency: perf.avgTurnLatency
  };
}

export interface CostAndSavings {
  actualCost: number;
  savedCost: number;
  savedRatio: number;
}

export function computeApiCostAndSavings(
  metrics: ProcessedRangeMetrics,
  range: TimeRangeOption,
  overview: GlobalAnalyticsOverview | null,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = ''
): CostAndSavings {
  let actualCost = 0;
  let baselineCost = 0;

  if (range === 'session' && activeSessionData) {
    const sessionModels = (activeSessionData.models || []).filter(
      (m) => m.inputTok + m.outTok + m.cacheRead > 0 && !m.modelName.toLowerCase().includes('unknown')
    );
    if (sessionModels.length > 0) {
      for (const m of sessionModels) {
        const rates = getModelPricingRates(m.modelId || m.modelName);
        actualCost +=
          (m.inputTok * rates.inputRate +
            m.outTok * rates.outputRate +
            m.cacheRead * rates.cacheRate) /
          1_000_000;
        baselineCost +=
          ((m.inputTok + m.cacheRead) * rates.inputRate + m.outTok * rates.outputRate) / 1_000_000;
      }
    } else {
      const rates = getModelPricingRates('gemini-3.8-flash');
      actualCost =
        (metrics.totalTokens.input * rates.inputRate +
          metrics.totalTokens.output * rates.outputRate +
          metrics.totalTokens.cacheRead * rates.cacheRate) /
        1_000_000;
      baselineCost =
        ((metrics.totalTokens.input + metrics.totalTokens.cacheRead) * rates.inputRate +
          metrics.totalTokens.output * rates.outputRate) /
        1_000_000;
    }
  } else if (overview?.dailyModelStats) {
    const dates = getFilterDatesForRange(range, customStart, customEnd);
    let matchedAny = false;
    for (const d of dates) {
      const dayModels = overview.dailyModelStats[d];
      if (!dayModels) continue;
      for (const [mKey, st] of Object.entries(dayModels)) {
        const mName = st.modelName || (mKey === st.modelId ? canonicalModelName(mKey) : mKey);
        if (
          !mKey ||
          mKey.toLowerCase().includes('unknown') ||
          mName.toLowerCase().includes('unknown')
        ) {
          continue;
        }
        const rates = getModelPricingRates(st.modelId || mName);
        actualCost +=
          (st.inTok * rates.inputRate +
            st.outTok * rates.outputRate +
            st.cacheRead * rates.cacheRate) /
          1_000_000;
        baselineCost +=
          ((st.inTok + st.cacheRead) * rates.inputRate + st.outTok * rates.outputRate) / 1_000_000;
        matchedAny = true;
      }
    }
    if (!matchedAny) {
      const rates = getModelPricingRates('gemini-3.8-flash');
      actualCost =
        (metrics.totalTokens.input * rates.inputRate +
          metrics.totalTokens.output * rates.outputRate +
          metrics.totalTokens.cacheRead * rates.cacheRate) /
        1_000_000;
      baselineCost =
        ((metrics.totalTokens.input + metrics.totalTokens.cacheRead) * rates.inputRate +
          metrics.totalTokens.output * rates.outputRate) /
        1_000_000;
    }
  } else {
    const rates = getModelPricingRates('gemini-3.8-flash');
    actualCost =
      (metrics.totalTokens.input * rates.inputRate +
        metrics.totalTokens.output * rates.outputRate +
        metrics.totalTokens.cacheRead * rates.cacheRate) /
      1_000_000;
    baselineCost =
      ((metrics.totalTokens.input + metrics.totalTokens.cacheRead) * rates.inputRate +
        metrics.totalTokens.output * rates.outputRate) /
      1_000_000;
  }

  const savedCost = Math.max(0, baselineCost - actualCost);
  const savedRatio = baselineCost > 0 ? (savedCost / baselineCost) * 100 : 0;
  return { actualCost, savedCost, savedRatio };
}

export function renderMetricCards(
  metrics: ProcessedRangeMetrics,
  range: TimeRangeOption,
  overview: GlobalAnalyticsOverview | null,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = ''
): void {
  const container = document.getElementById('analytics-cards-grid');
  if (!container) return;

  const totalTok = metrics.totalTokens.total;
  const inTok = metrics.totalTokens.input;
  const outTok = metrics.totalTokens.output;
  const cacheTok = metrics.totalTokens.cacheRead;
  const totalReq = metrics.totalRequests;

  const safeTotal = totalTok > 0 ? totalTok : 1;
  const cachePercent = ((cacheTok / safeTotal) * 100).toFixed(1);
  const inPercent = ((inTok / safeTotal) * 100).toFixed(1);
  const outPercent = ((outTok / safeTotal) * 100).toFixed(1);

  const { actualCost } = computeApiCostAndSavings(
    metrics,
    range,
    overview,
    activeSessionData,
    customStart,
    customEnd
  );

  const isSession = range === 'session' && !!activeSessionData;
  const turnsCount = isSession
    ? activeSessionData!.steps.length
    : overview?.totalConversations || 0;
  const avgPerTurn =
    turnsCount > 0
      ? Math.round(totalTok / turnsCount)
      : totalReq > 0
        ? Math.round(totalTok / totalReq)
        : 0;

  container.innerHTML = `
    <div class="kpi-hero-card">
      <div class="hero-left">
        <div class="kpi-label-row">
          <span>Total Tokens Processed</span>
        </div>
        <div class="kpi-hero-value">
          <span>${formatFullNumber(totalTok)}</span>
          <span class="kpi-approx-unit">~${formatCompactNumber(totalTok)}</span>
        </div>
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
      </div>
    </div>

    <div class="kpi-grid-dual">
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span>Throughput &amp; Latency</span>
        </div>
        <div>
          <span class="kpi-value-lg">${metrics.avgTokPerSec}</span>
          <span class="kpi-unit">tok/s</span>
        </div>
        <div class="cadence-rows">
          <div class="cadence-row">
            <span class="cadence-label">Median Speed (P50):</span>
            <span class="cadence-val">${metrics.p50TokPerSec} tok/s</span>
          </div>
          <div class="cadence-row">
            <span class="cadence-label">Avg Turn Latency:</span>
            <span class="cadence-val">${metrics.avgTurnLatency.toFixed(2)}s</span>
          </div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span>Requests &amp; Turns</span>
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

    <div class="kpi-grid-triplet">
      <div class="kpi-card kpi-card-compact">
        <div class="kpi-label-row">Cache Cost Efficiency</div>
        <div class="kpi-value-md">${metrics.cacheEfficiency.toFixed(1)}%</div>
      </div>

      <div class="kpi-card kpi-card-compact">
        <div class="kpi-label-row">Avg Time to First Token</div>
        <div class="kpi-value-md">${metrics.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
      </div>

      <div class="kpi-card kpi-card-compact">
        <div class="kpi-label-row">Est. Commercial Cost</div>
        <div class="kpi-value-md">$${actualCost.toFixed(2)}</div>
      </div>
    </div>
  `;
}

const PROJECT_TOOLTIP_ID = 'project-path-tooltip';
const boundProjectContainers = new WeakSet<HTMLElement>();
let projectTooltipHideTimer: ReturnType<typeof setTimeout> | null = null;
let activeProjectTooltipAnchor: HTMLElement | null = null;
let globalTooltipListenersBound = false;

function getOrCreateProjectTooltip(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) {
    return null;
  }
  let tip = document.getElementById(PROJECT_TOOLTIP_ID);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = PROJECT_TOOLTIP_ID;
    tip.className = 'project-path-tooltip';
    tip.setAttribute('role', 'tooltip');
    if ('popover' in tip) {
      tip.setAttribute('popover', 'manual');
    }
    document.body.appendChild(tip);

    tip.addEventListener('mouseenter', () => {
      if (projectTooltipHideTimer) {
        clearTimeout(projectTooltipHideTimer);
        projectTooltipHideTimer = null;
      }
    });
    tip.addEventListener('mouseleave', (event) => {
      const next = (event as MouseEvent).relatedTarget as Node | null;
      if (next && activeProjectTooltipAnchor?.contains(next)) return;
      scheduleHideProjectTooltip();
    });
  }

  if (!globalTooltipListenersBound && typeof window !== 'undefined') {
    globalTooltipListenersBound = true;
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideProjectTooltipImmediately();
      }
    });
    window.addEventListener('scroll', hideProjectTooltipImmediately, true);
    window.addEventListener('resize', hideProjectTooltipImmediately);
  }

  return tip;
}

function hideProjectTooltipImmediately(): void {
  if (projectTooltipHideTimer) {
    clearTimeout(projectTooltipHideTimer);
    projectTooltipHideTimer = null;
  }
  if (activeProjectTooltipAnchor) {
    activeProjectTooltipAnchor.removeAttribute('aria-describedby');
    activeProjectTooltipAnchor = null;
  }
  if (typeof document === 'undefined') return;
  const tip = document.getElementById(PROJECT_TOOLTIP_ID) as (HTMLElement & { hidePopover?: () => void }) | null;
  if (!tip) return;
  tip.classList.remove('visible');
  if (typeof tip.hidePopover === 'function') {
    try {
      tip.hidePopover();
    } catch {}
  }
}

function scheduleHideProjectTooltip(): void {
  if (projectTooltipHideTimer) clearTimeout(projectTooltipHideTimer);
  projectTooltipHideTimer = setTimeout(() => {
    hideProjectTooltipImmediately();
  }, 120);
}

function showProjectTooltip(anchor: HTMLElement, text: string): void {
  const tip = getOrCreateProjectTooltip() as (HTMLElement & { showPopover?: () => void }) | null;
  if (!tip || !text) return;

  if (projectTooltipHideTimer) {
    clearTimeout(projectTooltipHideTimer);
    projectTooltipHideTimer = null;
  }

  if (activeProjectTooltipAnchor && activeProjectTooltipAnchor !== anchor) {
    activeProjectTooltipAnchor.removeAttribute('aria-describedby');
  }
  activeProjectTooltipAnchor = anchor;
  anchor.setAttribute('aria-describedby', PROJECT_TOOLTIP_ID);

  tip.textContent = text;
  tip.classList.add('visible');
  if (typeof tip.showPopover === 'function') {
    try {
      tip.showPopover();
    } catch {}
  }

  const rect = anchor.getBoundingClientRect();
  const tipWidth = tip.offsetWidth || 240;
  const tipHeight = tip.offsetHeight || 28;
  const margin = 8;

  let left = rect.left;
  if (left + tipWidth > window.innerWidth - margin) {
    left = window.innerWidth - tipWidth - margin;
  }
  left = Math.max(margin, left);

  let top = rect.top - tipHeight - 6;
  if (top < margin) {
    top = Math.min(window.innerHeight - tipHeight - margin, rect.bottom + 6);
  }

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

async function openProjectDirectory(dirPath: string): Promise<void> {
  if (!dirPath || typeof window === 'undefined' || !window.sidecar?.fetch) return;
  try {
    const res = await window.sidecar.fetch('/api/open-directory', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath })
    });
    if (!res.ok) {
      let msg = 'Failed to open directory';
      try {
        const json = (await res.json()) as { error?: string };
        if (json.error) msg = json.error;
      } catch {}
      showToast(msg);
    }
  } catch (err) {
    console.error('[Aura Analytics] Failed to open directory:', err);
    showToast('Failed to open directory');
  }
}

function bindProjectContainerEvents(container: HTMLElement): void {
  if (boundProjectContainers.has(container) || typeof container.addEventListener !== 'function') {
    return;
  }
  boundProjectContainers.add(container);

  container.addEventListener('mouseover', (event) => {
    const target = event.target as HTMLElement | null;
    const pill = target?.closest?.('.project-path-pill[data-tooltip-path]') as HTMLElement | null;
    if (!pill) return;
    const text = pill.getAttribute('data-tooltip-path') || '';
    if (text) showProjectTooltip(pill, text);
  });

  container.addEventListener('mouseout', (event) => {
    const target = event.target as HTMLElement | null;
    const pill = target?.closest?.('.project-path-pill[data-tooltip-path]') as HTMLElement | null;
    if (!pill) return;
    const next = (event as MouseEvent).relatedTarget as Node | null;
    const tip = document.getElementById(PROJECT_TOOLTIP_ID);
    if (next && (pill.contains(next) || tip?.contains(next))) return;
    scheduleHideProjectTooltip();
  });

  container.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement | null;
    const pill = target?.closest?.('.project-path-pill[data-tooltip-path]') as HTMLElement | null;
    if (!pill) return;
    const text = pill.getAttribute('data-tooltip-path') || '';
    if (text) showProjectTooltip(pill, text);
  });

  container.addEventListener('focusout', (event) => {
    const target = event.target as HTMLElement | null;
    const pill = target?.closest?.('.project-path-pill[data-tooltip-path]') as HTMLElement | null;
    if (!pill) return;
    const next = (event as FocusEvent).relatedTarget as Node | null;
    const tip = document.getElementById(PROJECT_TOOLTIP_ID);
    if (next && (pill.contains(next) || tip?.contains(next))) return;
    scheduleHideProjectTooltip();
  });

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const openBtn = target?.closest?.('.project-open-btn[data-open-path]') as HTMLElement | null;
    if (!openBtn) return;
    event.preventDefault();
    event.stopPropagation();
    const dirPath = openBtn.getAttribute('data-open-path') || '';
    if (dirPath) void openProjectDirectory(dirPath);
  });
}

export function computeProjectDistributionItems(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  scope: ProjectScopeMode,
  customStart = '',
  customEnd = '',
  now = new Date()
): ProjectStatItem[] {
  const fallbackProjects = (): ProjectStatItem[] => {
    if (overview.projects && overview.projects.length > 0) {
      return [...overview.projects].sort(
        (a, b) =>
          b.tokenCount - a.tokenCount ||
          b.conversationCount - a.conversationCount ||
          a.name.localeCompare(b.name)
      );
    }
    return (overview.topProjects || [])
      .map((p) => {
        const shortName = p.projectId.split(/[\\/]/).filter(Boolean).pop() || p.projectId;
        const isUnassigned = !shortName || shortName === 'outside-of-project' || shortName === 'Default Project';
        return {
          projectKey: isUnassigned ? '__no_workspace__' : p.projectId,
          name: isUnassigned ? 'Conversations' : shortName,
          fullPath: '',
          displayPath: '',
          badgeText: isUnassigned ? 'outside-of-project' : 'no local path',
          isWorkspace: false,
          conversationCount: p.conversationCount,
          tokenCount: p.tokenCount,
          inputTok: 0,
          outTok: 0,
          cacheRead: 0,
          requests: 0
        };
      })
      .sort((a, b) => b.tokenCount - a.tokenCount || b.conversationCount - a.conversationCount);
  };

  if (scope === 'all-time') {
    return fallbackProjects();
  }

  if (range === 'session') {
    if (!activeSessionData || (activeSessionData.steps.length === 0 && activeSessionData.totalTokens.total <= 0)) {
      return [];
    }
    const proj = activeSessionData.project;
    return [
      {
        projectKey: proj?.projectKey || '__no_workspace__',
        name: proj?.name || 'Conversations',
        fullPath: proj?.fullPath || '',
        displayPath: proj?.displayPath || '',
        badgeText: proj?.badgeText || 'outside-of-project',
        isWorkspace: proj?.isWorkspace ?? false,
        conversationCount: 1,
        tokenCount: activeSessionData.totalTokens.total,
        inputTok: activeSessionData.totalTokens.input,
        outTok: activeSessionData.totalTokens.output,
        cacheRead: activeSessionData.totalTokens.cacheRead,
        requests: activeSessionData.totalRequests
      }
    ];
  }

  if (!overview.dailyProjectStats) {
    return fallbackProjects();
  }

  const dates = getFilterDatesForRange(range, customStart, customEnd, now);
  const aggMap = new Map<
    string,
    {
      meta: ProjectStatItem;
      convIds: Set<string>;
    }
  >();

  for (const d of dates) {
    const dayProjects = overview.dailyProjectStats[d];
    if (!dayProjects) continue;
    for (const [pKey, st] of Object.entries(dayProjects)) {
      let bucket = aggMap.get(pKey);
      if (!bucket) {
        bucket = {
          meta: {
            projectKey: st.projectKey || pKey,
            name: st.name,
            fullPath: st.fullPath,
            displayPath: st.displayPath,
            badgeText: st.badgeText,
            isWorkspace: st.isWorkspace,
            conversationCount: 0,
            tokenCount: 0,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            requests: 0
          },
          convIds: new Set<string>()
        };
        aggMap.set(pKey, bucket);
      }
      bucket.meta.inputTok += st.inTok;
      bucket.meta.outTok += st.outTok;
      bucket.meta.cacheRead += st.cacheRead;
      bucket.meta.requests += st.requests;
      for (const cid of st.conversationIds || []) {
        bucket.convIds.add(cid);
      }
    }
  }

  return Array.from(aggMap.values())
    .map(({ meta, convIds }) => ({
      ...meta,
      conversationCount: convIds.size,
      tokenCount: meta.inputTok + meta.outTok + meta.cacheRead
    }))
    .sort(
      (a, b) =>
        b.tokenCount - a.tokenCount ||
        b.conversationCount - a.conversationCount ||
        a.name.localeCompare(b.name)
    );
}

export function renderProjectDistribution(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption = 'last-30-days',
  activeSessionData: SessionAnalyticsData | null = null,
  scope: ProjectScopeMode = 'follow',
  customStart = '',
  customEnd = ''
): void {
  const container = document.getElementById('analytics-projects-list');
  if (!container) return;

  bindProjectContainerEvents(container);
  hideProjectTooltipImmediately();

  const projects = computeProjectDistributionItems(
    overview,
    range,
    activeSessionData,
    scope,
    customStart,
    customEnd
  );

  if (projects.length === 0) {
    const emptyMsg =
      scope === 'follow' && range === 'session'
        ? 'No workspace activity recorded in this session'
        : scope === 'follow'
          ? 'No workspace activity recorded in this range'
          : 'No workspace activity recorded';
    container.innerHTML = `<div class="chart-empty">${emptyMsg}</div>`;
    return;
  }

  const totalTokens = projects.reduce((sum, p) => sum + p.tokenCount, 0);
  const totalSessions = projects.reduce((sum, p) => sum + p.conversationCount, 0);
  const scopeLabel = scope === 'all-time' ? 'All Time' : getRangeDisplayTitle(range);
  const workspaceWord = projects.length === 1 ? 'workspace' : 'workspaces';
  const totalSessionWord = totalSessions === 1 ? 'session' : 'sessions';

  const rowsHtml = projects
    .map((p) => {
      const sharePct = totalTokens > 0 ? (p.tokenCount / totalTokens) * 100 : 0;
      const barPct = p.tokenCount > 0 ? sharePct : 0;
      const barFillClass = p.tokenCount > 0 ? 'project-bar-fill project-bar-fill-nonzero' : 'project-bar-fill';
      const pctText = p.tokenCount > 0 && sharePct < 0.1 ? '<0.1%' : `${sharePct.toFixed(1)}%`;
      const sessionWord = p.conversationCount === 1 ? 'session' : 'sessions';

      const pillHtml =
        p.isWorkspace && p.fullPath
          ? `<span class="project-path-pill" data-tooltip-path="${escapeHtml(p.fullPath)}">` +
            `<span class="project-path-text" tabindex="0">${escapeHtml(p.displayPath || p.name)}</span>` +
            `<button type="button" class="project-open-btn" data-open-path="${escapeHtml(p.fullPath)}" aria-label="Open ${escapeHtml(p.name)} in file manager">` +
            `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
            `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>` +
            `<polyline points="15 3 21 3 21 9"></polyline>` +
            `<line x1="10" y1="14" x2="21" y2="3"></line>` +
            `</svg>` +
            `</button>` +
            `</span>`
          : `<span class="project-path-pill project-path-pill-muted" data-tooltip-path="${escapeHtml(
              p.badgeText === 'outside-of-project'
                ? 'Standalone conversations started without an active workspace directory'
                : p.badgeText || p.name
            )}">` +
            `<span class="project-path-text" tabindex="0">${escapeHtml(p.badgeText || 'outside-of-project')}</span>` +
            `</span>`;

      return `
        <div class="project-stat-row">
          <div class="project-meta">
            <span class="project-name">${escapeHtml(p.name)}</span>
            <div class="project-counts">
              <span class="project-sessions-count">${formatFullNumber(p.conversationCount)} ${sessionWord}</span>
              <span class="project-counts-sep">·</span>
              <span class="project-tokens-strong">${formatCompactNumber(p.tokenCount)}</span> tokens
              <span class="project-pct-badge">${pctText}</span>
            </div>
          </div>
          <div class="project-bar-track">
            <div class="${barFillClass}" style="width: ${barPct.toFixed(2)}%"></div>
          </div>
          <div class="project-footer">
            ${pillHtml}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="project-distribution-summary">
      <span class="project-summary-text"><strong>${formatFullNumber(projects.length)}</strong> ${workspaceWord} · <strong>${formatFullNumber(totalSessions)}</strong> ${totalSessionWord} · <strong>${formatCompactNumber(totalTokens)}</strong> tokens</span>
      <span class="project-scope-badge">${escapeHtml(scopeLabel)}</span>
    </div>
    <div class="project-distribution-grid">
      ${rowsHtml}
    </div>
  `;
}

export function renderModelDistribution(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = ''
): void {
  const container = document.getElementById('analytics-models-list');
  if (!container) return;

  let models: ModelTokenStat[] = [];
  if (range === 'session') {
    models =
      activeSessionData?.models && activeSessionData.models.length > 0
        ? activeSessionData.models
        : overview.modelDistribution || [];
  } else {
    const dates = getFilterDatesForRange(range, customStart, customEnd);
    const statsMap: Record<
      string,
      {
        modelId: string;
        modelName: string;
        inTok: number;
        outTok: number;
        cacheRead: number;
        thinkTok: number;
        streamSec: number;
        ttftSec: number;
        effOutTok: number;
        effSec: number;
        requests: number;
      }
    > = {};

    for (const d of dates) {
      const dayModels = overview.dailyModelStats?.[d];
      if (!dayModels) continue;
      for (const [mKey, st] of Object.entries(dayModels)) {
        const effectiveName = st.modelName || (mKey === st.modelId ? canonicalModelName(mKey) : mKey);
        const effectiveId = resolveCanonicalModelId(st.modelId || mKey, effectiveName);
        if (
          effectiveId === 'unknown' ||
          !effectiveName ||
          effectiveName.toLowerCase().includes('unknown') ||
          st.inTok + st.outTok + st.cacheRead === 0
        ) {
          continue;
        }
        if (!statsMap[effectiveId]) {
          statsMap[effectiveId] = {
            modelId: effectiveId,
            modelName: effectiveName,
            inTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            streamSec: 0,
            ttftSec: 0,
            effOutTok: 0,
            effSec: 0,
            requests: 0
          };
        }
        statsMap[effectiveId].inTok += st.inTok;
        statsMap[effectiveId].outTok += st.outTok;
        statsMap[effectiveId].cacheRead += st.cacheRead;
        statsMap[effectiveId].thinkTok += st.thinkTok;
        statsMap[effectiveId].streamSec += st.streamSec;
        statsMap[effectiveId].ttftSec += st.ttftSec;
        statsMap[effectiveId].effOutTok += st.effOutTok || 0;
        statsMap[effectiveId].effSec += st.effSec || 0;
        statsMap[effectiveId].requests += st.requests;
      }
    }

    models = Object.values(statsMap)
      .map((st) => ({
        modelId: st.modelId,
        modelName: st.modelName,
        totalTokens: st.inTok + st.outTok + st.cacheRead,
        inputTok: st.inTok,
        outTok: st.outTok,
        cacheRead: st.cacheRead,
        thinkTok: st.thinkTok,
        requests: st.requests,
        avgTps: computeBucketTps(st),
        avgTtft: 0
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }

  models = models.filter(
    (m) =>
      m.totalTokens > 0 &&
      m.modelId !== 'unknown' &&
      !m.modelName.toLowerCase().includes('unknown')
  );

  if (models.length === 0) {
    container.innerHTML = '<div class="chart-empty">No model usage recorded in this range</div>';
    return;
  }

  const maxTokens = Math.max(...models.map((m) => m.totalTokens), 1);
  const usedColors = new Set<string>();

  container.innerHTML = models
    .map((m, idx) => {
      const pct = Math.max(3, Math.round((m.totalTokens / maxTokens) * 100));
      const color = getModelColor(m.modelId || m.modelName, idx, usedColors);
      const speedBadge = m.avgTps > 0 ? `<span class="model-speed-badge">${m.avgTps} tok/s</span>` : '';
      const rawTotal = m.inputTok + m.cacheRead;
      const cacheRate = rawTotal > 0 ? Math.round((m.cacheRead / rawTotal) * 100) : 0;
      const tokenParts = [
        `Cache: ${cacheRate}% (${formatCompactNumber(m.cacheRead)})`,
        `Out: ${formatCompactNumber(m.outTok)}`,
        `In: ${formatCompactNumber(m.inputTok)}`
      ];
      if (m.thinkTok > 0) {
        tokenParts.push(`Think: ${formatCompactNumber(m.thinkTok)}`);
      }

      return `
        <div class="model-stat-row">
          <div class="model-meta">
            <div class="model-title-line">
              <span class="model-dot" style="background: ${color}"></span>
              <span class="model-name">${escapeHtml(m.modelName)}</span>
              <span class="model-id-badge" title="API Endpoint ID: ${escapeHtml(m.modelId)}">${escapeHtml(m.modelId)}</span>
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
            <span class="model-token-summary">${tokenParts.join(' · ')}</span>
            ${speedBadge}
          </div>
        </div>
      `;
    })
    .join('');
}

export function renderToolDistribution(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = ''
): void {
  const container = document.getElementById('analytics-tools-list');
  if (!container) return;

  let tools: ToolStatItem[] = [];
  if (range === 'session') {
    tools =
      activeSessionData?.tools && activeSessionData.tools.length > 0
        ? activeSessionData.tools
        : overview.toolDistribution || [];
  } else {
    const dates = getFilterDatesForRange(range, customStart, customEnd);
    const countsMap: Record<string, number> = {};

    for (const d of dates) {
      const dayTools = overview.dailyToolStats?.[d];
      if (!dayTools) continue;
      for (const [tName, cnt] of Object.entries(dayTools)) {
        countsMap[tName] = (countsMap[tName] || 0) + cnt;
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
    }
  }

  if (tools.length === 0) {
    container.innerHTML = '<div class="chart-empty">No tool executions recorded in this range</div>';
    return;
  }

  const totalAll = tools.reduce((a, b) => a + b.count, 0);

  const itemsHtml = tools
    .map((t) => {
      const pct = Math.max(0.5, t.percentage);
      const safeColor = escapeHtml(t.color);
      return `
        <div class="tool-stat-row">
          <div class="tool-meta">
            <div class="tool-title-line">
              <span class="tool-category-badge" style="background: ${safeColor}22; color: ${safeColor}; border: 1px solid ${safeColor}44">${escapeHtml(t.category)}</span>
              <span class="tool-name">${escapeHtml(t.name)}</span>
              <span class="tool-raw-badge" title="Raw invocation name: ${escapeHtml(t.rawName)}">${escapeHtml(t.rawName)}</span>
            </div>
            <div class="tool-call-count">
              <span class="tool-count-strong">${formatFullNumber(t.count)}</span> calls
              <span class="tool-pct-badge">${t.percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div class="tool-bar-track">
            <div class="tool-bar-fill" style="width: ${pct.toFixed(1)}%; background: ${safeColor}"></div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="tool-distribution-summary">
      <span class="tool-summary-text">Total Invocations: <strong>${formatFullNumber(totalAll)}</strong></span>
    </div>
    <div class="tool-distribution-grid">
      ${itemsHtml}
    </div>
  `;
}
