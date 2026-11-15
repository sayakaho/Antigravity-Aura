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
    const tmpDir = path.join(os.tmpdir(), `aura-smooth-test-${Date.now()}-${Math.random()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });
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

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('decouples 5h and weekly baselines so 5h updates do not truncate weekly accumulation', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-decouple-test-${Date.now()}-${Math.random()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });
    const account = 'decouple@example.com';

    // Initial baseline: 10M tokens, frac5h: 0.80, fracWeekly: 0.90
    tracker.recordObservation(account, 10_000_000, 0.80, 0.90, 20.0);

    // Turn 1: 5h drops 1% with 150k tokens, weekly does not drop
    tracker.recordObservation(account, 10_150_000, 0.79, 0.90, 20.3);
    let rec = tracker.getCalibrationRecord(account);
    expect(rec?.fiveHourTokens).toBe(15_000_000);
    expect(rec?.sevenDayTokens).toBeUndefined(); // Weekly not yet triggered

    // Turn 2: Another 150k tokens consumed (total 300k since start), weekly drops by 0.3%
    // 5h does not drop further this turn
    tracker.recordObservation(account, 10_300_000, 0.79, 0.897, 20.6);
    rec = tracker.getCalibrationRecord(account);
    // Weekly delta should be total 300k tokens over 0.003 drop = 100M (not truncated to 150k / 0.003)
    expect(rec?.sevenDayTokens).toBe(100_000_000);
    expect(rec?.sampleCountWeekly).toBe(1);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('resets baseline cleanly when quota group changes dynamically', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-group-test-${Date.now()}-${Math.random()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });
    const account = 'group_switch@example.com';

    // Baseline under Gemini Models (frac5h: 0.90)
    tracker.recordObservation(account, 10_000_000, 0.90, 0.95, 10.0, 'Gemini Models');

    // Switch to Claude group (frac5h drops to 0.70 because Claude has independent quota)
    // Should NOT compute a 20% drop from 10k tokens!
    tracker.recordObservation(account, 10_010_000, 0.70, 0.80, 10.1, 'Claude and GPT models');
    let rec = tracker.getCalibrationRecord(account);
    expect(rec).toBeUndefined(); // Safely reset baseline, no calibration record created

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('self-heals uninitialized undefined baseline and appends calibration snapshot history', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-heal-test-${Date.now()}-${Math.random()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });
    const account = 'heal@example.com';

    // Step 1: Simulate cold start where RPC was in flight, fraction passed as undefined
    tracker.recordObservation(account, 5_000_000, undefined, undefined, 10.0);

    // Step 2: Next cycle RPC resolves, frac5h is 0.80. Base should self-heal and repair frac5h
    tracker.recordObservation(account, 5_000_000, 0.80, 0.90, 10.0);

    // Step 3: Turn consumes 90k tokens and $0.20 cost, frac5h drops from 0.80 to 0.79
    // Expected 5h capacity: 90k / 0.01 = 9M tokens, $0.20 / 0.01 = $20.00
    tracker.recordObservation(account, 5_090_000, 0.79, 0.90, 10.2);

    const rec = tracker.getCalibrationRecord(account);
    expect(rec).toBeDefined();
    expect(rec?.fiveHourTokens).toBe(9_000_000);
    expect(rec?.fiveHourCost).toBe(20.0);
    expect(rec?.history).toBeDefined();
    expect(rec?.history?.length).toBe(1);
    expect(rec?.history?.[0].fiveHourCost).toBe(20.0);
    expect(rec?.history?.[0].fiveHourTokens).toBe(9_000_000);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('records bounded recent transitions as intermediate calculation evidence', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-transitions-test-${Date.now()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });
    const account = 'trans@example.com';

    // Baseline
    tracker.recordObservation(account, 1_000_000, 0.90, 0.95, 2.0);

    // Turn 1: 5h drop 0.90 -> 0.88 (deltaQ = 0.02), deltaTokens = 100,000, deltaCost = $0.40
    // Capacity: 5,000,000 tokens, $20.00
    tracker.recordObservation(account, 1_100_000, 0.88, 0.95, 2.4);

    const cap = tracker.getAccountQuotaCapacity(account, 100_000, 100_000);
    expect(cap.recentTransitions).toBeDefined();
    expect(cap.recentTransitions?.length).toBe(1);
    expect(cap.recentTransitions?.[0].windowType).toBe('5h');
    expect(cap.recentTransitions?.[0].deltaFraction).toBeCloseTo(0.02);
    expect(cap.recentTransitions?.[0].deltaTokens).toBe(100_000);
    expect(cap.recentTransitions?.[0].deltaCost).toBeCloseTo(0.4);
    expect(cap.recentTransitions?.[0].measuredCapacityTokens).toBe(5_000_000);
    expect(cap.recentTransitions?.[0].measuredCapacityCost).toBe(20.0);

    // Persistence test
    const tracker2 = new QuotaTracker({ storageDir: tmpDir });
    const cap2 = tracker2.getAccountQuotaCapacity(account, 0, 0);
    expect(cap2.recentTransitions?.length).toBe(1);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('extractActiveQuotaFractions accurately resolves discrete windowStart from resetTime', () => {
    const now = Date.now();
    // Simulate reset time in 3 hours 13 minutes (11,580,000 ms)
    const reset5h = new Date(now + (3 * 3600 + 13 * 60) * 1000).toISOString();
    // Simulate weekly reset in 5 days
    const resetWeekly = new Date(now + 5 * 86400 * 1000).toISOString();

    const summary: RetrieveUserQuotaSummaryResponse = {
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              {
                bucketId: 'gemini-5h',
                displayName: '5h',
                window: '5h',
                remainingFraction: 0.25,
                resetTime: reset5h
              },
              {
                bucketId: 'gemini-weekly',
                displayName: 'Weekly',
                window: 'weekly',
                remainingFraction: 0.30,
                resetTime: resetWeekly
              }
            ]
          }
        ]
      }
    };

    const res = extractActiveQuotaFractions(summary);
    expect(res.frac5h).toBe(0.25);
    expect(res.fracWeekly).toBe(0.30);
    expect(res.resetTime5h).toBe(reset5h);
    expect(res.resetTimeWeekly).toBe(resetWeekly);

    // Discrete 5h window start should be resetTime - 5 hours
    const expectedStart5h = new Date(reset5h).getTime() - 5 * 3600 * 1000;
    expect(res.windowStart5hMs).toBe(expectedStart5h);

    // Elapsed in current 5h cycle should be 5h - 3h13m = 1h47m (6,420,000 ms)
    const elapsed5hMs = now - res.windowStart5hMs!;
    expect(Math.round(elapsed5hMs / 60_000)).toBe(107); // 107 minutes = 1h 47m

    // Discrete weekly window start should be resetTime - 7 days
    const expectedStartWeekly = new Date(resetWeekly).getTime() - 7 * 86400 * 1000;
    expect(res.windowStartWeeklyMs).toBe(expectedStartWeekly);
  });

  test('strictly isolates inactive accounts from calibration updates and fraction contamination', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-inactive-test-${Date.now()}`);
    const tracker = new QuotaTracker({ storageDir: tmpDir });

    const activeAcc = 'active@example.com';
    const inactiveAcc = 'inactive@example.com';

    // Mock active quota summary with a tiny burned fraction (1% burned, frac=0.99)
    tracker.setLatestQuotaSummaryForTesting({
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              {
                bucketId: 'gemini-weekly',
                displayName: 'Weekly',
                window: 'weekly',
                remainingFraction: 0.99,
                resetTime: new Date(Date.now() + 5 * 86400 * 1000).toISOString()
              }
            ]
          }
        ]
      }
    });

    // Inactive account has large historical spent ($40), but is NOT current account
    const inactiveCap = tracker.getAccountQuotaCapacity(
      inactiveAcc,
      1_000_000,
      10_000_000,
      10_000_000,
      40.0,
      5.0,
      40.0,
      false // isCurrentAccount = false
    );

    // Inactive account must NOT be calibrated to $4000 ($40 / 0.01)
    expect(inactiveCap.sevenDayCost).toBeUndefined();
    expect(tracker.getCalibrationRecord(inactiveAcc)).toBeUndefined();

    // Now calibrate active account legitimately
    tracker.recordObservation(activeAcc, 10_000_000, 0.85, 0.90, 10.0);
    tracker.recordObservation(activeAcc, 11_000_000, 0.83, 0.89, 11.0); // 1M tokens / 0.01 = 100M, $1.0 / 0.01 = $100

    const activeCap = tracker.getAccountQuotaCapacity(
      activeAcc,
      1_000_000,
      1_000_000,
      11_000_000,
      11.0,
      1.0,
      1.0,
      true // isCurrentAccount = true
    );

    expect(activeCap.status).toBe('calibrated');
    expect(activeCap.sevenDayCost).toBeLessThanOrEqual(300);

    // Inactive account calibration must still remain untouched
    expect(tracker.getCalibrationRecord(inactiveAcc)).toBeUndefined();

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('auto-sanitizes runaway calibration values from disk on startup', () => {
    const tmpDir = path.join(os.tmpdir(), `aura-sanitize-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const corruptedFilePath = path.join(tmpDir, 'quota_calibration.json');
    const dirtyData = {
      'corrupted@example.com': {
        fiveHourTokens: 293773648,
        sevenDayTokens: 20964452619,
        fiveHourCost: 34.14,
        sevenDayCost: 3748.84, // Runaway value
        sampleCount5h: 7,
        sampleCountWeekly: 7,
        lastUpdated: Date.now(),
        history: [
          {
            timestamp: Date.now(),
            dateKey: '2026-11-16',
            sevenDayCost: 3748.84
          }
        ]
      }
    };
    fs.writeFileSync(corruptedFilePath, JSON.stringify(dirtyData, null, 2), 'utf8');

    // Startup QuotaTracker pointing to dirty storage
    const tracker = new QuotaTracker({ storageDir: tmpDir });
    const rec = tracker.getCalibrationRecord('corrupted@example.com');

    expect(rec).toBeDefined();
    // Seven day cost must have been clamped and sanitized back to reasonable baseline ($100)
    expect(rec?.sevenDayCost).toBe(100.0);
    expect(rec?.sevenDayTokens).toBeLessThanOrEqual(5_000_000_000);
    // History must have been purged of corrupted entry
    expect(rec?.history?.length).toBe(0);

    // Ensure cleaned file was written back to disk
    const saved = JSON.parse(fs.readFileSync(corruptedFilePath, 'utf8'));
    expect(saved['corrupted@example.com'].sevenDayCost).toBe(100.0);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });
});
