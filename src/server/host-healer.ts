/**
 * Aura Dashboard · Non-Invasive Host CDP Healer (macOS)
 *
 * Ensures the Antigravity Electron host was launched with `--remote-debugging-port`.
 * Instead of mutating signed `app.asar` bundles (which breaks `ElectronAsarIntegrity`
 * and code signatures), it detects missing CDP flags at Sidecar startup and triggers
 * a cooldown-guarded detached graceful relaunch with `--remote-debugging-port=0`.
 */

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePortFilePath } from './cdp-client';

export type HostHealStatus = 'ready' | 'relaunched' | 'cooldown' | 'skipped' | 'error';

export interface HostHealResult {
  mode: 'relaunch';
  status: HostHealStatus;
  success: boolean;
  healed: boolean;
  alreadyPatched: boolean;
  needsRestart: boolean;
  hostPid?: number;
  appBundlePath?: string;
  reason?: string;
  error?: string;
}

export interface HostProcessInfo {
  pid: number;
  appBundlePath: string;
  command: string;
  hasRemoteDebuggingPort: boolean;
}

export interface RelaunchLockRecord {
  timestamp: number;
  pid: number;
  appBundlePath?: string;
}

export interface EnsureHostCdpOptions {
  isSidecarRuntime: boolean;
  storageDir: string;
  cdpTargetCount: number;
  platform?: NodeJS.Platform;
  now?: number;
  cooldownMs?: number;
  portFilePath?: string;
  env?: NodeJS.ProcessEnv;
  inspectHost?: () => HostProcessInfo | null;
  triggerRelaunch?: (host: HostProcessInfo) => void;
}

const DEFAULT_COOLDOWN_MS = 10_000;
const LOCK_FILENAME = 'cdp_relaunch_lock.json';
const RELAUNCH_LOG_FILENAME = 'cdp_relaunch.log';
const MAC_HOST_EXEC_RE = /^(.*?\/Antigravity\.app)\/Contents\/MacOS\/Antigravity(?:\s|$)/;
const STRIPPED_ENV_PREFIXES = ['ELECTRON_', 'NODE_', 'ANTIGRAVITY_', 'JETSKI_'];

/**
 * Strips Electron/Sidecar runtime variables so relaunched GUI host processes
 * do not inherit `ELECTRON_RUN_AS_NODE=1` or stale sidecar tokens.
 */
export function buildCleanRelaunchEnv(sourceEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    if (STRIPPED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Parses a single `ps -axo pid=,args=` line into a host process descriptor
 * if and only if it represents the main Antigravity macOS executable.
 */
export function parseMacHostProcessLine(line: string): HostProcessInfo | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  const pid = Number.parseInt(match[1], 10);
  if (!Number.isFinite(pid) || pid <= 0) return null;

  const command = match[2];
  // Exclude Electron helper/renderer/utility subprocesses
  if (command.includes('--type=') || command.includes('Antigravity Helper')) {
    return null;
  }

  const execMatch = command.match(MAC_HOST_EXEC_RE);
  if (!execMatch) return null;

  return {
    pid,
    appBundlePath: execMatch[1],
    command,
    hasRemoteDebuggingPort: /(?:^|\s)--remote-debugging-port(?:=|\s|$)/.test(command)
  };
}

/**
 * Inspects running processes on macOS to locate the main Antigravity host process.
 */
export function inspectMacHostProcess(): HostProcessInfo | null {
  if (process.platform !== 'darwin') return null;
  try {
    const out = execFileSync('ps', ['-axo', 'pid=,args='], {
      encoding: 'utf8',
      timeout: 3000
    });
    for (const line of out.split(/\r?\n/)) {
      const info = parseMacHostProcessLine(line);
      if (info) return info;
    }
  } catch (err) {
    console.warn('[Aura Host Healer] Failed to inspect host process list:', err);
  }
  return null;
}

function readRelaunchLock(lockPath: string): RelaunchLockRecord | null {
  try {
    if (!fs.existsSync(lockPath)) return null;
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Partial<RelaunchLockRecord>;
    if (typeof raw.timestamp !== 'number' || typeof raw.pid !== 'number') return null;
    return {
      timestamp: raw.timestamp,
      pid: raw.pid,
      appBundlePath: typeof raw.appBundlePath === 'string' ? raw.appBundlePath : undefined
    };
  } catch {
    return null;
  }
}

function writeRelaunchLock(lockPath: string, record: RelaunchLockRecord): void {
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${lockPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmpPath, lockPath);
}

/**
 * Spawns a detached POSIX shell script that gracefully terminates the current
 * Antigravity host PID, waits for its single-instance lock to exit cleanly,
 * and relaunches the `.app` with `--remote-debugging-port=0` using a clean env.
 */
export function spawnDetachedMacRelaunch(host: HostProcessInfo, logPath?: string): void {
  const unsetList = [
    'ELECTRON_RUN_AS_NODE',
    'NODE_PATH',
    'NODE_OPTIONS',
    'ANTIGRAVITY_SIDECAR_WEB_PORT',
    'ANTIGRAVITY_SIDECAR_UI_TOKEN',
    'ANTIGRAVITY_LS_ADDRESS',
    'ANTIGRAVITY_CSRF_TOKEN',
    'ANTIGRAVITY_AGENTAPI_EXE',
    'ANTIGRAVITY_EXECUTABLE_DATA_DIR',
    'ANTIGRAVITY_PROJECT_ID',
    'ANTIGRAVITY_SOURCE_METADATA',
    'ANTIGRAVITY_LS_VERSION',
    'ANTIGRAVITY_APP_DATA_DIR',
    'ANTIGRAVITY_NODE_PATH',
    'JETSKI_APP_DATA_DIR'
  ].join(' ');

  const script = [
    'log_file="$3"',
    'log() { [ -n "$log_file" ] && printf "%s %s\\n" "$(date "+%Y-%m-%dT%H:%M:%S")" "$1" >> "$log_file" 2>/dev/null || true; }',
    `unset ${unsetList} 2>/dev/null || true`,
    'log "Starting relaunch for PID=$1 app=$2"',
    'sleep 0.2',
    'kill -TERM "$1" 2>/dev/null || true',
    'i=0',
    'while kill -0 "$1" 2>/dev/null && [ "$i" -lt 125 ]; do',
    '  sleep 0.2',
    '  i=$((i + 1))',
    'done',
    'if kill -0 "$1" 2>/dev/null; then',
    '  log "Timed out waiting for PID=$1 to exit; aborting relaunch"',
    '  exit 0',
    'fi',
    'sleep 0.3',
    'if [ -n "$log_file" ]; then',
    '  open -a "$2" --args --remote-debugging-port=0 >> "$log_file" 2>&1',
    '  rc=$?',
    'else',
    '  open -a "$2" --args --remote-debugging-port=0',
    '  rc=$?',
    'fi',
    'log "open -a exited with status=$rc"'
  ].join('\n');

  const child = spawn(
    '/bin/sh',
    ['-c', script, 'aura-cdp-relaunch', String(host.pid), host.appBundlePath, logPath ?? ''],
    {
      detached: true,
      stdio: 'ignore',
      env: buildCleanRelaunchEnv(process.env)
    }
  );
  child.unref();
}

/**
 * Verifies CDP readiness and performs a cooldown-guarded automatic relaunch
 * on macOS when the host was launched without `--remote-debugging-port`.
 */
export function ensureHostCdpReady(options: EnsureHostCdpOptions): HostHealResult {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  if (!options.isSidecarRuntime) {
    return {
      mode: 'relaunch',
      status: 'skipped',
      success: true,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      reason: 'non-sidecar-runtime'
    };
  }

  if (options.cdpTargetCount > 0) {
    return {
      mode: 'relaunch',
      status: 'ready',
      success: true,
      healed: false,
      alreadyPatched: true,
      needsRestart: false,
      reason: 'cdp-connected'
    };
  }

  const portFilePath = options.portFilePath ?? resolvePortFilePath();
  if (Boolean(env.AGY_BROWSER_WS_URL) || fs.existsSync(portFilePath)) {
    return {
      mode: 'relaunch',
      status: 'ready',
      success: true,
      healed: false,
      alreadyPatched: true,
      needsRestart: false,
      reason: 'cdp-port-present'
    };
  }

  if (platform !== 'darwin') {
    const reason = `unsupported-platform:${platform}`;
    console.warn(`[Aura Host Healer] Auto-relaunch skipped (${reason}). Launch host with --remote-debugging-port=0.`);
    return {
      mode: 'relaunch',
      status: 'skipped',
      success: false,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      reason
    };
  }

  const inspect = options.inspectHost ?? inspectMacHostProcess;
  const host = inspect();
  if (!host) {
    const error = 'Unable to locate running Antigravity macOS host process.';
    console.warn(`[Aura Host Healer] ${error}`);
    return {
      mode: 'relaunch',
      status: 'error',
      success: false,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      reason: 'host-process-not-found',
      error
    };
  }

  if (host.hasRemoteDebuggingPort) {
    return {
      mode: 'relaunch',
      status: 'ready',
      success: true,
      healed: false,
      alreadyPatched: true,
      needsRestart: false,
      hostPid: host.pid,
      appBundlePath: host.appBundlePath,
      reason: 'host-flag-present'
    };
  }

  const lockPath = path.join(options.storageDir, LOCK_FILENAME);
  const prevLock = readRelaunchLock(lockPath);
  if (prevLock && (prevLock.pid === host.pid || now - prevLock.timestamp < cooldownMs)) {
    const reason = prevLock.pid === host.pid ? 'already-attempted-for-pid' : 'relaunch-cooldown-active';
    console.warn(`[Aura Host Healer] Skipping relaunch for PID ${host.pid} (${reason}).`);
    return {
      mode: 'relaunch',
      status: 'cooldown',
      success: false,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      hostPid: host.pid,
      appBundlePath: host.appBundlePath,
      reason
    };
  }

  try {
    writeRelaunchLock(lockPath, {
      timestamp: now,
      pid: host.pid,
      appBundlePath: host.appBundlePath
    });
    const relaunchLogPath = path.join(options.storageDir, RELAUNCH_LOG_FILENAME);
    const launch = options.triggerRelaunch ?? ((targetHost: HostProcessInfo) => spawnDetachedMacRelaunch(targetHost, relaunchLogPath));
    launch(host);
    console.log(
      `[Aura Host Healer] Host PID ${host.pid} lacks --remote-debugging-port; scheduled graceful relaunch of ${host.appBundlePath} with --remote-debugging-port=0.`
    );
    return {
      mode: 'relaunch',
      status: 'relaunched',
      success: true,
      healed: true,
      alreadyPatched: false,
      needsRestart: true,
      hostPid: host.pid,
      appBundlePath: host.appBundlePath,
      reason: 'relaunch-scheduled'
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Aura Host Healer] Failed to schedule host relaunch:', err);
    return {
      mode: 'relaunch',
      status: 'error',
      success: false,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      hostPid: host.pid,
      appBundlePath: host.appBundlePath,
      reason: 'relaunch-spawn-failed',
      error
    };
  }
}
