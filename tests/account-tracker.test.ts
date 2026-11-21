import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AccountTracker,
  readAccountFromStorageFile,
  resolveAntigravityAppStoragePath,
  UNTRACKED_HISTORICAL_ACCOUNT
} from '../src/server/account-tracker';

describe('AccountTracker and Temporal Alignment', () => {
  let tempDir: string;
  let fakeAppStoragePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-account-test-'));
    fakeAppStoragePath = path.join(tempDir, 'app_storage.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test('readAccountFromStorageFile extracts username cleanly', () => {
    expect(readAccountFromStorageFile('/non/existent/path')).toBeNull();

    fs.writeFileSync(fakeAppStoragePath, JSON.stringify({ otherKey: 123 }));
    expect(readAccountFromStorageFile(fakeAppStoragePath)).toBeNull();

    fs.writeFileSync(
      fakeAppStoragePath,
      JSON.stringify({ 'agy.onboarding.lastLoginUsername': '  user@example.com  ' })
    );
    expect(readAccountFromStorageFile(fakeAppStoragePath)).toBe('user@example.com');
  });

  test('initializes timeline with current account and persists', () => {
    fs.writeFileSync(
      fakeAppStoragePath,
      JSON.stringify({ 'agy.onboarding.lastLoginUsername': 'alice@company.com' })
    );

    const tracker = new AccountTracker({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath
    });

    expect(tracker.getCurrentAccount()).toBe('alice@company.com');
    const timeline = tracker.getTimeline();
    expect(timeline.length).toBe(1);
    expect(timeline[0].account).toBe('alice@company.com');
    expect(timeline[0].end).toBeNull();

    const savedRaw = fs.readFileSync(path.join(tempDir, 'account_timeline.json'), 'utf8');
    const saved = JSON.parse(savedRaw);
    expect(saved.length).toBe(1);
    expect(saved[0].account).toBe('alice@company.com');

    tracker.close();
  });

  test('records account switches and closes previous intervals', () => {
    fs.writeFileSync(
      fakeAppStoragePath,
      JSON.stringify({ 'agy.onboarding.lastLoginUsername': 'alice@company.com' })
    );

    let switchedAccount: string | null = null;
    let prevSwitched: string | null = null;

    const tracker = new AccountTracker({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath,
      onAccountSwitch: (acc, prev) => {
        switchedAccount = acc;
        prevSwitched = prev;
      }
    });

    const t1 = 1730000000;
    const t2 = 1730005000;

    tracker.recordAccountSwitch('alice@company.com', t1); // Same account, should no-op
    expect(tracker.getTimeline().length).toBe(1);

    tracker.recordAccountSwitch('bob@personal.org', t2);
    expect<string | null>(switchedAccount).toBe('bob@personal.org');
    expect<string | null>(prevSwitched).toBe('alice@company.com');

    const timeline = tracker.getTimeline();
    expect(timeline.length).toBe(2);
    expect(timeline[0].account).toBe('alice@company.com');
    expect(timeline[0].end).toBe(t2);
    expect(timeline[1].account).toBe('bob@personal.org');
    expect(timeline[1].start).toBe(t2);
    expect(timeline[1].end).toBeNull();

    tracker.close();
  });

  test('matchAccountForTimestamp correctly resolves temporal intervals', () => {
    const tracker = new AccountTracker({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath
    });

    tracker.recordAccountSwitch('user-a@work.com', 1000);
    tracker.recordAccountSwitch('user-b@home.com', 2000);
    tracker.recordAccountSwitch('user-a@work.com', 3000);

    // Exact interval checks
    expect(tracker.matchAccountForTimestamp(1000)).toBe('user-a@work.com');
    expect(tracker.matchAccountForTimestamp(1500)).toBe('user-a@work.com');
    expect(tracker.matchAccountForTimestamp(2000)).toBe('user-b@home.com');
    expect(tracker.matchAccountForTimestamp(2999)).toBe('user-b@home.com');
    expect(tracker.matchAccountForTimestamp(3000)).toBe('user-a@work.com');
    expect(tracker.matchAccountForTimestamp(4000)).toBe('user-a@work.com');

    // Pre-tracking check: timestamps before first record strictly resolve to UNTRACKED_HISTORICAL_ACCOUNT
    expect(tracker.matchAccountForTimestamp(500)).toBe(UNTRACKED_HISTORICAL_ACCOUNT);

    tracker.close();
  });

  test('ignores stale app_storage.json overwrites when authoritative Keychain account disagrees', () => {
    fs.writeFileSync(
      fakeAppStoragePath,
      JSON.stringify({ 'agy.onboarding.lastLoginUsername': 'floricidiva@gmail.com' })
    );

    let authAccount = 'floricidiva@gmail.com';
    const switches: string[] = [];
    const tracker = new AccountTracker({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath,
      resolveAuthoritativeAccount: () => authAccount,
      onAccountSwitch: (acc) => switches.push(acc)
    });

    expect(tracker.getCurrentAccount()).toBe('floricidiva@gmail.com');

    // Electron host overwrites app_storage.json back to an old official-login account
    fs.writeFileSync(
      fakeAppStoragePath,
      JSON.stringify({ 'agy.onboarding.lastLoginUsername': 'reisawaaoi@gmail.com' })
    );
    tracker.checkStorageChange();

    expect(tracker.getCurrentAccount()).toBe('floricidiva@gmail.com');
    expect(switches).toEqual([]);
    expect(tracker.getTimeline().length).toBe(1);

    // Real authoritative account change (e.g. CLI/external login) IS recorded
    authAccount = 'kosuzu@gmail.com';
    expect(tracker.reconcileActiveAccount()).toBe(true);
    expect(tracker.getCurrentAccount()).toBe('kosuzu@gmail.com');
    expect(switches).toEqual(['kosuzu@gmail.com']);

    tracker.close();
  });
});
