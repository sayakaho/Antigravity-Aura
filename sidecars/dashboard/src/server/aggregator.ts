/**
 * Aura Dashboard · Global Conversation Incremental Aggregator
 * Scans conversation_summaries.db and conversations/*.db with mtime signature caching
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GlobalAnalyticsOverview, ConversationSummary } from '../types';

let DatabaseSync: any = null;
try {
  const nodeSqlite = await import('node:sqlite').catch(() => null);
  if (nodeSqlite && nodeSqlite.DatabaseSync) {
    DatabaseSync = nodeSqlite.DatabaseSync;
  }
} catch {}

function openDb(filePath: string) {
  if (!DatabaseSync) return null;
  return new DatabaseSync(filePath, { readOnly: true });
}

interface TokenBreakdown {
  inTok: number;
  outTok: number;
  cacheRead: number;
  requests: number;
}

interface CacheEntry {
  sig: string;
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  ttft: number;
  stream: number;
  reqCount: number;
  lastModified: number;
  dailyBreakdown?: Record<string, TokenBreakdown>;
  hourlyBreakdown?: Record<string, TokenBreakdown>;
}

interface AnalyticsCache {
  version: number;
  sessions: Record<string, CacheEntry>;
}

const CACHE_FILE_NAME = 'aura_analytics_cache_v4.json';

function parseProto(buf: Buffer | Uint8Array): Map<number, any> {
  const map = new Map<number, any>();
  if (!buf || buf.length === 0) return map;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  let pos = 0;
  while (pos < b.length) {
    let key = 0;
    let shift = 0;
    while (pos < b.length) {
      const byte = b[pos++];
      key |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) break;
      shift += 7;
    }
    const wireType = key & 0x7;
    const fieldNum = key >>> 3;
    if (fieldNum === 0) break;

    if (wireType === 0) {
      let val = 0;
      let s = 0;
      while (pos < b.length) {
        const byte = b[pos++];
        val |= (byte & 0x7f) << s;
        if (!(byte & 0x80)) break;
        s += 7;
      }
      map.set(fieldNum, val);
    } else if (wireType === 2) {
      let len = 0;
      let s = 0;
      while (pos < b.length) {
        const byte = b[pos++];
        len |= (byte & 0x7f) << s;
        if (!(byte & 0x80)) break;
        s += 7;
      }
      if (pos + len > b.length) break;
      const slice = b.subarray(pos, pos + len);
      pos += len;
      map.set(fieldNum, slice);
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return map;
}

function extractStepIdx(field2: Buffer | Uint8Array | null | undefined): number | null {
  if (!field2 || field2.length === 0) return null;
  const b = Buffer.isBuffer(field2) ? field2 : Buffer.from(field2);
  let p = 0;
  while (p < b.length) {
    let val = 0, s = 0;
    while (p < b.length) {
      const byte = b[p++];
      val |= (byte & 0x7f) << s;
      if (!(byte & 0x80)) break;
      s += 7;
    }
    return val;
  }
  return null;
}

function extractTimestampFromStepMeta(buf: Uint8Array | Buffer | null | undefined): number | null {
  if (!buf || buf.length === 0) return null;
  try {
    const sMap = parseProto(buf);
    const sub = sMap.get(1);
    if (sub && sub.length > 0) {
      const tMap = parseProto(sub);
      const sec = tMap.get(1);
      if (typeof sec === 'number' && sec > 1000000000) {
        return sec;
      }
    }
  } catch {}
  return null;
}

function formatLocalDateAndHourKeys(dateObj: Date): { dateKey: string; hourKey: string } {
  const yr = dateObj.getFullYear();
  const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dy = String(dateObj.getDate()).padStart(2, '0');
  const hr = String(dateObj.getHours()).padStart(2, '0');
  const dateKey = `${yr}-${mo}-${dy}`;
  const hourKey = `${dateKey} ${hr}:00`;
  return { dateKey, hourKey };
}

export class GlobalAnalyticsEngine {
  private baseDir: string;
  private cachePath: string;
  private cache: AnalyticsCache;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.cachePath = path.join(baseDir, CACHE_FILE_NAME);
    this.cache = this.loadCache();
  }

  private loadCache(): AnalyticsCache {
    try {
      if (fs.existsSync(this.cachePath)) {
        return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
      }
    } catch {}
    return { version: 1, sessions: {} };
  }

  private saveCache(): void {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache), 'utf8');
    } catch (e) {
      console.error('[Aura Analytics] Failed to write cache:', e);
    }
  }

  public getSummaries(): ConversationSummary[] {
    const dbPath = path.join(this.baseDir, 'conversation_summaries.db');
    if (!fs.existsSync(dbPath)) return [];

    let db: any = null;
    try {
      db = openDb(dbPath);
      if (!db) return [];
      const rows = db.prepare(`
        SELECT conversation_id, title, step_count, last_modified_time, project_id, agent_name, workspace_uris, status
        FROM conversation_summaries
        ORDER BY last_modified_time DESC
        LIMIT 500
      `).all();
      db.close();
      return (rows || []).map((r: any) => ({
        conversationId: r.conversation_id,
        title: r.title,
        stepCount: r.step_count,
        lastModifiedTime: r.last_modified_time,
        projectId: r.project_id,
        agentName: r.agent_name,
        workspaceUris: r.workspace_uris,
        status: r.status
      }));
    } catch (e) {
      if (db) db.close();
      console.error('[Aura Analytics] Error reading summaries:', e);
      return [];
    }
  }

  public getGlobalOverview(days = 30): GlobalAnalyticsOverview {
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
    let streamSum = 0;
    let streamCount = 0;

    const projectStats: Record<string, { convCount: number; tokenCount: number }> = {};
    const dateSeries: Record<string, { input: number; output: number; cache: number; requests: number }> = {};
    const hourSeries: Record<string, { hourKey: string; inputTok: number; outTok: number; cacheRead: number; requests: number }> = {};

    for (const s of summaries) {
      const convId = s.conversationId;
      const dbPath = path.join(convDir, `${convId}.db`);
      if (!fs.existsSync(dbPath)) continue;

      let st: fs.Stats;
      try {
        st = fs.statSync(dbPath);
      } catch {
        continue;
      }

      const sig = `${st.mtimeMs}:${st.size}`;
      let entry = this.cache.sessions[convId];

      if (!entry || entry.sig !== sig) {
        let db: any = null;
        try {
          db = openDb(dbPath);
          if (!db) continue;

          // Pre-index step timestamps
          const stepTimeMap = new Map<number, number>();
          try {
            const stepRows = db.prepare('SELECT idx, metadata FROM steps WHERE metadata IS NOT NULL').all();
            for (const sr of stepRows || []) {
              const ts = extractTimestampFromStepMeta(sr.metadata);
              if (ts) stepTimeMap.set(sr.idx, ts);
            }
          } catch {}

          const rows = db.prepare('SELECT data FROM gen_metadata ORDER BY idx ASC').all();
          db.close();
          db = null;

          let sIn = 0, sOut = 0, sCache = 0, sThink = 0, sTtft = 0, sStream = 0;
          let count = 0;
          const dailyBreakdown: Record<string, TokenBreakdown> = {};
          const hourlyBreakdown: Record<string, TokenBreakdown> = {};

          const fallbackDate = s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(st.mtimeMs);

          for (const r of rows || []) {
            const top = parseProto(r.data);
            const chat = top.has(1) ? parseProto(top.get(1)) : new Map();
            const usage = chat.has(4) ? parseProto(chat.get(4)) : new Map();
            const ttftMap = chat.has(11) ? parseProto(chat.get(11)) : new Map();
            const streamMap = chat.has(12) ? parseProto(chat.get(12)) : new Map();

            const inTok = usage.get(2) || 0;
            const outTok = usage.get(3) || 0;
            const cacheRead = usage.get(5) || 0;
            const thinkTok = usage.get(9) || 0;

            sIn += inTok;
            sOut += outTok;
            sCache += cacheRead;
            sThink += thinkTok;
            sTtft += (ttftMap.get(1) || 0) + (ttftMap.get(2) || 0) / 1e9;
            sStream += (streamMap.get(1) || 0) + (streamMap.get(2) || 0) / 1e9;
            count++;

            // Precise timestamp from stepIdx mapped via top field 2
            const stepIdx = extractStepIdx(top.get(2));
            const sec = stepIdx !== null ? stepTimeMap.get(stepIdx) : null;
            const turnDate = sec ? new Date(sec * 1000) : fallbackDate;
            const { dateKey, hourKey } = formatLocalDateAndHourKeys(turnDate);

            if (!dailyBreakdown[dateKey]) {
              dailyBreakdown[dateKey] = { inTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
            }
            dailyBreakdown[dateKey].inTok += inTok;
            dailyBreakdown[dateKey].outTok += outTok;
            dailyBreakdown[dateKey].cacheRead += cacheRead;
            dailyBreakdown[dateKey].requests += 1;

            if (!hourlyBreakdown[hourKey]) {
              hourlyBreakdown[hourKey] = { inTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
            }
            hourlyBreakdown[hourKey].inTok += inTok;
            hourlyBreakdown[hourKey].outTok += outTok;
            hourlyBreakdown[hourKey].cacheRead += cacheRead;
            hourlyBreakdown[hourKey].requests += 1;
          }

          entry = {
            sig,
            inTok: sIn,
            outTok: sOut,
            cacheRead: sCache,
            thinkTok: sThink,
            ttft: count > 0 ? sTtft / count : 0,
            stream: sStream,
            reqCount: count || (rows ? rows.length : 1),
            lastModified: st.mtimeMs,
            dailyBreakdown,
            hourlyBreakdown
          };
          this.cache.sessions[convId] = entry;
          cacheUpdated = true;
        } catch {
          if (db) db.close();
          continue;
        }
      }

      // Aggregate metrics
      totalIn += entry.inTok;
      totalOut += entry.outTok;
      totalCache += entry.cacheRead;
      totalThink += entry.thinkTok;
      const convReq = entry.reqCount || s.stepCount || 1;
      totalRequests += convReq;

      if (entry.ttft > 0) {
        ttftSum += entry.ttft;
        ttftCount++;
      }
      if (entry.stream > 0 && entry.outTok > 0) {
        streamSum += entry.outTok / entry.stream;
        streamCount++;
      }

      // Aggregate by workspace directory name
      let proj = s.projectId || 'Default Project';
      if (s.workspaceUris) {
        try {
          const uris = JSON.parse(s.workspaceUris);
          if (Array.isArray(uris) && uris.length > 0) {
            const lastPart = uris[0].replace(/^file:\/\//, '').split('/').filter(Boolean).pop();
            if (lastPart) proj = decodeURIComponent(lastPart);
          }
        } catch {}
      }
      if (!projectStats[proj]) projectStats[proj] = { convCount: 0, tokenCount: 0 };
      projectStats[proj].convCount += 1;
      projectStats[proj].tokenCount += entry.inTok + entry.outTok + entry.cacheRead;

      // Group by daily and hourly time-series in user's local timezone
      if (entry.dailyBreakdown && Object.keys(entry.dailyBreakdown).length > 0) {
        for (const [dateKey, d] of Object.entries(entry.dailyBreakdown)) {
          if (!dateSeries[dateKey]) dateSeries[dateKey] = { input: 0, output: 0, cache: 0, requests: 0 };
          dateSeries[dateKey].input += d.inTok;
          dateSeries[dateKey].output += d.outTok;
          dateSeries[dateKey].cache += d.cacheRead;
          dateSeries[dateKey].requests += d.requests;
        }
      } else {
        const { dateKey } = formatLocalDateAndHourKeys(s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(st.mtimeMs));
        if (!dateSeries[dateKey]) dateSeries[dateKey] = { input: 0, output: 0, cache: 0, requests: 0 };
        dateSeries[dateKey].input += entry.inTok;
        dateSeries[dateKey].output += entry.outTok;
        dateSeries[dateKey].cache += entry.cacheRead;
        dateSeries[dateKey].requests += convReq;
      }

      if (entry.hourlyBreakdown && Object.keys(entry.hourlyBreakdown).length > 0) {
        for (const [hourKey, h] of Object.entries(entry.hourlyBreakdown)) {
          if (!hourSeries[hourKey]) hourSeries[hourKey] = { hourKey, inputTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
          hourSeries[hourKey].inputTok += h.inTok;
          hourSeries[hourKey].outTok += h.outTok;
          hourSeries[hourKey].cacheRead += h.cacheRead;
          hourSeries[hourKey].requests += h.requests;
        }
      } else {
        const { hourKey } = formatLocalDateAndHourKeys(s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(st.mtimeMs));
        if (hourKey) {
          if (!hourSeries[hourKey]) hourSeries[hourKey] = { hourKey, inputTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
          hourSeries[hourKey].inputTok += entry.inTok;
          hourSeries[hourKey].outTok += entry.outTok;
          hourSeries[hourKey].cacheRead += entry.cacheRead;
          hourSeries[hourKey].requests += convReq;
        }
      }
    }

    if (cacheUpdated) {
      this.saveCache();
    }

    const totalRaw = totalIn + totalCache;
    const efficiency = totalRaw > 0 ? Math.round((totalCache / totalRaw) * 1000) / 10 : 0;
    const avgTtft = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 100) / 100 : 0;
    const avgRate = streamCount > 0 ? Math.round(streamSum / streamCount) : 0;

    const topProjects = Object.entries(projectStats)
      .map(([projectId, stat]) => ({ projectId, conversationCount: stat.convCount, tokenCount: stat.tokenCount }))
      .sort((a, b) => b.tokenCount - a.tokenCount)
      .slice(0, 5);

    const timeRangeSeries = Object.entries(dateSeries)
      .map(([date, d]) => ({ date, inputTok: d.input, outTok: d.output, cacheRead: d.cache, requests: d.requests }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const hourlySeries = Object.values(hourSeries)
      .sort((a, b) => a.hourKey.localeCompare(b.hourKey));

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
      topProjects,
      timeRangeSeries,
      hourlySeries
    };
  }

  public getSessionDetails(convId: string) {
    if (!convId || !/^[0-9a-f-]{36}$/i.test(convId)) return null;
    const dbPath = path.join(this.baseDir, 'conversations', `${convId}.db`);
    if (!fs.existsSync(dbPath)) return null;

    let db: any = null;
    try {
      db = openDb(dbPath);
      if (!db) return null;
      const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
      db.close();
      db = null;

      if (!rows || rows.length === 0) return null;

      let totalIn = 0;
      let totalOut = 0;
      let totalCache = 0;
      let totalThink = 0;
      let ttftSum = 0;
      let streamSum = 0;
      let validCount = 0;

      const steps = rows.map((r: any) => {
        const top = parseProto(r.data);
        const chat = top.has(1) ? parseProto(top.get(1)) : new Map();
        const usage = chat.has(4) ? parseProto(chat.get(4)) : new Map();
        const ttftMap = chat.has(11) ? parseProto(chat.get(11)) : new Map();
        const streamMap = chat.has(12) ? parseProto(chat.get(12)) : new Map();

        const inTok = usage.get(2) || 0;
        const outTok = usage.get(3) || 0;
        const cacheRead = usage.get(5) || 0;
        const thinkTok = usage.get(9) || 0;
        const respTok = usage.get(10) || 0;
        const ttft = (ttftMap.get(1) || 0) + (ttftMap.get(2) || 0) / 1e9;
        const stream = (streamMap.get(1) || 0) + (streamMap.get(2) || 0) / 1e9;

        totalIn += inTok;
        totalOut += outTok;
        totalCache += cacheRead;
        totalThink += thinkTok;
        if (ttft > 0) { ttftSum += ttft; validCount++; }
        if (stream > 0 && outTok > 0) { streamSum += outTok / stream; }

        return {
          idx: r.idx,
          inTok,
          outTok,
          cacheRead,
          ctx: inTok + cacheRead,
          thinkTok,
          respTok,
          ttft,
          stream,
          totDur: ttft + stream
        };
      });

      const totalRaw = totalIn + totalCache;
      const efficiency = totalRaw > 0 ? Math.round((totalCache / totalRaw) * 1000) / 10 : 0;
      const avgTtft = validCount > 0 ? Math.round((ttftSum / validCount) * 100) / 100 : 0;
      const avgRate = validCount > 0 ? Math.round(streamSum / validCount) : 0;

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
        steps
      };
    } catch {
      if (db) db.close();
      return null;
    }
  }
}
