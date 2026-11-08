// Backend for Chuanban Theme & Metrics Sidecar
// Hosts Sidecar Web UI & Supervises CDP Theme Injection + Live Metrics into Antigravity

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Defensive fallback for local debugging outside Antigravity host
if (!process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
  process.env.ANTIGRAVITY_SIDECAR_WEB_PORT = '51980';
  process.env.ANTIGRAVITY_LS_ADDRESS = process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:5387';
  process.env.ANTIGRAVITY_CSRF_TOKEN = process.env.ANTIGRAVITY_CSRF_TOKEN || 'local-test';
}

import { SidecarApp, Response } from 'sidecar_sdk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../..');
const CORE_DIR = path.join(ROOT_DIR, 'core');
const TEMPLATE_USER_DIR = path.join(ROOT_DIR, 'user');
const USER_DIR = process.env.PLUGIN_DATA ||
  process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR ||
  TEMPLATE_USER_DIR;
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const CONVERSATIONS_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');

function initDataDirectory() {
  try {
    if (!fs.existsSync(USER_DIR)) {
      fs.mkdirSync(USER_DIR, { recursive: true });
    }
    const filesToSeed = ['config.json', 'custom.css', 'custom.js', 'i18n.override.json'];
    for (const file of filesToSeed) {
      const dest = path.join(USER_DIR, file);
      const src = path.join(TEMPLATE_USER_DIR, file);
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch (err) {
    console.error('[Sidecar Engine] Failed to initialize data directory:', err);
  }
}
initDataDirectory();

// ============================================================================
// 0. 动态探测 node:sqlite 与全量分析引擎支持
// ============================================================================
let DatabaseSync = null;
try {
  const sqliteMod = await import('node:sqlite').catch(() => null);
  if (sqliteMod && typeof sqliteMod.DatabaseSync === 'function') {
    DatabaseSync = sqliteMod.DatabaseSync;
  }
} catch {
  DatabaseSync = null;
}

let analyticsEngine = null;
try {
  const aggrMod = await import('./dist/aggregator.js').catch(() => null);
  if (aggrMod && aggrMod.GlobalAnalyticsEngine) {
    analyticsEngine = new aggrMod.GlobalAnalyticsEngine(path.join(os.homedir(), '.gemini', 'antigravity'));
  }
} catch (e) {
  console.error('[Sidecar Engine] Failed to load analytics engine:', e);
}

let lastGlobalActiveCascadeId = '';

// ============================================================================
// 1. 基础辅助函数
// ============================================================================
function readJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readTextSafe(filePath, fallback = '') {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function getFileMtimeSig(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '0:0';
    const st = fs.statSync(filePath);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return '0:0';
  }
}

function normalizeOverrideDict(rawObj) {
  if (!rawObj || typeof rawObj !== 'object') return {};
  const source = rawObj.exact && typeof rawObj.exact === 'object' ? rawObj.exact : rawObj;
  const clean = {};
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string') clean[k] = v;
  }
  return clean;
}

// ============================================================================
// 1.1 字体与排版动态计算引擎 (Typography & Layout Engine)
// ============================================================================
let cachedSystemFonts = null;

async function getSystemFonts() {
  if (cachedSystemFonts && cachedSystemFonts.length > 0) {
    return cachedSystemFonts;
  }

  const fontSet = new Set([
    'Anthropic Sans',
    'Anthropic Mono',
    'Sarasa UI SC',
    '更纱黑体 UI SC',
    'Sarasa Mono Slab SC',
    '等距更纱黑体 Slab SC',
    'PingFang SC',
    'LXGW WenKai',
    'JetBrains Mono',
    'Fira Code'
  ]);

  // 1. 优先通过已连接的主渲染窗口 CDP 查询本地安装字体
  for (const [, entry] of attachedTargets.entries()) {
    if (entry.send) {
      try {
        const res = await entry.send('Runtime.evaluate', {
          expression: `(async () => {
            if (typeof window.queryLocalFonts !== 'function') return [];
            const fonts = await window.queryLocalFonts();
            return Array.from(new Set(fonts.map(f => f.family))).filter(Boolean);
          })()`,
          awaitPromise: true,
          returnByValue: true
        });
        const cdpFonts = res?.result?.result?.value;
        if (Array.isArray(cdpFonts) && cdpFonts.length > 0) {
          for (const f of cdpFonts) fontSet.add(f);
        }
      } catch (e) {}
    }
  }

  // 2. 补充 fc-list 探测（针对 macOS / Linux CLI 环境）
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync('fc-list : family', { encoding: 'utf8', timeout: 1200 });
    const fcFonts = out
      .split('\n')
      .flatMap((l) => l.split(','))
      .map((f) => f.trim())
      .filter((f) => f && !f.startsWith('.'));
    for (const f of fcFonts) fontSet.add(f);
  } catch (e) {}

  cachedSystemFonts = Array.from(fontSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return cachedSystemFonts;
}

function resolveTypographyVars(typography = {}) {
  const primaryKey = (typography.primarySans || 'default').trim();
  const fallbackKey = (typography.fallbackSans || 'default').trim();
  const isCustomSans = primaryKey !== 'default' || fallbackKey !== 'default';

  let fullSans = '';
  if (isCustomSans) {
    let primarySans = '';
    if (primaryKey === 'default') {
      primarySans = 'system-ui, -apple-system, BlinkMacSystemFont';
    } else if (primaryKey === 'custom') {
      primarySans = (typography.customPrimarySans || '').trim() || 'system-ui';
    } else {
      primarySans = `'${primaryKey.replace(/'/g, '')}'`;
    }

    let fallbackSans = '';
    if (fallbackKey === 'default') {
      fallbackSans = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei'";
    } else if (fallbackKey === 'custom') {
      fallbackSans = (typography.customFallbackSans || '').trim() || "'PingFang SC'";
    } else {
      const cleanKey = fallbackKey.replace(/'/g, '');
      const baseKey = cleanKey.replace(/\s+(Regular|Medium|Bold|Light|Thin|SemiBold|Heavy|Black|W[0-9]+)$/i, '').trim();
      if (baseKey && baseKey !== cleanKey) {
        fallbackSans = `'${cleanKey}', '${baseKey}'`;
      } else {
        fallbackSans = `'${cleanKey}'`;
      }
    }

    // 严密完备的标准中文无衬线回退链，防止非标准字重名称导致意外回退到日文粗黑体
    fullSans = `${primarySans}, ${fallbackSans}, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  }

  const monoKey = (typography.mono || 'default').trim();
  const isCustomMono = monoKey !== 'default';
  let mono = '';
  if (isCustomMono) {
    if (monoKey === 'custom') {
      mono = `${(typography.customMono || '').trim() || 'ui-monospace'}, ui-monospace, monospace`;
    } else {
      mono = `'${monoKey.replace(/'/g, '')}', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`;
    }
  }

  const fontSize = Number(typography.fontSize) || 16;
  const fontSizePx = `${fontSize}px`;

  const vars = {
    '--ag-cfg-chat-font-size': fontSizePx,
    '--ag-chat-font-size': fontSizePx
  };

  if (isCustomSans) {
    vars['--ag-cfg-font-sans'] = fullSans;
    vars['--font-sans'] = fullSans;
  } else {
    vars['--ag-cfg-font-sans'] = '';
    vars['--font-sans'] = '';
  }

  if (isCustomMono) {
    vars['--ag-cfg-font-mono'] = mono;
  } else {
    vars['--ag-cfg-font-mono'] = '';
  }

  return vars;
}

function resolveThemeAttrs(userCfg = {}) {
  const composer = userCfg.composer || {};
  const lightPreset = userCfg.presets?.light || userCfg.lightPreset || 'high-contrast';
  const darkPreset = userCfg.presets?.dark || userCfg.darkPreset || 'claude-dark';
  const typography = userCfg.typography || {};

  const primaryKey = (typography.primarySans || 'default').trim();
  const fallbackKey = (typography.fallbackSans || 'default').trim();
  const isCustomSans = primaryKey !== 'default' || fallbackKey !== 'default';
  const isCustomMono = (typography.mono || 'default').trim() !== 'default';

  return {
    'data-ag-wax-seal': composer.waxSeal === false ? 'off' : 'on',
    'data-ag-collinear': composer.collinear === false ? 'off' : 'on',
    'data-ag-hide-arrows': composer.hideArrows === false ? 'off' : 'on',
    'data-ag-light-preset': lightPreset,
    'data-ag-dark-preset': darkPreset,
    'data-ag-custom-font': isCustomSans ? 'true' : null,
    'data-ag-custom-mono': isCustomMono ? 'true' : null,
    'data-ag-custom-font-size': 'true'
  };
}

async function applyLiveConfigToTargets(userCfg, bundleChanged = false) {
  const vars = resolveTypographyVars(userCfg.typography);
  const attrs = resolveThemeAttrs(userCfg);
  const telemetryEnabled = userCfg.telemetry?.enabled !== false;

  const hotCode = `(function() {
    const vars = ${JSON.stringify(vars)};
    for (const [k, v] of Object.entries(vars)) {
      if (v) document.documentElement.style.setProperty(k, v);
      else document.documentElement.style.removeProperty(k);
    }
    const attrs = ${JSON.stringify(attrs)};
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined) document.documentElement.removeAttribute(k);
      else document.documentElement.setAttribute(k, v);
    }
    if (typeof window.__ag_sync_color_scheme_fn === 'function') {
      window.__ag_sync_color_scheme_fn();
    }
    const pill = document.getElementById('ag-live-metrics-pill');
    if (pill && !${telemetryEnabled}) {
      pill.style.display = 'none';
    }
  })()`;

  for (const [, entry] of attachedTargets.entries()) {
    if (entry.send) {
      try {
        await entry.send('Runtime.evaluate', { expression: hotCode, returnByValue: true });
        if (bundleChanged) {
          await entry.send('Page.addScriptToEvaluateOnNewDocument', { source: cachedInjectScript });
          if (entry.inject) await entry.inject();
        }
        if (telemetryEnabled && entry.syncMetricsForSession) {
          await entry.syncMetricsForSession(true);
        }
      } catch (e) {}
    }
  }
}

// ============================================================================
// 2. 会话指标 SQLite + Protobuf 解析引擎
// ============================================================================
const metricsCache = new Map();
const MAX_METRICS_CACHE_SIZE = 30;

function setMetricsCache(dbPath, entry) {
  if (metricsCache.has(dbPath)) metricsCache.delete(dbPath);
  metricsCache.set(dbPath, entry);
  if (metricsCache.size > MAX_METRICS_CACHE_SIZE) {
    const oldestKey = metricsCache.keys().next().value;
    if (oldestKey) metricsCache.delete(oldestKey);
  }
}

function parseProto(buf) {
  let i = 0;
  const out = new Map();
  while (i < buf.length) {
    let tag = 0;
    let shift = 0;
    while (i < buf.length) {
      const b = buf[i++];
      tag |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    const fn = tag >>> 3;
    const wt = tag & 7;
    if (fn <= 0 || fn > 10000) break;
    if (wt === 0) {
      let val = 0;
      let s = 0;
      while (i < buf.length) {
        const b = buf[i++];
        val += (b & 0x7f) * Math.pow(2, s);
        if (!(b & 0x80)) break;
        s += 7;
      }
      out.set(fn, val);
    } else if (wt === 2) {
      let len = 0;
      let s = 0;
      while (i < buf.length) {
        const b = buf[i++];
        len |= (b & 0x7f) << s;
        if (!(b & 0x80)) break;
        s += 7;
      }
      if (len < 0 || i + len > buf.length) break;
      out.set(fn, buf.subarray(i, i + len));
      i += len;
    } else if (wt === 1) {
      if (i + 8 > buf.length) break;
      out.set(fn, buf.subarray(i, i + 8));
      i += 8;
    } else if (wt === 5) {
      if (i + 4 > buf.length) break;
      out.set(fn, buf.subarray(i, i + 4));
      i += 4;
    } else {
      break;
    }
  }
  return out;
}

function fmtTok(n) {
  if (!n || n <= 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function fmtNum(n) {
  return (n || 0).toLocaleString('en-US');
}

function getDbSignature(cascadeId, conversationsDir) {
  try {
    const dbPath = path.join(conversationsDir, `${cascadeId}.db`);
    if (!fs.existsSync(dbPath)) return null;
    const st = fs.statSync(dbPath);
    let walSig = '0:0';
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      const wst = fs.statSync(walPath);
      walSig = `${wst.mtimeMs}:${wst.size}`;
    }
    return `${st.mtimeMs}:${st.size}|${walSig}`;
  } catch {
    return null;
  }
}

function parseConversationMetrics(cascadeId, conversationsDir) {
  if (!DatabaseSync) return null;
  if (!cascadeId || !/^[0-9a-f-]{36}$/i.test(cascadeId)) return null;
  const dbPath = path.join(conversationsDir, `${cascadeId}.db`);
  const sig = getDbSignature(cascadeId, conversationsDir);
  if (!sig) return { cascadeId, hasData: false };

  const cached = metricsCache.get(dbPath);
  if (cached && cached.sig === sig) {
    return cached.payload;
  }

  const contextLimitTokens = activeConfig.contextLimit || 256000;
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
    if (!rows || rows.length === 0) {
      db.close();
      db = null;
      const emptyPayload = { cascadeId, hasData: false, sig };
      setMetricsCache(dbPath, { sig, payload: emptyPayload });
      return emptyPayload;
    }
    const userStat = db
      .prepare('SELECT COUNT(*) AS cnt, COALESCE(MAX(idx), -1) AS lastIdx FROM steps WHERE step_type = 14')
      .get();
    const lastUserStepIdx = userStat?.lastIdx ?? -1;
    const userStepsCount = userStat?.cnt ?? 0;
    const turnStat = db
      .prepare('SELECT COUNT(*) AS cnt FROM steps WHERE step_type = 15 AND idx > ?')
      .get(lastUserStepIdx);
    const rawTurnSteps = turnStat?.cnt ?? 0;
    db.close();
    db = null;

    let totalIn = 0;
    let totalCache = 0;
    let totalOut = 0;
    let totalThink = 0;
    let totalResp = 0;

    const parsed = rows.map((r) => {
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
      totalCache += cacheRead;
      totalOut += outTok;
      totalThink += thinkTok;
      totalResp += respTok;

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

    const valid = parsed.filter((p) => p.ctx > 0 || p.outTok > 0);
    if (valid.length === 0) {
      const emptyPayload = { cascadeId, hasData: false, sig };
      setMetricsCache(dbPath, { sig, payload: emptyPayload });
      return emptyPayload;
    }

    const turnSlice = rawTurnSteps > 0 ? valid.slice(-rawTurnSteps) : [];
    const turnSteps = turnSlice.length;
    let turnOut = 0;
    let turnThink = 0;
    let turnResp = 0;
    let turnDur = 0;
    for (let i = 0; i < turnSlice.length; i++) {
      turnOut += turnSlice[i].outTok;
      turnThink += turnSlice[i].thinkTok;
      turnResp += turnSlice[i].respTok;
      turnDur += turnSlice[i].totDur;
    }

    const last = valid[valid.length - 1];
    const streamTps = last.stream >= 0.25 ? last.outTok / last.stream : 0;
    const e2eTps = last.totDur > 0 ? last.outTok / last.totDur : 0;
    const displayTps = streamTps > 0 && streamTps <= 600 ? streamTps : e2eTps;
    const ctxPct = Math.round((last.ctx / contextLimitTokens) * 100);
    const ctxClass = ctxPct >= 90 ? 'ag-ctx-crit' : ctxPct >= 75 ? 'ag-ctx-warn' : 'ag-ctx-ok';
    const lastCacheRate = last.ctx > 0 ? ((last.cacheRead / last.ctx) * 100).toFixed(1) : '0.0';
    const sessionCacheRate = totalIn + totalCache > 0 ? ((totalCache / (totalIn + totalCache)) * 100).toFixed(1) : '0.0';
    const remainCtx = Math.max(0, contextLimitTokens - last.ctx);
    const limitKStr = Math.round(contextLimitTokens / 1000) + 'k';

    const inlineHtml = [
      `<span>${Math.round(displayTps)} tok/s</span>`,
      `<span class="ag-sep">·</span>`,
      `<span>TTFT ${last.ttft.toFixed(1)}s</span>`,
      `<span class="ag-sep">·</span>`,
      `<span>Ctx ${fmtTok(last.ctx)}/${limitKStr} <span class="${ctxClass}">(${ctxPct}%)</span></span>`,
      `<span class="ag-sep">·</span>`,
      `<span>Out ${fmtTok(last.outTok)}</span>`
    ].join('');

    const turnRowHtml =
      turnSteps > 1
        ? `<div class="ag-tt-row"><span class="ag-tt-lbl">本轮合计 (${turnSteps}步)</span><span class="ag-tt-val">输出 ${fmtNum(turnOut)} (思考 ${fmtNum(turnThink)} + 响应 ${fmtNum(turnResp)}) | 耗时 ${turnDur.toFixed(1)}s</span></div>`
        : '';

    const tooltipHtml = [
      `<div class="ag-tt-hdr">本轮最新调用 (Gen #${last.idx + 1})</div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">生成速度</span><span class="ag-tt-val">${streamTps > 0 && streamTps <= 600 ? `流式 ${streamTps.toFixed(1)} tok/s | ` : ''}端到端 ${e2eTps.toFixed(1)} tok/s</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">响应耗时</span><span class="ag-tt-val">TTFT ${last.ttft.toFixed(2)}s | 流式 ${last.stream.toFixed(2)}s | 总计 ${last.totDur.toFixed(2)}s</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">当前上下文</span><span class="ag-tt-val">${fmtNum(last.ctx)} (新增 ${fmtNum(last.inTok)} + 缓存 ${fmtNum(last.cacheRead)}, ${lastCacheRate}%)</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">本步输出量</span><span class="ag-tt-val">${fmtNum(last.outTok)} (思考链 ${fmtNum(last.thinkTok)} + 正文/工具 ${fmtNum(last.respTok)})</span></div>`,
      turnRowHtml,
      `<div class="ag-tt-hdr ag-tt-sec">当前会话累计 (${userStepsCount} 轮提问 / ${valid.length} 次有效调用)</div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">压缩水位线</span><span class="ag-tt-val">${fmtTok(last.ctx)} / ${limitKStr} (${ctxPct}%) · 距压缩余 ${fmtTok(remainCtx)}</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">累计输入量</span><span class="ag-tt-val">新增 ${fmtTok(totalIn)} + 缓存读取 ${fmtTok(totalCache)} (命中率 ${sessionCacheRate}%)</span></div>`,
      `<div class="ag-tt-row"><span class="ag-tt-lbl">累计输出量</span><span class="ag-tt-val">总计 ${fmtTok(totalOut)} (思考链 ${fmtTok(totalThink)} + 正文/工具 ${fmtTok(totalResp)})</span></div>`
    ].join('');

    const payload = {
      cascadeId,
      hasData: true,
      sig,
      displayTps: Math.round(displayTps),
      ttft: last.ttft,
      ctxTok: last.ctx,
      ctxPct,
      outTok: last.outTok,
      inlineHtml,
      tooltipHtml
    };
    setMetricsCache(dbPath, { sig, payload });
    return payload;
  } catch {
    if (cached && cached.payload) return cached.payload;
    return { cascadeId, hasData: false };
  } finally {
    try {
      db?.close();
    } catch {}
  }
}

// ============================================================================
// 3. 载荷构建与热重载
// ============================================================================
const BASE_VERSION = '20261108-v5.1.0-sidecar';
let cachedBundleSig = '';
let cachedInjectScript = '';
let cachedPatchVersion = '';
let currentCssBytes = 0;
let lastDetectedPort = null;
let latestMetrics = null;

let activeConfig = {
  enabled: true,
  channel: 'auto',
  preset: 'high-contrast',
  presets: { light: 'high-contrast', dark: 'claude-dark' },
  contextLimit: 256000,
  modules: {
    i18n: true,
    metrics: true,
    composerWaxSeal: true,
    deadlockHealer: true,
    customCss: true,
    customJs: true
  },
  themeVars: {},
  allowedOrigins: ['http://127.0.0.1', 'https://127.0.0.1', 'http://localhost', 'https://localhost', 'vscode-file://']
};

function rebuildBundleIfNeeded(force = false) {
  const coreFiles = [
    path.join(CORE_DIR, 'theme.css'),
    path.join(CORE_DIR, 'i18n.json'),
    path.join(CORE_DIR, 'runtime.js')
  ];
  const userFiles = [
    path.join(USER_DIR, 'config.json'),
    path.join(USER_DIR, 'custom.css'),
    path.join(USER_DIR, 'i18n.override.json'),
    path.join(USER_DIR, 'custom.js')
  ];

  const sig = [...coreFiles, ...userFiles].map(getFileMtimeSig).join('|') + `|force:${force}`;
  if (!force && sig === cachedBundleSig && cachedInjectScript) {
    return false;
  }

  const userCfg = readJsonSafe(path.join(USER_DIR, 'config.json'), {});
  const enabled = userCfg.enabled !== false;
  const channel = userCfg.channel || 'auto';
  const language = userCfg.language || 'default';
  const presets = Object.assign(
    {
      light: userCfg.presets?.light || userCfg.lightPreset || 'high-contrast',
      dark: userCfg.presets?.dark || userCfg.darkPreset || 'claude-dark'
    },
    userCfg.presets && typeof userCfg.presets === 'object' ? userCfg.presets : {}
  );
  const preset = presets.light;
  const contextLimit = Number(userCfg.contextLimit) > 0 ? Number(userCfg.contextLimit) : 256000;

  const rawModules = Object.assign({}, userCfg.features || {}, userCfg.modules || {});
  if (typeof rawModules.metricsCapsule === 'boolean' && typeof rawModules.metrics !== 'boolean') {
    rawModules.metrics = rawModules.metricsCapsule;
  }
  const modules = Object.assign(
    {
      i18n: language === 'zh-CN',
      metrics: true,
      composerWaxSeal: true,
      composerCollinear: true,
      composerHideArrows: true,
      deadlockHealer: true,
      customCss: true,
      customJs: true
    },
    rawModules
  );
  modules.i18n = language === 'zh-CN';
  if (userCfg.composer) {
    if (typeof userCfg.composer.waxSeal === 'boolean') modules.composerWaxSeal = userCfg.composer.waxSeal;
    if (typeof userCfg.composer.collinear === 'boolean') modules.composerCollinear = userCfg.composer.collinear;
    if (typeof userCfg.composer.hideArrows === 'boolean') modules.composerHideArrows = userCfg.composer.hideArrows;
  }
  if (userCfg.telemetry && typeof userCfg.telemetry.enabled === 'boolean') {
    modules.metrics = userCfg.telemetry.enabled;
  }
  if (!DatabaseSync) modules.metrics = false;
  modules.metricsCapsule = modules.metrics;

  const typoVars = resolveTypographyVars(userCfg.typography);
  const themeVars = Object.assign({}, typoVars, userCfg.themeVars && typeof userCfg.themeVars === 'object' ? userCfg.themeVars : {});

  activeConfig = {
    enabled,
    channel,
    language,
    preset,
    presets,
    contextLimit,
    modules,
    themeVars,
    selectors: userCfg.selectors || {},
    allowedOrigins: Array.isArray(userCfg.allowedOrigins)
      ? userCfg.allowedOrigins
      : ['http://127.0.0.1', 'https://127.0.0.1', 'http://localhost', 'https://localhost', 'vscode-file://']
  };

  const baseCss = readTextSafe(path.join(CORE_DIR, 'theme.css'), '');
  const customCss = modules.customCss ? readTextSafe(path.join(USER_DIR, 'custom.css'), '') : '';
  currentCssBytes = Buffer.byteLength(baseCss, 'utf8') + Buffer.byteLength(customCss, 'utf8');

  const baseDict = readJsonSafe(path.join(CORE_DIR, 'i18n.json'), {});
  const rawOverrideDict = readJsonSafe(path.join(USER_DIR, 'i18n.override.json'), {});
  const overrideDict = normalizeOverrideDict(rawOverrideDict);
  const mergedDict = Object.assign({}, baseDict, overrideDict);

  const customJs = modules.customJs ? readTextSafe(path.join(USER_DIR, 'custom.js'), '') : '';
  const runtimeTemplate = readTextSafe(path.join(CORE_DIR, 'runtime.js'), '');

  const hash = crypto
    .createHash('sha256')
    .update(String(enabled))
    .update(runtimeTemplate)
    .update(baseCss)
    .update(customCss)
    .update(JSON.stringify(mergedDict))
    .update(customJs)
    .update(JSON.stringify({ preset, presets, modules, themeVars, selectors: activeConfig.selectors }))
    .digest('hex')
    .slice(0, 8);

  cachedPatchVersion = `${BASE_VERSION}-${hash}`;

  const bootPayload = {
    version: cachedPatchVersion,
    platform: process.platform,
    enabled,
    language,
    preset,
    presets,
    cssText: baseCss,
    customCss,
    themeVars,
    i18nDict: mergedDict,
    modules,
    features: modules,
    selectors: activeConfig.selectors,
    config: {
      enabled,
      channel,
      preset,
      presets,
      contextLimit,
      modules,
      themeVars
    },
    customJs
  };

  cachedInjectScript = runtimeTemplate.replace('})(__AG_BOOT_PAYLOAD__);', () => `})(${JSON.stringify(bootPayload)});`);
  cachedBundleSig = sig;
  return true;
}

rebuildBundleIfNeeded();

// ============================================================================
// 4. CDP 目标发现与 WebSocket 会话挂载
// ============================================================================
const attachedTargets = new Map();

function resolvePortFilePath() {
  if (process.env.AGY_BROWSER_ACTIVE_PORT_FILE && fs.existsSync(process.env.AGY_BROWSER_ACTIVE_PORT_FILE)) {
    return process.env.AGY_BROWSER_ACTIVE_PORT_FILE;
  }
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort');
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Antigravity', 'DevToolsActivePort');
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    return path.join(xdgConfig, 'Antigravity', 'DevToolsActivePort');
  }
}

function readPort() {
  if (process.env.AGY_BROWSER_WS_URL) {
    try {
      const u = new URL(process.env.AGY_BROWSER_WS_URL);
      const port = parseInt(u.port, 10);
      if (Number.isFinite(port) && port > 0) return port;
    } catch {}
  }
  try {
    const portFile = resolvePortFilePath();
    if (fs.existsSync(portFile)) {
      const raw = fs.readFileSync(portFile, 'utf8').trim();
      const lines = raw.split(/\r?\n/);
      const port = parseInt(lines[0], 10);
      if (Number.isFinite(port) && port > 0) return port;
    }
  } catch {}
  return 9222;
}

function fetchTargets(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/json/list', timeout: 1500 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
  });
}

function isAllowedOrigin(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  return activeConfig.allowedOrigins.some((prefix) => urlStr.startsWith(prefix));
}

function attachTarget(target) {
  const wsUrl = target.webSocketDebuggerUrl;
  if (!wsUrl) return Promise.resolve(false);

  return new Promise((resolveAttach) => {
    let settled = false;
    const finishAttach = (ok) => {
      if (!settled) {
        settled = true;
        resolveAttach(ok);
      }
    };
    const attachTimeout = setTimeout(() => finishAttach(false), 2500);

    try {
      const ws = new WebSocket(wsUrl);
      let msgId = 1;
      let activeCascadeId = '';
      let lastPushedHash = '';
      const pendingCallbacks = new Map();

      const send = (method, params = {}) =>
        new Promise((resolve) => {
          if (ws.readyState !== WebSocket.OPEN) return resolve(null);
          const id = msgId++;
          const timer = setTimeout(() => {
            pendingCallbacks.delete(id);
            resolve(null);
          }, 2500);
          pendingCallbacks.set(id, (msg) => {
            clearTimeout(timer);
            resolve(msg);
          });
          ws.send(JSON.stringify({ id, method, params }));
        });

      const inject = async () => {
        const res = await send('Runtime.evaluate', {
          expression: cachedInjectScript,
          returnByValue: true
        });
        if (res?.error || res?.result?.exceptionDetails) {
          console.error(`[Sidecar Engine] Injection failed on ${target.id}`);
          return false;
        } else {
          console.log(`[Sidecar Engine] Injected (${cachedPatchVersion}) into target ${target.id}`);
          return true;
        }
      };

      const syncMetricsForSession = async (force = false) => {
        if (!DatabaseSync || !activeConfig.modules.metrics || !activeConfig.enabled) return;

        if (!activeCascadeId || force) {
          const evalRes = await send('Runtime.evaluate', {
            expression: `(function(){
              if (window.__ag_watched_cascade_id) return window.__ag_watched_cascade_id;
              const m = window.location.pathname.match(/\\/c\\/([0-9a-f-]{36})/i);
              if (m) return m[1];
              const el = document.querySelector('[data-testid=conversation-row-sidebar][data-selected=true]');
              return el ? (el.getAttribute('data-cascade-id') || '') : '';
            })()`,
            returnByValue: true
          });
          const cid = String(evalRes?.result?.result?.value || evalRes?.result?.value || '').trim();
          if (/^[0-9a-f-]{36}$/i.test(cid)) {
            activeCascadeId = cid;
            lastGlobalActiveCascadeId = cid;
          }
        }

        if (!activeCascadeId) return;

        const dbSig = getDbSignature(activeCascadeId, CONVERSATIONS_DIR);
        const sessionKey = `${activeCascadeId}:${dbSig}`;
        if (!force && sessionKey === lastPushedHash) return;

        const metrics = parseConversationMetrics(activeCascadeId, CONVERSATIONS_DIR);
        if (!metrics) return;

        latestMetrics = metrics;

        await send('Runtime.evaluate', {
          expression: `(function(){
            if (typeof window.__ag_render_metrics === 'function') {
              window.__ag_render_metrics(${JSON.stringify(metrics)});
            }
          })()`,
          returnByValue: true
        });
        lastPushedHash = sessionKey;
      };

      const checkAndInject = async () => {
        try {
          const checkRes = await send('Runtime.evaluate', {
            expression:
              'window.__ag_patch_version === ' +
              JSON.stringify(cachedPatchVersion) +
              ' && (' +
              JSON.stringify(!activeConfig.enabled) +
              ' || !!document.getElementById("ag-custom-fonts"))',
            returnByValue: true
          });
          const isUpToDate = checkRes?.result?.result?.value === true || checkRes?.result?.value === true;
          if (!isUpToDate) {
            await inject();
            await syncMetricsForSession(true);
          }
        } catch {}
      };

      let initialAttachDone = false;

      ws.addEventListener('open', async () => {
        console.log(`[Sidecar Engine] Attached target: ${target.id} (${target.title || 'Untitled'})`);
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Runtime.addBinding', { name: '__agRequestMetrics' });
        await send('Runtime.addBinding', { name: '__ag_on_session_change' });
        await send('Page.addScriptToEvaluateOnNewDocument', { source: cachedInjectScript });
        const ok = await inject();
        await syncMetricsForSession(true);
        initialAttachDone = true;

        attachedTargets.set(target.id, {
          id: target.id,
          title: target.title || '',
          url: target.url || '',
          ws,
          send,
          inject,
          checkAndInject,
          syncMetricsForSession
        });
        clearTimeout(attachTimeout);
        finishAttach(ok);
      });

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.id && pendingCallbacks.has(msg.id)) {
            const cb = pendingCallbacks.get(msg.id);
            pendingCallbacks.delete(msg.id);
            cb(msg);
            return;
          }
          if (
            msg.method === 'Runtime.bindingCalled' &&
            (msg.params?.name === '__agRequestMetrics' || msg.params?.name === '__ag_on_session_change')
          ) {
            const nextId = String(msg.params.payload || '').trim();
            if (/^[0-9a-f-]{36}$/i.test(nextId)) {
              activeCascadeId = nextId;
              lastPushedHash = '';
              syncMetricsForSession(true);
            }
          }
        } catch {}
      });

      const closeHandler = () => {
        clearTimeout(attachTimeout);
        for (const [, cb] of pendingCallbacks) cb(null);
        pendingCallbacks.clear();
        attachedTargets.delete(target.id);
        finishAttach(false);
      };
      ws.addEventListener('close', closeHandler);
      ws.addEventListener('error', closeHandler);
    } catch {
      finishAttach(false);
    }
  });
}

// ============================================================================
// 5. 定时轮询与同步
// ============================================================================
let isSyncing = false;
async function syncCdp(force = false) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const bundleChanged = rebuildBundleIfNeeded(force);
    const port = readPort();
    lastDetectedPort = port;
    if (!port) return;

    const targets = await fetchTargets(port);
    if (!Array.isArray(targets) || targets.length === 0) return;

    // 过滤页面：针对 Antigravity 宿主主窗口（排查 devtools 和 Launchpad）
    // 注意：不得加入 !t.url.includes('theme-engine')，否则侧边栏打开时主窗口 URL 带 tab 参数会被误判剔除！
    const pages = targets.filter(
      (t) =>
        t.type === 'page' &&
        t.webSocketDebuggerUrl &&
        !String(t.url || '').startsWith('devtools://') &&
        isAllowedOrigin(t.url) &&
        !String(t.title || '').includes('Launchpad')
    );

    const activeTargetIds = new Set();
    const attachPromises = [];

    for (const page of pages) {
      activeTargetIds.add(page.id);
      if (!attachedTargets.has(page.id)) {
        attachPromises.push(attachTarget(page));
      } else {
        const entry = attachedTargets.get(page.id);
        if (bundleChanged && entry.send) {
          await entry.send('Page.addScriptToEvaluateOnNewDocument', { source: cachedInjectScript });
          await entry.inject();
          if (entry.syncMetricsForSession) await entry.syncMetricsForSession(true);
        } else if (entry.checkAndInject) {
          await entry.checkAndInject();
        }
        if (entry.syncMetricsForSession) {
          await entry.syncMetricsForSession(false);
        }
      }
    }

    if (attachPromises.length > 0) {
      await Promise.allSettled(attachPromises);
    }

    // 清理已销毁的连接
    for (const [id, entry] of attachedTargets.entries()) {
      if (!activeTargetIds.has(id)) {
        try {
          entry.ws.close();
        } catch {}
        attachedTargets.delete(id);
      }
    }
  } catch (err) {
    console.error('[Sidecar Engine] Sync error:', err);
  } finally {
    isSyncing = false;
  }
}

// ============================================================================
// 6. SidecarApp Web UI 服务
// ============================================================================
const app = new SidecarApp();

app.page('/', () => readTextSafe(path.join(HERE, 'index.html'), ''));
app.api('/app.js', () => new Response(readTextSafe(path.join(HERE, 'app.js'), ''), {
  contentType: 'application/javascript',
  headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
}), 'GET');
app.api('/styles.css', () => new Response(readTextSafe(path.join(HERE, 'styles.css'), ''), {
  contentType: 'text/css',
  headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
}), 'GET');
app.api('/logo.svg', () => new Response(readTextSafe(path.join(ASSETS_DIR, 'logo.svg'), ''), { contentType: 'image/svg+xml' }), 'GET');

// GET /api/analytics/overview
app.api('/api/analytics/overview', () => {
  if (!analyticsEngine) {
    return { ok: false, error: 'Analytics engine unavailable' };
  }
  try {
    const data = analyticsEngine.getGlobalOverview();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}, 'GET');

// GET /api/analytics/conversations
app.api('/api/analytics/conversations', () => {
  if (!analyticsEngine) {
    return { ok: false, error: 'Analytics engine unavailable' };
  }
  try {
    const summaries = analyticsEngine.getSummaries();
    return { ok: true, conversations: summaries.slice(0, 50) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}, 'GET');

// GET /api/analytics/session
app.api('/api/analytics/session', (data) => {
  if (!analyticsEngine) {
    return { ok: false, error: 'Analytics engine unavailable' };
  }
  const convId = data?.id || data?.conversationId || lastGlobalActiveCascadeId;
  if (!convId) {
    return { ok: false, error: 'No active session detected' };
  }
  try {
    const sessionData = analyticsEngine.getSessionDetails(convId);
    if (!sessionData) {
      return { ok: false, error: 'No metrics found for this session' };
    }
    return { ok: true, data: sessionData };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}, 'GET');

// GET /api/config
app.api('/api/config', () => {
  const userCfg = readJsonSafe(path.join(USER_DIR, 'config.json'), {});
  return {
    ok: true,
    config: {
      language: userCfg.language || 'default',
      presets: Object.assign(
        { light: 'high-contrast', dark: 'claude-dark' },
        userCfg.presets || {}
      ),
      typography: Object.assign(
        {
          primarySans: 'default',
          fallbackSans: 'default',
          customPrimarySans: '',
          customFallbackSans: '',
          mono: 'default',
          customMono: '',
          fontSize: 16
        },
        userCfg.typography || {}
      ),
      composer: Object.assign(
        { collinear: true, waxSeal: true, hideArrows: true },
        userCfg.composer || {}
      ),
      telemetry: Object.assign(
        { enabled: true, interval: 2000 },
        userCfg.telemetry || {}
      )
    }
  };
}, 'GET');

// POST /api/config
app.api('/api/config', async (data) => {
  const userCfgPath = path.join(USER_DIR, 'config.json');
  const userCfg = readJsonSafe(userCfgPath, {});

  let languageChanged = false;
  if (data && typeof data === 'object') {
    if (typeof data.language === 'string' && data.language !== userCfg.language) {
      userCfg.language = data.language;
      languageChanged = true;
    }
    if (data.presets && typeof data.presets === 'object') {
      userCfg.presets = Object.assign(userCfg.presets || {}, data.presets);
      if (userCfg.presets.light) userCfg.preset = userCfg.presets.light;
    }
    if (data.typography && typeof data.typography === 'object') {
      userCfg.typography = Object.assign(userCfg.typography || {}, data.typography);
    }
    if (data.composer && typeof data.composer === 'object') {
      userCfg.composer = Object.assign(userCfg.composer || {}, data.composer);
    }
    if (data.telemetry && typeof data.telemetry === 'object') {
      userCfg.telemetry = Object.assign(userCfg.telemetry || {}, data.telemetry);
    }
  }

  try {
    fs.writeFileSync(userCfgPath, JSON.stringify(userCfg, null, 2), 'utf8');
  } catch (err) {
    console.error('[Sidecar Engine] Failed to save config:', err);
  }

  const bundleChanged = rebuildBundleIfNeeded(true);
  await applyLiveConfigToTargets(userCfg, bundleChanged || languageChanged);

  return { ok: true, config: userCfg };
});

// GET /api/system-fonts
app.api('/api/system-fonts', async () => {
  const fonts = await getSystemFonts();
  return { ok: true, fonts };
}, 'GET');

// GET /api/status
app.api('/api/status', () => ({
  connected: attachedTargets.size > 0,
  targetCount: attachedTargets.size,
  cdpPort: lastDetectedPort,
  patchVersion: cachedPatchVersion,
  cssLength: currentCssBytes,
  preset: activeConfig.preset,
  modules: activeConfig.modules,
  metrics: latestMetrics
}), 'GET');

// POST /api/reload
app.api('/api/reload', async () => {
  await syncCdp(true);
  for (const [, entry] of attachedTargets.entries()) {
    if (entry.inject) await entry.inject();
    if (entry.syncMetricsForSession) await entry.syncMetricsForSession(true);
  }
  return {
    ok: true,
    targetCount: attachedTargets.size,
    cssLength: currentCssBytes,
    version: cachedPatchVersion
  };
});

// POST /api/toggle-preset
app.api('/api/toggle-preset', async (data) => {
  const userCfgPath = path.join(USER_DIR, 'config.json');
  const userCfg = readJsonSafe(userCfgPath, {});
  userCfg.preset = data.preset || 'high-contrast';
  userCfg.lightPreset = userCfg.preset;
  try {
    fs.writeFileSync(userCfgPath, JSON.stringify(userCfg, null, 2), 'utf8');
  } catch {}
  await syncCdp(true);
  return { ok: true, preset: userCfg.preset };
});

// ============================================================================
// 7. 启动进程与退出守护
// ============================================================================
const syncInterval = setInterval(() => syncCdp(false), 2000);

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    console.log(`[Sidecar Engine] Received ${sig}, shutting down gracefully...`);
    clearInterval(syncInterval);
    for (const [, entry] of attachedTargets.entries()) {
      try {
        entry.ws.close();
      } catch {}
    }
    app.close().then(() => process.exit(0));
  });
}

// 启动 Web 服务与首次 CDP 连接
await app.run();
console.log(`[Sidecar Engine] Web UI running, initiating CDP sync...`);
await syncCdp(true);
