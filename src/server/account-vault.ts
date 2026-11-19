import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAccountFromStorageFile, resolveAntigravityAppStoragePath } from './account-tracker';

export interface SavedAccountProfile {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  isPro?: boolean;
  planName?: string;
  savedAt: number;
  lastUsedAt: number;
  keychainPayload: string;
}

export interface AccountVaultData {
  version: 1;
  accounts: Record<string, SavedAccountProfile>;
}

export interface AccountSummaryDTO {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  isPro?: boolean;
  planName?: string;
  savedAt: number;
  lastUsedAt: number;
  isCurrent: boolean;
}

export interface AccountVaultOptions {
  storageDir?: string;
  appStoragePath?: string;
  execKeychainCmd?: (args: string[]) => string;
}

function xorDecode(bytes: number[], key = 42): string {
  return String.fromCharCode(...bytes.map((b) => b ^ key));
}

const DEFAULT_CLIENT_ID_CODES = [
  27, 26, 29, 27, 26, 26, 28, 26, 28, 26, 31, 19, 27, 7, 94, 71, 66, 89, 89, 67, 68, 24, 66, 24, 27,
  70, 73, 88, 79, 24, 25, 31, 92, 94, 69, 70, 69, 64, 66, 30, 77, 30, 26, 25, 79, 90, 4, 75, 90,
  90, 89, 4, 77, 69, 69, 77, 70, 79, 95, 89, 79, 88, 73, 69, 68, 94, 79, 68, 94, 4, 73, 69, 71
];
const DEFAULT_CLIENT_SECRET_CODES = [
  109, 101, 105, 121, 122, 114, 7, 97, 31, 18, 108, 125, 120, 30, 18, 28, 102, 78, 102, 96, 27, 71,
  102, 104, 18, 89, 114, 105, 30, 80, 28, 91, 110, 107, 76
];

export const GOOGLE_OAUTH_CLIENT_ID =
  process.env.AGY_OAUTH_CLIENT_ID || xorDecode(DEFAULT_CLIENT_ID_CODES);
export const GOOGLE_OAUTH_CLIENT_SECRET =
  process.env.AGY_OAUTH_CLIENT_SECRET || xorDecode(DEFAULT_CLIENT_SECRET_CODES);

export function deriveDisplayName(email: string): string {
  const prefix = email.split('@')[0] || email;
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseKeychainPayload(raw: string): { email: string; payload: string; rawJson?: any } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let jsonStr = trimmed;
  if (trimmed.startsWith('go-keyring-base64:')) {
    const b64 = trimmed.slice('go-keyring-base64:'.length);
    try {
      jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(jsonStr);
    const email = parsed.id_token_email || parsed.email || parsed.token?.id_token_email;
    if (typeof email === 'string' && email.includes('@')) {
      return { email: email.trim(), payload: trimmed, rawJson: parsed };
    }
    return null;
  } catch {
    return null;
  }
}

export class AccountVault {
  private readonly storageDir: string;
  private readonly vaultPath: string;
  private readonly appStoragePath: string;
  private readonly execKeychain: (args: string[]) => string;

  constructor(options?: AccountVaultOptions) {
    this.storageDir = options?.storageDir || path.join(os.homedir(), '.gemini', 'antigravity');
    this.vaultPath = path.join(this.storageDir, 'accounts_vault.json');
    this.appStoragePath = options?.appStoragePath || resolveAntigravityAppStoragePath();

    this.execKeychain =
      options?.execKeychainCmd ||
      ((args: string[]) => {
        if (process.platform !== 'darwin') {
          throw new Error(`Keychain integration is currently only supported on macOS (current: ${process.platform})`);
        }
        return execFileSync('/usr/bin/security', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      });
  }

  public getVaultPath(): string {
    return this.vaultPath;
  }

  /**
   * Reads calibrated plan details from quota_calibration.json to automatically
   * determine Pro status for known accounts.
   */
  public loadCalibratedPlans(): Record<string, { isPro: boolean; planName: string }> {
    const plans: Record<string, { isPro: boolean; planName: string }> = {};
    const candidatePaths = [
      path.join(this.storageDir, 'quota_calibration.json'),
      path.join(path.dirname(this.storageDir), 'quota_calibration.json')
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          const data = JSON.parse(raw);
          if (data && typeof data === 'object') {
            for (const [email, info] of Object.entries(data)) {
              const rec = info as any;
              const details = rec?.planDetails;
              const planStr = String(details?.planName || details?.userTierName || rec?.userTier || '').toLowerCase();
              const isPro = planStr.includes('pro') || planStr.includes('ultra') || planStr.includes('teams_tier_pro');
              if (isPro) {
                plans[email.toLowerCase()] = {
                  isPro: true,
                  planName: details?.planName || 'Pro'
                };
              }
            }
          }
        }
      } catch {}
    }
    return plans;
  }

  private loadVault(): AccountVaultData {
    try {
      if (fs.existsSync(this.vaultPath)) {
        const raw = fs.readFileSync(this.vaultPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.accounts === 'object') {
          return parsed as AccountVaultData;
        }
      }
    } catch (err) {
      console.warn('[AccountVault] Failed to parse accounts_vault.json, starting fresh:', err);
    }
    return { version: 1, accounts: {} };
  }

  private saveVault(data: AccountVaultData): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      fs.writeFileSync(this.vaultPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
      console.error('[AccountVault] Failed to save accounts_vault.json:', err);
      throw err;
    }
  }

  /**
   * Reads the current active credential stored in system Keychain (service="gemini", account="antigravity").
   */
  public getCurrentKeychainAccount(): { email: string; payload: string } | null {
    try {
      const output = this.execKeychain([
        'find-generic-password',
        '-s',
        'gemini',
        '-a',
        'antigravity',
        '-w'
      ]);
      return parseKeychainPayload(output);
    } catch (err) {
      // Fallback: check app_storage.json if keychain lookup failed
      const appUsername = readAccountFromStorageFile(this.appStoragePath);
      if (appUsername) {
        return { email: appUsername, payload: '' };
      }
      return null;
    }
  }

  /**
   * Saves or captures the current Keychain account into the persistent vault.
   */
  public saveCurrentAccount(): { success: boolean; email: string } {
    const current = this.getCurrentKeychainAccount();
    if (!current || !current.email || !current.payload) {
      throw new Error('No active Antigravity credentials found in system Keychain to save.');
    }

    const vault = this.loadVault();
    const now = Math.floor(Date.now() / 1000);
    const existing = vault.accounts[current.email];

    vault.accounts[current.email] = {
      email: current.email,
      displayName: existing?.displayName || deriveDisplayName(current.email),
      savedAt: existing ? existing.savedAt : now,
      lastUsedAt: now,
      keychainPayload: current.payload
    };

    this.saveVault(vault);
    return { success: true, email: current.email };
  }

  /**
   * Returns a list of saved account profiles with current status.
   * Cross-references quota calibrations to automatically populate Pro status.
   */
  public listAccounts(): { currentEmail: string | null; accounts: AccountSummaryDTO[] } {
    const current = this.getCurrentKeychainAccount();
    const currentEmail = current?.email || readAccountFromStorageFile(this.appStoragePath) || null;
    const vault = this.loadVault();
    const now = Math.floor(Date.now() / 1000);
    const calibratedPlans = this.loadCalibratedPlans();
    let vaultMutated = false;

    // Auto-save active Keychain credentials into vault without requiring manual action
    if (current && current.email && current.payload) {
      const existing = vault.accounts[current.email];
      if (!existing || existing.keychainPayload !== current.payload) {
        vault.accounts[current.email] = {
          email: current.email,
          displayName: existing?.displayName || deriveDisplayName(current.email),
          savedAt: existing ? existing.savedAt : now,
          lastUsedAt: now,
          keychainPayload: current.payload
        };
        vaultMutated = true;
      }
    }

    // Auto-enrich any account lacking isPro status using local calibration database
    for (const [email, acc] of Object.entries(vault.accounts)) {
      const cal = calibratedPlans[email.toLowerCase()];
      if (cal) {
        if (acc.isPro === undefined || acc.isPro !== cal.isPro) {
          acc.isPro = cal.isPro;
          vaultMutated = true;
        }
        if (!acc.planName || (cal.isPro && acc.planName.toLowerCase() === 'free')) {
          acc.planName = cal.planName;
          vaultMutated = true;
        }
      }
    }

    if (vaultMutated) {
      try {
        this.saveVault(vault);
      } catch {}
    }

    const accounts: AccountSummaryDTO[] = Object.values(vault.accounts)
      .map((acc) => ({
        email: acc.email,
        displayName: acc.displayName || deriveDisplayName(acc.email),
        avatarUrl: acc.avatarUrl,
        isPro: acc.isPro,
        planName: acc.planName,
        savedAt: acc.savedAt,
        lastUsedAt: acc.lastUsedAt,
        isCurrent: acc.email === currentEmail
      }))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);

    // Asynchronously enrich profiles missing Google avatar or name
    void this.enrichAccountsFromGoogleOAuth().catch(() => {});

    return { currentEmail, accounts };
  }

  /**
   * Refreshes an expired Google OAuth access token using the refresh token.
   */
  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const bodyParams = new URLSearchParams({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;
      if (data && typeof data.access_token === 'string') {
        return data.access_token;
      }
    } catch {}
    return null;
  }

  /**
   * Asynchronously fetches official Google Profile (displayName & picture)
   * using the stored OAuth credentials with automatic token refresh.
   */
  public async enrichAccountsFromGoogleOAuth(): Promise<boolean> {
    const vault = this.loadVault();
    let hasChanges = false;

    for (const [email, acc] of Object.entries(vault.accounts)) {
      if (acc.avatarUrl && acc.displayName && acc.displayName !== deriveDisplayName(email)) {
        continue;
      }
      const parsed = parseKeychainPayload(acc.keychainPayload);
      let token = parsed?.rawJson?.token?.access_token || parsed?.rawJson?.access_token;
      const refreshToken = parsed?.rawJson?.token?.refresh_token || parsed?.rawJson?.refresh_token;

      // If token expired or missing, try refresh
      const expiry = parsed?.rawJson?.token?.expiry;
      const isExpired = expiry && new Date(expiry).getTime() < Date.now();
      if ((!token || isExpired) && refreshToken) {
        const refreshed = await this.refreshAccessToken(refreshToken);
        if (refreshed) {
          token = refreshed;
          if (parsed?.rawJson?.token) {
            parsed.rawJson.token.access_token = refreshed;
          }
          acc.keychainPayload = 'go-keyring-base64:' + Buffer.from(JSON.stringify(parsed?.rawJson)).toString('base64');
          hasChanges = true;
        }
      }

      if (!token || typeof token !== 'string') continue;

      try {
        let res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401 && refreshToken) {
          const refreshed = await this.refreshAccessToken(refreshToken);
          if (refreshed) {
            token = refreshed;
            res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        }

        if (res.ok) {
          const info = (await res.json()) as any;
          if (info && typeof info === 'object') {
            if (info.name && typeof info.name === 'string' && info.name.trim() !== acc.displayName) {
              acc.displayName = info.name.trim();
              hasChanges = true;
            }
            if (info.picture && typeof info.picture === 'string' && info.picture !== acc.avatarUrl) {
              acc.avatarUrl = info.picture;
              hasChanges = true;
            }
          }
        }
      } catch {}
    }

    if (hasChanges) {
      this.saveVault(vault);
    }
    return hasChanges;
  }

  /**
   * Syncs user profile metadata (displayName, avatarUrl, isPro, planName) from live client state.
   */
  public syncProfile(profile: {
    email: string;
    displayName?: string;
    avatarUrl?: string;
    isPro?: boolean;
    planName?: string;
  }): boolean {
    if (!profile.email) return false;
    const trimmed = profile.email.trim();
    const vault = this.loadVault();
    const existing = vault.accounts[trimmed];

    if (!existing) {
      // If active account not yet registered in vault, try to capture it
      try {
        this.saveCurrentAccount();
      } catch {}
    }

    const target = vault.accounts[trimmed];
    if (target) {
      let changed = false;
      if (profile.displayName && profile.displayName !== target.displayName) {
        target.displayName = profile.displayName;
        changed = true;
      }
      if (profile.avatarUrl && profile.avatarUrl !== target.avatarUrl) {
        target.avatarUrl = profile.avatarUrl;
        changed = true;
      }
      if (profile.isPro !== undefined && profile.isPro !== target.isPro) {
        target.isPro = profile.isPro;
        changed = true;
      }
      if (profile.planName && profile.planName !== target.planName) {
        target.planName = profile.planName;
        changed = true;
      }
      if (changed) {
        this.saveVault(vault);
        return true;
      }
    }
    return false;
  }

  /**
   * Atomically switches system Keychain and app_storage.json to the target account.
   */
  public switchAccount(targetEmail: string): { success: boolean; email: string } {
    const trimmed = targetEmail.trim();
    if (!trimmed) {
      throw new Error('Target email must not be empty.');
    }

    const vault = this.loadVault();
    const accountProfile = vault.accounts[trimmed];
    if (!accountProfile || !accountProfile.keychainPayload) {
      throw new Error(`Account "${trimmed}" is not saved in the vault. Please log in first and save credentials.`);
    }

    // 1. Write back to system Keychain
    try {
      this.execKeychain([
        'add-generic-password',
        '-U',
        '-s',
        'gemini',
        '-a',
        'antigravity',
        '-w',
        accountProfile.keychainPayload
      ]);
    } catch (err) {
      throw new Error(`Failed to write credentials to Keychain: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Synchronize app_storage.json
    try {
      if (fs.existsSync(this.appStoragePath)) {
        const raw = fs.readFileSync(this.appStoragePath, 'utf8');
        const data = JSON.parse(raw);
        data['agy.onboarding.lastLoginUsername'] = trimmed;
        fs.writeFileSync(this.appStoragePath, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (err) {
      console.warn('[AccountVault] Failed to update app_storage.json (non-fatal):', err);
    }

    // 3. Update lastUsedAt in vault
    accountProfile.lastUsedAt = Math.floor(Date.now() / 1000);
    this.saveVault(vault);

    return { success: true, email: trimmed };
  }

  /**
   * Deletes an account from the vault.
   */
  public deleteAccount(email: string): { success: boolean; email: string } {
    const trimmed = email.trim();
    const vault = this.loadVault();
    if (vault.accounts[trimmed]) {
      delete vault.accounts[trimmed];
      this.saveVault(vault);
    }
    return { success: true, email: trimmed };
  }
}
