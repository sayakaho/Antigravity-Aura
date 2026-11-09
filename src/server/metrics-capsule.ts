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

const MAX_METRICS_CACHE_SIZE = 30;
const metricsCache = new Map<string, { sig: string; payload: LiveMetricsPayload }>();

function setMetricsCache(dbPath: string, entry: { sig: string; payload: LiveMetricsPayload }): void {
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

  const cached = metricsCache.get(dbPath);
  if (cached && cached.sig === sig) {
    return cached.payload;
  }

  const contextLimitTokens = resolveContextLimitTokens(config);
  const db = openDb(dbPath);
  if (!db) {
    return cached?.payload ?? { cascadeId, hasData: false };
  }

  try {
    const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
    if (!rows || rows.length === 0) {
      const emptyPayload: LiveMetricsPayload = { cascadeId, hasData: false, sig };
      setMetricsCache(dbPath, { sig, payload: emptyPayload });
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
      setMetricsCache(dbPath, { sig, payload: emptyPayload });
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
    const ctxClass = ctxPct >= 90 ? 'ag-ctx-crit' : ctxPct >= 75 ? 'ag-ctx-warn' : 'ag-ctx-ok';
    const lastCacheRate = last.ctx > 0 ? ((last.cacheRead / last.ctx) * 100).toFixed(1) : '0.0';
    const sessionCacheRate =
      totalIn + totalCache > 0 ? ((totalCache / (totalIn + totalCache)) * 100).toFixed(1) : '0.0';
    const remainCtx = Math.max(0, contextLimitTokens - last.ctx);
    const limitKStr = `${Math.round(contextLimitTokens / 1000)}k`;

    const inlineHtml = [
      `<span>${Math.round(tps.displayTps)} tok/s</span>`,
      `<span class="ag-sep">·</span>`,
      `<span>TTFT ${last.ttftSec.toFixed(1)}s</span>`,
      `<span class="ag-sep">·</span>`,
      `<span class="${ctxClass}">Ctx ${formatCompactNumber(last.ctx, 2)}/${limitKStr}</span>`,
      `<span class="ag-sep">·</span>`,
      `<span>Out ${formatCompactNumber(last.outTok, 2)}</span>`
    ].join('');

    const turnRowHtml =
      turnSteps > 1
        ? `<div class="ag-tt-row"><span class="ag-tt-lbl">本轮合计 (${turnSteps}步)</span><span class="ag-tt-val">输出 ${formatFullNumber(turnOut)} (思考 ${formatFullNumber(turnThink)} + 响应 ${formatFullNumber(turnResp)}) | 耗时 ${turnDur.toFixed(1)}s</span></div>`
        : '';

    const tooltipHtml = [
      `<div class="ag-tt-hdr">本轮最新调用 (Gen #${last.idx + 1})</div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">生成速度</span><span class="ag-tt-val">${tps.usedStream ? `流式 ${tps.streamTps.toFixed(1)} tok/s | ` : ''}端到端 ${tps.e2eTps.toFixed(1)} tok/s</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">响应耗时</span><span class="ag-tt-val">TTFT ${last.ttftSec.toFixed(2)}s | 流式 ${last.streamSec.toFixed(2)}s | 总计 ${last.totDur.toFixed(2)}s</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">当前上下文</span><span class="ag-tt-val">${formatFullNumber(last.ctx)} (新增 ${formatFullNumber(last.inTok)} + 缓存 ${formatFullNumber(last.cacheRead)}, ${lastCacheRate}%)</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">本步输出量</span><span class="ag-tt-val">${formatFullNumber(last.outTok)} (思考链 ${formatFullNumber(last.thinkTok)} + 正文/工具 ${formatFullNumber(last.respTok)})</span></div>`,
      turnRowHtml,
      `<div class="ag-tt-hdr ag-tt-sec">当前会话累计 (${userStepsCount} 轮提问 / ${validSteps.length} 次有效调用)</div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">压缩水位线</span><span class="ag-tt-val">${formatCompactNumber(last.ctx, 2)} / ${limitKStr} (${ctxPct}%) · 距压缩余 ${formatCompactNumber(remainCtx, 2)}</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">累计输入量</span><span class="ag-tt-val">新增 ${formatCompactNumber(totalIn, 2)} + 缓存读取 ${formatCompactNumber(totalCache, 2)} (命中率 ${sessionCacheRate}%)</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">累计输出量</span><span class="ag-tt-val">总计 ${formatCompactNumber(totalOut, 2)} (思考链 ${formatCompactNumber(totalThink, 2)} + 正文/工具 ${formatCompactNumber(totalResp, 2)})</span></div>`
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
    setMetricsCache(dbPath, { sig, payload });
    return payload;
  } catch {
    return cached?.payload ?? { cascadeId, hasData: false };
  } finally {
    try {
      db.close();
    } catch {}
  }
}
