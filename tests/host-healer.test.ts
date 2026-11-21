import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildCleanRelaunchEnv,
  ensureHostCdpReady,
  parseMacHostProcessLine,
  type HostProcessInfo
} from '../src/server/host-healer';

describe('Non-Invasive Host CDP Healer', () => {
  test('parseMacHostProcessLine matches main Antigravity host and rejects helpers', () => {
    const mainWithoutFlag = parseMacHostProcessLine(
      '42274 /Applications/Antigravity.app/Contents/MacOS/Antigravity'
    );
    expect(mainWithoutFlag).toEqual({
      pid: 42274,
      appBundlePath: '/Applications/Antigravity.app',
      command: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
      hasRemoteDebuggingPort: false
    });

    const mainWithFlag = parseMacHostProcessLine(
      '50123 /Users/test/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port=0'
    );
    expect(mainWithFlag).toEqual({
      pid: 50123,
      appBundlePath: '/Users/test/Applications/Antigravity.app',
      command:
        '/Users/test/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port=0',
      hasRemoteDebuggingPort: true
    });

    const helperProc = parseMacHostProcessLine(
      '42603 /Applications/Antigravity.app/Contents/Frameworks/Antigravity Helper (Renderer).app/Contents/MacOS/Antigravity Helper (Renderer) --type=renderer'
    );
    expect(helperProc).toBeNull();
  });

  test('buildCleanRelaunchEnv strips Electron, Node, and Antigravity sidecar variables', () => {
    const clean = buildCleanRelaunchEnv({
      PATH: '/usr/bin:/bin',
      HOME: '/Users/test',
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: '/tmp/node_modules',
      ANTIGRAVITY_SIDECAR_WEB_PORT: '52234',
      JETSKI_APP_DATA_DIR: 'antigravity'
    });
    expect(clean).toEqual({
      PATH: '/usr/bin:/bin',
      HOME: '/Users/test'
    });
  });

  test('ensureHostCdpReady skips in non-sidecar debug runtime', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-healer-test-'));
    try {
      let relaunched = false;
      const res = ensureHostCdpReady({
        isSidecarRuntime: false,
        storageDir: tmpDir,
        cdpTargetCount: 0,
        platform: 'darwin',
        portFilePath: path.join(tmpDir, 'DevToolsActivePort'),
        triggerRelaunch: () => {
          relaunched = true;
        }
      });
      expect(res.status).toBe('skipped');
      expect(res.reason).toBe('non-sidecar-runtime');
      expect(relaunched).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('ensureHostCdpReady returns ready when CDP is connected or host flag is present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-healer-test-'));
    try {
      const connectedRes = ensureHostCdpReady({
        isSidecarRuntime: true,
        storageDir: tmpDir,
        cdpTargetCount: 1,
        platform: 'darwin',
        portFilePath: path.join(tmpDir, 'DevToolsActivePort')
      });
      expect(connectedRes.status).toBe('ready');
      expect(connectedRes.alreadyPatched).toBe(true);

      const flaggedRes = ensureHostCdpReady({
        isSidecarRuntime: true,
        storageDir: tmpDir,
        cdpTargetCount: 0,
        platform: 'darwin',
        portFilePath: path.join(tmpDir, 'DevToolsActivePort'),
        env: {},
        inspectHost: () => ({
          pid: 1001,
          appBundlePath: '/Applications/Antigravity.app',
          command: '/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port=0',
          hasRemoteDebuggingPort: true
        })
      });
      expect(flaggedRes.status).toBe('ready');
      expect(flaggedRes.reason).toBe('host-flag-present');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('ensureHostCdpReady triggers relaunch once and enforces cooldown/PID guard', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-healer-test-'));
    try {
      const relaunchedHosts: HostProcessInfo[] = [];
      const hostInfo: HostProcessInfo = {
        pid: 42274,
        appBundlePath: '/Applications/Antigravity.app',
        command: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        hasRemoteDebuggingPort: false
      };

      const first = ensureHostCdpReady({
        isSidecarRuntime: true,
        storageDir: tmpDir,
        cdpTargetCount: 0,
        platform: 'darwin',
        now: 1_000_000,
        cooldownMs: 30_000,
        portFilePath: path.join(tmpDir, 'DevToolsActivePort'),
        env: {},
        inspectHost: () => hostInfo,
        triggerRelaunch: (h) => relaunchedHosts.push(h)
      });

      expect(first.status).toBe('relaunched');
      expect(first.healed).toBe(true);
      expect(first.needsRestart).toBe(true);
      expect(relaunchedHosts).toEqual([hostInfo]);

      // Same PID within cooldown must not relaunch again
      const samePidRes = ensureHostCdpReady({
        isSidecarRuntime: true,
        storageDir: tmpDir,
        cdpTargetCount: 0,
        platform: 'darwin',
        now: 1_060_000,
        cooldownMs: 30_000,
        portFilePath: path.join(tmpDir, 'DevToolsActivePort'),
        env: {},
        inspectHost: () => hostInfo,
        triggerRelaunch: (h) => relaunchedHosts.push(h)
      });
      expect(samePidRes.status).toBe('cooldown');
      expect(samePidRes.reason).toBe('already-attempted-for-pid');
      expect(relaunchedHosts.length).toBe(1);

      // Different PID within cooldown window must also be guarded
      const newPidWithinCooldown = ensureHostCdpReady({
        isSidecarRuntime: true,
        storageDir: tmpDir,
        cdpTargetCount: 0,
        platform: 'darwin',
        now: 1_010_000,
        cooldownMs: 30_000,
        portFilePath: path.join(tmpDir, 'DevToolsActivePort'),
        env: {},
        inspectHost: () => ({ ...hostInfo, pid: 43000 }),
        triggerRelaunch: (h) => relaunchedHosts.push(h)
      });
      expect(newPidWithinCooldown.status).toBe('cooldown');
      expect(newPidWithinCooldown.reason).toBe('relaunch-cooldown-active');
      expect(relaunchedHosts.length).toBe(1);

      // Different PID after cooldown expires can relaunch again
      const afterCooldown = ensureHostCdpReady({
        isSidecarRuntime: true,
        storageDir: tmpDir,
        cdpTargetCount: 0,
        platform: 'darwin',
        now: 1_035_000,
        cooldownMs: 30_000,
        portFilePath: path.join(tmpDir, 'DevToolsActivePort'),
        env: {},
        inspectHost: () => ({ ...hostInfo, pid: 43000 }),
        triggerRelaunch: (h) => relaunchedHosts.push(h)
      });
      expect(afterCooldown.status).toBe('relaunched');
      expect(relaunchedHosts.length).toBe(2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
