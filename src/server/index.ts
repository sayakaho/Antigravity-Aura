import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { toPanelConfigDTO } from '../shared/config-schema';
import { resolveAnalyticsSessionId } from '../shared/session';
import type { SidecarStatusResponse } from '../types';
import { GlobalAnalyticsEngine } from './analytics-engine';
import { CdpManager } from './cdp-client';
import {
  getActiveConfig,
  getBundleSnapshot,
  getSystemFonts,
  loadAndNormalizeDiskConfig,
  rebuildBundleIfNeeded,
  saveConfigPatch
} from './config-bundle';
import {
  ANTIGRAVITY_DATA_DIR,
  ASSETS_DIR,
  EMBEDDED_ASSETS,
  HERE,
  initDataDirectory,
  readTextSafe
} from './paths';

// Defensive fallback for local debugging outside Antigravity host
if (!process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
  process.env.ANTIGRAVITY_SIDECAR_WEB_PORT = '51980';
  process.env.ANTIGRAVITY_LS_ADDRESS = process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:5387';
  process.env.ANTIGRAVITY_CSRF_TOKEN = process.env.ANTIGRAVITY_CSRF_TOKEN || 'local-test';
}

interface SidecarSdkModule {
  SidecarApp: new () => {
    page: (route: string, handler: () => unknown) => void;
    api: (route: string, handler: (data?: any) => unknown, method?: string) => void;
    run: () => Promise<unknown>;
    close: () => Promise<void>;
  };
  Response: new (
    body: string | Uint8Array,
    opts?: { contentType?: string; status?: number; headers?: Record<string, string> }
  ) => unknown;
}

let sdk: SidecarSdkModule;
try {
  sdk = (await import('sidecar_sdk')) as SidecarSdkModule;
} catch {
  const sdkPath = path.join(
    os.homedir(),
    '.gemini',
    'antigravity',
    'lib',
    'node_modules',
    'sidecar_sdk',
    'index.mjs'
  );
  sdk = (await import(pathToFileURL(sdkPath).href)) as SidecarSdkModule;
}

const { SidecarApp, Response } = sdk;

initDataDirectory();
rebuildBundleIfNeeded(true);

const analyticsEngine = new GlobalAnalyticsEngine(ANTIGRAVITY_DATA_DIR);
analyticsEngine.startWatching();
const cdpManager = new CdpManager({
  onSessionDbChange: (cascadeId, sig) => {
    analyticsEngine.notifySessionSignature(cascadeId, sig);
  }
});
const app = new SidecarApp();

app.page('/', () =>
  EMBEDDED_ASSETS ? EMBEDDED_ASSETS.panelHtml : readTextSafe(path.join(HERE, 'index.html'), '')
);

app.api(
  '/app.js',
  () =>
    new Response(
      EMBEDDED_ASSETS ? EMBEDDED_ASSETS.panelJs : readTextSafe(path.join(HERE, 'app.js'), ''),
      {
        contentType: 'application/javascript',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      }
    ),
  'GET'
);

app.api(
  '/styles.css',
  () =>
    new Response(
      EMBEDDED_ASSETS ? EMBEDDED_ASSETS.panelCss : readTextSafe(path.join(HERE, 'styles.css'), ''),
      {
        contentType: 'text/css',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      }
    ),
  'GET'
);

app.api(
  '/logo.png',
  () => {
    const logoPath = path.join(ASSETS_DIR, 'logo.png');
    if (!fs.existsSync(logoPath)) {
      return new Response(new Uint8Array(), { contentType: 'image/png', status: 404 });
    }
    return new Response(fs.readFileSync(logoPath), {
      contentType: 'image/png'
    });
  },
  'GET'
);

function isForceRefreshQuery(data?: Record<string, unknown>): boolean {
  const raw = data?.force;
  return raw === true || raw === '1' || raw === 'true';
}

app.api(
  '/api/analytics/overview',
  (data?: Record<string, unknown>) => {
    try {
      return { ok: true, data: analyticsEngine.getGlobalOverview(isForceRefreshQuery(data)) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  'GET'
);

app.api(
  '/api/analytics/session',
  (data?: Record<string, unknown>) => {
    const rawId = resolveAnalyticsSessionId(data, cdpManager.getLastActiveCascadeId());
    if (!rawId) {
      return { ok: false, error: 'No active session detected' };
    }
    try {
      const sessionData = analyticsEngine.getSessionDetails(rawId, isForceRefreshQuery(data));
      if (!sessionData) {
        return { ok: false, error: 'No metrics found for this session' };
      }
      return { ok: true, data: sessionData };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  'GET'
);

app.api(
  '/api/config',
  () => ({
    ok: true,
    config: toPanelConfigDTO(loadAndNormalizeDiskConfig())
  }),
  'GET'
);

app.api('/api/config', async (data: unknown) => {
  try {
    const { nextConfig, bundleChanged, languageChanged } = saveConfigPatch(data);
    await cdpManager.applyHotConfig(nextConfig, bundleChanged || languageChanged);
    return { ok: true, config: toPanelConfigDTO(nextConfig) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      contentType: 'application/json',
      status: 400
    });
  }
});

app.api(
  '/api/system-fonts',
  async () => {
    const fonts = await getSystemFonts(() => cdpManager.queryHostFonts());
    return { ok: true, fonts };
  },
  'GET'
);

app.api(
  '/api/status',
  (): SidecarStatusResponse => {
    const snap = getBundleSnapshot();
    return {
      connected: cdpManager.getTargetCount() > 0,
      targetCount: cdpManager.getTargetCount(),
      cdpPort: cdpManager.getLastDetectedPort(),
      patchVersion: snap.patchVersion,
      cssLength: snap.cssBytes,
      preset: snap.config.presets.light,
      modules: snap.modules,
      metrics: cdpManager.getLatestMetrics(),
      activeCascadeId: cdpManager.getLastActiveCascadeId(),
      analyticsRevision: analyticsEngine.getRevision()
    };
  },
  'GET'
);

app.api('/api/reload', async () => {
  await cdpManager.reloadAll();
  const snap = getBundleSnapshot();
  return {
    ok: true,
    targetCount: cdpManager.getTargetCount(),
    cssLength: snap.cssBytes,
    version: snap.patchVersion
  };
});

async function openDirectoryInFileManager(rawPath: string): Promise<string> {
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }
  const st = fs.statSync(resolved);
  if (!st.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'explorer'
        : 'xdg-open';

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const child = spawn(cmd, [resolved], {
      detached: true,
      stdio: 'ignore',
      shell: false
    });
    child.once('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.once('spawn', () => {
      child.unref();
      if (!settled) {
        settled = true;
        resolve();
      }
    });
  });

  return resolved;
}

app.api('/api/open-directory', async (data: unknown) => {
  let payload: unknown = data;
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {
      payload = null;
    }
  }

  const targetPath =
    payload && typeof payload === 'object' && typeof (payload as { path?: unknown }).path === 'string'
      ? (payload as { path: string }).path.trim()
      : '';

  if (!targetPath) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing directory path' }), {
      contentType: 'application/json',
      status: 400
    });
  }

  try {
    const openedPath = await openDirectoryInFileManager(targetPath);
    return { ok: true, path: openedPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('does not exist') || msg.includes('not a directory') ? 404 : 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      contentType: 'application/json',
      status
    });
  }
});

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

function scheduleNextSync(): void {
  if (stopped) return;
  const intervalMs = getActiveConfig().telemetry.interval;
  syncTimer = setTimeout(async () => {
    await cdpManager.sync(false);
    scheduleNextSync();
  }, intervalMs);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    console.log(`[Sidecar Engine] Received ${sig}, shutting down gracefully...`);
    stopped = true;
    if (syncTimer) clearTimeout(syncTimer);
    cdpManager.closeAll();
    analyticsEngine.dispose();
    void app.close().then(() => process.exit(0));
  });
}

await app.run();
console.log('[Sidecar Engine] Web UI running, initiating CDP sync...');
await cdpManager.sync(true);
scheduleNextSync();
