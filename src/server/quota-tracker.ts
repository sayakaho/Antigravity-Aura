import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  AccountPlanDetails,
  AccountQuotaCapacity,
  CalibrationSnapshot,
  QuotaWindowTransition
} from '../types';
import { formatLocalDateAndHourKeys } from '../shared/format';

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

export interface GetUserStatusResponse {
  userStatus?: {
    name?: string;
    email?: string;
    planStatus?: {
      planInfo?: {
        teamsTier?: string;
        planName?: string;
        monthlyPromptCredits?: number;
        monthlyFlowCredits?: number;
      };
    };
    userTier?: {
      id?: string;
      name?: string;
      description?: string;
    };
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
  planDetails?: AccountPlanDetails;
  history?: CalibrationSnapshot[];
  recentTransitions?: QuotaWindowTransition[];
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
): {
  frac5h?: number;
  fracWeekly?: number;
  activeGroup?: UserQuotaGroup;
  activeGroupId?: string;
  windowStart5hMs?: number;
  windowStartWeeklyMs?: number;
  resetTime5h?: string;
  resetTimeWeekly?: string;
} {
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

  let windowStart5hMs: number | undefined;
  if (bucket5h?.resetTime) {
    const t = new Date(bucket5h.resetTime).getTime();
    if (!isNaN(t)) {
      windowStart5hMs = t - 5 * 3600 * 1000;
    }
  }

  let windowStartWeeklyMs: number | undefined;
  if (bucketWeekly?.resetTime) {
    const t = new Date(bucketWeekly.resetTime).getTime();
    if (!isNaN(t)) {
      windowStartWeeklyMs = t - 7 * 86400 * 1000;
    }
  }

  return {
    frac5h: bucket5h?.remainingFraction,
    fracWeekly: bucketWeekly?.remainingFraction,
    activeGroup: activeGroup || undefined,
    activeGroupId: activeGroup?.displayName || activeGroup?.description,
    windowStart5hMs,
    windowStartWeeklyMs,
    resetTime5h: bucket5h?.resetTime,
    resetTimeWeekly: bucketWeekly?.resetTime
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
  private latestUserStatus: GetUserStatusResponse | null = null;
  private lastFetchTime = 0;
  private inFlightFetch: Promise<RetrieveUserQuotaSummaryResponse | null> | null = null;
  private inFlightUserStatusFetch: Promise<GetUserStatusResponse | null> | null = null;

  private readonly baselines = new Map<string, QuotaObservationPoint>();
  private readonly calibrations = new Map<string, PersistedCalibrationRecord>();

  constructor(options?: QuotaTrackerOptions) {
    this.storageDir = options?.storageDir || path.join(os.homedir(), '.gemini', 'antigravity');
    this.calibrationFilePath = path.join(this.storageDir, 'quota_calibration.json');

    this.lsAddress = options?.lsAddress || process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:5387';
    this.csrfToken = options?.csrfToken || process.env.ANTIGRAVITY_CSRF_TOKEN || '';
    this.fetchTimeoutMs = options?.fetchTimeoutMs || 1500;
    this.cacheTtlMs = options?.cacheTtlMs || 20_000;

    this.loadCalibrations();
    // Warm up background fetch on startup so first evaluation does not hit uninitialized state
    void this.fetchQuotaSummary();
    void this.fetchUserStatus();
  }

  public getLatestQuotaSummary(): RetrieveUserQuotaSummaryResponse | null {
    return this.latestQuotaSummary;
  }

  public getLatestUserStatus(): GetUserStatusResponse | null {
    return this.latestUserStatus;
  }

  public resetLiveCache(): void {
    this.latestUserStatus = null;
    this.latestQuotaSummary = null;
    this.lastFetchTime = 0;
  }

  public getLatestPlanDetails(): AccountPlanDetails | undefined {
    const status = this.latestUserStatus?.userStatus;
    const planInfo = status?.planStatus?.planInfo;
    const userTier = status?.userTier;
    if (!planInfo?.planName && !userTier?.name && !userTier?.id) {
      return undefined;
    }
    return {
      planName: planInfo?.planName,
      teamsTier: planInfo?.teamsTier,
      monthlyPromptCredits: planInfo?.monthlyPromptCredits,
      monthlyFlowCredits: planInfo?.monthlyFlowCredits,
      userTierId: userTier?.id,
      userTierName: userTier?.name
    };
  }

  public getActiveQuotaWindows(): {
    frac5h?: number;
    fracWeekly?: number;
    activeGroup?: UserQuotaGroup;
    activeGroupId?: string;
    windowStart5hMs?: number;
    windowStartWeeklyMs?: number;
    resetTime5h?: string;
    resetTimeWeekly?: string;
  } {
    return extractActiveQuotaFractions(this.latestQuotaSummary);
  }

  public setLatestQuotaSummaryForTesting(summary: RetrieveUserQuotaSummaryResponse | null): void {
    this.latestQuotaSummary = summary;
    this.lastFetchTime = Date.now();
  }

  public setLatestUserStatusForTesting(status: GetUserStatusResponse | null): void {
    this.latestUserStatus = status;
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
          let dirty = false;
          for (const [acc, rec] of Object.entries(parsed)) {
            if (rec && typeof rec === 'object') {
              const r = rec as Partial<PersistedCalibrationRecord>;
              let fiveHourCost = typeof r.fiveHourCost === 'number' ? r.fiveHourCost : undefined;
              let sevenDayCost = typeof r.sevenDayCost === 'number' ? r.sevenDayCost : undefined;
              let fiveHourTokens = typeof r.fiveHourTokens === 'number' ? r.fiveHourTokens : undefined;
              let sevenDayTokens = typeof r.sevenDayTokens === 'number' ? r.sevenDayTokens : undefined;

              // Sanity Sanitization: Purge any runaway divergence (> $200 for 5h, > $500 for 7d)
              if (typeof fiveHourCost === 'number' && (fiveHourCost > 200 || fiveHourCost < 5)) {
                fiveHourCost = 35.0;
                dirty = true;
              }
              if (typeof sevenDayCost === 'number' && (sevenDayCost > 500 || sevenDayCost < 20)) {
                sevenDayCost = 100.0;
                dirty = true;
              }
              if (typeof fiveHourTokens === 'number' && (fiveHourTokens > 2_000_000_000 || fiveHourTokens < 1_000_000)) {
                fiveHourTokens = 250_000_000;
                dirty = true;
              }
              if (typeof sevenDayTokens === 'number' && (sevenDayTokens > 5_000_000_000 || sevenDayTokens < 10_000_000)) {
                sevenDayTokens = 850_000_000;
                dirty = true;
              }

              // Sanitize history and transitions
              const cleanedHistory = Array.isArray(r.history)
                ? r.history.filter((h) => (!h.sevenDayCost || h.sevenDayCost <= 500) && (!h.fiveHourCost || h.fiveHourCost <= 200))
                : undefined;
              const cleanedTransitions = Array.isArray(r.recentTransitions)
                ? r.recentTransitions.filter(
                    (t) => (!t.measuredCapacityCost || t.measuredCapacityCost <= 500)
                  )
                : undefined;

              this.calibrations.set(acc, {
                fiveHourTokens,
                sevenDayTokens,
                fiveHourCost,
                sevenDayCost,
                sampleCount5h: typeof r.sampleCount5h === 'number' ? r.sampleCount5h : 0,
                sampleCountWeekly: typeof r.sampleCountWeekly === 'number' ? r.sampleCountWeekly : 0,
                lastUpdated: typeof r.lastUpdated === 'number' ? r.lastUpdated : Date.now(),
                planDetails: r.planDetails,
                history: cleanedHistory,
                recentTransitions: cleanedTransitions
              });
            }
          }
          if (dirty) {
            this.saveCalibrations();
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

  public async fetchUserStatus(force = false): Promise<GetUserStatusResponse | null> {
    const now = Date.now();
    if (!force && this.latestUserStatus && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.latestUserStatus;
    }
    if (this.inFlightUserStatusFetch) {
      return this.inFlightUserStatusFetch;
    }
    this.inFlightUserStatusFetch = this.performUserStatusFetch()
      .then((status) => {
        if (status) {
          this.latestUserStatus = status;
        }
        return this.latestUserStatus;
      })
      .finally(() => {
        this.inFlightUserStatusFetch = null;
      });
    return this.inFlightUserStatusFetch;
  }

  private async performUserStatusFetch(): Promise<GetUserStatusResponse | null> {
    const url = `http://${this.lsAddress}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
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
      const data = (await res.json()) as GetUserStatusResponse;
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
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

    // Self-healing: if baseline fraction was recorded as undefined (e.g. uninitialized cold start), repair it now
    if (typeof base.frac5h !== 'number' && typeof frac5h === 'number') {
      base.frac5h = frac5h;
      base.base5hTokens = currentAccountTokens;
      base.base5hCost = currentAccountCost;
    }
    if (typeof base.fracWeekly !== 'number' && typeof fracWeekly === 'number') {
      base.fracWeekly = fracWeekly;
      base.baseWeeklyTokens = currentAccountTokens;
      base.baseWeeklyCost = currentAccountCost;
    }
    if (typeof base.base5hCost !== 'number' && typeof currentAccountCost === 'number') {
      base.base5hCost = currentAccountCost;
    }
    if (typeof base.baseWeeklyCost !== 'number' && typeof currentAccountCost === 'number') {
      base.baseWeeklyCost = currentAccountCost;
    }

    let updated = false;

    const record = this.calibrations.get(account) || {
      sampleCount5h: 0,
      sampleCountWeekly: 0,
      lastUpdated: Date.now()
    };

    const planDetails = this.getLatestPlanDetails();
    if (planDetails) {
      record.planDetails = planDetails;
    }

    const { dateKey } = formatLocalDateAndHourKeys(new Date());

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

        // Trigger on either >=0.3% quota drop with 80k tokens OR >=$0.15 cost drop
        const isTrigger5h =
          deltaQ5h >= 0.003 &&
          (deltaTokens5h >= 80_000 || (typeof deltaCost5h === 'number' && deltaCost5h >= 0.15));

        if (isTrigger5h) {
          const measured5h = Math.round(deltaTokens5h / deltaQ5h);
          if (measured5h >= 1_000_000 && measured5h <= 2_000_000_000) {
            let measured5hCost: number | undefined;
            if (typeof deltaCost5h === 'number' && deltaCost5h > 0) {
              measured5hCost = Math.round((deltaCost5h / deltaQ5h) * 100) / 100;
            } else if (deltaTokens5h > 0) {
              const fallbackCost = (deltaTokens5h * 0.35) / 1_000_000;
              measured5hCost = Math.round((fallbackCost / deltaQ5h) * 100) / 100;
            }

            // Sanity clamp: 5h rolling capacity must fall in realistic bounds ($10 to $100)
            if (measured5hCost && measured5hCost >= 10 && measured5hCost <= 100) {
              if (record.fiveHourCost && record.sampleCount5h > 0) {
                record.fiveHourCost =
                  Math.round((record.fiveHourCost * 0.7 + measured5hCost * 0.3) * 100) / 100;
              } else {
                record.fiveHourCost = measured5hCost;
              }
            }

            if (record.fiveHourTokens && record.sampleCount5h > 0) {
              record.fiveHourTokens = Math.round(record.fiveHourTokens * 0.7 + measured5h * 0.3);
            } else {
              record.fiveHourTokens = measured5h;
            }

            record.sampleCount5h++;
            record.lastUpdated = Date.now();

            if (!record.history) record.history = [];
            record.history.push({
              timestamp: Date.now(),
              dateKey,
              fiveHourCost: measured5hCost,
              fiveHourTokens: measured5h,
              userTier: planDetails?.userTierName || planDetails?.userTierId,
              planName: planDetails?.planName,
              deltaCost: deltaCost5h || 0,
              deltaTokens: deltaTokens5h,
              deltaQ5h,
              groupName: activeGroupId || base.activeGroupId
            });
            if (record.history.length > 365) {
              record.history = record.history.slice(-365);
            }

            if (!record.recentTransitions) record.recentTransitions = [];
            record.recentTransitions.push({
              timestamp: Date.now(),
              account,
              windowType: '5h',
              prevFraction: base.frac5h,
              currFraction: frac5h,
              deltaFraction: deltaQ5h,
              deltaTokens: deltaTokens5h,
              deltaCost: deltaCost5h,
              measuredCapacityTokens: measured5h,
              measuredCapacityCost: measured5hCost
            });
            if (record.recentTransitions.length > 30) {
              record.recentTransitions = record.recentTransitions.slice(-30);
            }

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

        // Trigger on either >=0.2% quota drop with 150k tokens OR >=$0.25 cost drop
        const isTriggerWeekly =
          deltaQWeekly >= 0.002 &&
          (deltaTokensWeekly >= 150_000 || (typeof deltaCostWeekly === 'number' && deltaCostWeekly >= 0.25));

        if (isTriggerWeekly) {
          const measuredWeekly = Math.round(deltaTokensWeekly / deltaQWeekly);
          if (measuredWeekly >= 10_000_000 && measuredWeekly <= 5_000_000_000) {
            let measuredWeeklyCost: number | undefined;
            if (typeof deltaCostWeekly === 'number' && deltaCostWeekly > 0) {
              measuredWeeklyCost = Math.round((deltaCostWeekly / deltaQWeekly) * 100) / 100;
            } else if (deltaTokensWeekly > 0) {
              const fallbackCost = (deltaTokensWeekly * 0.35) / 1_000_000;
              measuredWeeklyCost = Math.round((fallbackCost / deltaQWeekly) * 100) / 100;
            }

            // Sanity clamp: weekly rolling capacity must fall in realistic bounds ($30 to $300)
            if (measuredWeeklyCost && measuredWeeklyCost >= 30 && measuredWeeklyCost <= 300) {
              if (record.sevenDayCost && record.sampleCountWeekly > 0) {
                record.sevenDayCost =
                  Math.round((record.sevenDayCost * 0.7 + measuredWeeklyCost * 0.3) * 100) / 100;
              } else {
                record.sevenDayCost = measuredWeeklyCost;
              }
            }

            if (record.sevenDayTokens && record.sampleCountWeekly > 0) {
              record.sevenDayTokens = Math.round(record.sevenDayTokens * 0.7 + measuredWeekly * 0.3);
            } else {
              record.sevenDayTokens = measuredWeekly;
            }

            record.sampleCountWeekly++;
            record.lastUpdated = Date.now();

            if (!record.history) record.history = [];
            record.history.push({
              timestamp: Date.now(),
              dateKey,
              sevenDayCost: measuredWeeklyCost,
              sevenDayTokens: measuredWeekly,
              userTier: planDetails?.userTierName || planDetails?.userTierId,
              planName: planDetails?.planName,
              deltaCost: deltaCostWeekly || 0,
              deltaTokens: deltaTokensWeekly,
              deltaQWeekly,
              groupName: activeGroupId || base.activeGroupId
            });
            if (record.history.length > 365) {
              record.history = record.history.slice(-365);
            }

            if (!record.recentTransitions) record.recentTransitions = [];
            record.recentTransitions.push({
              timestamp: Date.now(),
              account,
              windowType: 'weekly',
              prevFraction: base.fracWeekly,
              currFraction: fracWeekly,
              deltaFraction: deltaQWeekly,
              deltaTokens: deltaTokensWeekly,
              deltaCost: deltaCostWeekly,
              measuredCapacityTokens: measuredWeekly,
              measuredCapacityCost: measuredWeeklyCost
            });
            if (record.recentTransitions.length > 30) {
              record.recentTransitions = record.recentTransitions.slice(-30);
            }

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
    cost7d?: number,
    isCurrentAccount: boolean = false
  ): AccountQuotaCapacity {
    // READ-ONLY SHORT-CIRCUIT FOR INACTIVE ACCOUNTS:
    // Do NOT calculate, do NOT update, do NOT touch RPCs or write calibrations for accounts that are not currently active.
    if (!isCurrentAccount) {
      const record = this.calibrations.get(account);
      const planDetails = record?.planDetails;
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
        fiveHourUsed: undefined,
        sevenDayUsed: undefined,
        fiveHourFraction: undefined,
        weeklyFraction: undefined,
        status: isCalibrated ? 'calibrated' : 'calibrating',
        userTier: planDetails?.userTierName || planDetails?.userTierId,
        planName: planDetails?.planName,
        planDetails,
        history: record?.history,
        recentTransitions: record?.recentTransitions
      };
    }

    const now = Date.now();
    if (now - this.lastFetchTime >= this.cacheTtlMs && !this.inFlightFetch) {
      void this.fetchQuotaSummary();
      void this.fetchUserStatus();
    }

    const { frac5h, fracWeekly, activeGroupId } = extractActiveQuotaFractions(
      this.latestQuotaSummary
    );

    // CRITICAL: Drive differential calibration ONLY for the currently active account.
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

    const record = this.calibrations.get(account) || {
      sampleCount5h: 0,
      sampleCountWeekly: 0,
      lastUpdated: Date.now()
    };

    let updated = false;

    // Window Consumption Integration (Ground Truth Correction) for Active Account Only:
    if (typeof frac5h === 'number' && frac5h <= 0.90 && frac5h > 0) {
      const usedFrac5h = 1 - frac5h;
      if (typeof cost5h === 'number' && cost5h > 0) {
        const integratedCost = Math.round((cost5h / usedFrac5h) * 100) / 100;
        // 5h sanity clamp: realistic rolling capacity between $15 and $80
        if (integratedCost >= 15 && integratedCost <= 80) {
          if (!record.fiveHourCost || Math.abs(integratedCost - record.fiveHourCost) / record.fiveHourCost > 0.15) {
            record.fiveHourCost = record.fiveHourCost
              ? Math.round((record.fiveHourCost * 0.7 + integratedCost * 0.3) * 100) / 100
              : integratedCost;
            updated = true;
          }
        }
      }
      if (typeof tokens5h === 'number' && tokens5h > 0) {
        const integratedTokens = Math.round(tokens5h / usedFrac5h);
        if (integratedTokens >= 20_000_000 && integratedTokens <= 1_500_000_000) {
          if (!record.fiveHourTokens || Math.abs(integratedTokens - record.fiveHourTokens) / record.fiveHourTokens > 0.15) {
            record.fiveHourTokens = record.fiveHourTokens
              ? Math.round(record.fiveHourTokens * 0.7 + integratedTokens * 0.3)
              : integratedTokens;
            updated = true;
          }
        }
      }
    }

    if (typeof fracWeekly === 'number' && fracWeekly <= 0.90 && fracWeekly > 0) {
      const usedFracWeekly = 1 - fracWeekly;
      if (typeof cost7d === 'number' && cost7d > 0) {
        const integratedCost = Math.round((cost7d / usedFracWeekly) * 100) / 100;
        // Weekly sanity clamp: realistic rolling capacity between $50 and $250
        if (integratedCost >= 50 && integratedCost <= 250) {
          if (!record.sevenDayCost || Math.abs(integratedCost - record.sevenDayCost) / record.sevenDayCost > 0.15) {
            record.sevenDayCost = record.sevenDayCost
              ? Math.round((record.sevenDayCost * 0.7 + integratedCost * 0.3) * 100) / 100
              : integratedCost;
            updated = true;
          }
        }
      }
      if (typeof tokens7d === 'number' && tokens7d > 0) {
        const integratedTokens = Math.round(tokens7d / usedFracWeekly);
        if (integratedTokens >= 50_000_000 && integratedTokens <= 3_000_000_000) {
          if (!record.sevenDayTokens || Math.abs(integratedTokens - record.sevenDayTokens) / record.sevenDayTokens > 0.15) {
            record.sevenDayTokens = record.sevenDayTokens
              ? Math.round(record.sevenDayTokens * 0.7 + integratedTokens * 0.3)
              : integratedTokens;
            updated = true;
          }
        }
      }
    }

    // Physical Invariant Enforcer for active account: Capacity cannot be less than used in current window
    if (typeof cost5h === 'number' && cost5h > 0 && record.fiveHourCost && record.fiveHourCost < cost5h) {
      record.fiveHourCost = Math.min(80, Math.round(cost5h * 100) / 100);
      updated = true;
    }
    if (typeof cost7d === 'number' && cost7d > 0 && record.sevenDayCost && record.sevenDayCost < cost7d) {
      record.sevenDayCost = Math.min(250, Math.round(cost7d * 100) / 100);
      updated = true;
    }
    if (typeof tokens5h === 'number' && tokens5h > 0 && record.fiveHourTokens && record.fiveHourTokens < tokens5h) {
      record.fiveHourTokens = tokens5h;
      updated = true;
    }
    if (typeof tokens7d === 'number' && tokens7d > 0 && record.sevenDayTokens && record.sevenDayTokens < tokens7d) {
      record.sevenDayTokens = tokens7d;
      updated = true;
    }

    if (updated) {
      record.lastUpdated = Date.now();
      const planDetails = record.planDetails || this.getLatestPlanDetails();
      const { dateKey } = formatLocalDateAndHourKeys(new Date());
      if (!record.history) record.history = [];
      const existingSnap = record.history.find((h) => h.dateKey === dateKey);
      if (existingSnap) {
        existingSnap.fiveHourCost = record.fiveHourCost;
        existingSnap.fiveHourTokens = record.fiveHourTokens;
        existingSnap.sevenDayCost = record.sevenDayCost;
        existingSnap.sevenDayTokens = record.sevenDayTokens;
      } else {
        record.history.push({
          timestamp: Date.now(),
          dateKey,
          fiveHourCost: record.fiveHourCost,
          fiveHourTokens: record.fiveHourTokens,
          sevenDayCost: record.sevenDayCost,
          sevenDayTokens: record.sevenDayTokens,
          userTier: planDetails?.userTierName || planDetails?.userTierId,
          planName: planDetails?.planName,
          deltaCost: 0,
          deltaTokens: 0,
          groupName: activeGroupId
        });
        if (record.history.length > 365) {
          record.history = record.history.slice(-365);
        }
      }
      this.calibrations.set(account, record);
      this.saveCalibrations();
    }

    const planDetails = record?.planDetails || this.getLatestPlanDetails();
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
      status: isCalibrated ? 'calibrated' : 'calibrating',
      userTier: planDetails?.userTierName || planDetails?.userTierId,
      planName: planDetails?.planName,
      planDetails,
      history: record?.history,
      recentTransitions: record?.recentTransitions
    };
  }
}
