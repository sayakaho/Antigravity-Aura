import {
  canonicalizeTool,
  canonicalModelName,
  getModelColor,
  getModelPricingRates,
  getPricingTooltipHtml,
  getPricingTooltipText,
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
  AccountDailyStat,
  AccountQuotaCapacity,
  AccountTokenStat,
  CalibrationSnapshot,
  DailySeriesPoint,
  GlobalAnalyticsOverview,
  HourlySeriesPoint,
  ModelDailyStat,
  ModelTokenStat,
  ProjectStatItem,
  RangePerfFields,
  SessionAnalyticsData,
  SubagentBreakdownSummary,
  SubagentStatItem,
  ToolStatItem
} from '../../types';
import type { ProjectScopeMode } from '../panel-state';
import { showToast } from '../settings';
import {
  clearRenderedHtmlCache,
  setRenderedHtmlIfChanged,
  type ChartColumnData
} from './charts-base';
import {
  generateContinuousDateList,
  getRangeBounds,
  getRangeDisplayTitle,
  resolveTimeFilterContext,
  type TimeFilterContext,
  type TimeRangeOption
} from './time-range';

export { resolveTimeFilterContext, type TimeFilterContext, type TimeRangeOption };

export interface ProcessedRangeMetrics {
  columns: ChartColumnData[];
  totalTokens: { input: number; output: number; cacheRead: number; thinking: number; total: number };
  totalRequests: number;
  userTurns: number;
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
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): ProcessedRangeMetrics {
  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, startDate, endDate, dates: dateList } = timeCtx;
  const effectiveNow = timeCtx.now;

  if (range === 'session') {
    if (!activeSessionData || activeSessionData.steps.length === 0) {
      return {
        columns: [],
        totalTokens: { input: 0, output: 0, cacheRead: 0, thinking: 0, total: 0 },
        totalRequests: 0,
        userTurns: 0,
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
      userTurns: s.sessionTurns ?? s.steps.length,
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
        ? formatLocalDateKey(effectiveNow)
        : formatLocalDateKey(new Date(effectiveNow.getFullYear(), effectiveNow.getMonth(), effectiveNow.getDate() - 1));

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

    let thinkTok = 0;
    let userTurns = 0;
    for (const hItem of overview.hourlySeries || []) {
      if (hItem.hourKey && hItem.hourKey.startsWith(targetDate)) {
        matchedHourlyBuckets.push(hItem);
        thinkTok += hItem.thinkTok || 0;
        userTurns += hItem.userTurns || 0;
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
        thinking: thinkTok,
        total: totalTok
      },
      totalRequests: reqs,
      userTurns,
      cacheEfficiency: efficiency,
      avgTtft: perf.avgTtft,
      avgTokPerSec: perf.avgTokPerSec,
      p50TokPerSec: perf.p50TokPerSec,
      avgTurnLatency: perf.avgTurnLatency
    };
  }

  const dateMap: Record<string, DailySeriesPoint> = {};
  for (const item of overview.timeRangeSeries || []) {
    if (item.date && !item.date.startsWith('0001')) {
      dateMap[item.date] = item;
    }
  }

  const startMs = new Date(`${startDate}T00:00:00`).getTime();
  const endMs = new Date(`${endDate}T00:00:00`).getTime();
  const daySpan = Math.round((endMs - startMs) / 86400000);

  let thinkTok = 0;
  let userTurns = 0;
  const matchedDailyBuckets: DailySeriesPoint[] = [];
  for (const dStr of dateList) {
    if (dateMap[dStr]) {
      matchedDailyBuckets.push(dateMap[dStr]);
      thinkTok += dateMap[dStr].thinkTok || 0;
      userTurns += dateMap[dStr].userTurns || 0;
    }
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
      thinking: thinkTok,
      total: totalTok
    },
    totalRequests: reqs,
    userTurns,
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
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  overview: GlobalAnalyticsOverview | null,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): CostAndSavings {
  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, dates } = timeCtx;
  let actualCost = 0;
  let baselineCost = 0;

  if (range === 'session') {
    if (activeSessionData) {
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
    }
  } else if (overview?.dailyModelStats) {
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
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  overview: GlobalAnalyticsOverview | null,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const container = document.getElementById('analytics-cards-grid');
  if (!container) return;

  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range } = timeCtx;

  const totalTok = metrics.totalTokens.total;
  const inTok = metrics.totalTokens.input;
  const outTok = metrics.totalTokens.output;
  const cacheTok = metrics.totalTokens.cacheRead;
  const thinkTok = metrics.totalTokens.thinking || 0;
  const respTok = Math.max(0, outTok - thinkTok);
  const totalReq = metrics.totalRequests;

  const safeTotal = totalTok > 0 ? totalTok : 1;
  const cachePercent = ((cacheTok / safeTotal) * 100).toFixed(1);
  const inPercent = ((inTok / safeTotal) * 100).toFixed(1);
  const thinkPercent = ((thinkTok / safeTotal) * 100).toFixed(1);
  const outPercent = ((outTok / safeTotal) * 100).toFixed(1);
  const respPercent = ((respTok / safeTotal) * 100).toFixed(1);

  const { actualCost } = computeApiCostAndSavings(
    metrics,
    timeCtx,
    overview,
    activeSessionData
  );

  const isSession = range === 'session' && !!activeSessionData;
  const turnsCount = isSession
    ? (activeSessionData!.sessionTurns ?? activeSessionData!.steps.length)
    : metrics.userTurns;
  const reqWord = totalReq === 1 ? 'request' : 'requests';
  const turnWord = turnsCount === 1 ? 'turn' : 'turns';
  const avgPerTurn =
    turnsCount > 0
      ? Math.round(totalTok / turnsCount)
      : totalReq > 0
        ? Math.round(totalTok / totalReq)
        : 0;

  setRenderedHtmlIfChanged(
    container,
    `
    <div class="kpi-hero-card">
      <div class="kpi-label-row">
        <span>Total Tokens Processed</span>
      </div>

      <div class="hero-body-row">
        <div class="kpi-hero-value">
          <span>${formatFullNumber(totalTok)}</span>
          <span class="kpi-approx-unit">~${formatCompactNumber(totalTok)}</span>
        </div>

        <div class="kpi-breakdown-list">
          <div class="kpi-breakdown-row">
            <div class="kpi-breakdown-key">
              <span class="kpi-dot kpi-dot-input"></span>
              <span>Input:</span>
            </div>
            <div class="kpi-breakdown-stat">
              <span class="kpi-breakdown-val">${formatFullNumber(inTok)}</span>
              <span class="kpi-breakdown-pct">(${inPercent}%)</span>
            </div>
          </div>
          <div class="kpi-breakdown-row">
            <div class="kpi-breakdown-key">
              <span class="kpi-dot kpi-dot-cache"></span>
              <span>Cache Read:</span>
            </div>
            <div class="kpi-breakdown-stat">
              <span class="kpi-breakdown-val">${formatFullNumber(cacheTok)}</span>
              <span class="kpi-breakdown-pct">(${cachePercent}%)</span>
            </div>
          </div>
          <div class="kpi-breakdown-row">
            <div class="kpi-breakdown-key">
              <span class="kpi-dot kpi-dot-think"></span>
              <span>Thinking:</span>
            </div>
            <div class="kpi-breakdown-stat">
              <span class="kpi-breakdown-val">${formatFullNumber(thinkTok)}</span>
              <span class="kpi-breakdown-pct">(${thinkPercent}%)</span>
            </div>
          </div>
          <div class="kpi-breakdown-row">
            <div class="kpi-breakdown-key">
              <span class="kpi-dot kpi-dot-output"></span>
              <span>Output:</span>
            </div>
            <div class="kpi-breakdown-stat">
              <span class="kpi-breakdown-val">${formatFullNumber(outTok)}</span>
              <span class="kpi-breakdown-pct">(${outPercent}%)</span>
            </div>
          </div>
        </div>
      </div>

      <div class="kpi-ratio-bar">
        <div class="kpi-ratio-seg-cache" style="width: ${cachePercent}%;"></div>
        <div class="kpi-ratio-seg-input" style="width: ${inPercent}%;"></div>
        <div class="kpi-ratio-seg-think" style="width: ${thinkPercent}%;"></div>
        <div class="kpi-ratio-seg-output" style="width: ${respPercent}%;"></div>
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
          <span class="kpi-unit">${reqWord}</span>
        </div>
        <div class="cadence-rows">
          <div class="cadence-row">
            <span class="cadence-label">${isSession ? 'Session Turns:' : 'User Conversation Turns:'}</span>
            <span class="cadence-val">${formatFullNumber(turnsCount)} ${turnWord}</span>
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
        <div class="kpi-label-row">
          <span class="kpi-label-with-info">
            Est. Commercial Cost
            <span class="cost-pricing-info-icon" data-tooltip-html="${escapeHtml(getPricingTooltipHtml())}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </span>
          </span>
        </div>
        <div class="kpi-value-md">$${actualCost.toFixed(2)}</div>
      </div>
    </div>
  `
  );
  initGlobalTooltipSystem();
}

const GLOBAL_TOOLTIP_ID = 'aura-global-tooltip';
const boundProjectContainers = new WeakSet<HTMLElement>();
let globalTooltipHideTimer: ReturnType<typeof setTimeout> | null = null;
let activeGlobalTooltipAnchor: HTMLElement | null = null;
let globalTooltipListenersBound = false;

export function getOrCreateGlobalTooltip(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) {
    return null;
  }
  let tip = document.getElementById(GLOBAL_TOOLTIP_ID);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = GLOBAL_TOOLTIP_ID;
    tip.className = 'aura-global-tooltip project-path-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }

  if (!globalTooltipListenersBound && typeof window !== 'undefined') {
    initGlobalTooltipSystem();
  }

  return tip;
}

export function initGlobalTooltipSystem(): void {
  if (
    globalTooltipListenersBound ||
    typeof document === 'undefined' ||
    typeof document.addEventListener !== 'function'
  ) {
    return;
  }
  globalTooltipListenersBound = true;

  document.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('[data-tooltip-html], [data-tooltip], [data-tooltip-path]') as HTMLElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute('title')) {
        anchor.removeAttribute('title');
      }
      showGlobalTooltip(anchor);
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('[data-tooltip-html], [data-tooltip], [data-tooltip-path]') as HTMLElement | null;
      if (!anchor) return;
      const next = (event as MouseEvent).relatedTarget as Node | null;
      const nextAnchor = next instanceof Element ? next.closest('[data-tooltip-html], [data-tooltip], [data-tooltip-path]') : null;
      if (nextAnchor && nextAnchor === activeGlobalTooltipAnchor) return;
      scheduleHideGlobalTooltip();
    },
    true
  );

  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('[data-tooltip-html], [data-tooltip], [data-tooltip-path]') as HTMLElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute('title')) {
        anchor.removeAttribute('title');
      }
      showGlobalTooltip(anchor);
    },
    true
  );

  document.addEventListener(
    'focusout',
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('[data-tooltip-html], [data-tooltip], [data-tooltip-path]') as HTMLElement | null;
      if (!anchor) return;
      scheduleHideGlobalTooltip();
    },
    true
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideGlobalTooltipImmediately();
    }
  });

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('scroll', hideGlobalTooltipImmediately, true);
    window.addEventListener('resize', hideGlobalTooltipImmediately);
  }
}

export function hideGlobalTooltipImmediately(): void {
  if (globalTooltipHideTimer) {
    clearTimeout(globalTooltipHideTimer);
    globalTooltipHideTimer = null;
  }
  if (activeGlobalTooltipAnchor) {
    activeGlobalTooltipAnchor.removeAttribute('aria-describedby');
    activeGlobalTooltipAnchor = null;
  }
  if (typeof document === 'undefined') return;
  const tip = document.getElementById(GLOBAL_TOOLTIP_ID);
  if (!tip) return;
  tip.classList.remove('visible');
  tip.style.display = 'none';
}

function scheduleHideGlobalTooltip(): void {
  if (globalTooltipHideTimer) clearTimeout(globalTooltipHideTimer);
  globalTooltipHideTimer = setTimeout(() => {
    hideGlobalTooltipImmediately();
  }, 100);
}

export function showGlobalTooltip(anchor: HTMLElement, text?: string): void {
  const tip = getOrCreateGlobalTooltip();
  if (!tip) return;

  const html = anchor.getAttribute('data-tooltip-html');
  const raw = text || anchor.getAttribute('data-tooltip') || anchor.getAttribute('data-tooltip-path') || '';
  if (!html && !raw) return;

  // Crucial: remove native title if present so browser never displays duplicate tooltip
  if (anchor.hasAttribute('title')) {
    anchor.removeAttribute('title');
  }

  if (globalTooltipHideTimer) {
    clearTimeout(globalTooltipHideTimer);
    globalTooltipHideTimer = null;
  }

  if (activeGlobalTooltipAnchor && activeGlobalTooltipAnchor !== anchor) {
    activeGlobalTooltipAnchor.removeAttribute('aria-describedby');
  }
  activeGlobalTooltipAnchor = anchor;
  anchor.setAttribute('aria-describedby', GLOBAL_TOOLTIP_ID);

  if (html) {
    tip.innerHTML = html;
  } else if (raw.trim().startsWith('<') && raw.includes('</')) {
    tip.innerHTML = raw;
  } else {
    tip.textContent = raw;
  }

  tip.style.display = 'block';
  tip.classList.add('visible');

  const rect = anchor.getBoundingClientRect();
  const tipWidth = tip.offsetWidth || 260;
  const tipHeight = tip.offsetHeight || 36;
  const margin = 8;

  let left = rect.left + rect.width / 2 - tipWidth / 2;
  if (left + tipWidth > window.innerWidth - margin) {
    left = window.innerWidth - tipWidth - margin;
  }
  left = Math.max(margin, left);

  let top = rect.top - tipHeight - 8;
  if (top < margin) {
    top = Math.min(window.innerHeight - tipHeight - margin, rect.bottom + 8);
  }

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

// Backward-compatible alias
export const showProjectTooltip = showGlobalTooltip;
export const hideProjectTooltipImmediately = hideGlobalTooltipImmediately;

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
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  scope: ProjectScopeMode,
  customStart = '',
  customEnd = '',
  now = new Date()
): ProjectStatItem[] {
  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, dates } = timeCtx;

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
  timeContextOrRange: TimeFilterContext | TimeRangeOption = 'last-30-days',
  activeSessionData: SessionAnalyticsData | null = null,
  scope: ProjectScopeMode = 'follow',
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const container = document.getElementById('analytics-projects-list');
  if (!container) return;

  bindProjectContainerEvents(container);

  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range } = timeCtx;

  const projects = computeProjectDistributionItems(
    overview,
    timeCtx,
    activeSessionData,
    scope
  );

  if (projects.length === 0) {
    const emptyMsg =
      scope === 'follow' && range === 'session'
        ? 'No workspace activity recorded in this session'
        : scope === 'follow'
          ? 'No workspace activity recorded in this range'
          : 'No workspace activity recorded';
    if (setRenderedHtmlIfChanged(container, `<div class="chart-empty">${emptyMsg}</div>`)) {
      hideProjectTooltipImmediately();
    }
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

  const nextHtml = `
    <div class="project-distribution-summary">
      <span class="project-summary-text"><strong>${formatFullNumber(projects.length)}</strong> ${workspaceWord} · <strong>${formatFullNumber(totalSessions)}</strong> ${totalSessionWord} · <strong>${formatCompactNumber(totalTokens)}</strong> tokens</span>
      <span class="project-scope-badge">${escapeHtml(scopeLabel)}</span>
    </div>
    <div class="project-distribution-grid">
      ${rowsHtml}
    </div>
  `;
  if (setRenderedHtmlIfChanged(container, nextHtml)) {
    hideProjectTooltipImmediately();
  }
}

export function renderQuotaHistoryHeatmap(
  capacity?: AccountQuotaCapacity,
  dailyAccountStats?: Record<string, AccountDailyStat>
): string {
  const history = capacity?.history || [];
  const historyMap = new Map<string, CalibrationSnapshot>();
  for (const h of history) {
    historyMap.set(h.dateKey, h);
  }

  // Generate 52 weeks (364 consecutive calendar days) ending today
  const today = new Date();
  const dayList: string[] = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400 * 1000);
    dayList.push(formatLocalDateKey(d));
  }

  // Find max cost / activity for relative heat coloring
  let maxCost = 0;
  for (const dateStr of dayList) {
    const dayStat = dailyAccountStats?.[dateStr];
    const snap = historyMap.get(dateStr);
    const dayCost = dayStat?.cost || 0;
    const snapCost = snap?.fiveHourCost || (snap?.fiveHourTokens ? snap.fiveHourTokens / 5_000_000 : 0);
    const effectiveCost = Math.max(dayCost, snapCost);
    if (effectiveCost > maxCost) maxCost = effectiveCost;
  }
  if (maxCost <= 0) maxCost = 10;

  const cellsHtml = dayList
    .map((dateStr) => {
      const snap = historyMap.get(dateStr);
      const dayStat = dailyAccountStats?.[dateStr];
      const totTok = dayStat ? dayStat.inTok + dayStat.outTok + dayStat.cacheRead : 0;
      const dayCost = dayStat?.cost || 0;
      const reqCount = dayStat?.requests || 0;

      const hasActivity = totTok > 0 || dayCost > 0;
      const hasSnap = !!snap;

      if (!hasActivity && !hasSnap) {
        const noActHtml = `
          <div class="popover-tooltip">
            <div class="tooltip-header">
              <span class="tooltip-title">${dateStr}</span>
            </div>
            <div class="tooltip-subline-muted">No activity recorded</div>
          </div>
        `;
        return `<div class="quota-heatmap-cell level-0" data-tooltip-html="${escapeHtml(noActHtml)}"></div>`;
      }

      // Resolve effective snapshot for the day: exact daily record or closest historical calibration
      let effectiveSnap = snap;
      if (!effectiveSnap && history.length > 0) {
        const onOrBefore = history
          .filter((h) => h.dateKey <= dateStr)
          .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        if (onOrBefore.length > 0) {
          effectiveSnap = onOrBefore[0];
        } else {
          effectiveSnap = history[0];
        }
      }

      const snapCost5h =
        effectiveSnap?.fiveHourCost ??
        capacity?.fiveHourCost ??
        (effectiveSnap?.fiveHourTokens
          ? Math.round(((effectiveSnap.fiveHourTokens * 0.35) / 1_000_000) * 100) / 100
          : capacity?.fiveHourTokens
            ? Math.round(((capacity.fiveHourTokens * 0.35) / 1_000_000) * 100) / 100
            : 35.0);

      const snapCost7d =
        effectiveSnap?.sevenDayCost ??
        capacity?.sevenDayCost ??
        (effectiveSnap?.sevenDayTokens
          ? Math.round(((effectiveSnap.sevenDayTokens * 0.35) / 1_000_000) * 100) / 100
          : capacity?.sevenDayTokens
            ? Math.round(((capacity.sevenDayTokens * 0.35) / 1_000_000) * 100) / 100
            : 100.0);

      const cost5hStr = `~$${snapCost5h.toFixed(2)}`;
      const cost7dStr = `~$${snapCost7d.toFixed(2)}`;
      const planStr =
        effectiveSnap?.planName ||
        effectiveSnap?.userTier ||
        capacity?.planName ||
        capacity?.userTier ||
        'Pro';
      const groupStr = effectiveSnap?.groupName ? ` · ${effectiveSnap.groupName}` : '';

      // Determine heat level (1-4)
      const effectiveCost = Math.max(dayCost, snapCost5h ? dayCost : 0);
      const ratio = Math.min(1, Math.max(0.05, effectiveCost / maxCost));
      let level = 'level-1';
      if (ratio > 0.65) level = 'level-4';
      else if (ratio > 0.4) level = 'level-3';
      else if (ratio > 0.15) level = 'level-2';

      const quotaLineHtml = `
        <div class="tooltip-divider"></div>
        <div class="tooltip-row">
          <span class="tooltip-label">5h Quota Bucket</span>
          <span class="tooltip-val">${cost5hStr}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">7d Quota Bucket</span>
          <span class="tooltip-val">${cost7dStr}</span>
        </div>
      `;

      let humanCardHtml: string;
      if (hasActivity) {
        humanCardHtml = `
          <div class="popover-tooltip">
            <div class="tooltip-header">
              <span class="tooltip-title">${dateStr}</span>
              <span class="tooltip-cost-tag">$${dayCost.toFixed(2)}</span>
            </div>
            <div class="tooltip-row total-row">
              <span class="tooltip-label">Total Volume</span>
              <span class="tooltip-val">${formatCompactNumber(totTok)} tok (${formatFullNumber(reqCount)} req)</span>
            </div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-row">
              <span class="tooltip-label"><span class="tooltip-dot" style="background: #3B82F6"></span>Input</span>
              <span class="tooltip-val">${formatCompactNumber(dayStat?.inTok || 0)}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label"><span class="tooltip-dot" style="background: #F59E0B"></span>Output</span>
              <span class="tooltip-val">${formatCompactNumber(dayStat?.outTok || 0)}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label"><span class="tooltip-dot" style="background: #10B981"></span>Cache Read</span>
              <span class="tooltip-val">${formatCompactNumber(dayStat?.cacheRead || 0)}</span>
            </div>
            ${quotaLineHtml}
            <div class="tooltip-subline-muted" style="display: none">${dateStr} · 5h: ${cost5hStr} · 7d: ${cost7dStr} (${planStr}${groupStr})</div>
          </div>
        `;
      } else {
        // Fallback for snapshot without recorded daily stat (e.g. mock test snapshot)
        humanCardHtml = `
          <div class="popover-tooltip">
            <div class="tooltip-header">
              <span class="tooltip-title">${dateStr}</span>
              <span class="tooltip-badge">${planStr}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">5h Quota Budget</span>
              <span class="tooltip-val">${cost5hStr}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">7d Quota Budget</span>
              <span class="tooltip-val">${cost7dStr}</span>
            </div>
            <div class="tooltip-subline-muted" style="display: none">${dateStr} · 5h: ${cost5hStr} · 7d: ${cost7dStr} (${planStr}${groupStr})</div>
          </div>
        `;
      }

      return `<div class="quota-heatmap-cell ${level}" data-tooltip-html="${escapeHtml(humanCardHtml)}"></div>`;
    })
    .join('');

  return `
    <div class="quota-heatmap-container">
      <div class="quota-heatmap-meta">
        <span class="quota-heatmap-title">Capacity Activity (1 Year)</span>
        <div class="quota-heatmap-legend">
          <span class="legend-text">Less</span>
          <span class="quota-heatmap-cell level-0"></span>
          <span class="quota-heatmap-cell level-1"></span>
          <span class="quota-heatmap-cell level-2"></span>
          <span class="quota-heatmap-cell level-3"></span>
          <span class="quota-heatmap-cell level-4"></span>
          <span class="legend-text">More</span>
        </div>
      </div>
      <div class="quota-heatmap-grid">
        ${cellsHtml}
      </div>
    </div>
  `;
}

export function computeAccountDistributionItems(
  overview: GlobalAnalyticsOverview,
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  scope: ProjectScopeMode = 'follow',
  customStart = '',
  customEnd = '',
  now = new Date()
): AccountTokenStat[] {
  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, dates } = timeCtx;

  if (scope === 'all-time' || !overview.dailyAccountStats) {
    return overview.accountDistribution ? [...overview.accountDistribution] : [];
  }

  if (range === 'session') {
    if (activeSessionData?.accounts && activeSessionData.accounts.length > 0) {
      return activeSessionData.accounts.map((a) => {
        const baseAccount = overview.accountDistribution?.find((base) => base.account === a.account);
        return {
          ...a,
          userTier: a.userTier || baseAccount?.userTier,
          planName: a.planName || baseAccount?.planName,
          planDetails: a.planDetails || baseAccount?.planDetails,
          quotaCapacity: a.quotaCapacity || baseAccount?.quotaCapacity
        };
      });
    }
    return [];
  }

  const aggMap = new Map<string, { stat: AccountTokenStat; convIds: Set<string> }>();
  const currentAccount = overview.accountDistribution?.find((a) => a.isCurrent)?.account;

  for (const d of dates) {
    const dayAccounts = overview.dailyAccountStats[d];
    if (!dayAccounts) continue;
    for (const [acc, st] of Object.entries(dayAccounts)) {
      let bucket = aggMap.get(acc);
      if (!bucket) {
        const isUntracked = acc === 'Untracked (Historical)' || acc.startsWith('Untracked');
        bucket = {
          stat: {
            account: acc,
            totalTokens: 0,
            cost: 0,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            conversationCount: 0,
            isCurrent: !isUntracked && acc === currentAccount,
            isUntracked
          },
          convIds: new Set<string>()
        };
        aggMap.set(acc, bucket);
      }
      bucket.stat.inputTok += st.inTok;
      bucket.stat.outTok += st.outTok;
      bucket.stat.cacheRead += st.cacheRead;
      bucket.stat.thinkTok += st.thinkTok;
      bucket.stat.requests += st.requests;
      bucket.stat.cost = (bucket.stat.cost || 0) + (st.cost || 0);
      for (const cid of st.conversationIds || []) {
        bucket.convIds.add(cid);
      }
    }
  }

  return Array.from(aggMap.values())
    .map(({ stat, convIds }) => {
      const baseAccount = overview.accountDistribution?.find((a) => a.account === stat.account);
      let cost = stat.cost;
      if (typeof cost !== 'number' && typeof baseAccount?.cost === 'number') {
        cost = baseAccount.cost;
      }
      return {
        ...stat,
        cost,
        quotaCapacity: baseAccount?.quotaCapacity,
        conversationCount: convIds.size,
        totalTokens: stat.inputTok + stat.outTok + stat.cacheRead
      };
    })
    .filter((a) => a.totalTokens > 0 || a.requests > 0 || (typeof a.cost === 'number' && a.cost > 0))
    .sort((a, b) => {
      if (a.isUntracked && !b.isUntracked) return 1;
      if (!a.isUntracked && b.isUntracked) return -1;
      const costDiff = (b.cost || 0) - (a.cost || 0);
      if (Math.abs(costDiff) > 0.0001) return costDiff;
      return b.totalTokens - a.totalTokens || b.conversationCount - a.conversationCount;
    });
}

export function renderAccountDistribution(
  overview: GlobalAnalyticsOverview,
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  scope: ProjectScopeMode = 'follow',
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const container = document.getElementById('analytics-accounts-list');
  if (!container) return;

  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range } = timeCtx;

  const accounts = computeAccountDistributionItems(
    overview,
    timeCtx,
    activeSessionData,
    scope
  );

  if (accounts.length === 0) {
    const emptyHtml = `
      <div class="empty-state-card" style="padding: 18px 12px; text-align: center; color: var(--aura-fg-muted); font-size: 13px;">
        <div style="font-weight: 500; margin-bottom: 4px; color: var(--aura-fg);">No Account Activity</div>
        <div>Account telemetry will appear here as conversations and tokens are processed.</div>
      </div>
    `;
    setRenderedHtmlIfChanged(container, emptyHtml);
    return;
  }

  const totalCost = accounts.reduce((sum, a) => sum + (a.cost || 0), 0);
  const totalTokens = accounts.reduce((sum, a) => sum + a.totalTokens, 0);
  const totalSessions = accounts.reduce((sum, a) => sum + a.conversationCount, 0);
  const hasCost = totalCost > 0 || accounts.some((a) => typeof a.cost === 'number' && a.cost > 0);
  const scopeLabel = scope === 'all-time' ? 'All Time' : getRangeDisplayTitle(range);
  const accountWord = accounts.length === 1 ? 'account' : 'accounts';
  const sessionWord = totalSessions === 1 ? 'session' : 'sessions';

  const rowsHtml = accounts
    .map((a) => {
      const aCost = a.cost || 0;
      const sharePct = hasCost
        ? (totalCost > 0 ? (aCost / totalCost) * 100 : 0)
        : (totalTokens > 0 ? (a.totalTokens / totalTokens) * 100 : 0);
      const isNonzero = hasCost ? aCost > 0 : a.totalTokens > 0;
      const barPct = isNonzero ? sharePct : 0;
      const isUntracked = !!a.isUntracked || a.account === 'Untracked (Historical)';
      const barFillClass = isUntracked
        ? 'project-bar-fill account-bar-fill-untracked'
        : isNonzero
          ? 'project-bar-fill project-bar-fill-nonzero'
          : 'project-bar-fill';
      const pctText = isNonzero && sharePct < 0.1 ? '<0.1%' : `${sharePct.toFixed(1)}%`;
      const sWord = a.conversationCount === 1 ? 'session' : 'sessions';
      const badgeHtml = isUntracked
        ? '<span class="account-untracked-badge">Pre-tracking</span>'
        : a.isCurrent
          ? '<span class="account-current-badge">Active</span>'
          : '';
      const breakdownTip = isUntracked
        ? 'Historical data prior to account tracking'
        : `In: ${formatCompactNumber(a.inputTok)} · Out: ${formatCompactNumber(a.outTok)} · Cache: ${formatCompactNumber(a.cacheRead)}`;
      const pillHtml = isUntracked
        ? `Historical data prior to account tracking · ${formatFullNumber(a.requests)} req`
        : `${formatCompactNumber(a.totalTokens)} tok · ${formatFullNumber(a.requests)} req`;
      let quotaHtml = '';
      if (a.quotaCapacity) {
        if (a.quotaCapacity.status === 'calibrated') {
          const cost5h =
            a.quotaCapacity.fiveHourCost ??
            (a.quotaCapacity.fiveHourTokens
              ? Math.round(((a.quotaCapacity.fiveHourTokens * 0.35) / 1_000_000) * 100) / 100
              : undefined);
          const cost7d =
            a.quotaCapacity.sevenDayCost ??
            (a.quotaCapacity.sevenDayTokens
              ? Math.round(((a.quotaCapacity.sevenDayTokens * 0.35) / 1_000_000) * 100) / 100
              : undefined);

          const tip5hHtml = cost5h !== undefined
            ? `
              <div class="popover-tooltip">
                <div class="tooltip-header">
                  <span class="tooltip-title">5-Hour Rolling Budget</span>
                  <span class="tooltip-cost-tag">~$${cost5h.toFixed(2)}</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">Cached Context Capacity</span>
                  <span class="tooltip-val">~${Math.round(cost5h / 0.0000001 / 1_000_000)}M+ tok</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">Raw Prompt Capacity</span>
                  <span class="tooltip-val">~${Math.round(cost5h / 0.00000125 / 1_000_000)}M tok</span>
                </div>
              </div>
            `
            : '';

          const tip7dHtml = cost7d !== undefined
            ? `
              <div class="popover-tooltip">
                <div class="tooltip-header">
                  <span class="tooltip-title">7-Day Rolling Budget</span>
                  <span class="tooltip-cost-tag">~$${cost7d.toFixed(2)}</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">Rolling Cycle</span>
                  <span class="tooltip-val">7 Days (Weekly)</span>
                </div>
              </div>
            `
            : '';

          const pill5h = cost5h !== undefined
            ? `<span class="account-quota-pill" data-tooltip-html="${escapeHtml(tip5hHtml)}">5h <strong>~$${cost5h.toFixed(2)}</strong></span>`
            : `<span class="account-quota-pill account-quota-calibrating">5h: Calibrating...</span>`;
          const pill7d = cost7d !== undefined
            ? `<span class="account-quota-pill" data-tooltip-html="${escapeHtml(tip7dHtml)}">7d <strong>~$${cost7d.toFixed(2)}</strong></span>`
            : `<span class="account-quota-pill account-quota-calibrating">7d: Calibrating...</span>`;
          quotaHtml = `
            <div class="account-quota-pills">
              ${pill5h}
              ${pill7d}
            </div>
          `;
        } else {
          quotaHtml = `
            <div class="account-quota-pills">
              <span class="account-quota-pill account-quota-calibrating">Calibrating Quota Capacity...</span>
            </div>
          `;
        }
      }
      const rowClass = isUntracked
        ? 'project-stat-row account-stat-row account-stat-row-untracked'
        : 'project-stat-row account-stat-row';

      const countsContentHtml = hasCost
        ? `
            <span class="account-cost-spent">Spent: <strong>$${aCost.toFixed(2)}</strong></span>
            <span class="project-pct-badge">${pctText}</span>
          `
        : `
            <span class="project-tokens-strong">${formatCompactNumber(a.totalTokens)}</span> tokens
            <span class="project-pct-badge">${pctText}</span>
          `;

      let planPillHtml = '';
      const p = a.planDetails || a.quotaCapacity?.planDetails;
      if (p?.planName) {
        const tooltipLines = [
          `"planName": "${p.planName}",`,
          `"teamsTier": "${p.teamsTier || 'TEAMS_TIER_PRO'}",`,
          typeof p.monthlyPromptCredits === 'number'
            ? `"monthlyPromptCredits": ${p.monthlyPromptCredits},`
            : '"monthlyPromptCredits": 50000,',
          typeof p.monthlyFlowCredits === 'number'
            ? `"monthlyFlowCredits": ${p.monthlyFlowCredits}`
            : '"monthlyFlowCredits": 150000',
          p.userTierId ? `"id": "${p.userTierId}",` : '"id": "g1-pro-tier",'
        ].filter(Boolean).join('\n');

        const humanPlanHtml = `
          <div class="popover-tooltip">
            <div class="tooltip-header">
              <span class="tooltip-title">Account Subscription</span>
              <span class="tooltip-badge">${escapeHtml(p.planName)}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">Teams Tier</span>
              <span class="tooltip-val">${escapeHtml(p.teamsTier || 'TEAMS_TIER_PRO')}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">Monthly Prompt Credits</span>
              <span class="tooltip-val">${typeof p.monthlyPromptCredits === 'number' ? formatFullNumber(p.monthlyPromptCredits) : '50,000'}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">Monthly Flow Credits</span>
              <span class="tooltip-val">${typeof p.monthlyFlowCredits === 'number' ? formatFullNumber(p.monthlyFlowCredits) : '150,000'}</span>
            </div>
            <div class="tooltip-divider"></div>
            <div class="tooltip-subline-muted">Tier ID: ${escapeHtml(p.userTierId || 'g1-pro-tier')}</div>
          </div>
        `;

        planPillHtml = `<span class="account-plan-pill" data-tooltip-html="${escapeHtml(humanPlanHtml)}" data-plan-json="${escapeHtml(tooltipLines)}">${escapeHtml(p.planName)}</span>`;
      }

      const detailsCardHtml = `
        <div class="popover-tooltip">
          <div class="tooltip-header">
            <span class="tooltip-title">Token Distribution</span>
            <span class="tooltip-val">${formatFullNumber(a.requests)} req</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label"><span class="tooltip-dot" style="background:#3B82F6"></span>Input</span>
            <span class="tooltip-val">${formatCompactNumber(a.inputTok)} (${formatFullNumber(a.inputTok)})</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label"><span class="tooltip-dot" style="background:#F59E0B"></span>Output</span>
            <span class="tooltip-val">${formatCompactNumber(a.outTok)} (${formatFullNumber(a.outTok)})</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label"><span class="tooltip-dot" style="background:#10B981"></span>Cache Read</span>
            <span class="tooltip-val">${formatCompactNumber(a.cacheRead)} (${formatFullNumber(a.cacheRead)})</span>
          </div>
        </div>
      `;

      return `
        <div class="${rowClass}">
          <div class="project-meta">
            <div class="account-name-group">
              <span class="project-name account-name">${escapeHtml(a.account)}</span>
              ${planPillHtml}
              ${badgeHtml}
            </div>
            <div class="project-counts">
              ${countsContentHtml}
            </div>
          </div>
          <div class="project-bar-track">
            <div class="${barFillClass}" style="width: ${barPct.toFixed(2)}%"></div>
          </div>
          <div class="project-footer">
            <span class="account-details-pill" data-tooltip-html="${escapeHtml(detailsCardHtml)}">
              ${pillHtml}
            </span>
            ${quotaHtml}
          </div>
        </div>
      `;
    })
    .join('');

  const summaryCostText = hasCost
    ? `<strong>$${totalCost.toFixed(2)}</strong> (${formatCompactNumber(totalTokens)} tok)`
    : `<strong>${formatCompactNumber(totalTokens)}</strong> tokens`;

  // Aggregate daily stats across all accounts for the single unified 1-year heatmap
  const aggDailyStats: Record<string, AccountDailyStat> = {};
  if (overview.dailyAccountStats) {
    for (const [dk, accMap] of Object.entries(overview.dailyAccountStats)) {
      for (const stat of Object.values(accMap)) {
        if (!aggDailyStats[dk]) {
          aggDailyStats[dk] = {
            account: 'all',
            inTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            cost: 0,
            conversationIds: []
          };
        }
        const a = aggDailyStats[dk];
        a.inTok += stat.inTok || 0;
        a.outTok += stat.outTok || 0;
        a.cacheRead += stat.cacheRead || 0;
        a.thinkTok = (a.thinkTok || 0) + (stat.thinkTok || 0);
        a.requests += stat.requests || 0;
        a.cost = (a.cost || 0) + (stat.cost || 0);
      }
    }
  }

  const activeAccount =
    accounts.find((a) => a.isCurrent) ||
    accounts.find((a) => a.quotaCapacity) ||
    accounts[0];
  const overallHeatmapHtml = renderQuotaHistoryHeatmap(
    activeAccount?.quotaCapacity,
    aggDailyStats
  );

  const nextHtml = `
    <div class="project-distribution-summary">
      <span class="project-summary-text"><strong>${formatFullNumber(accounts.length)}</strong> ${accountWord} · <strong>${formatFullNumber(totalSessions)}</strong> ${sessionWord} · ${summaryCostText}</span>
      <span class="project-scope-badge">${escapeHtml(scopeLabel)}</span>
    </div>
    <div class="project-distribution-grid">
      ${rowsHtml}
    </div>
    ${overallHeatmapHtml}
  `;
  setRenderedHtmlIfChanged(container, nextHtml);
  initGlobalTooltipSystem();
}

export function renderModelDistribution(
  overview: GlobalAnalyticsOverview,
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const container = document.getElementById('analytics-models-list');
  if (!container) return;

  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, dates } = timeCtx;

  let models: ModelTokenStat[] = [];
  if (range === 'session') {
    models = activeSessionData?.models ? [...activeSessionData.models] : [];
  } else {
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
    const emptyMsg =
      range === 'session'
        ? 'No model usage recorded in this session'
        : 'No model usage recorded in this range';
    setRenderedHtmlIfChanged(container, `<div class="chart-empty">${emptyMsg}</div>`);
    return;
  }

  const totalModelTokens = models.reduce((sum, m) => sum + m.totalTokens, 0);
  const usedColors = new Set<string>();

  setRenderedHtmlIfChanged(
    container,
    models
      .map((m, idx) => {
        const sharePct = totalModelTokens > 0 ? (m.totalTokens / totalModelTokens) * 100 : 0;
        const pct = m.totalTokens > 0 ? Math.max(0.5, Math.round(sharePct * 10) / 10) : 0;
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
              <span class="model-req-count">(${formatFullNumber(m.requests)} ${m.requests === 1 ? 'req' : 'reqs'})</span>
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
      .join('')
  );
}

export function renderToolDistribution(
  overview: GlobalAnalyticsOverview,
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const container = document.getElementById('analytics-tools-list');
  if (!container) return;

  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, dates } = timeCtx;

  let tools: ToolStatItem[] = [];
  if (range === 'session') {
    tools = activeSessionData?.tools ? [...activeSessionData.tools] : [];
  } else {
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
    const emptyMsg =
      range === 'session'
        ? 'No tool executions recorded in this session'
        : 'No tool executions recorded in this range';
    setRenderedHtmlIfChanged(container, `<div class="chart-empty">${emptyMsg}</div>`);
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
              <span class="tool-count-strong">${formatFullNumber(t.count)}</span> ${t.count === 1 ? 'call' : 'calls'}
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

  setRenderedHtmlIfChanged(
    container,
    `
    <div class="tool-distribution-summary">
      <span class="tool-summary-text">Total Invocations: <strong>${formatFullNumber(totalAll)}</strong></span>
    </div>
    <div class="tool-distribution-grid">
      ${itemsHtml}
    </div>
  `
  );
  initGlobalTooltipSystem();
}

export function computeSubagentBreakdown(
  overview: GlobalAnalyticsOverview,
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  processedMetrics: ProcessedRangeMetrics,
  customStart = '',
  customEnd = '',
  now = new Date()
): SubagentBreakdownSummary | null {
  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range, dates } = timeCtx;

  if (range === 'session') {
    const sa = activeSessionData?.subagents;
    if (!sa || sa.items.length === 0 || (sa.subagentTokens <= 0 && sa.totalRuns <= 0)) {
      return null;
    }
    return {
      ...sa,
      items: [...sa.items].sort(
        (a, b) =>
          b.totalTokens - a.totalTokens ||
          b.runs - a.runs ||
          a.agentName.localeCompare(b.agentName)
      )
    };
  }

  if (!overview.dailySubagentStats) {
    return null;
  }

  const aggMap = new Map<
    string,
    {
      item: SubagentStatItem;
      convIds: Set<string>;
    }
  >();

  for (const d of dates) {
    const daySubagents = overview.dailySubagentStats[d];
    if (!daySubagents) continue;
    for (const [agentKey, st] of Object.entries(daySubagents)) {
      const name = (st.agentName || agentKey || '').trim() || 'subagent';
      let bucket = aggMap.get(name);
      if (!bucket) {
        bucket = {
          item: {
            agentName: name,
            runs: 0,
            totalTokens: 0,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0
          },
          convIds: new Set<string>()
        };
        aggMap.set(name, bucket);
      }
      bucket.item.inputTok += st.inTok;
      bucket.item.outTok += st.outTok;
      bucket.item.cacheRead += st.cacheRead;
      bucket.item.thinkTok += st.thinkTok;
      bucket.item.requests += st.requests;
      if (st.conversationIds && st.conversationIds.length > 0) {
        for (const cid of st.conversationIds) {
          bucket.convIds.add(cid);
        }
      } else {
        bucket.item.runs += st.runs;
      }
    }
  }

  const items = Array.from(aggMap.values())
    .map(({ item, convIds }) => ({
      ...item,
      runs: convIds.size > 0 ? convIds.size : item.runs,
      totalTokens: item.inputTok + item.outTok + item.cacheRead
    }))
    .filter((item) => item.totalTokens > 0 || item.requests > 0)
    .sort(
      (a, b) =>
        b.totalTokens - a.totalTokens ||
        b.runs - a.runs ||
        a.agentName.localeCompare(b.agentName)
    );

  if (items.length === 0) return null;

  const subagentTokens = items.reduce((sum, item) => sum + item.totalTokens, 0);
  const subagentRequests = items.reduce((sum, item) => sum + item.requests, 0);
  const totalRuns = items.reduce((sum, item) => sum + item.runs, 0);

  return {
    mainTokens: Math.max(0, processedMetrics.totalTokens.total - subagentTokens),
    subagentTokens,
    mainRequests: Math.max(0, processedMetrics.totalRequests - subagentRequests),
    subagentRequests,
    totalRuns,
    items
  };
}

export function renderSubagentDistribution(
  overview: GlobalAnalyticsOverview,
  timeContextOrRange: TimeFilterContext | TimeRangeOption,
  activeSessionData: SessionAnalyticsData | null,
  processedMetrics: ProcessedRangeMetrics,
  customStart = '',
  customEnd = '',
  now = new Date()
): void {
  const section = document.getElementById('analytics-subagents-section');
  const container = document.getElementById('analytics-subagents-list');
  if (!container) return;

  const timeCtx = resolveTimeFilterContext(timeContextOrRange, customStart, customEnd, now);
  const { range } = timeCtx;

  const breakdown = computeSubagentBreakdown(
    overview,
    timeCtx,
    activeSessionData,
    processedMetrics
  );

  if (!breakdown || breakdown.items.length === 0) {
    if (section) section.style.display = 'none';
    clearRenderedHtmlCache(container);
    container.innerHTML = '';
    return;
  }

  if (section) section.style.display = '';

  const combinedTokens = breakdown.mainTokens + breakdown.subagentTokens;
  const mainPct = combinedTokens > 0 ? (breakdown.mainTokens / combinedTokens) * 100 : 0;
  const subPct = combinedTokens > 0 ? (breakdown.subagentTokens / combinedTokens) * 100 : 0;
  const runWord = breakdown.totalRuns === 1 ? 'run' : 'runs';
  const usedColors = new Set<string>();

  const rowsHtml = breakdown.items
    .map((item, idx) => {
      const sharePct =
        breakdown.subagentTokens > 0 ? (item.totalTokens / breakdown.subagentTokens) * 100 : 0;
      const barPct = item.totalTokens > 0 ? sharePct : 0;
      const barFillClass =
        item.totalTokens > 0 ? 'model-bar-fill subagent-bar-fill-nonzero' : 'model-bar-fill';
      const pctText =
        item.totalTokens > 0 && sharePct < 0.1 ? '<0.1%' : `${sharePct.toFixed(1)}%`;
      const color = getModelColor(item.agentName, idx, usedColors);
      const rawTotal = item.inputTok + item.cacheRead;
      const cacheRate = rawTotal > 0 ? Math.round((item.cacheRead / rawTotal) * 100) : 0;
      const itemRunWord = item.runs === 1 ? 'run' : 'runs';
      const tokenParts = [
        `Cache: ${cacheRate}% (${formatCompactNumber(item.cacheRead)})`,
        `Out: ${formatCompactNumber(item.outTok)}`,
        `In: ${formatCompactNumber(item.inputTok)}`
      ];
      if (item.thinkTok > 0) {
        tokenParts.push(`Think: ${formatCompactNumber(item.thinkTok)}`);
      }

      return `
        <div class="model-stat-row subagent-stat-row">
          <div class="model-meta">
            <div class="model-title-line">
              <span class="model-dot" style="background: ${color}"></span>
              <span class="model-name">${escapeHtml(item.agentName)}</span>
              <span class="subagent-runs-badge">${formatFullNumber(item.runs)} ${itemRunWord}</span>
            </div>
            <div class="project-counts">
              <span class="model-tokens-strong">${formatCompactNumber(item.totalTokens)}</span> tokens
              <span class="model-req-count">(${formatFullNumber(item.requests)} ${item.requests === 1 ? 'req' : 'reqs'})</span>
              <span class="project-pct-badge">${pctText}</span>
            </div>
          </div>
          <div class="model-bar-track">
            <div class="${barFillClass}" style="width: ${barPct.toFixed(2)}%; background: ${color}"></div>
          </div>
          <div class="model-chips">
            <span class="model-token-summary">${tokenParts.join(' · ')}</span>
          </div>
        </div>
      `;
    })
    .join('');

  setRenderedHtmlIfChanged(
    container,
    `
    <div class="subagent-distribution-summary">
      <div class="subagent-summary-legend">
        <span class="subagent-legend-item">
          <span class="kpi-dot subagent-dot-main"></span>
          <span>Main Agent <strong>${mainPct.toFixed(1)}%</strong> (${formatCompactNumber(breakdown.mainTokens)})</span>
        </span>
        <span class="subagent-legend-item">
          <span class="kpi-dot subagent-dot-sub"></span>
          <span>Subagents <strong>${subPct.toFixed(1)}%</strong> (${formatCompactNumber(breakdown.subagentTokens)})</span>
        </span>
      </div>
      <span class="project-scope-badge">${formatFullNumber(breakdown.totalRuns)} ${runWord}</span>
    </div>
    <div class="subagent-split-bar" aria-label="Main agent vs subagents token share">
      <div class="subagent-split-main" style="width: ${mainPct.toFixed(2)}%;"></div>
      <div class="subagent-split-sub" style="width: ${subPct.toFixed(2)}%;"></div>
    </div>
    <div class="subagent-distribution-grid">
      ${rowsHtml}
    </div>
  `
  );
  initGlobalTooltipSystem();
}
