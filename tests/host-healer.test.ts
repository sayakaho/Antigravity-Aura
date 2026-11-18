import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { autoHealHostAsar, resolveHostAsarPath } from '../src/server/host-healer';

function buildFixtureAsar(mainJsContent: string): Buffer {
  const mainBuf = Buffer.from(mainJsContent, 'utf8');
  const header = {
    files: {
      dist: {
        files: {
          'main.js': {
            size: mainBuf.length,
            offset: '0'
          }
        }
      }
    }
  };
  const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
  const padding = (4 - (headerBuf.length % 4)) % 4;
  const paddedHeaderSize = headerBuf.length + padding;
  const outBuf = Buffer.alloc(16 + paddedHeaderSize + mainBuf.length);

  outBuf.writeUInt32LE(4, 0);
  outBuf.writeUInt32LE(paddedHeaderSize + 8, 4);
  outBuf.writeUInt32LE(paddedHeaderSize + 4, 8);
  outBuf.writeUInt32LE(headerBuf.length, 12);
  headerBuf.copy(outBuf, 16);
  mainBuf.copy(outBuf, 16 + paddedHeaderSize);
  return outBuf;
}

describe('Host Healer & Auto-Patcher', () => {
  test('resolveHostAsarPath returns null or an existing app.asar file', () => {
    const asarPath = resolveHostAsarPath();
    if (asarPath) {
      expect(fs.existsSync(asarPath)).toBe(true);
    } else {
      expect(asarPath).toBeNull();
    }
  });

  test('autoHealHostAsar safely patches a fixture app.asar and stays idempotent', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-healer-test-'));
    const fixtureAsar = path.join(tmpDir, 'app.asar');
    const anchor = "electron_1.app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');";
    try {
      fs.writeFileSync(fixtureAsar, buildFixtureAsar(`const x = 1;\n${anchor}\n`));

      const first = autoHealHostAsar(fixtureAsar);
      expect(first.success).toBe(true);
      expect(first.healed).toBe(true);
      expect(first.alreadyPatched).toBe(false);
      expect(first.needsRestart).toBe(true);
      expect(fs.existsSync(`${fixtureAsar}.bak`)).toBe(true);

      const second = autoHealHostAsar(fixtureAsar);
      expect(second.success).toBe(true);
      expect(second.healed).toBe(false);
      expect(second.alreadyPatched).toBe(true);
      expect(second.needsRestart).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('autoHealHostAsar returns clean error when app.asar path does not exist', () => {
    const res = autoHealHostAsar(path.join(os.tmpdir(), `non-existent-${Date.now()}.asar`));
    expect(res.success).toBe(false);
    expect(res.healed).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
