import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AccountTimelineEntry } from '../types';

export const UNTRACKED_HISTORICAL_ACCOUNT = 'Untracked (Historical)';

export function isUntrackedAccount(account: string): boolean {
  return account === UNTRACKED_HISTORICAL_ACCOUNT || account.startsWith('Untracked');
}

export function resolveAntigravityAppStoragePath(): string {
  if (
    process.env.ANTIGRAVITY_APP_STORAGE_PATH &&
    fs.existsSync(process.env.ANTIGRAVITY_APP_STORAGE_PATH)
  ) {
    return process.env.ANTIGRAVITY_APP_STORAGE_PATH;
  }
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Antigravity', 'app_storage.json');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Antigravity', 'app_storage.json');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdgConfig, 'Antigravity', 'app_storage.json');
}

export function readAccountFromStorageFile(storagePath: string): string | null {
  try {
    if (!fs.existsSync(storagePath)) return null;
    const raw = fs.readFileSync(storagePath, 'utf8');
    const data = JSON.parse(raw);
    const username = data?.['agy.onboarding.lastLoginUsername'];
    if (typeof username === 'string' && username.trim().length > 0) {
      return username.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export interface AccountTrackerOptions {
  storageDir?: string;
  appStoragePath?: string;
  onAccountSwitch?: (account: string, prevAccount: string | null) => void;
}

export class AccountTracker {
  private readonly storageDir: string;
  private readonly timelinePath: string;
  private readonly appStoragePath: string;
  private readonly onAccountSwitch?: (account: string, prevAccount: string | null) => void;

  private timeline: AccountTimelineEntry[] = [];
  private currentAccount: string | null = null;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: AccountTrackerOptions) {
    this.storageDir = options?.storageDir || path.join(os.homedir(), '.gemini', 'antigravity');
    this.timelinePath = path.join(this.storageDir, 'account_timeline.json');
    this.appStoragePath = options?.appStoragePath || resolveAntigravityAppStoragePath();
    this.onAccountSwitch = options?.onAccountSwitch;

    this.init();
  }

  private init(): void {
    this.loadTimeline();
    const active = readAccountFromStorageFile(this.appStoragePath);
    if (active) {
      this.currentAccount = active;
      this.ensureCurrentAccountInTimeline(active);
    }
    this.startWatching();
  }

  public getCurrentAccount(): string | null {
    return this.currentAccount;
  }

  public getTimeline(): AccountTimelineEntry[] {
    return [...this.timeline];
  }

  public getStorageDir(): string {
    return this.storageDir;
  }

  private loadTimeline(): void {
    try {
      if (fs.existsSync(this.timelinePath)) {
        const raw = fs.readFileSync(this.timelinePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.timeline = parsed.filter(
            (item): item is AccountTimelineEntry =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.account === 'string' &&
              typeof item.start === 'number'
          );
        }
      }
    } catch (err) {
      console.warn('[AccountTracker] Failed to load timeline, starting fresh:', err);
      this.timeline = [];
    }
  }

  private saveTimeline(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      fs.writeFileSync(this.timelinePath, JSON.stringify(this.timeline, null, 2), 'utf8');
    } catch (err) {
      console.error('[AccountTracker] Failed to save account timeline:', err);
    }
  }

  public recordAccountSwitch(newAccount: string, timestampSec = Math.floor(Date.now() / 1000)): void {
    const trimmed = newAccount.trim();
    if (!trimmed) return;

    const prevAccount = this.currentAccount;
    if (prevAccount === trimmed && this.timeline.length > 0 && this.timeline[this.timeline.length - 1].end === null) {
      return;
    }

    const lastEntry = this.timeline.length > 0 ? this.timeline[this.timeline.length - 1] : null;
    if (lastEntry && lastEntry.end === null) {
      if (lastEntry.start > timestampSec) {
        lastEntry.start = timestampSec;
      }
      lastEntry.end = timestampSec;
    }

    this.timeline.push({
      account: trimmed,
      start: timestampSec,
      end: null
    });
    this.currentAccount = trimmed;
    this.saveTimeline();

    if (this.onAccountSwitch) {
      try {
        this.onAccountSwitch(trimmed, prevAccount);
      } catch (err) {
        console.error('[AccountTracker] onAccountSwitch callback error:', err);
      }
    }
  }

  private ensureCurrentAccountInTimeline(account: string, nowSec = Math.floor(Date.now() / 1000)): void {
    if (this.timeline.length === 0) {
      this.timeline.push({
        account,
        start: nowSec,
        end: null
      });
      this.saveTimeline();
      return;
    }

    const last = this.timeline[this.timeline.length - 1];
    if (last.end === null) {
      if (last.account !== account) {
        last.end = Math.max(last.start, nowSec);
        this.timeline.push({
          account,
          start: nowSec,
          end: null
        });
        this.saveTimeline();
      }
    } else {
      this.timeline.push({
        account,
        start: nowSec,
        end: null
      });
      this.saveTimeline();
    }
  }

  public matchAccountForTimestamp(timestampSec: number): string {
    if (this.timeline.length === 0) {
      return UNTRACKED_HISTORICAL_ACCOUNT;
    }

    // 1. Direct temporal interval match
    for (const entry of this.timeline) {
      if (timestampSec >= entry.start && (entry.end === null || timestampSec < entry.end)) {
        return entry.account;
      }
    }

    // 2. Before the earliest recorded entry: strictly isolate as untracked historical data
    if (timestampSec < this.timeline[0].start) {
      return UNTRACKED_HISTORICAL_ACCOUNT;
    }

    // 3. Fallback if beyond closed intervals:
    const lastEntry = this.timeline[this.timeline.length - 1];
    if (lastEntry.end === null) {
      return lastEntry.account;
    }
    return this.currentAccount || UNTRACKED_HISTORICAL_ACCOUNT;
  }

  private startWatching(): void {
    const targetFile = this.appStoragePath;
    const targetDir = path.dirname(targetFile);

    try {
      if (!fs.existsSync(targetDir)) return;
      this.watcher = fs.watch(targetDir, { persistent: false }, (_event, filename) => {
        if (!filename || filename.includes('app_storage')) {
          this.scheduleCheck();
        }
      });
    } catch (err) {
      console.warn('[AccountTracker] Failed to establish file watcher for app_storage:', err);
    }
  }

  private scheduleCheck(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.checkStorageChange();
    }, 400);
  }

  public checkStorageChange(): void {
    const updated = readAccountFromStorageFile(this.appStoragePath);
    if (updated && updated !== this.currentAccount) {
      this.recordAccountSwitch(updated);
    }
  }

  public close(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {}
      this.watcher = null;
    }
  }
}
