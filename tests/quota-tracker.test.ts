import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  extractActiveQuotaFractions,
  QuotaTracker,
  type RetrieveUserQuotaSummaryResponse
} from '../src/server/quota-tracker';

describe('QuotaTracker & Differential Calibration (ΔTokens / ΔQ)', () => {
  test('extractActiveQuotaFractions extracts active burning group correctly', () => {
    const fakeSummary: RetrieveUserQuotaSummaryResponse = {
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              {
                bucketId: 'gemini-weekly',
                displayName: 'Weekly',
                window: 'weekly',
                remainingFraction: 0.8195,
                resetTime: '2026-11-21T04:21:33Z'
              },
              {
                bucketId: 'gemini-5h',
                displayName: '5h',
                window: '5h',
                remainingFraction: 0.728,
                resetTime: '2026-11-14T14:21:33Z'
              }
            ]
          },
          {
            displayName: 'Claude and GPT models',
            buckets: [
              {
                bucketId: '3p-weekly',
                displayName: 'Weekly',
                window: 'weekly',
                remainingFraction: 1.0,
                resetTime: '2026-11-21T13:46:57Z'
              }
            ]
          }
        ]
      }
    };

    const res = extractActiveQuotaFractions(fakeSummary);
    expect(res.frac5h).toBe(0.728);
    expect(res.fracWeekly).toBe(0.8195);
    expect(res.activeGroup?.displayName).toBe('Gemini Models');
  });

  test('calculates exact capacities via incremental differential and ignores historical base offset', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-quota-test-${Date.now()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });

    const account = 'user@example.com';

    // Step 1: Initial baseline established at 50,000,000 tokens (simulating pre-existing tokens)
    // with weekly quota at 0.820 (82.0% remaining) and 5h quota at 0.750
    tracker.recordObservation(account, 50_000_000, 0.75, 0.82);

    let cap = tracker.getAccountQuotaCapacity(account, 10_000_000, 50_000_000);
    expect(cap.status).toBe('calibrating');
    expect(cap.sevenDayTokens).toBeUndefined();

    // Step 2: Next turn - account consumed 2,000,000 more tokens (total 52,000,000)
    // Weekly quota dropped from 0.820 to 0.81744 (delta = 0.00256 = 0.256%)
    // 5h quota dropped from 0.750 to 0.730 (delta = 0.020 = 2.0%)
    // Expected weekly: 2,000,000 / 0.00256 = 781,250,000 (~781M)
    // Expected 5h: 2,000,000 / 0.02 = 100,000,000 (100M)
    tracker.recordObservation(account, 52_000_000, 0.73, 0.81744);

    cap = tracker.getAccountQuotaCapacity(account, 12_000_000, 52_000_000);
    expect(cap.status).toBe('calibrated');
    expect(cap.fiveHourTokens).toBe(100_000_000);
    expect(cap.sevenDayTokens).toBe(Math.round(2_000_000 / 0.00256));
    expect(cap.sevenDayTokens).toBeGreaterThan(770_000_000);

    // Step 3: Persistence test - a fresh QuotaTracker with the same storageDir should load the calibrated values
    const tracker2 = new QuotaTracker({ storageDir: tmpDir });
    const cap2 = tracker2.getAccountQuotaCapacity(account, 0, 0);
    expect(cap2.status).toBe('calibrated');
    expect(cap2.fiveHourTokens).toBe(100_000_000);
    expect(cap2.sevenDayTokens).toBe(cap.sevenDayTokens);

    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('applies weighted smoothing on subsequent differential measurements', () => {
    const tracker = new QuotaTracker();
    const account = 'smooth@example.com';

    // Baseline
    tracker.recordObservation(account, 10_000_000, 0.8, 0.9);

    // First sample: 1M tokens / 0.01 drop = 100M
    tracker.recordObservation(account, 11_000_000, 0.79, 0.9);
    let rec = tracker.getCalibrationRecord(account);
    expect(rec?.fiveHourTokens).toBe(100_000_000);

    // Second sample: 1.2M tokens / 0.01 drop = 120M
    // EMA: Math.round(100M * 0.7 + 120M * 0.3) = 70M + 36M = 106M
    tracker.recordObservation(account, 12_200_000, 0.78, 0.9);
    rec = tracker.getCalibrationRecord(account);
    expect(rec?.fiveHourTokens).toBe(106_000_000);
    expect(rec?.sampleCount5h).toBe(2);
  });
});
