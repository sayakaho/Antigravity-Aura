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

export interface CachedAccountCaps {
  fiveHourTokens?: number;
  sevenDayTokens?: number;
}

/**
 * Pure data-driven, symmetric quota capacity calculation.
 * Capacity = tokensConsumed / (1 - remainingFraction)
 * No hardcoded defaults or artificial threshold clamps.
 */
export function computeQuotaCapacity(
  tokens5h: number,
  tokens7d: number,
  quotaSummary: RetrieveUserQuotaSummaryResponse | null,
  cachedCaps?: CachedAccountCaps
): AccountQuotaCapacity {
  const groups = quotaSummary?.response?.groups || [];

  // Identify the active group (the group where model requests are actively burning quota)
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

  const frac5h = bucket5h?.remainingFraction;
  const fracWeekly = bucketWeekly?.remainingFraction;

  let fiveHourTokens = cachedCaps?.fiveHourTokens;
  let sevenDayTokens = cachedCaps?.sevenDayTokens;

  // 1. Calculate 5-hour window capacity
  if (typeof frac5h === 'number' && frac5h <= 0.995 && tokens5h > 0) {
    const consumedRatio = 1 - frac5h;
    if (consumedRatio > 0.005) {
      fiveHourTokens = Math.round(tokens5h / consumedRatio);
    }
  }

  // 2. Calculate Weekly (7-day) window capacity - completely symmetrical
  if (typeof fracWeekly === 'number' && fracWeekly <= 0.995 && tokens7d > 0) {
    const consumedRatio = 1 - fracWeekly;
    if (consumedRatio > 0.005) {
      sevenDayTokens = Math.round(tokens7d / consumedRatio);
    }
  }

  const isCalibrated = typeof fiveHourTokens === 'number' || typeof sevenDayTokens === 'number';

  return {
    fiveHourTokens,
    sevenDayTokens,
    fiveHourUsed: tokens5h,
    sevenDayUsed: tokens7d,
    fiveHourFraction: frac5h,
    weeklyFraction: fracWeekly,
    status: isCalibrated ? 'calibrated' : 'calibrating'
  };
}

export interface QuotaTrackerOptions {
  lsAddress?: string;
  csrfToken?: string;
  fetchTimeoutMs?: number;
  cacheTtlMs?: number;
}

export class QuotaTracker {
  private readonly lsAddress: string;
  private readonly csrfToken: string;
  private readonly fetchTimeoutMs: number;
  private readonly cacheTtlMs: number;

  private latestQuotaSummary: RetrieveUserQuotaSummaryResponse | null = null;
  private lastFetchTime = 0;
  private inFlightFetch: Promise<RetrieveUserQuotaSummaryResponse | null> | null = null;
  private readonly calibratedCaps = new Map<string, CachedAccountCaps>();

  constructor(options?: QuotaTrackerOptions) {
    this.lsAddress = options?.lsAddress || process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:5387';
    this.csrfToken = options?.csrfToken || process.env.ANTIGRAVITY_CSRF_TOKEN || '';
    this.fetchTimeoutMs = options?.fetchTimeoutMs || 1500;
    this.cacheTtlMs = options?.cacheTtlMs || 20_000;
  }

  public getLatestQuotaSummary(): RetrieveUserQuotaSummaryResponse | null {
    return this.latestQuotaSummary;
  }

  public setLatestQuotaSummaryForTesting(summary: RetrieveUserQuotaSummaryResponse | null): void {
    this.latestQuotaSummary = summary;
    this.lastFetchTime = Date.now();
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

  public getAccountQuotaCapacity(
    account: string,
    tokens5h: number,
    tokens7d: number
  ): AccountQuotaCapacity {
    const now = Date.now();
    if (now - this.lastFetchTime >= this.cacheTtlMs && !this.inFlightFetch) {
      void this.fetchQuotaSummary();
    }

    const cached = this.calibratedCaps.get(account);
    const result = computeQuotaCapacity(tokens5h, tokens7d, this.latestQuotaSummary, cached);

    if (result.fiveHourTokens || result.sevenDayTokens) {
      this.calibratedCaps.set(account, {
        fiveHourTokens: result.fiveHourTokens ?? cached?.fiveHourTokens,
        sevenDayTokens: result.sevenDayTokens ?? cached?.sevenDayTokens
      });
    }

    return result;
  }
}
