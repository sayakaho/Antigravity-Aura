// src/server/aggregator.ts
import fs from "node:fs";
import path from "node:path";
var DatabaseSync = null;
try {
  const nodeSqlite = await import("node:sqlite").catch(() => null);
  if (nodeSqlite && nodeSqlite.DatabaseSync) {
    DatabaseSync = nodeSqlite.DatabaseSync;
  }
} catch {}
function openDb(filePath) {
  if (!DatabaseSync)
    return null;
  return new DatabaseSync(filePath, { readOnly: true });
}
var CACHE_FILE_NAME = "aura_analytics_cache.json";
function parseProto(buf) {
  const map = new Map;
  if (!buf || buf.length === 0)
    return map;
  let pos = 0;
  while (pos < buf.length) {
    let key = 0;
    let shift = 0;
    while (pos < buf.length) {
      const b = buf[pos++];
      key |= (b & 127) << shift;
      if (!(b & 128))
        break;
      shift += 7;
    }
    const wireType = key & 7;
    const fieldNum = key >>> 3;
    if (fieldNum === 0)
      break;
    if (wireType === 0) {
      let val = 0;
      let s = 0;
      while (pos < buf.length) {
        const b = buf[pos++];
        val |= (b & 127) << s;
        if (!(b & 128))
          break;
        s += 7;
      }
      map.set(fieldNum, val);
    } else if (wireType === 2) {
      let len = 0;
      let s = 0;
      while (pos < buf.length) {
        const b = buf[pos++];
        len |= (b & 127) << s;
        if (!(b & 128))
          break;
        s += 7;
      }
      if (pos + len > buf.length)
        break;
      const slice = buf.subarray(pos, pos + len);
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

class GlobalAnalyticsEngine {
  baseDir;
  cachePath;
  cache;
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.cachePath = path.join(baseDir, CACHE_FILE_NAME);
    this.cache = this.loadCache();
  }
  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        return JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
      }
    } catch {}
    return { version: 1, sessions: {} };
  }
  saveCache() {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache), "utf8");
    } catch (e) {
      console.error("[Aura Analytics] Failed to write cache:", e);
    }
  }
  getSummaries() {
    const dbPath = path.join(this.baseDir, "conversation_summaries.db");
    if (!fs.existsSync(dbPath))
      return [];
    let db = null;
    try {
      db = openDb(dbPath);
      if (!db)
        return [];
      const rows = db.prepare(`
        SELECT conversation_id, title, step_count, last_modified_time, project_id, agent_name, workspace_uris, status
        FROM conversation_summaries
        ORDER BY last_modified_time DESC
        LIMIT 500
      `).all();
      db.close();
      return (rows || []).map((r) => ({
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
      if (db)
        db.close();
      console.error("[Aura Analytics] Error reading summaries:", e);
      return [];
    }
  }
  getGlobalOverview(days = 30) {
    const convDir = path.join(this.baseDir, "conversations");
    const summaries = this.getSummaries();
    let cacheUpdated = false;
    let totalIn = 0;
    let totalOut = 0;
    let totalCache = 0;
    let totalThink = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    let streamSum = 0;
    let streamCount = 0;
    const projectStats = {};
    const dateSeries = {};
    for (const s of summaries) {
      const convId = s.conversationId;
      const dbPath = path.join(convDir, `${convId}.db`);
      if (!fs.existsSync(dbPath))
        continue;
      let st;
      try {
        st = fs.statSync(dbPath);
      } catch {
        continue;
      }
      const sig = `${st.mtimeMs}:${st.size}`;
      let entry = this.cache.sessions[convId];
      if (!entry || entry.sig !== sig) {
        let db = null;
        try {
          db = openDb(dbPath);
          if (!db)
            continue;
          const rows = db.prepare("SELECT data FROM gen_metadata ORDER BY idx ASC").all();
          db.close();
          db = null;
          let sIn = 0, sOut = 0, sCache = 0, sThink = 0, sTtft = 0, sStream = 0;
          let count = 0;
          for (const r of rows || []) {
            const top = parseProto(r.data);
            const chat = top.has(1) ? parseProto(top.get(1)) : new Map;
            const usage = chat.has(4) ? parseProto(chat.get(4)) : new Map;
            const ttftMap = chat.has(11) ? parseProto(chat.get(11)) : new Map;
            const streamMap = chat.has(12) ? parseProto(chat.get(12)) : new Map;
            sIn += usage.get(2) || 0;
            sOut += usage.get(3) || 0;
            sCache += usage.get(5) || 0;
            sThink += usage.get(9) || 0;
            sTtft += (ttftMap.get(1) || 0) + (ttftMap.get(2) || 0) / 1e9;
            sStream += (streamMap.get(1) || 0) + (streamMap.get(2) || 0) / 1e9;
            count++;
          }
          entry = {
            sig,
            inTok: sIn,
            outTok: sOut,
            cacheRead: sCache,
            thinkTok: sThink,
            ttft: count > 0 ? sTtft / count : 0,
            stream: sStream,
            lastModified: st.mtimeMs
          };
          this.cache.sessions[convId] = entry;
          cacheUpdated = true;
        } catch {
          if (db)
            db.close();
          continue;
        }
      }
      totalIn += entry.inTok;
      totalOut += entry.outTok;
      totalCache += entry.cacheRead;
      totalThink += entry.thinkTok;
      if (entry.ttft > 0) {
        ttftSum += entry.ttft;
        ttftCount++;
      }
      if (entry.stream > 0 && entry.outTok > 0) {
        streamSum += entry.outTok / entry.stream;
        streamCount++;
      }
      let proj = s.projectId || "Default Project";
      if (s.workspaceUris) {
        try {
          const uris = JSON.parse(s.workspaceUris);
          if (Array.isArray(uris) && uris.length > 0) {
            const lastPart = uris[0].replace(/^file:\/\//, "").split("/").filter(Boolean).pop();
            if (lastPart)
              proj = decodeURIComponent(lastPart);
          }
        } catch {}
      }
      if (!projectStats[proj])
        projectStats[proj] = { convCount: 0, tokenCount: 0 };
      projectStats[proj].convCount += 1;
      projectStats[proj].tokenCount += entry.inTok + entry.outTok + entry.cacheRead;
      const dateKey = s.lastModifiedTime ? s.lastModifiedTime.slice(0, 10) : "Recent";
      if (!dateSeries[dateKey])
        dateSeries[dateKey] = { input: 0, output: 0, cache: 0 };
      dateSeries[dateKey].input += entry.inTok;
      dateSeries[dateKey].output += entry.outTok;
      dateSeries[dateKey].cache += entry.cacheRead;
    }
    if (cacheUpdated) {
      this.saveCache();
    }
    const totalRaw = totalIn + totalCache;
    const efficiency = totalRaw > 0 ? Math.round(totalCache / totalRaw * 1000) / 10 : 0;
    const avgTtft = ttftCount > 0 ? Math.round(ttftSum / ttftCount * 100) / 100 : 0;
    const avgRate = streamCount > 0 ? Math.round(streamSum / streamCount) : 0;
    const topProjects = Object.entries(projectStats).map(([projectId, stat]) => ({ projectId, conversationCount: stat.convCount, tokenCount: stat.tokenCount })).sort((a, b) => b.tokenCount - a.tokenCount).slice(0, 5);
    const timeRangeSeries = Object.entries(dateSeries).map(([date, d]) => ({ date, inputTok: d.input, outTok: d.output, cacheRead: d.cache })).sort((a, b) => a.date.localeCompare(b.date));
    return {
      totalConversations: summaries.length,
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
      timeRangeSeries
    };
  }
}
export {
  GlobalAnalyticsEngine
};
