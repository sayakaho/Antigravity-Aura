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
var CACHE_FILE_NAME = "aura_analytics_cache_v5.json";
function canonicalModelName(id, name) {
  if (name && name.trim() && name.trim().toLowerCase() !== "unknown")
    return name.trim();
  if (!id || id === "unknown")
    return "Unknown Model";
  const cleanId = id.trim().toLowerCase();
  if (cleanId === "gemini-3.8-flash")
    return "Gemini 3.8 Flash";
  if (cleanId === "gemini-3.8-flash-n")
    return "Gemini 3.8 Flash (High)";
  if (cleanId === "gemini-3.8-flash-exp-a")
    return "Gemini 3.8 Flash (Exp)";
  if (cleanId === "gemini-3.8-flash-tiered")
    return "Gemini 3.8 Flash (Tiered)";
  if (cleanId === "gemini-3.7-flash")
    return "Gemini 3.7 Flash";
  if (cleanId === "gemini-3.7-flash-n")
    return "Gemini 3.7 Flash (High)";
  if (cleanId === "gemini-3.1-pro-low" || cleanId === "gemini-3.1-pro")
    return "Gemini 3.1 Pro";
  if (cleanId.includes("claude-opus-4-6-thinking"))
    return "Claude Opus 4.6 Thinking";
  if (cleanId.includes("claude-opus"))
    return "Claude Opus";
  if (cleanId.includes("claude-sonnet"))
    return "Claude Sonnet";
  if (cleanId === "gemini-4-argon-m" || cleanId.includes("gemini-4-argon"))
    return "Gemini 4 Argon (Medium)";
  if (cleanId.startsWith("gemini-")) {
    return cleanId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  return id;
}
function parseProto(buf) {
  const map = new Map;
  if (!buf || buf.length === 0)
    return map;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  let pos = 0;
  while (pos < b.length) {
    let key = 0;
    let shift = 0;
    while (pos < b.length) {
      const byte = b[pos++];
      key |= (byte & 127) << shift;
      if (!(byte & 128))
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
      while (pos < b.length) {
        const byte = b[pos++];
        val |= (byte & 127) << s;
        if (!(byte & 128))
          break;
        s += 7;
      }
      map.set(fieldNum, val);
    } else if (wireType === 2) {
      let len = 0;
      let s = 0;
      while (pos < b.length) {
        const byte = b[pos++];
        len |= (byte & 127) << s;
        if (!(byte & 128))
          break;
        s += 7;
      }
      if (pos + len > b.length)
        break;
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
function extractStepIdx(field2) {
  if (!field2 || field2.length === 0)
    return null;
  const b = Buffer.isBuffer(field2) ? field2 : Buffer.from(field2);
  let p = 0;
  while (p < b.length) {
    let val = 0, s = 0;
    while (p < b.length) {
      const byte = b[p++];
      val |= (byte & 127) << s;
      if (!(byte & 128))
        break;
      s += 7;
    }
    return val;
  }
  return null;
}
function extractTimestampFromStepMeta(buf) {
  if (!buf || buf.length === 0)
    return null;
  try {
    const sMap = parseProto(buf);
    const sub = sMap.get(1);
    if (sub && sub.length > 0) {
      const tMap = parseProto(sub);
      const sec = tMap.get(1);
      if (typeof sec === "number" && sec > 1e9) {
        return sec;
      }
    }
  } catch {}
  return null;
}
function formatLocalDateAndHourKeys(dateObj) {
  const yr = dateObj.getFullYear();
  const mo = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dy = String(dateObj.getDate()).padStart(2, "0");
  const hr = String(dateObj.getHours()).padStart(2, "0");
  const dateKey = `${yr}-${mo}-${dy}`;
  const hourKey = `${dateKey} ${hr}:00`;
  return { dateKey, hourKey };
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
    let totalRequests = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    let streamSum = 0;
    let streamCount = 0;
    const projectStats = {};
    const dateSeries = {};
    const hourSeries = {};
    const globalModelMap = {};
    const globalDailyModelStats = {};
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
          const stepTimeMap = new Map;
          try {
            const stepRows = db.prepare("SELECT idx, metadata FROM steps WHERE metadata IS NOT NULL").all();
            for (const sr of stepRows || []) {
              const ts = extractTimestampFromStepMeta(sr.metadata);
              if (ts)
                stepTimeMap.set(sr.idx, ts);
            }
          } catch {}
          const rows = db.prepare("SELECT data FROM gen_metadata ORDER BY idx ASC").all();
          db.close();
          db = null;
          let sIn = 0, sOut = 0, sCache = 0, sThink = 0, sTtft = 0, sStream = 0;
          let count = 0;
          const dailyBreakdown = {};
          const hourlyBreakdown = {};
          const models = {};
          const dailyModelStats = {};
          const fallbackDate = s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(st.mtimeMs);
          for (const r of rows || []) {
            const top = parseProto(r.data);
            const chat = top.has(1) ? parseProto(top.get(1)) : new Map;
            const usage = chat.has(4) ? parseProto(chat.get(4)) : new Map;
            const ttftMap = chat.has(11) ? parseProto(chat.get(11)) : new Map;
            const streamMap = chat.has(12) ? parseProto(chat.get(12)) : new Map;
            const rawModelId = chat.has(19) ? chat.get(19).toString("utf8").trim() : "unknown";
            const rawModelName = chat.has(21) ? chat.get(21).toString("utf8").trim() : "";
            const modelName = canonicalModelName(rawModelId, rawModelName);
            const inTok = usage.get(2) || 0;
            const outTok = usage.get(3) || 0;
            const cacheRead = usage.get(5) || 0;
            const thinkTok = usage.get(9) || 0;
            const ttftSec = (ttftMap.get(1) || 0) + (ttftMap.get(2) || 0) / 1e9;
            const streamSec = (streamMap.get(1) || 0) + (streamMap.get(2) || 0) / 1e9;
            sIn += inTok;
            sOut += outTok;
            sCache += cacheRead;
            sThink += thinkTok;
            sTtft += ttftSec;
            sStream += streamSec;
            count++;
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
            if (!models[modelName]) {
              models[modelName] = {
                modelId: rawModelId,
                modelName,
                inTok: 0,
                outTok: 0,
                cacheRead: 0,
                thinkTok: 0,
                streamSec: 0,
                ttftSec: 0,
                count: 0
              };
            }
            models[modelName].inTok += inTok;
            models[modelName].outTok += outTok;
            models[modelName].cacheRead += cacheRead;
            models[modelName].thinkTok += thinkTok;
            models[modelName].streamSec += streamSec;
            models[modelName].ttftSec += ttftSec;
            models[modelName].count += 1;
            if (!dailyModelStats[dateKey]) {
              dailyModelStats[dateKey] = {};
            }
            if (!dailyModelStats[dateKey][modelName]) {
              dailyModelStats[dateKey][modelName] = {
                inTok: 0,
                outTok: 0,
                cacheRead: 0,
                thinkTok: 0,
                streamSec: 0,
                ttftSec: 0,
                requests: 0
              };
            }
            dailyModelStats[dateKey][modelName].inTok += inTok;
            dailyModelStats[dateKey][modelName].outTok += outTok;
            dailyModelStats[dateKey][modelName].cacheRead += cacheRead;
            dailyModelStats[dateKey][modelName].thinkTok += thinkTok;
            dailyModelStats[dateKey][modelName].streamSec += streamSec;
            dailyModelStats[dateKey][modelName].ttftSec += ttftSec;
            dailyModelStats[dateKey][modelName].requests += 1;
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
            hourlyBreakdown,
            models,
            dailyModelStats
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
      if (entry.dailyBreakdown && Object.keys(entry.dailyBreakdown).length > 0) {
        for (const [dateKey, d] of Object.entries(entry.dailyBreakdown)) {
          if (!dateSeries[dateKey])
            dateSeries[dateKey] = { input: 0, output: 0, cache: 0, requests: 0 };
          dateSeries[dateKey].input += d.inTok;
          dateSeries[dateKey].output += d.outTok;
          dateSeries[dateKey].cache += d.cacheRead;
          dateSeries[dateKey].requests += d.requests;
        }
      } else {
        const { dateKey } = formatLocalDateAndHourKeys(s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(st.mtimeMs));
        if (!dateSeries[dateKey])
          dateSeries[dateKey] = { input: 0, output: 0, cache: 0, requests: 0 };
        dateSeries[dateKey].input += entry.inTok;
        dateSeries[dateKey].output += entry.outTok;
        dateSeries[dateKey].cache += entry.cacheRead;
        dateSeries[dateKey].requests += convReq;
      }
      if (entry.hourlyBreakdown && Object.keys(entry.hourlyBreakdown).length > 0) {
        for (const [hourKey, h] of Object.entries(entry.hourlyBreakdown)) {
          if (!hourSeries[hourKey])
            hourSeries[hourKey] = { hourKey, inputTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
          hourSeries[hourKey].inputTok += h.inTok;
          hourSeries[hourKey].outTok += h.outTok;
          hourSeries[hourKey].cacheRead += h.cacheRead;
          hourSeries[hourKey].requests += h.requests;
        }
      } else {
        const { hourKey } = formatLocalDateAndHourKeys(s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(st.mtimeMs));
        if (hourKey) {
          if (!hourSeries[hourKey])
            hourSeries[hourKey] = { hourKey, inputTok: 0, outTok: 0, cacheRead: 0, requests: 0 };
          hourSeries[hourKey].inputTok += entry.inTok;
          hourSeries[hourKey].outTok += entry.outTok;
          hourSeries[hourKey].cacheRead += entry.cacheRead;
          hourSeries[hourKey].requests += convReq;
        }
      }
      if (entry.models) {
        for (const [mName, m] of Object.entries(entry.models)) {
          if (!globalModelMap[mName]) {
            globalModelMap[mName] = {
              modelId: m.modelId,
              modelName: m.modelName,
              inTok: 0,
              outTok: 0,
              cacheRead: 0,
              thinkTok: 0,
              streamSec: 0,
              ttftSec: 0,
              count: 0
            };
          }
          globalModelMap[mName].inTok += m.inTok;
          globalModelMap[mName].outTok += m.outTok;
          globalModelMap[mName].cacheRead += m.cacheRead;
          globalModelMap[mName].thinkTok += m.thinkTok;
          globalModelMap[mName].streamSec += m.streamSec;
          globalModelMap[mName].ttftSec += m.ttftSec;
          globalModelMap[mName].count += m.count;
        }
      }
      if (entry.dailyModelStats) {
        for (const [dKey, dModels] of Object.entries(entry.dailyModelStats)) {
          if (!globalDailyModelStats[dKey])
            globalDailyModelStats[dKey] = {};
          for (const [mName, dm] of Object.entries(dModels)) {
            if (!globalDailyModelStats[dKey][mName]) {
              globalDailyModelStats[dKey][mName] = {
                inTok: 0,
                outTok: 0,
                cacheRead: 0,
                thinkTok: 0,
                streamSec: 0,
                ttftSec: 0,
                requests: 0
              };
            }
            globalDailyModelStats[dKey][mName].inTok += dm.inTok;
            globalDailyModelStats[dKey][mName].outTok += dm.outTok;
            globalDailyModelStats[dKey][mName].cacheRead += dm.cacheRead;
            globalDailyModelStats[dKey][mName].thinkTok += dm.thinkTok;
            globalDailyModelStats[dKey][mName].streamSec += dm.streamSec;
            globalDailyModelStats[dKey][mName].ttftSec += dm.ttftSec;
            globalDailyModelStats[dKey][mName].requests += dm.requests;
          }
        }
      }
    }
    if (cacheUpdated) {
      this.saveCache();
    }
    const totalRaw = totalIn + totalCache;
    const efficiency = totalRaw > 0 ? Math.round(totalCache / totalRaw * 1000) / 10 : 0;
    const avgTtft = ttftCount > 0 ? Math.round(ttftSum / ttftCount * 100) / 100 : 0;
    const avgRate = streamCount > 0 ? Math.round(streamSum / streamCount) : 0;
    const topProjects = Object.entries(projectStats).map(([projectId, stat]) => ({ projectId, conversationCount: stat.convCount, tokenCount: stat.tokenCount })).sort((a, b) => b.tokenCount - a.tokenCount).slice(0, 5);
    const timeRangeSeries = Object.entries(dateSeries).map(([date, d]) => ({ date, inputTok: d.input, outTok: d.output, cacheRead: d.cache, requests: d.requests })).sort((a, b) => a.date.localeCompare(b.date));
    const hourlySeries = Object.values(hourSeries).sort((a, b) => a.hourKey.localeCompare(b.hourKey));
    const modelDistribution = Object.values(globalModelMap).filter((m) => (m.inTok + m.outTok + m.cacheRead > 0 || m.count > 0) && m.modelName !== "Unknown Model").map((m) => ({
      modelId: m.modelId,
      modelName: m.modelName,
      totalTokens: m.inTok + m.outTok + m.cacheRead,
      inputTok: m.inTok,
      outTok: m.outTok,
      cacheRead: m.cacheRead,
      thinkTok: m.thinkTok,
      requests: m.count,
      avgTps: m.streamSec > 0 ? Math.round(m.outTok / m.streamSec) : 0,
      avgTtft: m.count > 0 ? Math.round(m.ttftSec / m.count * 100) / 100 : 0
    })).sort((a, b) => b.totalTokens - a.totalTokens);
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
      hourlySeries,
      modelDistribution,
      dailyModelStats: globalDailyModelStats
    };
  }
  getSessionDetails(convId) {
    if (!convId || !/^[0-9a-f-]{36}$/i.test(convId))
      return null;
    const dbPath = path.join(this.baseDir, "conversations", `${convId}.db`);
    if (!fs.existsSync(dbPath))
      return null;
    let db = null;
    try {
      db = openDb(dbPath);
      if (!db)
        return null;
      const rows = db.prepare("SELECT idx, data FROM gen_metadata ORDER BY idx ASC").all();
      db.close();
      db = null;
      if (!rows || rows.length === 0)
        return null;
      let totalIn = 0;
      let totalOut = 0;
      let totalCache = 0;
      let totalThink = 0;
      let ttftSum = 0;
      let streamSum = 0;
      let validCount = 0;
      const sessionModelsMap = {};
      const steps = rows.map((r) => {
        const top = parseProto(r.data);
        const chat = top.has(1) ? parseProto(top.get(1)) : new Map;
        const usage = chat.has(4) ? parseProto(chat.get(4)) : new Map;
        const ttftMap = chat.has(11) ? parseProto(chat.get(11)) : new Map;
        const streamMap = chat.has(12) ? parseProto(chat.get(12)) : new Map;
        const inTok = usage.get(2) || 0;
        const outTok = usage.get(3) || 0;
        const cacheRead = usage.get(5) || 0;
        const thinkTok = usage.get(9) || 0;
        const respTok = usage.get(10) || 0;
        const ttft = (ttftMap.get(1) || 0) + (ttftMap.get(2) || 0) / 1e9;
        const stream = (streamMap.get(1) || 0) + (streamMap.get(2) || 0) / 1e9;
        const rawModelId = chat.has(19) ? chat.get(19).toString("utf8") : "unknown";
        const rawModelName = chat.has(21) ? chat.get(21).toString("utf8") : undefined;
        const modelName = canonicalModelName(rawModelId, rawModelName);
        if (!sessionModelsMap[modelName]) {
          sessionModelsMap[modelName] = {
            modelId: rawModelId,
            modelName,
            inTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            streamSec: 0,
            ttftSec: 0
          };
        }
        sessionModelsMap[modelName].inTok += inTok;
        sessionModelsMap[modelName].outTok += outTok;
        sessionModelsMap[modelName].cacheRead += cacheRead;
        sessionModelsMap[modelName].thinkTok += thinkTok;
        sessionModelsMap[modelName].requests += 1;
        sessionModelsMap[modelName].streamSec += stream;
        sessionModelsMap[modelName].ttftSec += ttft;
        totalIn += inTok;
        totalOut += outTok;
        totalCache += cacheRead;
        totalThink += thinkTok;
        if (ttft > 0) {
          ttftSum += ttft;
          validCount++;
        }
        if (stream > 0 && outTok > 0) {
          streamSum += outTok / stream;
        }
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
      const efficiency = totalRaw > 0 ? Math.round(totalCache / totalRaw * 1000) / 10 : 0;
      const avgTtft = validCount > 0 ? Math.round(ttftSum / validCount * 100) / 100 : 0;
      const avgRate = validCount > 0 ? Math.round(streamSum / validCount) : 0;
      const models = Object.values(sessionModelsMap).filter((m) => m.inTok + m.outTok + m.cacheRead > 0 && !m.modelName.toLowerCase().includes("unknown")).map((m) => ({
        modelId: m.modelId,
        modelName: m.modelName,
        totalTokens: m.inTok + m.outTok + m.cacheRead,
        inputTok: m.inTok,
        outTok: m.outTok,
        cacheRead: m.cacheRead,
        thinkTok: m.thinkTok,
        requests: m.requests,
        avgTps: m.streamSec > 0 ? Math.round(m.outTok / m.streamSec) : 0,
        avgTtft: m.requests > 0 ? Math.round(m.ttftSec / m.requests * 100) / 100 : 0
      })).sort((a, b) => b.totalTokens - a.totalTokens);
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
        steps,
        models
      };
    } catch {
      if (db)
        db.close();
      return null;
    }
  }
}
export {
  GlobalAnalyticsEngine
};
