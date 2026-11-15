import fs from 'node:fs';
import path from 'node:path';
import type { AccountQuotaCapacity } from '../types';

export interface UserQuotaBucket {
  bucketId: string;
  displayName: string;
  description?: string;
  window: '5h' | 'weekly' | string;
  remainingFraction: number;
  resetTime: string;
}

export interface UserQuotaGroup {
  displayName: string;
  description?: string;
  buckets?: UserQuotaBucket[];
}

export interface RetrieveUserQuotaSummaryResponse {
  response?: {
    groups?: UserQuotaGroup[];
    description?: string;
  };
}

export interface QuotaObservationPoint {
  timestamp: number;
  base5hTokens: number;
  baseWeeklyTokens: number;
  base5hCost?: number;
  baseWeeklyCost?: number;
  frac5h?: number;
  fracWeekly?: number;
  activeGroupId?: string;
  // Backward compatibility alias for tests accessing accountTokens directly
  accountTokens?: number;
}

export interface PersistedCalibrationRecord {
  fiveHourTokens?: number;
  sevenDayTokens?: number;
  fiveHourCost?: number;
  sevenDayCost?: number;
  sampleCount5h: number;
  sampleCountWeekly: number;
  lastUpdated: number;
}

export interface QuotaTrackerOptions {
  storageDir?: string;
  lsAddress?: string;
  csrfToken?: string;
  fetchTimeoutMs?: number;
  cacheTtlMs?: number;
}

/**
 * Extracts the actively burning quota group and its 5h/weekly remaining fractions.
 */
export function extractActiveQuotaFractions(
  quotaSummary: RetrieveUserQuotaSummaryResponse | null
): { frac5h?: number; fracWeekly?: number; activeGroup?: UserQuotaGroup; activeGroupId?: string } {
  const groups = quotaSummary?.response?.groups || [];
  let activeGroup: UserQuotaGroup | null = null;
  let minFraction = 1.0;

  for (const g of groups) {
    for (const b of g.buckets || []) {
      if (typeof b.remainingFraction === 'number' && b.remainingFraction < minFraction) {
        minFraction = b.remainingFraction;
        activeGroup = g;
      }
    }
  }

  if (!activeGroup && groups.length > 0) {
    activeGroup = groups[0];
  }

  const bucket5h = activeGroup?.buckets?.find((b) => b.window === '5h');
  const bucketWeekly = activeGroup?.buckets?.find((b) => b.window === 'weekly');

  return {
    frac5h: bucket5h?.remainingFraction,
    fracWeekly: bucketWeekly?.remainingFraction,
    activeGroup: activeGroup || undefined,
    activeGroupId: activeGroup?.displayName || activeGroup?.description
  };
}

export class QuotaTracker {
  private readonly storageDir?: string;
  private readonly calibrationFilePath?: string;
  private readonly lsAddress: string;
  private readonly csrfToken: string;
  private readonly fetchTimeoutMs: number;
  private readonly cacheTtlMs: number;

  private latestQuotaSummary: RetrieveUserQuotaSummaryResponse | null = null;
  private lastFetchTime = 0;
  private inFlightFetch: Promise<RetrieveUserQuotaSummaryResponse | null> | null = null;

  private readonly baselines = new Map<string, QuotaObservationPoint>();
  private readonly calibrations = new Map<string, PersistedCalibrationRecord>();

  constructor(options?: QuotaTrackerOptions) {
    this.storageDir = options?.storageDir;
    this.calibrationFilePath = this.storageDir
      ? path.join(this.storageDir, 'quota_calibration.json')
      : undefined;

    this.lsAddress = options?.lsAddress || process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:5387';
    this.csrfToken = options?.csrfToken || process.env.ANTIGRAVITY_CSRF_TOKEN || '';
    this.fetchTimeoutMs = options?.fetchTimeoutMs || 1500;
    this.cacheTtlMs = options?.cacheTtlMs || 20_000;

    this.loadCalibrations();
  }

  public getLatestQuotaSummary(): RetrieveUserQuotaSummaryResponse | null {
    return this.latestQuotaSummary;
  }

  public setLatestQuotaSummaryForTesting(summary: RetrieveUserQuotaSummaryResponse | null): void {
    this.latestQuotaSummary = summary;
    this.lastFetchTime = Date.now();
  }

  public setCalibrationForTesting(account: string, record: PersistedCalibrationRecord): void {
    this.calibrations.set(account, record);
  }

  public getCalibrationRecord(account: string): PersistedCalibrationRecord | undefined {
    return this.calibrations.get(account);
  }

  private loadCalibrations(): void {
    if (!this.calibrationFilePath) return;
    try {
      if (fs.existsSync(this.calibrationFilePath)) {
        const raw = fs.readFileSync(this.calibrationFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [acc, rec] of Object.entries(parsed)) {
            if (rec && typeof rec === 'object') {
              const r = rec as Partial<PersistedCalibrationRecord>;
              this.calibrations.set(acc, {
                fiveHourTokens: typeof r.fiveHourTokens === 'number' ? r.fiveHourTokens : undefined,
                sevenDayTokens: typeof r.sevenDayTokens === 'number' ? r.sevenDayTokens : undefined,
                fiveHourCost: typeof r.fiveHourCost === 'number' ? r.fiveHourCost : undefined,
                sevenDayCost: typeof r.sevenDayCost === 'number' ? r.sevenDayCost : undefined,
                sampleCount5h: typeof r.sampleCount5h === 'number' ? r.sampleCount5h : 0,
                sampleCountWeekly: typeof r.sampleCountWeekly === 'number' ? r.sampleCountWeekly : 0,
                lastUpdated: typeof r.lastUpdated === 'number' ? r.lastUpdated : Date.now()
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[QuotaTracker] Failed to load quota_calibration.json:', err);
    }
  }

  private saveCalibrations(): void {
    if (!this.calibrationFilePath || !this.storageDir) return;
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const serializable: Record<string, PersistedCalibrationRecord> = {};
      for (const [acc, rec] of this.calibrations.entries()) {
        serializable[acc] = rec;
      }
      fs.writeFileSync(this.calibrationFilePath, JSON.stringify(serializable, null, 2), 'utf8');
    } catch (err) {
      console.error('[QuotaTracker] Failed to save quota_calibration.json:', err);
    }
  }

  public async fetchQuotaSummary(force = false): Promise<RetrieveUserQuotaSummaryResponse | null> {
    const now = Date.now();
    if (!force && this.latestQuotaSummary && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.latestQuotaSummary;
    }

    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }

    this.inFlightFetch = this.performFetch()
      .then((summary) => {
        if (summary) {
          this.latestQuotaSummary = summary;
          this.lastFetchTime = Date.now();
        }
        return this.latestQuotaSummary;
      })
      .finally(() => {
        this.inFlightFetch = null;
      });

    return this.inFlightFetch;
  }

  private async performFetch(): Promise<RetrieveUserQuotaSummaryResponse | null> {
    const url = `http://${this.lsAddress}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-codeium-csrf-token': this.csrfToken
        },
        body: '{}',
        signal: controller.signal
      });

      if (!res.ok) return null;
      const data = (await res.json()) as RetrieveUserQuotaSummaryResponse;
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Differential Calibration Algorithm (ΔTokens / ΔQuota)
   * Captures pure marginal token cost over incremental quota drops.
   * Completely immune to pre-installation history, untracked gaps, or cross-device consumption.
   */
  public recordObservation(
    account: string,
    currentAccountTokens: number,
    frac5h?: number,
    fracWeekly?: number,
    currentAccountCost?: number,
    activeGroupId?: string
  ): void {
    const base = this.baselines.get(account);
    if (!base) {
      // First baseline entry
      this.baselines.set(account, {
        timestamp: Date.now(),
        accountTokens: currentAccountTokens,
        base5hTokens: currentAccountTokens,
        baseWeeklyTokens: currentAccountTokens,
        base5hCost: currentAccountCost,
        baseWeeklyCost: currentAccountCost,
        frac5h,
        fracWeekly,
        activeGroupId
      });
      return;
    }

    // If quota group changed dynamically (e.g. from Gemini to 3P), reset baseline to prevent cross-group pollution
    if (activeGroupId && base.activeGroupId && activeGroupId !== base.activeGroupId) {
      base.activeGroupId = activeGroupId;
      base.accountTokens = currentAccountTokens;
      base.base5hTokens = currentAccountTokens;
      base.baseWeeklyTokens = currentAccountTokens;
      base.base5hCost = currentAccountCost;
      base.baseWeeklyCost = currentAccountCost;
      base.frac5h = frac5h;
      base.fracWeekly = fracWeekly;
      return;
    }
    if (activeGroupId && !base.activeGroupId) {
      base.activeGroupId = activeGroupId;
    }

    let updated = false;

    const record = this.calibrations.get(account) || {
      sampleCount5h: 0,
      sampleCountWeekly: 0,
      lastUpdated: Date.now()
    };

    // 1. Five Hour Differential Window (ΔTokens / ΔQ_5h)
    if (typeof base.frac5h === 'number' && typeof frac5h === 'number') {
      if (frac5h > base.frac5h + 0.05) {
        // Window reset occurred on server (e.g. from 20% to 100%)
        base.frac5h = frac5h;
        base.base5hTokens = currentAccountTokens;
        base.base5hCost = currentAccountCost;
      } else {
        const deltaQ5h = base.frac5h - frac5h;
        const deltaTokens5h =
          currentAccountTokens - (base.base5hTokens ?? base.accountTokens ?? currentAccountTokens);
        const deltaCost5h =
          typeof currentAccountCost === 'number' && typeof base.base5hCost === 'number'
            ? currentAccountCost - base.base5hCost
            : undefined;

        // Require at least 0.3% quota drop and 100k tokens consumed to filter noise
        if (deltaQ5h >= 0.003 && deltaTokens5h >= 100_000) {
          const measured5h = Math.round(deltaTokens5h / deltaQ5h);
          if (measured5h >= 1_000_000 && measured5h <= 10_000_000_000) {
            if (record.fiveHourTokens && record.sampleCount5h > 0) {
              record.fiveHourTokens = Math.round(record.fiveHourTokens * 0.7 + measured5h * 0.3);
            } else {
              record.fiveHourTokens = measured5h;
            }

            if (typeof deltaCost5h === 'number' && deltaCost5h > 0) {
              const measured5hCost = Math.round((deltaCost5h / deltaQ5h) * 100) / 100;
              if (record.fiveHourCost && record.sampleCount5h > 0) {
                record.fiveHourCost =
                  Math.round((record.fiveHourCost * 0.7 + measured5hCost * 0.3) * 100) / 100;
              } else {
                record.fiveHourCost = measured5hCost;
              }
            }

            record.sampleCount5h++;
            record.lastUpdated = Date.now();
            base.frac5h = frac5h;
            base.base5hTokens = currentAccountTokens;
            base.base5hCost = currentAccountCost;
            base.accountTokens = currentAccountTokens;
            updated = true;
          }
        }
      }
    }

    // 2. Weekly Differential Window (ΔTokens / ΔQ_weekly)
    if (typeof base.fracWeekly === 'number' && typeof fracWeekly === 'number') {
      if (fracWeekly > base.fracWeekly + 0.05) {
        // Weekly window reset occurred on server
        base.fracWeekly = fracWeekly;
        base.baseWeeklyTokens = currentAccountTokens;
        base.baseWeeklyCost = currentAccountCost;
      } else {
        const deltaQWeekly = base.fracWeekly - fracWeekly;
        const deltaTokensWeekly =
          currentAccountTokens - (base.baseWeeklyTokens ?? base.accountTokens ?? currentAccountTokens);
        const deltaCostWeekly =
          typeof currentAccountCost === 'number' && typeof base.baseWeeklyCost === 'number'
            ? currentAccountCost - base.baseWeeklyCost
            : undefined;

        // Require at least 0.2% quota drop and 200k tokens consumed to filter noise
        if (deltaQWeekly >= 0.002 && deltaTokensWeekly >= 200_000) {
          const measuredWeekly = Math.round(deltaTokensWeekly / deltaQWeekly);
          if (measuredWeekly >= 10_000_000 && measuredWeekly <= 50_000_000_000) {
            if (record.sevenDayTokens && record.sampleCountWeekly > 0) {
              record.sevenDayTokens = Math.round(record.sevenDayTokens * 0.7 + measuredWeekly * 0.3);
            } else {
              record.sevenDayTokens = measuredWeekly;
            }

            if (typeof deltaCostWeekly === 'number' && deltaCostWeekly > 0) {
              const measuredWeeklyCost = Math.round((deltaCostWeekly / deltaQWeekly) * 100) / 100;
              if (record.sevenDayCost && record.sampleCountWeekly > 0) {
                record.sevenDayCost =
                  Math.round((record.sevenDayCost * 0.7 + measuredWeeklyCost * 0.3) * 100) / 100;
              } else {
                record.sevenDayCost = measuredWeeklyCost;
              }
            }

            record.sampleCountWeekly++;
            record.lastUpdated = Date.now();
            base.fracWeekly = fracWeekly;
            base.baseWeeklyTokens = currentAccountTokens;
            base.baseWeeklyCost = currentAccountCost;
            base.accountTokens = currentAccountTokens;
            updated = true;
          }
        }
      }
    }

    if (updated) {
      this.calibrations.set(account, record);
      this.saveCalibrations();
    }
  }

  public getAccountQuotaCapacity(
    account: string,
    tokens5h: number,
    tokens7d: number,
    totalAccountTokens?: number,
    totalAccountCost?: number,
    cost5h?: number,
    cost7d?: number
  ): AccountQuotaCapacity {
    const now = Date.now();
    if (now - this.lastFetchTime >= this.cacheTtlMs && !this.inFlightFetch) {
      void this.fetchQuotaSummary();
    }

    const { frac5h, fracWeekly, activeGroupId } = extractActiveQuotaFractions(
      this.latestQuotaSummary
    );

    // Drive differential calibration if account tokens are provided
    if (typeof totalAccountTokens === 'number') {
      this.recordObservation(
        account,
        totalAccountTokens,
        frac5h,
        fracWeekly,
        totalAccountCost,
        activeGroupId
      );
    }

    const record = this.calibrations.get(account);
    const isCalibrated = !!(
      record?.fiveHourTokens ||
      record?.sevenDayTokens ||
      record?.fiveHourCost ||
      record?.sevenDayCost
    );

    return {
      fiveHourTokens: record?.fiveHourTokens,
      sevenDayTokens: record?.sevenDayTokens,
      fiveHourCost: record?.fiveHourCost,
      sevenDayCost: record?.sevenDayCost,
      fiveHourUsed: tokens5h,
      sevenDayUsed: tokens7d,
      fiveHourFraction: frac5h,
      weeklyFraction: fracWeekly,
      status: isCalibrated ? 'calibrated' : 'calibrating'
    };
  }
}
