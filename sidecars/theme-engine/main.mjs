// Backend for Chuanban Theme & Metrics Sidecar
// Hosts Sidecar Web UI & Supervises CDP Theme Injection into Antigravity

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
const USER_DIR = path.join(ROOT_DIR, 'user');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

// 0. 动态探测 node:sqlite 支持
let DatabaseSync = null;
try {
  const sqliteMod = await import('node:sqlite').catch(() => null);
  if (sqliteMod && typeof sqliteMod.DatabaseSync === 'function') {
    DatabaseSync = sqliteMod.DatabaseSync;
  }
} catch {
  DatabaseSync = null;
}

// 1. 辅助函数
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

// 2. 载荷构建与热重载
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
  const presets = Object.assign(
    {
      light: userCfg.lightPreset || (typeof userCfg.preset === 'string' ? userCfg.preset : 'high-contrast'),
      dark: userCfg.darkPreset || 'claude-dark'
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
      i18n: true,
      metrics: true,
      composerWaxSeal: true,
      deadlockHealer: true,
      customCss: true,
      customJs: true
    },
    rawModules
  );
  if (!DatabaseSync) modules.metrics = false;
  modules.metricsCapsule = modules.metrics;

  const themeVars = userCfg.themeVars && typeof userCfg.themeVars === 'object' ? userCfg.themeVars : {};

  activeConfig = {
    enabled,
    channel,
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

// 3. CDP 端口发现与 WebSocket 目标挂载
const attachedTargets = new Map();

function resolvePortFilePath() {
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
  try {
    const portFile = resolvePortFilePath();
    if (!fs.existsSync(portFile)) return null;
    const raw = fs.readFileSync(portFile, 'utf8').trim();
    const lines = raw.split(/\r?\n/);
    const port = parseInt(lines[0], 10);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
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

      const checkAndInject = async () => {
        const checkRes = await send('Runtime.evaluate', {
          expression: `Boolean(window.__AG_THEME_BOOTSTRAPPED__ && window.__AG_PATCH_VERSION__ === ${JSON.stringify(
            cachedPatchVersion
          )})`,
          returnByValue: true
        });
        const isUpToDate = checkRes?.result?.value === true;
        if (!isUpToDate) {
          return await inject();
        }
        return true;
      };

      ws.onopen = async () => {
        clearTimeout(attachTimeout);
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', { source: cachedInjectScript });
        const ok = await inject();
        attachedTargets.set(target.id, {
          id: target.id,
          title: target.title || '',
          url: target.url || '',
          ws,
          send,
          inject,
          checkAndInject
        });
        finishAttach(ok);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && pendingCallbacks.has(msg.id)) {
            const cb = pendingCallbacks.get(msg.id);
            pendingCallbacks.delete(msg.id);
            cb(msg);
          }
        } catch {}
      };

      ws.onerror = () => finishAttach(false);
      ws.onclose = () => {
        attachedTargets.delete(target.id);
        finishAttach(false);
      };
    } catch {
      finishAttach(false);
    }
  });
}

// 4. 定时轮询与同步
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

    // 过滤页面：仅针对 Antigravity 主渲染窗口，排除 devtools 以及 sidecar 自身的 Web UI 面板
    const pages = targets.filter(
      (t) =>
        t.type === 'page' &&
        t.webSocketDebuggerUrl &&
        !String(t.url || '').startsWith('devtools://') &&
        !String(t.url || '').includes('/sidecar') &&
        !String(t.url || '').includes('theme-engine') &&
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
        } else if (entry.checkAndInject) {
          await entry.checkAndInject();
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

// 5. SidecarApp Web UI 服务
const app = new SidecarApp();

app.page('/', () => readTextSafe(path.join(HERE, 'index.html'), ''));
app.page('/app.js', () => readTextSafe(path.join(HERE, 'app.js'), ''));
app.api('/styles.css', () => new Response(readTextSafe(path.join(HERE, 'styles.css'), ''), { contentType: 'text/css' }), 'GET');
app.api('/logo.svg', () => new Response(readTextSafe(path.join(ASSETS_DIR, 'logo.svg'), ''), { contentType: 'image/svg+xml' }), 'GET');

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

// 6. 启动进程与退出守护
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
