import { describe, expect, test } from 'bun:test';
import {
  computeQuotaCapacity,
  QuotaTracker,
  type RetrieveUserQuotaSummaryResponse
} from '../src/server/quota-tracker';

describe('QuotaTracker & Symmetric Quota Capacity Calculation', () => {
  test('returns calibrating status when no summary or consumption is available', () => {
    const res = computeQuotaCapacity(0, 0, null);
    expect(res.status).toBe('calibrating');
    expect(res.fiveHourTokens).toBeUndefined();
    expect(res.sevenDayTokens).toBeUndefined();
    expect(res.fiveHourUsed).toBe(0);
    expect(res.sevenDayUsed).toBe(0);
  });

  test('computes fiveHourTokens and sevenDayTokens symmetrically from RetrieveUserQuotaSummary', () => {
    const fakeSummary: RetrieveUserQuotaSummaryResponse = {
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              {
                bucketId: 'gemini-weekly',
                displayName: 'Weekly Limit Remaining',
                window: 'weekly',
                remainingFraction: 0.819505, // 18.05% consumed
                resetTime: '2026-11-21T04:21:33Z'
              },
              {
                bucketId: 'gemini-5h',
                displayName: 'Five Hour Limit Remaining',
                window: '5h',
                remainingFraction: 0.727953, // 27.2047% consumed
                resetTime: '2026-11-14T14:21:33Z'
              }
            ]
          }
        ]
      }
    };

    // User scenario: 140.7M tokens used corresponding to 18.05% weekly quota
    // 5h window: 25M tokens used corresponding to 27.20% 5h quota
    const tokens5h = 25_000_000;
    const tokens7d = 140_700_000;

    const res = computeQuotaCapacity(tokens5h, tokens7d, fakeSummary);
    expect(res.status).toBe('calibrated');

    // 25M / (1 - 0.727953) = 91,895,557 (~92M)
    expect(res.fiveHourTokens).toBe(Math.round(tokens5h / (1 - 0.727953)));
    expect(res.fiveHourTokens).toBeGreaterThan(90_000_000);

    // 140.7M / (1 - 0.819505) = 779,523_048 (~780M)
    expect(res.sevenDayTokens).toBe(Math.round(tokens7d / (1 - 0.819505)));
    expect(res.sevenDayTokens).toBeGreaterThan(770_000_000);

    expect(res.fiveHourUsed).toBe(tokens5h);
    expect(res.sevenDayUsed).toBe(tokens7d);
    expect(res.fiveHourFraction).toBe(0.727953);
    expect(res.weeklyFraction).toBe(0.819505);
  });

  test('QuotaTracker caches calibrated capacities across quota resets', () => {
    const tracker = new QuotaTracker();
    const fakeSummary: RetrieveUserQuotaSummaryResponse = {
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              {
                bucketId: 'gemini-weekly',
                displayName: 'Weekly Limit Remaining',
                window: 'weekly',
                remainingFraction: 0.8, // 20% consumed
                resetTime: '2026-11-21T00:00:00Z'
              },
              {
                bucketId: 'gemini-5h',
                displayName: 'Five Hour Limit Remaining',
                window: '5h',
                remainingFraction: 0.75, // 25% consumed
                resetTime: '2026-11-14T14:00:00Z'
              }
            ]
          }
        ]
      }
    };

    tracker.setLatestQuotaSummaryForTesting(fakeSummary);

    // Initial measurement:
    // 5h: 20M / 0.25 = 80M
    // 7d: 140M / 0.2 = 700M
    const first = tracker.getAccountQuotaCapacity('test@example.com', 20_000_000, 140_000_000);
    expect(first.status).toBe('calibrated');
    expect(first.fiveHourTokens).toBe(80_000_000);
    expect(first.sevenDayTokens).toBe(700_000_000);

    // Simulate quota reset: remainingFraction becomes 1.0 (fresh period, 0% consumed)
    tracker.setLatestQuotaSummaryForTesting({
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              { bucketId: 'gemini-weekly', displayName: 'Weekly', window: 'weekly', remainingFraction: 1.0, resetTime: '' },
              { bucketId: 'gemini-5h', displayName: '5h', window: '5h', remainingFraction: 1.0, resetTime: '' }
            ]
          }
        ]
      }
    });

    // Should retain the empirical calibrated 80M and 700M capacities
    const afterReset = tracker.getAccountQuotaCapacity('test@example.com', 0, 0);
    expect(afterReset.status).toBe('calibrated');
    expect(afterReset.fiveHourTokens).toBe(80_000_000);
    expect(afterReset.sevenDayTokens).toBe(700_000_000);
  });
});
