import { describe, expect, test } from 'bun:test';
import {
  computeAccountDistributionItems,
  renderAccountDistribution
} from '../src/panel/analytics/metrics';
import type { GlobalAnalyticsOverview, SessionAnalyticsData } from '../src/types';

function makeBaseOverview(): GlobalAnalyticsOverview {
  return {
    totalConversations: 2,
    totalRequests: 5,
    totalTokens: { input: 100, output: 50, cacheRead: 200, thinking: 0, total: 350 },
    cacheEfficiency: 66.7,
    avgTtft: 1.0,
    avgTokPerSec: 100,
    topProjects: [],
    projects: [],
    timeRangeSeries: [],
    modelDistribution: [],
    dailyModelStats: {},
    toolDistribution: [],
    dailyToolStats: {},
    accountDistribution: [
      {
        account: 'primary@example.com',
        totalTokens: 250,
        inputTok: 80,
        outTok: 40,
        cacheRead: 130,
        thinkTok: 0,
        requests: 4,
        conversationCount: 2,
        isCurrent: true,
        quotaCapacity: {
          fiveHourTokens: 500_000,
          sevenDayTokens: 3_500_000,
          status: 'calibrated'
        }
      },
      {
        account: 'secondary@example.com',
        totalTokens: 100,
        inputTok: 20,
        outTok: 10,
        cacheRead: 70,
        thinkTok: 0,
        requests: 1,
        conversationCount: 1,
        isCurrent: false
      }
    ],
    dailyAccountStats: {
      '2026-11-14': {
        'primary@example.com': {
          account: 'primary@example.com',
          inTok: 50,
          outTok: 25,
          cacheRead: 75,
          thinkTok: 0,
          requests: 2,
          conversationIds: ['c1']
        }
      },
      '2026-11-10': {
        'secondary@example.com': {
          account: 'secondary@example.com',
          inTok: 20,
          outTok: 10,
          cacheRead: 70,
          thinkTok: 0,
          requests: 1,
          conversationIds: ['c2']
        }
      }
    }
  };
}

describe('Account Token Consumption UI & Distribution', () => {
  test('computeAccountDistributionItems handles all-time scope and session mode', () => {
    const overview = makeBaseOverview();

    // All-time scope returns precomputed accountDistribution
    const allTime = computeAccountDistributionItems(
      overview,
      'last-30-days',
      null,
      'all-time'
    );
    expect(allTime.length).toBe(2);
    expect(allTime[0].account).toBe('primary@example.com');
    expect(allTime[0].totalTokens).toBe(250);
    expect(allTime[0].isCurrent).toBe(true);
    expect(allTime[1].account).toBe('secondary@example.com');
    expect(allTime[1].totalTokens).toBe(100);

    // Session mode with active session accounts
    const fakeSession: SessionAnalyticsData = {
      cascadeId: 'c1',
      totalTokens: { input: 50, output: 25, cacheRead: 75, thinking: 0, total: 150 },
      totalRequests: 2,
      cacheEfficiency: 50,
      avgTtft: 1.0,
      avgTokPerSec: 100,
      steps: [],
      accounts: [
        {
          account: 'primary@example.com',
          totalTokens: 150,
          inputTok: 50,
          outTok: 25,
          cacheRead: 75,
          thinkTok: 0,
          requests: 2,
          conversationCount: 1,
          isCurrent: true
        }
      ]
    };

    const sessionItems = computeAccountDistributionItems(
      overview,
      'session',
      fakeSession,
      'follow'
    );
    expect(sessionItems.length).toBe(1);
    expect(sessionItems[0].account).toBe('primary@example.com');
    expect(sessionItems[0].totalTokens).toBe(150);
  });

  test('computeAccountDistributionItems filters by date range in follow mode', () => {
    const overview = makeBaseOverview();
    const fixedNow = new Date('2026-11-14T12:00:00Z');

    // last-7-days should include both Nov 14 and Nov 10
    const last7 = computeAccountDistributionItems(
      overview,
      'last-7-days',
      null,
      'follow',
      '',
      '',
      fixedNow
    );
    expect(last7.length).toBe(2);

    // today should only include Nov 14 (primary account)
    const today = computeAccountDistributionItems(
      overview,
      'today',
      null,
      'follow',
      '',
      '',
      fixedNow
    );
    expect(today.length).toBe(1);
    expect(today[0].account).toBe('primary@example.com');
    expect(today[0].totalTokens).toBe(150); // 50 + 25 + 75
    expect(today[0].quotaCapacity?.fiveHourTokens).toBe(500_000);
    expect(today[0].quotaCapacity?.sevenDayTokens).toBe(3_500_000);
  });

  test('renderAccountDistribution renders HTML into container cleanly', () => {
    const overview = makeBaseOverview();

    // Mock minimal DOM container
    const container = {
      id: 'analytics-accounts-list',
      innerHTML: '',
      querySelectorAll: () => []
    };
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'analytics-accounts-list' ? container : null)
    };

    renderAccountDistribution(overview, 'last-30-days', null, 'all-time');

    expect(container.innerHTML).toContain('primary@example.com');
    expect(container.innerHTML).toContain('secondary@example.com');
    expect(container.innerHTML).toContain('account-current-badge');
    expect(container.innerHTML).toContain('Active');
    expect(container.innerHTML).toContain('5h Window ≈');
    expect(container.innerHTML).toContain('7d Window ≈');
    expect(container.innerHTML).toContain('500k');
    expect(container.innerHTML).toContain('3.5M');
  });

  test('renderAccountDistribution renders calibrating indicator when quota is uncalibrated', () => {
    const overview = makeBaseOverview();
    overview.accountDistribution![0].quotaCapacity = {
      status: 'calibrating',
      fiveHourUsed: 0,
      sevenDayUsed: 0
    };

    const container = {
      id: 'analytics-accounts-list',
      innerHTML: '',
      querySelectorAll: () => []
    };
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'analytics-accounts-list' ? container : null)
    };

    renderAccountDistribution(overview, 'last-30-days', null, 'all-time');
    expect(container.innerHTML).toContain('Calibrating Quota Capacity');
  });
});
