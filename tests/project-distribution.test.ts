import { describe, expect, test } from 'bun:test';
import {
  computeProjectDistributionItems,
  renderProjectDistribution
} from '../src/panel/analytics/metrics';
import { formatDisplayPath, resolveSummaryProjectInfo } from '../src/shared/project';
import type { GlobalAnalyticsOverview, ProjectStatItem, SessionAnalyticsData } from '../src/types';

function makeBaseOverview(): GlobalAnalyticsOverview {
  return {
    totalConversations: 3,
    totalRequests: 10,
    totalTokens: { input: 300, output: 100, cacheRead: 600, thinking: 0, total: 1000 },
    cacheEfficiency: 66.7,
    avgTtft: 1.5,
    avgTokPerSec: 120,
    topProjects: [],
    projects: [],
    dailyProjectStats: {},
    timeRangeSeries: [],
    modelDistribution: [],
    dailyModelStats: {},
    toolDistribution: [],
    dailyToolStats: {}
  };
}

describe('Workspace & Project Distribution', () => {
  test('resolveSummaryProjectInfo keeps full local path distinct, decodes URIs, and merges no-workspace entries', () => {
    const p1 = resolveSummaryProjectInfo(
      {
        projectId: 'id-1',
        workspaceUris: '["file:///Users/oren/WorkSpace/Apps/app"]'
      },
      '/Users/oren'
    );
    const p2 = resolveSummaryProjectInfo(
      {
        projectId: 'id-2',
        workspaceUris: '["file:///Users/oren/Downloads/app"]'
      },
      '/Users/oren'
    );
    expect(p1.name).toBe('app');
    expect(p2.name).toBe('app');
    expect(p1.projectKey).not.toBe(p2.projectKey);
    expect(p1.fullPath).toBe('/Users/oren/WorkSpace/Apps/app');
    expect(p1.displayPath).toBe('~/WorkSpace/Apps/app');
    expect(p1.isWorkspace).toBe(true);

    const spaces = resolveSummaryProjectInfo(
      {
        projectId: 'id-3',
        workspaceUris: '["file:///Users/oren/Documents/Oren%20Vault/Skills"]'
      },
      '/Users/oren'
    );
    expect(spaces.fullPath).toBe('/Users/oren/Documents/Oren Vault/Skills');
    expect(spaces.displayPath).toBe('~/Documents/Oren Vault/Skills');

    const win = resolveSummaryProjectInfo({
      projectId: 'id-4',
      workspaceUris: '["file:///C:/Users/oren/My%20Repo"]'
    });
    expect(win.fullPath).toBe('C:\\Users\\oren\\My Repo');
    expect(win.name).toBe('My Repo');

    expect(formatDisplayPath('/Users/oren2/foo', '/Users/oren')).toBe('/Users/oren2/foo');

    const outside = resolveSummaryProjectInfo({
      projectId: 'outside-of-project',
      workspaceUris: ''
    });
    const emptyProj = resolveSummaryProjectInfo({
      projectId: '',
      workspaceUris: ''
    });
    expect(outside.projectKey).toBe(emptyProj.projectKey);
    expect(outside.name).toBe('Conversations');
    expect(outside.isWorkspace).toBe(false);
    expect(outside.badgeText).toBe('outside-of-project');
  });

  test('computeProjectDistributionItems deduplicates multi-day conversations in follow mode and supports all-time without 5-item cap', () => {
    const overview = makeBaseOverview();
    const allProjects: ProjectStatItem[] = Array.from({ length: 7 }, (_, i) => ({
      projectKey: `/Users/oren/proj-${i + 1}`,
      name: `proj-${i + 1}`,
      fullPath: `/Users/oren/proj-${i + 1}`,
      displayPath: `~/proj-${i + 1}`,
      badgeText: `~/proj-${i + 1}`,
      isWorkspace: true,
      conversationCount: i + 1,
      tokenCount: (7 - i) * 100,
      inputTok: (7 - i) * 20,
      outTok: (7 - i) * 10,
      cacheRead: (7 - i) * 70,
      requests: i + 1
    }));
    overview.projects = allProjects;

    overview.dailyProjectStats = {
      '2026-11-08': {
        '/Users/oren/proj-1': {
          projectKey: '/Users/oren/proj-1',
          name: 'proj-1',
          fullPath: '/Users/oren/proj-1',
          displayPath: '~/proj-1',
          badgeText: '~/proj-1',
          isWorkspace: true,
          inTok: 100,
          outTok: 50,
          cacheRead: 250,
          requests: 2,
          conversationIds: ['conv-shared', 'conv-a']
        }
      },
      '2026-11-09': {
        '/Users/oren/proj-1': {
          projectKey: '/Users/oren/proj-1',
          name: 'proj-1',
          fullPath: '/Users/oren/proj-1',
          displayPath: '~/proj-1',
          badgeText: '~/proj-1',
          isWorkspace: true,
          inTok: 50,
          outTok: 50,
          cacheRead: 100,
          requests: 1,
          conversationIds: ['conv-shared']
        },
        __no_workspace__: {
          projectKey: '__no_workspace__',
          name: 'Conversations',
          fullPath: '',
          displayPath: '',
          badgeText: 'outside-of-project',
          isWorkspace: false,
          inTok: 100,
          outTok: 100,
          cacheRead: 200,
          requests: 2,
          conversationIds: ['conv-b']
        }
      }
    };

    const followItems = computeProjectDistributionItems(
      overview,
      'last-7-days',
      null,
      'follow',
      '',
      '',
      new Date('2026-11-09T12:00:00')
    );
    expect(followItems.length).toBe(2);
    expect(followItems[0].name).toBe('proj-1');
    expect(followItems[0].tokenCount).toBe(600);
    // conv-shared was active on both Nov 8 and Nov 9 -> counted once, plus conv-a = 2
    expect(followItems[0].conversationCount).toBe(2);
    expect(followItems[1].name).toBe('Conversations');
    expect(followItems[1].tokenCount).toBe(400);

    const allTimeItems = computeProjectDistributionItems(
      overview,
      'today',
      null,
      'all-time',
      '',
      '',
      new Date('2026-11-09T12:00:00')
    );
    expect(allTimeItems.length).toBe(7);

    const sessionData: SessionAnalyticsData = {
      cascadeId: '00000000-0000-0000-0000-000000000001',
      project: {
        projectKey: '/Users/oren/WorkSpace/Apps/aura',
        name: 'aura',
        fullPath: '/Users/oren/WorkSpace/Apps/aura',
        displayPath: '~/WorkSpace/Apps/aura',
        badgeText: '~/WorkSpace/Apps/aura',
        isWorkspace: true
      },
      totalTokens: { input: 100, output: 50, cacheRead: 250, thinking: 0, total: 400 },
      totalRequests: 2,
      cacheEfficiency: 71.4,
      avgTtft: 1.0,
      avgTokPerSec: 100,
      steps: [{ idx: 0, inTok: 100, outTok: 50, cacheRead: 250, ctx: 350, thinkTok: 0, respTok: 50, ttft: 1, stream: 1, totDur: 2 }]
    };
    const sessionFollow = computeProjectDistributionItems(overview, 'session', sessionData, 'follow');
    expect(sessionFollow.length).toBe(1);
    expect(sessionFollow[0].name).toBe('aura');
    expect(sessionFollow[0].tokenCount).toBe(400);
    expect(sessionFollow[0].conversationCount).toBe(1);
  });

  test('renderProjectDistribution uses total share for bar width, renders path pill with tooltip/open button, and avoids 5-item truncation', () => {
    const overview = makeBaseOverview();
    overview.projects = [
      {
        projectKey: '/Users/oren/WorkSpace/Apps/MaterialReader',
        name: 'MaterialReader',
        fullPath: '/Users/oren/WorkSpace/Apps/MaterialReader',
        displayPath: '~/WorkSpace/Apps/MaterialReader',
        badgeText: '~/WorkSpace/Apps/MaterialReader',
        isWorkspace: true,
        conversationCount: 10,
        tokenCount: 600,
        inputTok: 100,
        outTok: 100,
        cacheRead: 400,
        requests: 20
      },
      {
        projectKey: '__no_workspace__',
        name: 'Conversations',
        fullPath: '',
        displayPath: '',
        badgeText: 'outside-of-project',
        isWorkspace: false,
        conversationCount: 1,
        tokenCount: 400,
        inputTok: 100,
        outTok: 100,
        cacheRead: 200,
        requests: 2
      }
    ];

    const fakeContainer = { innerHTML: '' };
    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'analytics-projects-list' ? fakeContainer : null)
    };

    try {
      renderProjectDistribution(overview, 'today', null, 'all-time');
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }

    const html = fakeContainer.innerHTML;
    expect(html).toContain('data-tooltip-path="/Users/oren/WorkSpace/Apps/MaterialReader"');
    expect(html).toContain('data-open-path="/Users/oren/WorkSpace/Apps/MaterialReader"');
    expect(html).toContain('~/WorkSpace/Apps/MaterialReader');
    // 600 / (600 + 400) = 60.0% (not 100% relative to #1)
    expect(html).toContain('style="width: 60.00%"');
    expect(html).toContain('60.0%');
    expect(html).toContain('style="width: 40.00%"');
    expect(html).toContain('40.0%');
    // Singular vs plural session labels
    expect(html).toContain('10 sessions');
    expect(html).toContain('1 session');
    // Path pill placed below progress bar in .project-footer
    const firstRow = html.split('class="project-stat-row"')[1] || '';
    const metaSection = firstRow.split('class="project-bar-track"')[0] || '';
    const footerSection = firstRow.split('class="project-footer"')[1] || '';
    expect(metaSection).not.toContain('project-path-pill');
    expect(footerSection).toContain('project-path-pill');
    // Conversations has muted badge without open button
    expect(html).toContain('Conversations');
    expect(html).toContain('outside-of-project');
    expect(html.match(/class="project-open-btn"/g)?.length).toBe(1);
  });
});
