import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AuraConfig, LiveMetricsPayload } from '../types';
import {
  getBundleSnapshot,
  rebuildBundleIfNeeded,
  resolveThemeAttrs,
  resolveTypographyVars
} from './config-bundle';
import { parseConversationMetrics } from './metrics-capsule';
import { CONVERSATIONS_DIR } from './paths';
import { getDbSignature, hasSqlite } from './sqlite-proto';

interface CdpTargetDescriptor {
  id: string;
  type?: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

interface AttachedTargetEntry {
  id: string;
  title: string;
  url: string;
  ws: WebSocket;
  send: (method: string, params?: Record<string, unknown>) => Promise<any>;
  inject: () => Promise<boolean>;
  checkAndInject: () => Promise<void>;
  syncMetricsForSession: (force?: boolean) => Promise<void>;
}

function resolvePortFilePath(): string {
  if (
    process.env.AGY_BROWSER_ACTIVE_PORT_FILE &&
    fs.existsSync(process.env.AGY_BROWSER_ACTIVE_PORT_FILE)
  ) {
    return process.env.AGY_BROWSER_ACTIVE_PORT_FILE;
  }
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Antigravity', 'DevToolsActivePort');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdgConfig, 'Antigravity', 'DevToolsActivePort');
}

function readPort(): number {
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

function fetchTargets(port: number): Promise<CdpTargetDescriptor[]> {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/json/list', timeout: 1500 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(Array.isArray(parsed) ? (parsed as CdpTargetDescriptor[]) : []);
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

export interface CdpManagerOptions {
  onSessionDbChange?: (cascadeId: string, sig: string) => void;
}

export class CdpManager {
  private readonly attachedTargets = new Map<string, AttachedTargetEntry>();
  private readonly onSessionDbChange?: (cascadeId: string, sig: string) => void;
  private lastDetectedPort: number | null = null;
  private lastGlobalActiveCascadeId = '';
  private latestMetrics: LiveMetricsPayload | null = null;
  private isSyncing = false;

  constructor(options?: CdpManagerOptions) {
    this.onSessionDbChange = options?.onSessionDbChange;
  }

  public getTargetCount(): number {
    return this.attachedTargets.size;
  }

  public getLastDetectedPort(): number | null {
    return this.lastDetectedPort;
  }

  public getLastActiveCascadeId(): string {
    return this.lastGlobalActiveCascadeId;
  }

  public getLatestMetrics(): LiveMetricsPayload | null {
    return this.latestMetrics;
  }

  public async queryHostFonts(): Promise<string[]> {
    const collected: string[] = [];
    for (const [, entry] of this.attachedTargets.entries()) {
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
        if (Array.isArray(cdpFonts)) {
          for (const f of cdpFonts) {
            if (typeof f === 'string') collected.push(f);
          }
        }
      } catch {}
    }
    return collected;
  }

  public async applyHotConfig(nextConfig: AuraConfig, bundleChanged: boolean): Promise<void> {
    const snap = getBundleSnapshot();
    const vars = resolveTypographyVars(nextConfig.typography);
    const attrs = resolveThemeAttrs(nextConfig);
    const telemetryEnabled = nextConfig.telemetry.enabled;

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

    for (const [, entry] of this.attachedTargets.entries()) {
      try {
        await entry.send('Runtime.evaluate', { expression: hotCode, returnByValue: true });
        if (bundleChanged) {
          await entry.send('Page.addScriptToEvaluateOnNewDocument', { source: snap.injectScript });
          await entry.inject();
        }
        if (telemetryEnabled) {
          await entry.syncMetricsForSession(true);
        }
      } catch {}
    }
  }

  public async sync(force = false): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const bundleChanged = rebuildBundleIfNeeded(force);
      const snap = getBundleSnapshot();
      const port = readPort();
      this.lastDetectedPort = port;
      if (!port) return;

      const targets = await fetchTargets(port);
      if (targets.length === 0) return;

      const pages = targets.filter(
        (t) =>
          t.type === 'page' &&
          Boolean(t.webSocketDebuggerUrl) &&
          !String(t.url || '').startsWith('devtools://') &&
          snap.config.allowedOrigins.some((prefix) => String(t.url || '').startsWith(prefix)) &&
          !String(t.title || '').includes('Launchpad')
      );

      const activeTargetIds = new Set<string>();
      const attachPromises: Array<Promise<boolean>> = [];

      for (const page of pages) {
        activeTargetIds.add(page.id);
        const existing = this.attachedTargets.get(page.id);
        if (!existing) {
          attachPromises.push(this.attachTarget(page));
        } else {
          if (bundleChanged) {
            await existing.send('Page.addScriptToEvaluateOnNewDocument', {
              source: snap.injectScript
            });
            await existing.inject();
            await existing.syncMetricsForSession(true);
          } else {
            await existing.checkAndInject();
          }
          await existing.syncMetricsForSession(false);
        }
      }

      if (attachPromises.length > 0) {
        await Promise.allSettled(attachPromises);
      }

      for (const [id, entry] of this.attachedTargets.entries()) {
        if (!activeTargetIds.has(id)) {
          try {
            entry.ws.close();
          } catch {}
          this.attachedTargets.delete(id);
        }
      }
    } catch (err) {
      console.error('[Sidecar Engine] Sync error:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  public async reloadAll(): Promise<void> {
    await this.sync(true);
    for (const [, entry] of this.attachedTargets.entries()) {
      await entry.inject();
      await entry.syncMetricsForSession(true);
    }
  }

  public closeAll(): void {
    for (const [, entry] of this.attachedTargets.entries()) {
      try {
        entry.ws.close();
      } catch {}
    }
    this.attachedTargets.clear();
  }

  private attachTarget(target: CdpTargetDescriptor): Promise<boolean> {
    const wsUrl = target.webSocketDebuggerUrl;
    if (!wsUrl) return Promise.resolve(false);

    return new Promise((resolveAttach) => {
      let settled = false;
      const finishAttach = (ok: boolean) => {
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
        const pendingCallbacks = new Map<number, (msg: any) => void>();

        const send = (method: string, params: Record<string, unknown> = {}) =>
          new Promise<any>((resolve) => {
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
          const snap = getBundleSnapshot();
          const res = await send('Runtime.evaluate', {
            expression: snap.injectScript,
            returnByValue: true
          });
          if (res?.error || res?.result?.exceptionDetails) {
            console.error(`[Sidecar Engine] Injection failed on ${target.id}`);
            return false;
          }
          console.log(`[Sidecar Engine] Injected (${snap.patchVersion}) into target ${target.id}`);
          return true;
        };

        const syncMetricsForSession = async (force = false) => {
          const snap = getBundleSnapshot();
          if (!hasSqlite() || !snap.modules.metrics || !snap.config.enabled) return;

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
              this.lastGlobalActiveCascadeId = cid;
            }
          }

          if (!activeCascadeId) return;

          const dbSig = getDbSignature(path.join(CONVERSATIONS_DIR, `${activeCascadeId}.db`));
          if (dbSig) {
            this.onSessionDbChange?.(activeCascadeId, dbSig);
          }
          const sessionKey = `${activeCascadeId}:${dbSig}`;
          if (!force && sessionKey === lastPushedHash) return;

          const metrics = parseConversationMetrics(activeCascadeId, CONVERSATIONS_DIR, snap.config);
          if (!metrics) return;

          this.latestMetrics = metrics;

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
            const snap = getBundleSnapshot();
            const checkRes = await send('Runtime.evaluate', {
              expression:
                `window.__ag_patch_version === ${JSON.stringify(snap.patchVersion)}` +
                ` && (${JSON.stringify(!snap.config.enabled)} || !!document.getElementById("ag-custom-fonts"))`,
              returnByValue: true
            });
            const isUpToDate =
              checkRes?.result?.result?.value === true || checkRes?.result?.value === true;
            if (!isUpToDate) {
              await inject();
              await syncMetricsForSession(true);
            }
          } catch {}
        };

        ws.addEventListener('open', async () => {
          console.log(`[Sidecar Engine] Attached target: ${target.id} (${target.title || 'Untitled'})`);
          const snap = getBundleSnapshot();
          await send('Page.enable');
          await send('Runtime.enable');
          await send('Runtime.addBinding', { name: '__agRequestMetrics' });
          await send('Runtime.addBinding', { name: '__ag_on_session_change' });
          await send('Page.addScriptToEvaluateOnNewDocument', { source: snap.injectScript });
          const ok = await inject();
          await syncMetricsForSession(true);

          this.attachedTargets.set(target.id, {
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
              cb?.(msg);
              return;
            }
            if (
              msg.method === 'Runtime.bindingCalled' &&
              (msg.params?.name === '__agRequestMetrics' ||
                msg.params?.name === '__ag_on_session_change')
            ) {
              const nextId = String(msg.params.payload || '').trim();
              if (/^[0-9a-f-]{36}$/i.test(nextId)) {
                const changed = activeCascadeId !== nextId;
                activeCascadeId = nextId;
                this.lastGlobalActiveCascadeId = nextId;
                if (changed || msg.params?.name === '__agRequestMetrics') {
                  lastPushedHash = '';
                  void syncMetricsForSession(true);
                }
              }
            }
          } catch {}
        });

        const closeHandler = () => {
          clearTimeout(attachTimeout);
          for (const [, cb] of pendingCallbacks) cb(null);
          pendingCallbacks.clear();
          this.attachedTargets.delete(target.id);
          finishAttach(false);
        };
        ws.addEventListener('close', closeHandler);
        ws.addEventListener('error', closeHandler);
      } catch {
        finishAttach(false);
      }
    });
  }
}
