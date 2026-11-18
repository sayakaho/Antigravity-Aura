import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { autoHealHostAsar, resolveHostAsarPath } from '../src/server/host-healer';

describe('Host Healer & Auto-Patcher', () => {
  test('resolveHostAsarPath finds Antigravity app.asar if installed', () => {
    const asarPath = resolveHostAsarPath();
    if (process.platform === 'darwin') {
      expect(asarPath).toBeTruthy();
      expect(fs.existsSync(asarPath!)).toBe(true);
    }
  });

  test('autoHealHostAsar safely detects or patches app.asar idempotently', () => {
    const res = autoHealHostAsar();
    expect(res.success).toBe(true);
    // On repeated runs, alreadyPatched is true
    const res2 = autoHealHostAsar();
    expect(res2.success).toBe(true);
    expect(res2.alreadyPatched).toBe(true);
  });
});
