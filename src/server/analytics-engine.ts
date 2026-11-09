import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { canonicalizeTool } from '../shared/catalog';
import { formatLocalDateAndHourKeys } from '../shared/format';
import { computeStepTps, computeWeightedTps } from '../shared/tps';
import type {
  ConversationSummary,
  DailySeriesPoint,
  GlobalAnalyticsOverview,
  HourlySeriesPoint,
  ModelDailyStat,
  RangePerfFields,
  SessionAnalyticsData
} from '../types';
import {
  extractGenMetadataStep,
  extractTimestampFromStepMeta,
  extractToolInfo,
  getDbSignature,
  openDb
} from './sqlite-proto';

interface TokenBreakdown extends RangePerfFields {
  inTok: number;
  outTok: number;
  cacheRead: number;
  requests: number;
}

interface ModelBucket {
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
  count: number;
}

interface CacheEntry {
  sig: string;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  ttft: number;
  ttftSum?: number;
  ttftCount?: number;
  stream: number;
  reqCount: number;
  lastModified: number;
  dailyBreakdown?: Record<string, TokenBreakdown>;
  hourlyBreakdown?: Record<string, TokenBreakdown>;
  models?: Record<string, ModelBucket>;
  dailyModelStats?: Record<string, Record<string, ModelDailyStat>>;
  hourlyModelStats?: Record<string, Record<string, ModelDailyStat>>;
  tools?: Record<string, number>;
  dailyTools?: Record<string, Record<string, number>>;
  effOutTok?: number;
  effSec?: number;
  tpsList?: number[];
  turnDurSum?: number;
  validTurnCount?: number;
}

interface AnalyticsCache {
  version: number;
  sessions: Record<string, CacheEntry>;
}

const CACHE_FILE_NAME = 'aura_analytics_cache_v9.json';
const OBSOLETE_CACHE_FILES = [
  'aura_analytics_cache.json',
  'aura_analytics_cache_v1.json',
  'aura_analytics_cache_v2.json',
  'aura_analytics_cache_v3.json',
  'aura_analytics_cache_v4.json',
  'aura_analytics_cache_v5.json',
  'aura_analytics_cache_v6.json',
  'aura_analytics_cache_v7.json',
  'aura_analytics_cache_v8.json'
];

function createEmptyBreakdown(): TokenBreakdown {
  return {
    inTok: 0,
    outTok: 0,
    cacheRead: 0,
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

function createEmptyModelDailyStat(modelId: string): ModelDailyStat {
  return {
    modelId,
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

function recordStepIntoBreakdown(
  bucket: TokenBreakdown,
  inTok: number,
  outTok: number,
  cacheRead: number,
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

function mergeBreakdownPerf(target: RangePerfFields, src: RangePerfFields): void {
  target.effOutTok = (target.effOutTok || 0) + (src.effOutTok || 0);
  target.effSec = (target.effSec || 0) + (src.effSec || 0);
  target.ttftSum = (target.ttftSum || 0) + (src.ttftSum || 0);
  target.ttftCount = (target.ttftCount || 0) + (src.ttftCount || 0);
  target.turnDurSum = (target.turnDurSum || 0) + (src.turnDurSum || 0);
  target.validTurnCount = (target.validTurnCount || 0) + (src.validTurnCount || 0);
  if (src.tpsHist) {
    if (!target.tpsHist) target.tpsHist = {};
    for (const [k, cnt] of Object.entries(src.tpsHist)) {
      target.tpsHist[k] = (target.tpsHist[k] || 0) + cnt;
    }
  }
}

function accumulateModelDailyStat(
  targetMap: Record<string, Record<string, ModelDailyStat>>,
  key: string,
  modelName: string,
  modelId: string,
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
  if (!targetMap[key][modelName]) {
    targetMap[key][modelName] = createEmptyModelDailyStat(modelId);
  }
  const st = targetMap[key][modelName];
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

export class GlobalAnalyticsEngine {
  private readonly baseDir: string;
  private readonly cachePath: string;
  private cache: AnalyticsCache;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private cacheDirty = false;
  private isWritingCache = false;
  private writeFailureCount = 0;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.cachePath = path.join(baseDir, CACHE_FILE_NAME);
    this.cache = this.loadCache();
    this.pruneObsoleteCaches();
  }

  private pruneObsoleteCaches(): void {
    for (const name of OBSOLETE_CACHE_FILES) {
      const fullPath = path.join(this.baseDir, name);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // Ignore cleanup failure for locked legacy cache files
      }
    }
  }

  private loadCache(): AnalyticsCache {
    try {
      if (fs.existsSync(this.cachePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.cachePath, 'utf8')) as Partial<AnalyticsCache>;
        if (parsed && parsed.sessions && typeof parsed.sessions === 'object') {
          return { version: parsed.version || 1, sessions: parsed.sessions };
        }
      }
    } catch {
      // Corrupt cache recovers by rebuilding lazily from SQLite
    }
    return { version: 1, sessions: {} };
  }

  private scheduleSaveCache(resetFailures = true, delayMs = 400): void {
    this.cacheDirty = true;
    if (resetFailures) {
      this.writeFailureCount = 0;
    }
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.writeCacheAtomicAsync();
    }, delayMs);
    this.saveTimer.unref?.();
  }

  private async writeCacheAtomicAsync(): Promise<void> {
    if (!this.cacheDirty || this.isWritingCache) return;
    this.isWritingCache = true;
    this.cacheDirty = false;
    const tmpPath = `${this.cachePath}.tmp`;
    let shouldRetryError = false;
    try {
      await fsPromises.writeFile(tmpPath, JSON.stringify(this.cache), 'utf8');
      await fsPromises.rename(tmpPath, this.cachePath);
      this.writeFailureCount = 0;
    } catch (err) {
      this.writeFailureCount += 1;
      shouldRetryError = this.writeFailureCount < 3;
      if (shouldRetryError) {
        this.cacheDirty = true;
      }
      console.error('[Aura Analytics] Failed to write cache:', err);
    } finally {
      this.isWritingCache = false;
      if (this.cacheDirty) {
        const delayMs = shouldRetryError ? 400 * (this.writeFailureCount + 1) : 400;
        this.scheduleSaveCache(false, delayMs);
      }
    }
  }

  public flushCache(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.cacheDirty) return;
    const tmpPath = `${this.cachePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.cache), 'utf8');
      fs.renameSync(tmpPath, this.cachePath);
      this.cacheDirty = false;
    } catch (err) {
      console.error('[Aura Analytics] Failed to flush cache:', err);
    }
  }

  public getSummaries(): ConversationSummary[] {
    const dbPath = path.join(this.baseDir, 'conversation_summaries.db');
    if (!fs.existsSync(dbPath)) return [];

    const db = openDb(dbPath);
    if (!db) return [];

    try {
      const rows = db
        .prepare(
          `
          SELECT conversation_id, title, step_count, last_modified_time, project_id, agent_name, workspace_uris, status
          FROM conversation_summaries
          ORDER BY last_modified_time DESC
        `
        )
        .all();
      return (rows || []).map((r) => ({
        conversationId: String(r.conversation_id || ''),
        title: String(r.title || ''),
        stepCount: Number(r.step_count || 0),
        lastModifiedTime: String(r.last_modified_time || ''),
        projectId: String(r.project_id || ''),
        agentName: String(r.agent_name || ''),
        workspaceUris: String(r.workspace_uris || ''),
        status: String(r.status || '')
      }));
    } catch (err) {
      console.error('[Aura Analytics] Error reading summaries:', err);
      return [];
    } finally {
      try {
        db.close();
      } catch {}
    }
  }

  public getGlobalOverview(): GlobalAnalyticsOverview {
    const convDir = path.join(this.baseDir, 'conversations');
    const summaries = this.getSummaries();
    let cacheUpdated = false;

    let totalIn = 0;
    let totalOut = 0;
    let totalCache = 0;
    let totalThink = 0;
    let totalRequests = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    let globalEffOutTokens = 0;
    let globalEffSeconds = 0;
    const globalTpsList: number[] = [];
    let globalTurnDurSum = 0;
    let globalValidTurnCount = 0;

    const projectStats: Record<string, { convCount: number; tokenCount: number }> = {};
    const dateSeries: Record<string, DailySeriesPoint> = {};
    const hourSeries: Record<string, HourlySeriesPoint> = {};
    const globalModelMap: Record<string, ModelBucket> = {};
    const globalDailyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
    const globalHourlyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
    const globalDailyToolStats: Record<string, Record<string, number>> = {};
    const globalToolsMap: Record<string, number> = {};

    for (const s of summaries) {
      const convId = s.conversationId;
      const dbPath = path.join(convDir, `${convId}.db`);
      const sig = getDbSignature(dbPath);
      if (!sig) continue;

      let entry = this.cache.sessions[convId];
      if (!entry || entry.sig !== sig) {
        const parsedEntry = this.parseSessionCacheEntry(dbPath, sig, s.lastModifiedTime);
        if (!parsedEntry) continue;
        entry = parsedEntry;
        this.cache.sessions[convId] = entry;
        cacheUpdated = true;
      }

      totalIn += entry.inTok;
      totalOut += entry.outTok;
      totalCache += entry.cacheRead;
      totalThink += entry.thinkTok;
      const convReq = entry.reqCount || s.stepCount || 1;
      totalRequests += convReq;

      if ((entry.ttftCount || 0) > 0 && (entry.ttftSum || 0) > 0) {
        ttftSum += entry.ttftSum || 0;
        ttftCount += entry.ttftCount || 0;
      } else if (entry.ttft > 0) {
        ttftSum += entry.ttft;
        ttftCount++;
      }
      if (entry.tpsList && entry.tpsList.length > 0) {
        globalTpsList.push(...entry.tpsList);
      }
      if (entry.effSec && entry.effSec > 0) {
        globalEffOutTokens += entry.effOutTok || 0;
        globalEffSeconds += entry.effSec;
      }
      if (entry.turnDurSum) {
        globalTurnDurSum += entry.turnDurSum;
        globalValidTurnCount += entry.validTurnCount || 0;
      }

      let proj = s.projectId || 'Default Project';
      if (s.workspaceUris) {
        try {
          const uris = JSON.parse(s.workspaceUris);
          if (Array.isArray(uris) && uris.length > 0 && typeof uris[0] === 'string') {
            const lastPart = uris[0].replace(/^file:\/\//, '').split('/').filter(Boolean).pop();
            if (lastPart) proj = decodeURIComponent(lastPart);
          }
        } catch {}
      }
      if (!projectStats[proj]) projectStats[proj] = { convCount: 0, tokenCount: 0 };
      projectStats[proj].convCount += 1;
      projectStats[proj].tokenCount += entry.inTok + entry.outTok + entry.cacheRead;

      if (entry.dailyBreakdown && Object.keys(entry.dailyBreakdown).length > 0) {
        for (const [dateKey, d] of Object.entries(entry.dailyBreakdown)) {
          if (!dateSeries[dateKey]) {
            dateSeries[dateKey] = {
              date: dateKey,
              inputTok: 0,
              outTok: 0,
              cacheRead: 0,
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
          dateSeries[dateKey].inputTok += d.inTok;
          dateSeries[dateKey].outTok += d.outTok;
          dateSeries[dateKey].cacheRead += d.cacheRead;
          dateSeries[dateKey].requests += d.requests;
          mergeBreakdownPerf(dateSeries[dateKey], d);
        }
      } else {
        const { dateKey } = formatLocalDateAndHourKeys(
          s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(entry.lastModified)
        );
        if (!dateSeries[dateKey]) {
          dateSeries[dateKey] = {
            date: dateKey,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
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
        dateSeries[dateKey].inputTok += entry.inTok;
        dateSeries[dateKey].outTok += entry.outTok;
        dateSeries[dateKey].cacheRead += entry.cacheRead;
        dateSeries[dateKey].requests += convReq;
      }

      if (entry.hourlyBreakdown && Object.keys(entry.hourlyBreakdown).length > 0) {
        for (const [hourKey, h] of Object.entries(entry.hourlyBreakdown)) {
          if (!hourSeries[hourKey]) {
            hourSeries[hourKey] = {
              hourKey,
              inputTok: 0,
              outTok: 0,
              cacheRead: 0,
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
          hourSeries[hourKey].inputTok += h.inTok;
          hourSeries[hourKey].outTok += h.outTok;
          hourSeries[hourKey].cacheRead += h.cacheRead;
          hourSeries[hourKey].requests += h.requests;
          mergeBreakdownPerf(hourSeries[hourKey], h);
        }
      } else {
        const { hourKey } = formatLocalDateAndHourKeys(
          s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(entry.lastModified)
        );
        if (!hourSeries[hourKey]) {
          hourSeries[hourKey] = {
            hourKey,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
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
        hourSeries[hourKey].inputTok += entry.inTok;
        hourSeries[hourKey].outTok += entry.outTok;
        hourSeries[hourKey].cacheRead += entry.cacheRead;
        hourSeries[hourKey].requests += convReq;
      }

      if (entry.models) {
        for (const [mName, m] of Object.entries(entry.models)) {
          if (!globalModelMap[mName]) {
            globalModelMap[mName] = { ...m };
          } else {
            const g = globalModelMap[mName];
            g.inTok += m.inTok;
            g.outTok += m.outTok;
            g.cacheRead += m.cacheRead;
            g.thinkTok += m.thinkTok;
            g.streamSec += m.streamSec;
            g.ttftSec += m.ttftSec;
            g.effOutTok += m.effOutTok || 0;
            g.effSec += m.effSec || 0;
            g.count += m.count;
          }
        }
      }

      if (entry.dailyModelStats) {
        for (const [dKey, dModels] of Object.entries(entry.dailyModelStats)) {
          for (const [mName, dm] of Object.entries(dModels)) {
            accumulateModelDailyStat(
              globalDailyModelStats,
              dKey,
              mName,
              dm.modelId || '',
              dm.inTok,
              dm.outTok,
              dm.cacheRead,
              dm.thinkTok,
              dm.streamSec,
              dm.ttftSec,
              dm.effOutTok || 0,
              dm.effSec || 0,
              dm.requests
            );
          }
        }
      }

      if (entry.hourlyModelStats) {
        for (const [hKey, hModels] of Object.entries(entry.hourlyModelStats)) {
          for (const [mName, hm] of Object.entries(hModels)) {
            accumulateModelDailyStat(
              globalHourlyModelStats,
              hKey,
              mName,
              hm.modelId || '',
              hm.inTok,
              hm.outTok,
              hm.cacheRead,
              hm.thinkTok,
              hm.streamSec,
              hm.ttftSec,
              hm.effOutTok || 0,
              hm.effSec || 0,
              hm.requests
            );
          }
        }
      }

      if (entry.tools) {
        for (const [tName, tCount] of Object.entries(entry.tools)) {
          globalToolsMap[tName] = (globalToolsMap[tName] || 0) + tCount;
        }
      }
      if (entry.dailyTools) {
        for (const [dKey, dTools] of Object.entries(entry.dailyTools)) {
          if (!globalDailyToolStats[dKey]) globalDailyToolStats[dKey] = {};
          for (const [tName, tCount] of Object.entries(dTools)) {
            globalDailyToolStats[dKey][tName] = (globalDailyToolStats[dKey][tName] || 0) + tCount;
          }
        }
      }
    }

    if (cacheUpdated) {
      this.scheduleSaveCache();
    }

    const totalRaw = totalIn + totalCache;
    const efficiency = totalRaw > 0 ? Math.round((totalCache / totalRaw) * 1000) / 10 : 0;
    const avgTtft = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 100) / 100 : 0;

    const avgRate = computeWeightedTps(globalEffOutTokens, globalEffSeconds);
    let p50Rate = avgRate;
    if (globalTpsList.length > 0) {
      globalTpsList.sort((a, b) => a - b);
      p50Rate = globalTpsList[Math.floor(globalTpsList.length * 0.5)];
    }

    const avgTurnLatency =
      globalValidTurnCount > 0
        ? Math.round((globalTurnDurSum / globalValidTurnCount) * 100) / 100
        : 0;

    const topProjects = Object.entries(projectStats)
      .map(([projectId, stat]) => ({
        projectId,
        conversationCount: stat.convCount,
        tokenCount: stat.tokenCount
      }))
      .sort((a, b) => b.tokenCount - a.tokenCount)
      .slice(0, 5);

    const timeRangeSeries = Object.values(dateSeries).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const hourlySeries = Object.values(hourSeries).sort((a, b) =>
      a.hourKey.localeCompare(b.hourKey)
    );

    const modelDistribution = Object.values(globalModelMap)
      .filter(
        (m) => (m.inTok + m.outTok + m.cacheRead > 0 || m.count > 0) && m.modelName !== 'Unknown Model'
      )
      .map((m) => ({
        modelId: m.modelId,
        modelName: m.modelName,
        totalTokens: m.inTok + m.outTok + m.cacheRead,
        inputTok: m.inTok,
        outTok: m.outTok,
        cacheRead: m.cacheRead,
        thinkTok: m.thinkTok,
        requests: m.count,
        avgTps: computeWeightedTps(m.effOutTok, m.effSec),
        avgTtft: m.count > 0 ? Math.round((m.ttftSec / m.count) * 100) / 100 : 0
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    const totalToolCalls = Object.values(globalToolsMap).reduce((a, b) => a + b, 0);
    const toolDistribution = Object.entries(globalToolsMap)
      .map(([rawName, count]) => {
        const info = canonicalizeTool(rawName);
        return {
          rawName,
          name: info.name,
          category: info.category,
          color: info.color,
          count,
          percentage: totalToolCalls > 0 ? Math.round((count / totalToolCalls) * 1000) / 10 : 0
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalConversations: summaries.length,
      totalRequests,
      totalTokens: {
        input: totalIn,
        output: totalOut,
        cacheRead: totalCache,
        thinking: totalThink,
        total: totalIn + totalOut + totalCache
      },
      cacheEfficiency: efficiency,
      avgTtft,
      avgTokPerSec: avgRate,
      p50TokPerSec: p50Rate,
      e2eTokPerSec: p50Rate,
      avgTurnLatency,
      topProjects,
      timeRangeSeries,
      hourlySeries,
      modelDistribution,
      dailyModelStats: globalDailyModelStats,
      hourlyModelStats: globalHourlyModelStats,
      toolDistribution,
      dailyToolStats: globalDailyToolStats
    };
  }

  private parseSessionCacheEntry(
    dbPath: string,
    sig: string,
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
      const fallbackDate = lastModifiedTime ? new Date(lastModifiedTime) : new Date(stMtimeMs);

      try {
        const stepRows = db.prepare('SELECT idx, step_type, step_payload, metadata FROM steps').all();
        for (const sr of stepRows || []) {
          const ts = extractTimestampFromStepMeta(sr.metadata);
          if (ts) stepTimeMap.set(Number(sr.idx), ts);

          if (sr.step_type === 132 && sr.step_payload) {
            const toolName = extractToolInfo(sr.step_payload);
            if (toolName) {
              tools[toolName] = (tools[toolName] || 0) + 1;
              const stepDate = ts ? new Date(ts * 1000) : fallbackDate;
              const { dateKey } = formatLocalDateAndHourKeys(stepDate);
              if (!dailyTools[dateKey]) dailyTools[dateKey] = {};
              dailyTools[dateKey][toolName] = (dailyTools[dateKey][toolName] || 0) + 1;
            }
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
      const models: Record<string, ModelBucket> = {};
      const dailyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
      const hourlyModelStats: Record<string, Record<string, ModelDailyStat>> = {};

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

        if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = createEmptyBreakdown();
        recordStepIntoBreakdown(
          dailyBreakdown[dateKey],
          parsed.inTok,
          parsed.outTok,
          parsed.cacheRead,
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
          parsed.ttftSec,
          stepEffOut,
          stepEffSec,
          hasValidTps,
          roundedTps,
          tpsRes.totDur
        );

        if (!models[parsed.modelName]) {
          models[parsed.modelName] = {
            modelId: parsed.rawModelId,
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
        const mb = models[parsed.modelName];
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
          parsed.modelName,
          parsed.rawModelId,
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
          parsed.modelName,
          parsed.rawModelId,
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
        tools,
        dailyTools,
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

  public getSessionDetails(convId: string): SessionAnalyticsData | null {
    if (!convId || !/^[0-9a-f-]{36}$/i.test(convId)) return null;
    const dbPath = path.join(this.baseDir, 'conversations', `${convId}.db`);
    if (!fs.existsSync(dbPath)) return null;

    const db = openDb(dbPath);
    if (!db) return null;

    try {
      const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
      const toolRows = db.prepare('SELECT step_payload FROM steps WHERE step_type = 132').all();
      if (!rows || rows.length === 0) return null;

      let totalIn = 0;
      let totalOut = 0;
      let totalCache = 0;
      let totalThink = 0;
      let ttftSum = 0;
      let validCount = 0;
      let sessionEffOut = 0;
      let sessionEffSec = 0;
      const sessionTpsList: number[] = [];
      let sessionTurnDurSum = 0;
      let sessionValidTurnCount = 0;
      const sessionModelsMap: Record<string, ModelBucket> = {};

      const steps = rows.map((r) => {
        const parsed = extractGenMetadataStep(r.data);
        const tpsRes = computeStepTps(parsed.outTok, parsed.ttftSec, parsed.streamSec, parsed.totDur);
        const stepEffOut = parsed.outTok > 0 && tpsRes.effectiveSec > 0 ? parsed.outTok : 0;
        const stepEffSec = stepEffOut > 0 ? tpsRes.effectiveSec : 0;

        if (!sessionModelsMap[parsed.modelName]) {
          sessionModelsMap[parsed.modelName] = {
            modelId: parsed.rawModelId,
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
        const sm = sessionModelsMap[parsed.modelName];
        sm.inTok += parsed.inTok;
        sm.outTok += parsed.outTok;
        sm.cacheRead += parsed.cacheRead;
        sm.thinkTok += parsed.thinkTok;
        sm.streamSec += parsed.streamSec;
        sm.ttftSec += parsed.ttftSec;
        sm.effOutTok += stepEffOut;
        sm.effSec += stepEffSec;
        sm.count += 1;

        totalIn += parsed.inTok;
        totalOut += parsed.outTok;
        totalCache += parsed.cacheRead;
        totalThink += parsed.thinkTok;
        if (parsed.ttftSec > 0) {
          ttftSum += parsed.ttftSec;
          validCount++;
        }
        if (parsed.outTok > 0 && tpsRes.totDur > 0) {
          sessionTurnDurSum += tpsRes.totDur;
          sessionValidTurnCount++;
        }
        if (stepEffSec > 0 && tpsRes.displayTps > 0) {
          sessionEffOut += stepEffOut;
          sessionEffSec += stepEffSec;
          sessionTpsList.push(Math.round(tpsRes.displayTps));
        }

        return {
          idx: Number(r.idx),
          inTok: parsed.inTok,
          outTok: parsed.outTok,
          cacheRead: parsed.cacheRead,
          ctx: parsed.ctx,
          thinkTok: parsed.thinkTok,
          respTok: parsed.respTok,
          ttft: parsed.ttftSec,
          stream: parsed.streamSec,
          totDur: tpsRes.totDur
        };
      });

      const totalRaw = totalIn + totalCache;
      const efficiency = totalRaw > 0 ? Math.round((totalCache / totalRaw) * 1000) / 10 : 0;
      const avgTtft = validCount > 0 ? Math.round((ttftSum / validCount) * 100) / 100 : 0;
      const avgRate = computeWeightedTps(sessionEffOut, sessionEffSec);
      let p50Rate = avgRate;
      if (sessionTpsList.length > 0) {
        sessionTpsList.sort((a, b) => a - b);
        p50Rate = sessionTpsList[Math.floor(sessionTpsList.length * 0.5)];
      }
      const avgTurnLatency =
        sessionValidTurnCount > 0
          ? Math.round((sessionTurnDurSum / sessionValidTurnCount) * 100) / 100
          : 0;

      const models = Object.values(sessionModelsMap)
        .filter(
          (m) =>
            m.inTok + m.outTok + m.cacheRead > 0 &&
            !m.modelName.toLowerCase().includes('unknown')
        )
        .map((m) => ({
          modelId: m.modelId,
          modelName: m.modelName,
          totalTokens: m.inTok + m.outTok + m.cacheRead,
          inputTok: m.inTok,
          outTok: m.outTok,
          cacheRead: m.cacheRead,
          thinkTok: m.thinkTok,
          requests: m.count,
          avgTps: computeWeightedTps(m.effOutTok, m.effSec),
          avgTtft: m.count > 0 ? Math.round((m.ttftSec / m.count) * 100) / 100 : 0
        }))
        .sort((a, b) => b.totalTokens - a.totalTokens);

      const sessionToolsMap: Record<string, number> = {};
      for (const tr of toolRows || []) {
        const t = extractToolInfo(tr.step_payload);
        if (t) sessionToolsMap[t] = (sessionToolsMap[t] || 0) + 1;
      }
      const totalSessionTools = Object.values(sessionToolsMap).reduce((a, b) => a + b, 0);
      const tools = Object.entries(sessionToolsMap)
        .map(([rawName, count]) => {
          const info = canonicalizeTool(rawName);
          return {
            rawName,
            name: info.name,
            category: info.category,
            color: info.color,
            count,
            percentage: totalSessionTools > 0 ? Math.round((count / totalSessionTools) * 1000) / 10 : 0
          };
        })
        .sort((a, b) => b.count - a.count);

      return {
        cascadeId: convId,
        totalTokens: {
          input: totalIn,
          output: totalOut,
          cacheRead: totalCache,
          thinking: totalThink,
          total: totalIn + totalOut + totalCache
        },
        totalRequests: steps.length,
        cacheEfficiency: efficiency,
        avgTtft,
        avgTokPerSec: avgRate,
        p50TokPerSec: p50Rate,
        e2eTokPerSec: p50Rate,
        avgTurnLatency,
        steps,
        models,
        tools
      };
    } catch (err) {
      console.error('[Aggregator] getSessionDetails error:', err);
      return null;
    } finally {
      try {
        db.close();
      } catch {}
    }
  }
}
