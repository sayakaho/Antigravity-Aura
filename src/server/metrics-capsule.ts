import path from 'node:path';
import { resolveContextLimitTokens } from '../shared/config-schema';
import { formatCompactNumber, formatFullNumber } from '../shared/format';
import { computeStepTps } from '../shared/tps';
import type { AuraConfig, LiveMetricsPayload } from '../types';
import {
  extractGenMetadataStep,
  getDbSignature,
  hasSqlite,
  openDb
} from './sqlite-proto';

interface MetricsCacheEntry {
  sig: string;
  language: AuraConfig['language'];
  contextLimitTokens: number;
  payload: LiveMetricsPayload;
}

interface MetricsTooltipLocale {
  latestCall: string;
  stepsBadge: (steps: number) => string;
  speed: string;
  speedSubStream: (e2e: string) => string;
  speedSubE2e: string;
  latency: string;
  ttftLabel: string;
  streamShort: string;
  context: string;
  cachedRate: (rate: string) => string;
  stepInput: string;
  stepOutput: string;
  turnTotal: (steps: number) => string;
  newShort: string;
  cachedShort: string;
  thinkShort: string;
  respShort: string;
  sessionTotals: string;
  sessionMeta: (turns: number, calls: number) => string;
  waterline: string;
  remainCtx: (remain: string) => string;
  totalInput: string;
  hitRate: (rate: string) => string;
  totalOutput: string;
  footerHint: string;
}

const MICRO_ICON_PATHS = {
  new: '<circle cx="12" cy="12" r="9"/><path d="m16 12-4-4-4 4M12 16V8"/>',
  cached: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  think: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  resp: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
} as const;

function renderMicroIcon(kind: keyof typeof MICRO_ICON_PATHS, label: string): string {
  return `<svg class="ag-tt-ico" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${MICRO_ICON_PATHS[kind]}</svg>`;
}

const METRICS_I18N: Record<AuraConfig['language'], MetricsTooltipLocale> = {
  default: {
    latestCall: 'Latest Call',
    stepsBadge: (steps) => `${steps} steps`,
    speed: 'Speed',
    speedSubStream: (e2e) => `Stream · E2E ${e2e}`,
    speedSubE2e: 'End-to-End',
    latency: 'Latency',
    ttftLabel: 'TTFT',
    streamShort: 'Gen',
    context: 'Context',
    cachedRate: (rate) => `${rate}% cached`,
    stepInput: 'Step Input',
    stepOutput: 'Step Output',
    turnTotal: (steps) => `Turn (${steps} steps)`,
    newShort: 'new',
    cachedShort: 'cached',
    thinkShort: 'think',
    respShort: 'resp',
    sessionTotals: 'Session Totals',
    sessionMeta: (turns, calls) =>
      `${turns} ${turns === 1 ? 'turn' : 'turns'} · ${calls} ${calls === 1 ? 'call' : 'calls'}`,
    waterline: 'Context Waterline',
    remainCtx: (remain) => `${remain} left`,
    totalInput: 'Total Input',
    hitRate: (rate) => `${rate}% hit`,
    totalOutput: 'Total Output',
    footerHint: 'Click pill to toggle Aura Dashboard'
  },
  'zh-CN': {
    latestCall: '本轮最新调用',
    stepsBadge: (steps) => `${steps} 步`,
    speed: '生成速度',
    speedSubStream: (e2e) => `流式 · 端到端 ${e2e}`,
    speedSubE2e: '端到端速度',
    latency: '响应耗时',
    ttftLabel: 'TTFT',
    streamShort: '流式',
    context: '当前上下文',
    cachedRate: (rate) => `缓存 ${rate}%`,
    stepInput: '本步输入',
    stepOutput: '本步输出',
    turnTotal: (steps) => `本轮合计 (${steps}步)`,
    newShort: '新增',
    cachedShort: '缓存',
    thinkShort: '思考',
    respShort: '正文',
    sessionTotals: '当前会话累计',
    sessionMeta: (turns, calls) => `${turns} 轮提问 · ${calls} 次调用`,
    waterline: '压缩水位线',
    remainCtx: (remain) => `距压缩余 ${remain}`,
    totalInput: '累计输入',
    hitRate: (rate) => `命中 ${rate}%`,
    totalOutput: '累计输出',
    footerHint: '点击胶囊切换 Aura Dashboard 侧边栏'
  }
};

const MAX_METRICS_CACHE_SIZE = 30;
const metricsCache = new Map<string, MetricsCacheEntry>();

function setMetricsCache(dbPath: string, entry: MetricsCacheEntry): void {
  if (metricsCache.has(dbPath)) metricsCache.delete(dbPath);
  metricsCache.set(dbPath, entry);
  if (metricsCache.size > MAX_METRICS_CACHE_SIZE) {
    const oldestKey = metricsCache.keys().next().value;
    if (oldestKey) metricsCache.delete(oldestKey);
  }
}

export function parseConversationMetrics(
  cascadeId: string,
  conversationsDir: string,
  config: AuraConfig
): LiveMetricsPayload | null {
  if (!hasSqlite()) return null;
  if (!cascadeId || !/^[0-9a-f-]{36}$/i.test(cascadeId)) return null;

  const dbPath = path.join(conversationsDir, `${cascadeId}.db`);
  const sig = getDbSignature(dbPath);
  if (!sig) return { cascadeId, hasData: false };

  const language: AuraConfig['language'] = config.language === 'zh-CN' ? 'zh-CN' : 'default';
  const contextLimitTokens = resolveContextLimitTokens(config);

  const cached = metricsCache.get(dbPath);
  if (
    cached &&
    cached.sig === sig &&
    cached.language === language &&
    cached.contextLimitTokens === contextLimitTokens
  ) {
    return cached.payload;
  }

  const db = openDb(dbPath);
  if (!db) {
    return cached?.payload ?? { cascadeId, hasData: false };
  }

  try {
    const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
    if (!rows || rows.length === 0) {
      const emptyPayload: LiveMetricsPayload = { cascadeId, hasData: false, sig };
      setMetricsCache(dbPath, { sig, language, contextLimitTokens, payload: emptyPayload });
      return emptyPayload;
    }

    const userStat = db
      .prepare('SELECT COUNT(*) AS cnt, COALESCE(MAX(idx), -1) AS lastIdx FROM steps WHERE step_type = 14')
      .get();
    const lastUserStepIdx = Number(userStat?.lastIdx ?? -1);
    const userStepsCount = Number(userStat?.cnt ?? 0);
    const turnStat = db
      .prepare('SELECT COUNT(*) AS cnt FROM steps WHERE step_type = 15 AND idx > ?')
      .get(lastUserStepIdx);
    const rawTurnSteps = Number(turnStat?.cnt ?? 0);

    let totalIn = 0;
    let totalCache = 0;
    let totalOut = 0;
    let totalThink = 0;
    let totalResp = 0;

    const validSteps: Array<ReturnType<typeof extractGenMetadataStep> & { idx: number }> = [];
    for (const row of rows) {
      const parsed = extractGenMetadataStep(row.data);
      totalIn += parsed.inTok;
      totalCache += parsed.cacheRead;
      totalOut += parsed.outTok;
      totalThink += parsed.thinkTok;
      totalResp += parsed.respTok;
      if (parsed.ctx > 0 || parsed.outTok > 0) {
        validSteps.push({ ...parsed, idx: Number(row.idx) });
      }
    }

    if (validSteps.length === 0) {
      const emptyPayload: LiveMetricsPayload = { cascadeId, hasData: false, sig };
      setMetricsCache(dbPath, { sig, language, contextLimitTokens, payload: emptyPayload });
      return emptyPayload;
    }

    const turnSlice = rawTurnSteps > 0 ? validSteps.slice(-rawTurnSteps) : [];
    const turnSteps = turnSlice.length;
    let turnOut = 0;
    let turnThink = 0;
    let turnResp = 0;
    let turnDur = 0;
    for (const s of turnSlice) {
      turnOut += s.outTok;
      turnThink += s.thinkTok;
      turnResp += s.respTok;
      turnDur += s.totDur;
    }

    const last = validSteps[validSteps.length - 1];
    const tps = computeStepTps(last.outTok, last.ttftSec, last.streamSec, last.totDur);
    const ctxPct = Math.round((last.ctx / contextLimitTokens) * 100);
    const clampedCtxPct = Math.min(100, Math.max(0, ctxPct));
    const ctxClass = ctxPct >= 90 ? 'ag-ctx-crit' : ctxPct >= 75 ? 'ag-ctx-warn' : 'ag-ctx-ok';
    const lastCacheRate = last.ctx > 0 ? ((last.cacheRead / last.ctx) * 100).toFixed(1) : '0.0';
    const sessionCacheRate =
      totalIn + totalCache > 0 ? ((totalCache / (totalIn + totalCache)) * 100).toFixed(1) : '0.0';
    const remainCtx = Math.max(0, contextLimitTokens - last.ctx);
    const limitKStr = `${Math.round(contextLimitTokens / 1000)}k`;
    const t = METRICS_I18N[language];

    const inlineHtml = [
      `<span>${Math.round(tps.displayTps)} tok/s</span>`,
      `<span class="ag-sep">·</span>`,
      `<span>TTFT ${last.ttftSec.toFixed(1)}s</span>`,
      `<span class="ag-sep">·</span>`,
      `<span class="${ctxClass}">Ctx ${formatCompactNumber(last.ctx, 2)}/${limitKStr}</span>`,
      `<span class="ag-sep">·</span>`,
      `<span>Out ${formatCompactNumber(last.outTok, 2)}</span>`
    ].join('');

    const speedSub = tps.usedStream ? t.speedSubStream(tps.e2eTps.toFixed(1)) : t.speedSubE2e;
    const latestBadge =
      turnSteps > 1
        ? `Gen #${last.idx + 1} · ${t.stepsBadge(turnSteps)}`
        : `Gen #${last.idx + 1}`;

    const icoNew = renderMicroIcon('new', t.newShort);
    const icoCached = renderMicroIcon('cached', t.cachedShort);
    const icoThink = renderMicroIcon('think', t.thinkShort);
    const icoResp = renderMicroIcon('resp', t.respShort);

    const turnRowHtml =
      turnSteps > 1
        ? `<div class="ag-tt-row"><span class="ag-tt-lbl">${t.turnTotal(turnSteps)}</span><span class="ag-tt-val"><span class="ag-tt-num">${formatFullNumber(turnOut)}</span> <span class="ag-tt-muted">(<span class="ag-tt-chip">${icoThink}${formatFullNumber(turnThink)}</span> + <span class="ag-tt-chip">${icoResp}${formatFullNumber(turnResp)}</span>) · ${turnDur.toFixed(1)}s</span></span></div>`
        : '';

    const tooltipHtml = [
      `<div class="ag-tt-hdr"><span class="ag-tt-title">${t.latestCall}</span><span class="ag-tt-badge">${latestBadge}</span></div>`,
      `<div class="ag-tt-kpi-grid">`,
      `<div class="ag-tt-kpi"><div class="ag-tt-kpi-lbl">${t.speed}</div><div class="ag-tt-kpi-val">${tps.displayTps.toFixed(1)}<span class="ag-tt-kpi-unit"> tok/s</span></div><div class="ag-tt-kpi-sub">${speedSub}</div></div>`,
      `<div class="ag-tt-kpi"><div class="ag-tt-kpi-lbl">${t.latency}</div><div class="ag-tt-kpi-val">${last.totDur.toFixed(2)}<span class="ag-tt-kpi-unit">s</span></div><div class="ag-tt-kpi-sub">${t.ttftLabel} ${last.ttftSec.toFixed(2)}s · ${t.streamShort} ${last.streamSec.toFixed(2)}s</div></div>`,
      `<div class="ag-tt-kpi"><div class="ag-tt-kpi-lbl">${t.context}</div><div class="ag-tt-kpi-val ${ctxClass}">${formatFullNumber(last.ctx)}</div><div class="ag-tt-kpi-sub">${t.cachedRate(lastCacheRate)}</div></div>`,
      `</div>`,
      `<div class="ag-tt-rows">`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">${t.stepInput}</span><span class="ag-tt-val"><span class="ag-tt-chip ag-tt-num">${icoNew}${formatFullNumber(last.inTok)}</span><span class="ag-tt-dot">·</span><span class="ag-tt-chip ag-tt-num">${icoCached}${formatFullNumber(last.cacheRead)}</span></span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">${t.stepOutput}</span><span class="ag-tt-val"><span class="ag-tt-num">${formatFullNumber(last.outTok)}</span> <span class="ag-tt-muted">(<span class="ag-tt-chip">${icoThink}${formatFullNumber(last.thinkTok)}</span> + <span class="ag-tt-chip">${icoResp}${formatFullNumber(last.respTok)}</span>)</span></span></div>`,
      turnRowHtml,
      `</div>`,
      `<div class="ag-tt-hdr ag-tt-sec"><span class="ag-tt-title">${t.sessionTotals}</span><span class="ag-tt-badge">${t.sessionMeta(userStepsCount, validSteps.length)}</span></div>`,
      `<div class="ag-tt-waterline">`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">${t.waterline}</span><span class="ag-tt-val"><span class="ag-tt-num ${ctxClass}">${formatCompactNumber(last.ctx, 2)} / ${limitKStr} (${ctxPct}%)</span> <span class="ag-tt-muted">· ${t.remainCtx(formatCompactNumber(remainCtx, 2))}</span></span></div>`,
      `<div class="ag-tt-progress" role="progressbar" aria-valuenow="${clampedCtxPct}" aria-valuemin="0" aria-valuemax="100"><div class="ag-tt-progress-fill ${ctxClass}" style="width: ${clampedCtxPct}%"></div></div>`,
      `</div>`,
      `<div class="ag-tt-rows">`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">${t.totalInput}</span><span class="ag-tt-val"><span class="ag-tt-chip ag-tt-num">${icoNew}${formatCompactNumber(totalIn, 2)}</span> <span class="ag-tt-muted">+</span> <span class="ag-tt-chip ag-tt-num">${icoCached}${formatCompactNumber(totalCache, 2)}</span><span class="ag-tt-tag">${t.hitRate(sessionCacheRate)}</span></span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">${t.totalOutput}</span><span class="ag-tt-val"><span class="ag-tt-num">${formatCompactNumber(totalOut, 2)}</span> <span class="ag-tt-muted">(<span class="ag-tt-chip">${icoThink}${formatCompactNumber(totalThink, 2)}</span> + <span class="ag-tt-chip">${icoResp}${formatCompactNumber(totalResp, 2)}</span>)</span></span></div>`,
      `</div>`,
      `<div class="ag-tt-footer">${t.footerHint}</div>`
    ].join('');

    const payload: LiveMetricsPayload = {
      cascadeId,
      hasData: true,
      sig,
      displayTps: Math.round(tps.displayTps),
      ttft: last.ttftSec,
      ctxTok: last.ctx,
      ctxPct,
      outTok: last.outTok,
      inlineHtml,
      tooltipHtml
    };
    setMetricsCache(dbPath, { sig, language, contextLimitTokens, payload });
    return payload;
  } catch {
    return cached?.payload ?? { cascadeId, hasData: false };
  } finally {
    try {
      db.close();
    } catch {}
  }
}
