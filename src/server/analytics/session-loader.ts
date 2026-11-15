import fs from 'node:fs';
import { AccountTracker } from '../account-tracker';
import { getModelPricingRates, resolveCanonicalModelId } from '../../shared/catalog';
import { formatLocalDateAndHourKeys } from '../../shared/format';
import { computeStepTps } from '../../shared/tps';
import type {
  AccountDailyStat,
  AccountHourlyStat,
  ModelDailyStat,
  RangePerfFields,
  TimedSpeedSample,
  TurnLatencySample
} from '../../types';
import {
  extractGenMetadataStep,
  extractTimestampFromStepMeta,
  extractToolInfo,
  openDb
} from '../sqlite-proto';
import type { CacheEntry, ModelBucket, TokenBreakdown } from './types';

export type { CacheEntry, ModelBucket, TokenBreakdown };

export function createEmptyBreakdown(): TokenBreakdown {
  return {
    inTok: 0,
    outTok: 0,
    cacheRead: 0,
    thinkTok: 0,
    requests: 0,
    effOutTok: 0,
    effSec: 0,
    ttftSum: 0,
    ttftCount: 0,
    turnDurSum: 0,
    validTurnCount: 0,
    tpsHist: {}
  };
}

export function createEmptyModelDailyStat(modelId: string, modelName = ''): ModelDailyStat {
  return {
    modelId,
    modelName: modelName || undefined,
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

export function recordStepIntoBreakdown(
  bucket: TokenBreakdown,
  inTok: number,
  outTok: number,
  cacheRead: number,
  thinkTok: number,
  ttftSec: number,
  stepEffOut: number,
  stepEffSec: number,
  hasValidTps: boolean,
  roundedTps: number,
  totDur: number
): void {
  bucket.inTok += inTok;
  bucket.outTok += outTok;
  bucket.cacheRead += cacheRead;
  bucket.thinkTok = (bucket.thinkTok || 0) + thinkTok;
  bucket.requests += 1;
  if (ttftSec > 0) {
    bucket.ttftSum = (bucket.ttftSum || 0) + ttftSec;
    bucket.ttftCount = (bucket.ttftCount || 0) + 1;
  }
  if (outTok > 0 && totDur > 0) {
    bucket.turnDurSum = (bucket.turnDurSum || 0) + totDur;
    bucket.validTurnCount = (bucket.validTurnCount || 0) + 1;
  }
  if (hasValidTps) {
    bucket.effOutTok = (bucket.effOutTok || 0) + stepEffOut;
    bucket.effSec = (bucket.effSec || 0) + stepEffSec;
    if (!bucket.tpsHist) bucket.tpsHist = {};
    const key = String(roundedTps);
    bucket.tpsHist[key] = (bucket.tpsHist[key] || 0) + 1;
  }
}

export function accumulateModelDailyStat(
  targetMap: Record<string, Record<string, ModelDailyStat>>,
  key: string,
  modelKey: string,
  modelId: string,
  modelName: string,
  inTok: number,
  outTok: number,
  cacheRead: number,
  thinkTok: number,
  streamSec: number,
  ttftSec: number,
  effOutTok: number,
  effSec: number,
  requests: number
): void {
  if (!targetMap[key]) targetMap[key] = {};
  if (!targetMap[key][modelKey]) {
    targetMap[key][modelKey] = createEmptyModelDailyStat(modelId, modelName);
  }
  const st = targetMap[key][modelKey];
  if ((!st.modelName || st.modelName === 'Unknown Model') && modelName) {
    st.modelName = modelName;
  }
  st.inTok += inTok;
  st.outTok += outTok;
  st.cacheRead += cacheRead;
  st.thinkTok += thinkTok;
  st.streamSec += streamSec;
  st.ttftSec += ttftSec;
  st.effOutTok = (st.effOutTok || 0) + effOutTok;
  st.effSec = (st.effSec || 0) + effSec;
  st.requests += requests;
}

export function accumulateAccountDailyStat(
  target: Record<string, Record<string, AccountDailyStat>>,
  dateKey: string,
  account: string,
  inTok: number,
  outTok: number,
  cacheRead: number,
  thinkTok: number,
  requests: number,
  cascadeId?: string,
  cost = 0
): void {
  if (!target[dateKey]) target[dateKey] = {};
  if (!target[dateKey][account]) {
    target[dateKey][account] = {
      account,
      cost: 0,
      inTok: 0,
      outTok: 0,
      cacheRead: 0,
      thinkTok: 0,
      requests: 0,
      conversationIds: []
    };
  }
  const item = target[dateKey][account];
  item.cost = (item.cost || 0) + cost;
  item.inTok += inTok;
  item.outTok += outTok;
  item.cacheRead += cacheRead;
  item.thinkTok += thinkTok;
  item.requests += requests;
  if (cascadeId && !item.conversationIds.includes(cascadeId)) {
    item.conversationIds.push(cascadeId);
  }
}

export function accumulateAccountHourlyStat(
  target: Record<string, Record<string, AccountHourlyStat>>,
  hourKey: string,
  account: string,
  inTok: number,
  outTok: number,
  cacheRead: number,
  thinkTok: number,
  requests: number,
  cost = 0
): void {
  if (!target[hourKey]) target[hourKey] = {};
  if (!target[hourKey][account]) {
    target[hourKey][account] = {
      account,
      cost: 0,
      inTok: 0,
      outTok: 0,
      cacheRead: 0,
      thinkTok: 0,
      requests: 0
    };
  }
  const item = target[hourKey][account];
  item.cost = (item.cost || 0) + cost;
  item.inTok += inTok;
  item.outTok += outTok;
  item.cacheRead += cacheRead;
  item.thinkTok += thinkTok;
  item.requests += requests;
}

export function parseEpochSecFromIso(isoStr?: string): number {
  if (!isoStr) return 0;
  const ms = Date.parse(isoStr);
  return Number.isFinite(ms) && ms > 1_000_000_000_000 ? Math.floor(ms / 1000) : 0;
}

export function getFileMtimeSec(filePath: string): number {
  try {
    const sec = Math.floor(fs.statSync(filePath).mtimeMs / 1000);
    return sec > 1_000_000_000 ? sec : 0;
  } catch {
    return 0;
  }
}

export function parseSessionCacheEntry(
  dbPath: string,
  sig: string,
  accountTracker: AccountTracker,
  lastModifiedTime?: string
): CacheEntry | null {
  const db = openDb(dbPath);
  if (!db) return null;

  let stMtimeMs = Date.now();
  try {
    stMtimeMs = fs.statSync(dbPath).mtimeMs;
  } catch {}

  try {
    const stepTimeMap = new Map<number, number>();
    const tools: Record<string, number> = {};
    const dailyTools: Record<string, Record<string, number>> = {};
    const dailyUserTurns: Record<string, number> = {};
    const hourlyUserTurns: Record<string, number> = {};
    const fallbackDate = lastModifiedTime ? new Date(lastModifiedTime) : new Date(stMtimeMs);

    try {
      const stepRows = db.prepare('SELECT idx, step_type, metadata FROM steps').all();
      for (const sr of stepRows || []) {
        const ts = extractTimestampFromStepMeta(sr.metadata);
        if (ts) stepTimeMap.set(Number(sr.idx), ts);

        if (sr.step_type === 14) {
          const stepDate = ts ? new Date(ts * 1000) : fallbackDate;
          const { dateKey, hourKey } = formatLocalDateAndHourKeys(stepDate);
          dailyUserTurns[dateKey] = (dailyUserTurns[dateKey] || 0) + 1;
          hourlyUserTurns[hourKey] = (hourlyUserTurns[hourKey] || 0) + 1;
        }
      }

      const toolRows = db
        .prepare('SELECT idx, step_payload FROM steps WHERE step_type = 132 AND step_payload IS NOT NULL')
        .all();
      for (const tr of toolRows || []) {
        const toolName = extractToolInfo(tr.step_payload);
        if (toolName) {
          tools[toolName] = (tools[toolName] || 0) + 1;
          const ts = stepTimeMap.get(Number(tr.idx));
          const stepDate = ts ? new Date(ts * 1000) : fallbackDate;
          const { dateKey } = formatLocalDateAndHourKeys(stepDate);
          if (!dailyTools[dateKey]) dailyTools[dateKey] = {};
          dailyTools[dateKey][toolName] = (dailyTools[dateKey][toolName] || 0) + 1;
        }
      }
    } catch {}

    const rows = db.prepare('SELECT data FROM gen_metadata ORDER BY idx ASC').all();

    let sIn = 0;
    let sOut = 0;
    let sCache = 0;
    let sThink = 0;
    let sTtft = 0;
    let sTtftCount = 0;
    let sStream = 0;
    let count = 0;
    let sEffOut = 0;
    let sEffSec = 0;
    const sTpsList: number[] = [];
    let sTurnDurSum = 0;
    let sValidTurnCount = 0;
    const dailyBreakdown: Record<string, TokenBreakdown> = {};
    const hourlyBreakdown: Record<string, TokenBreakdown> = {};
    const dailyLatencySamples: Record<string, TurnLatencySample[]> = {};
    const models: Record<string, ModelBucket> = {};
    const dailyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
    const hourlyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
    const dailyAccountStats: Record<string, Record<string, AccountDailyStat>> = {};
    const hourlyAccountStats: Record<string, Record<string, AccountHourlyStat>> = {};

    for (const r of rows || []) {
      const parsed = extractGenMetadataStep(r.data);
      sIn += parsed.inTok;
      sOut += parsed.outTok;
      sCache += parsed.cacheRead;
      sThink += parsed.thinkTok;
      if (parsed.ttftSec > 0) {
        sTtft += parsed.ttftSec;
        sTtftCount++;
      }
      sStream += parsed.streamSec;
      count++;

      const tpsRes = computeStepTps(parsed.outTok, parsed.ttftSec, parsed.streamSec, parsed.totDur);
      const stepEffOut = parsed.outTok > 0 && tpsRes.effectiveSec > 0 ? parsed.outTok : 0;
      const stepEffSec = stepEffOut > 0 ? tpsRes.effectiveSec : 0;
      const hasValidTps = stepEffSec > 0 && tpsRes.displayTps > 0;
      const roundedTps = hasValidTps ? Math.round(tpsRes.displayTps) : 0;

      if (parsed.outTok > 0 && tpsRes.totDur > 0) {
        sTurnDurSum += tpsRes.totDur;
        sValidTurnCount++;
      }
      if (hasValidTps) {
        sEffOut += stepEffOut;
        sEffSec += stepEffSec;
        sTpsList.push(roundedTps);
      }

      const sec = parsed.stepIdx !== null ? stepTimeMap.get(parsed.stepIdx) : undefined;
      const turnDate = sec ? new Date(sec * 1000) : fallbackDate;
      const { dateKey, hourKey } = formatLocalDateAndHourKeys(turnDate);

      const turnDur = tpsRes.totDur > 0 ? tpsRes.totDur : parsed.ttftSec + parsed.streamSec;
      if (parsed.ttftSec > 0 && turnDur > 0) {
        if (!dailyLatencySamples[dateKey]) dailyLatencySamples[dateKey] = [];
        const turnTs = sec && sec > 1_000_000_000 ? sec : Math.floor(turnDate.getTime() / 1000);
        dailyLatencySamples[dateKey].push({
          ts: turnTs > 1_000_000_000 ? turnTs : 0,
          ttft: Math.round(parsed.ttftSec * 100) / 100,
          totDur: Math.round(turnDur * 100) / 100,
          stream: Math.round(parsed.streamSec * 100) / 100,
          outTok: parsed.outTok,
          speed: Math.round(tpsRes.displayTps)
        });
      }

      if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = createEmptyBreakdown();
      recordStepIntoBreakdown(
        dailyBreakdown[dateKey],
        parsed.inTok,
        parsed.outTok,
        parsed.cacheRead,
        parsed.thinkTok,
        parsed.ttftSec,
        stepEffOut,
        stepEffSec,
        hasValidTps,
        roundedTps,
        tpsRes.totDur
      );

      if (!hourlyBreakdown[hourKey]) hourlyBreakdown[hourKey] = createEmptyBreakdown();
      recordStepIntoBreakdown(
        hourlyBreakdown[hourKey],
        parsed.inTok,
        parsed.outTok,
        parsed.cacheRead,
        parsed.thinkTok,
        parsed.ttftSec,
        stepEffOut,
        stepEffSec,
        hasValidTps,
        roundedTps,
        tpsRes.totDur
      );

      const modelKey = resolveCanonicalModelId(parsed.rawModelId, parsed.modelName);
      if (!models[modelKey]) {
        models[modelKey] = {
          modelId: modelKey,
          modelName: parsed.modelName,
          inTok: 0,
          outTok: 0,
          cacheRead: 0,
          thinkTok: 0,
          streamSec: 0,
          ttftSec: 0,
          effOutTok: 0,
          effSec: 0,
          count: 0
        };
      }
      const mb = models[modelKey];
      mb.inTok += parsed.inTok;
      mb.outTok += parsed.outTok;
      mb.cacheRead += parsed.cacheRead;
      mb.thinkTok += parsed.thinkTok;
      mb.streamSec += parsed.streamSec;
      mb.ttftSec += parsed.ttftSec;
      mb.effOutTok += stepEffOut;
      mb.effSec += stepEffSec;
      mb.count += 1;

      accumulateModelDailyStat(
        dailyModelStats,
        dateKey,
        modelKey,
        modelKey,
        parsed.modelName,
        parsed.inTok,
        parsed.outTok,
        parsed.cacheRead,
        parsed.thinkTok,
        parsed.streamSec,
        parsed.ttftSec,
        stepEffOut,
        stepEffSec,
        1
      );
      accumulateModelDailyStat(
        hourlyModelStats,
        hourKey,
        modelKey,
        modelKey,
        parsed.modelName,
        parsed.inTok,
        parsed.outTok,
        parsed.cacheRead,
        parsed.thinkTok,
        parsed.streamSec,
        parsed.ttftSec,
        stepEffOut,
        stepEffSec,
        1
      );

      const stepTs = sec && sec > 1_000_000_000 ? sec : Math.floor(turnDate.getTime() / 1000);
      const account = accountTracker.matchAccountForTimestamp(stepTs);
      const modelRates = getModelPricingRates(modelKey || parsed.modelName);
      const stepCost =
        (parsed.inTok * modelRates.inputRate +
          parsed.outTok * modelRates.outputRate +
          parsed.cacheRead * modelRates.cacheRate) /
        1_000_000;

      accumulateAccountDailyStat(
        dailyAccountStats,
        dateKey,
        account,
        parsed.inTok,
        parsed.outTok,
        parsed.cacheRead,
        parsed.thinkTok,
        1,
        undefined,
        stepCost
      );
      accumulateAccountHourlyStat(
        hourlyAccountStats,
        hourKey,
        account,
        parsed.inTok,
        parsed.outTok,
        parsed.cacheRead,
        parsed.thinkTok,
        1,
        stepCost
      );
    }

    return {
      sig,
      inTok: sIn,
      outTok: sOut,
      cacheRead: sCache,
      thinkTok: sThink,
      ttft: sTtftCount > 0 ? sTtft / sTtftCount : 0,
      ttftSum: sTtft,
      ttftCount: sTtftCount,
      stream: sStream,
      reqCount: count || (rows ? rows.length : 1),
      lastModified: stMtimeMs,
      dailyBreakdown,
      hourlyBreakdown,
      models,
      dailyModelStats,
      hourlyModelStats,
      dailyAccountStats,
      hourlyAccountStats,
      tools,
      dailyTools,
      dailyUserTurns,
      hourlyUserTurns,
      dailyLatencySamples,
      effOutTok: sEffOut,
      effSec: sEffSec,
      tpsList: sTpsList,
      turnDurSum: sTurnDurSum,
      validTurnCount: sValidTurnCount
    };
  } catch {
    return null;
  } finally {
    try {
      db.close();
    } catch {}
  }
}

export function extractTimedSamplesFromRows(
  rows: Array<{ data: Buffer | Uint8Array }> | undefined,
  stepTimeMap: Map<number, number>,
  fallbackTsSec: number
): TimedSpeedSample[] {
  const samples: TimedSpeedSample[] = [];
  for (const r of rows || []) {
    const parsed = extractGenMetadataStep(r.data);
    const tpsRes = computeStepTps(parsed.outTok, parsed.ttftSec, parsed.streamSec, parsed.totDur);
    const stepEffOut = parsed.outTok > 0 && tpsRes.effectiveSec > 0 ? parsed.outTok : 0;
    const stepEffSec = stepEffOut > 0 ? tpsRes.effectiveSec : 0;
    if (stepEffOut <= 0 || stepEffSec <= 0 || tpsRes.displayTps <= 0) continue;

    const modelKey = resolveCanonicalModelId(parsed.rawModelId, parsed.modelName);
    if (modelKey === 'unknown' || parsed.modelName.toLowerCase().includes('unknown')) continue;

    const stepTs = parsed.stepIdx !== null ? stepTimeMap.get(parsed.stepIdx) : undefined;
    const ts = stepTs && stepTs > 1_000_000_000 ? stepTs : fallbackTsSec;
    if (!ts || ts <= 1_000_000_000) continue;

    samples.push({
      ts,
      modelId: modelKey,
      modelName: parsed.modelName,
      effOutTok: stepEffOut,
      effSec: stepEffSec
    });
  }
  return samples;
}
