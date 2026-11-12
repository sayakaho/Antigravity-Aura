import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  computeProcessedColumns,
  computeSubagentBreakdown,
  renderSubagentDistribution
} from '../src/panel/analytics/metrics';
import { GlobalAnalyticsEngine } from '../src/server/analytics-engine';
import {
  buildSessionTreeIndex,
  isSubagentSummary,
  resolveSubagentAgentName
} from '../src/shared/session';
import type { ConversationSummary, GlobalAnalyticsOverview, SessionAnalyticsData } from '../src/types';

function encodeVarint(val: number | bigint): Buffer {
  let n = BigInt(val);
  const bytes: number[] = [];
  while (n >= 0x80n) {
    bytes.push(Number((n & 0x7fn) | 0x80n));
    n >>= 7n;
  }
  bytes.push(Number(n));
  return Buffer.from(bytes);
}

function encodeFieldVarint(fieldNum: number, val: number | bigint): Buffer {
  return Buffer.concat([encodeVarint((fieldNum << 3) | 0), encodeVarint(val)]);
}

function encodeFieldBytes(fieldNum: number, payload: Buffer | string): Buffer {
  const buf = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  return Buffer.concat([encodeVarint((fieldNum << 3) | 2), encodeVarint(buf.length), buf]);
}

function buildGenMetadataBlob(opts: {
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok?: number;
  ttftSec?: number;
  streamSec?: number;
  modelId: string;
  modelName: string;
  stepIdx: number;
}): Buffer {
  const usage = Buffer.concat([
    encodeFieldVarint(2, opts.inTok),
    encodeFieldVarint(3, opts.outTok),
    encodeFieldVarint(5, opts.cacheRead),
    encodeFieldVarint(9, opts.thinkTok ?? 0),
    encodeFieldVarint(10, Math.max(0, opts.outTok - (opts.thinkTok ?? 0)))
  ]);
  const ttft = encodeFieldVarint(1, Math.floor(opts.ttftSec ?? 1));
  const stream = encodeFieldVarint(1, Math.floor(opts.streamSec ?? 2));
  const chat = Buffer.concat([
    encodeFieldBytes(4, usage),
    encodeFieldBytes(11, ttft),
    encodeFieldBytes(12, stream),
    encodeFieldBytes(19, opts.modelId),
    encodeFieldBytes(21, opts.modelName)
  ]);
  return Buffer.concat([encodeFieldBytes(1, chat), encodeFieldBytes(2, encodeVarint(opts.stepIdx))]);
}

function buildStepMetaBlob(epochSec: number): Buffer {
  return encodeFieldBytes(1, encodeFieldVarint(1, epochSec));
}

function buildToolPayloadBlob(toolName: string): Buffer {
  return encodeFieldBytes(5, encodeFieldBytes(4, encodeFieldBytes(2, toolName)));
}

function createConvDb(
  filePath: string,
  gens: Array<Parameters<typeof buildGenMetadataBlob>[0]>,
  tools: Array<{ idx: number; name: string }>,
  epochSec: number
): void {
  const db = new DatabaseSync(filePath);
  db.exec(`
    CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, step_payload BLOB, metadata BLOB);
    CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB);
  `);
  const insertStep = db.prepare(
    'INSERT INTO steps (idx, step_type, step_payload, metadata) VALUES (?, ?, ?, ?)'
  );
  const insertGen = db.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)');

  const metaBlob = buildStepMetaBlob(epochSec);
  for (let i = 0; i < gens.length; i++) {
    const g = gens[i];
    insertStep.run(g.stepIdx, 15, Buffer.alloc(0), metaBlob);
    insertGen.run(i, buildGenMetadataBlob(g));
  }
  for (const t of tools) {
    insertStep.run(t.idx, 132, buildToolPayloadBlob(t.name), metaBlob);
  }
  db.close();
}

describe('Subagent session tree & analytics integration', () => {
  test('buildSessionTreeIndex resolves multi-level root, filters orphans, and guards cycles', () => {
    const summaries: ConversationSummary[] = [
      {
        conversationId: 'root-1',
        title: 'Root',
        stepCount: 4,
        lastModifiedTime: '2026-11-10T10:00:00Z',
        projectId: 'p1',
        agentName: '',
        workspaceUris: '["file:///Users/oren/proj"]',
        status: 'IDLE',
        parentConversationId: '',
        nestingDepth: 0
      },
      {
        conversationId: 'sub-1',
        title: 'Sub 1',
        stepCount: 6,
        lastModifiedTime: '2026-11-10T10:01:00Z',
        projectId: 'p1',
        agentName: 'research',
        workspaceUris: '["file:///Users/oren/proj"]',
        status: 'IDLE',
        parentConversationId: 'root-1',
        nestingDepth: 1
      },
      {
        conversationId: 'sub-2',
        title: 'Sub 2',
        stepCount: 2,
        lastModifiedTime: '2026-11-10T10:02:00Z',
        projectId: 'p1',
        agentName: 'self',
        workspaceUris: '["file:///Users/oren/proj"]',
        status: 'IDLE',
        parentConversationId: 'sub-1',
        nestingDepth: 2
      },
      {
        conversationId: 'orphan-1',
        title: 'Orphan',
        stepCount: 3,
        lastModifiedTime: '2026-11-10T10:03:00Z',
        projectId: 'p1',
        agentName: 'research',
        workspaceUris: '["file:///Users/oren/proj"]',
        status: 'IDLE',
        parentConversationId: 'deleted-root',
        nestingDepth: 1
      },
      {
        conversationId: 'cycle-a',
        title: 'Cycle A',
        stepCount: 1,
        lastModifiedTime: '2026-11-10T10:04:00Z',
        projectId: 'p1',
        agentName: 'self',
        workspaceUris: '["file:///Users/oren/proj"]',
        status: 'IDLE',
        parentConversationId: 'cycle-b',
        nestingDepth: 1
      },
      {
        conversationId: 'cycle-b',
        title: 'Cycle B',
        stepCount: 1,
        lastModifiedTime: '2026-11-10T10:04:00Z',
        projectId: 'p1',
        agentName: 'self',
        workspaceUris: '["file:///Users/oren/proj"]',
        status: 'IDLE',
        parentConversationId: 'cycle-a',
        nestingDepth: 2
      }
    ];

    const tree = buildSessionTreeIndex(summaries);
    expect(isSubagentSummary(summaries[0])).toBe(false);
    expect(isSubagentSummary(summaries[1])).toBe(true);
    expect(resolveSubagentAgentName('')).toBe('subagent');
    expect(resolveSubagentAgentName(' research ')).toBe('research');

    expect(tree.resolveRootConversationId('root-1')).toBe('root-1');
    expect(tree.resolveRootConversationId('sub-1')).toBe('root-1');
    expect(tree.resolveRootConversationId('sub-2')).toBe('root-1');
    expect(tree.resolveRootConversationId('orphan-1')).toBeNull();
    expect(tree.resolveRootConversationId('cycle-a')).toBeNull();
    expect(tree.collectDescendantIds('root-1')).toEqual(['sub-1', 'sub-2']);
    expect(tree.collectDescendantIds('cycle-a')).toEqual(['cycle-b']);
  });

  test('GlobalAnalyticsEngine deduplicates root sessions, excludes orphan subagents from session counts, and merges session trees', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-subagent-engine-'));
    try {
      const convDir = path.join(tmpDir, 'conversations');
      fs.mkdirSync(convDir, { recursive: true });

      const rootId = '11111111-1111-1111-1111-111111111111';
      const sub1Id = '22222222-2222-2222-2222-222222222222';
      const sub2Id = '33333333-3333-3333-3333-333333333333';
      const subNestedId = '44444444-4444-4444-4444-444444444444';
      const orphanId = '55555555-5555-5555-5555-555555555555';
      const missingRootId = '99999999-9999-9999-9999-999999999999';

      const epochSec = Math.floor(new Date('2026-11-10T10:00:00').getTime() / 1000);
      const wsUri = '["file:///Users/oren/WorkSpace/Apps/demo"]';

      const sumDb = new DatabaseSync(path.join(tmpDir, 'conversation_summaries.db'));
      sumDb.exec(`
        CREATE TABLE conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          title TEXT,
          step_count INTEGER,
          last_modified_time TEXT,
          project_id TEXT,
          agent_name TEXT,
          workspace_uris TEXT,
          status TEXT,
          parent_conversation_id TEXT,
          nesting_depth INTEGER
        );
      `);
      const ins = sumDb.prepare(`
        INSERT INTO conversation_summaries (
          conversation_id, title, step_count, last_modified_time,
          project_id, agent_name, workspace_uris, status,
          parent_conversation_id, nesting_depth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      ins.run(rootId, 'Main Task', 4, '2026-11-10T10:00:00', 'proj-1', '', wsUri, 'IDLE', '', 0);
      ins.run(sub1Id, 'Research 1', 4, '2026-11-10T10:01:00', 'proj-1', 'research', wsUri, 'IDLE', rootId, 1);
      ins.run(sub2Id, 'Self Worker', 2, '2026-11-10T10:02:00', 'proj-1', 'self', wsUri, 'IDLE', rootId, 1);
      ins.run(subNestedId, 'Nested Research', 2, '2026-11-10T10:03:00', 'proj-1', 'research', wsUri, 'IDLE', sub1Id, 2);
      ins.run(orphanId, 'Orphan Research', 2, '2026-11-10T10:04:00', 'proj-1', 'research', wsUri, 'IDLE', missingRootId, 1);
      sumDb.close();

      createConvDb(
        path.join(convDir, `${rootId}.db`),
        [
          {
            inTok: 1000,
            outTok: 200,
            cacheRead: 800,
            thinkTok: 50,
            modelId: 'claude-opus-4-6-thinking',
            modelName: 'Claude Opus 4.6 Thinking',
            stepIdx: 1
          }
        ],
        [{ idx: 2, name: 'invoke_subagent' }],
        epochSec
      );
      createConvDb(
        path.join(convDir, `${sub1Id}.db`),
        [
          {
            inTok: 2000,
            outTok: 500,
            cacheRead: 5000,
            modelId: 'gemini-3.8-flash-s',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 1
          },
          {
            inTok: 1000,
            outTok: 300,
            cacheRead: 2000,
            modelId: 'gemini-3.8-flash-s',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 2
          }
        ],
        [
          { idx: 3, name: 'read_file' },
          { idx: 4, name: 'grep_search' }
        ],
        epochSec
      );
      createConvDb(
        path.join(convDir, `${sub2Id}.db`),
        [
          {
            inTok: 500,
            outTok: 100,
            cacheRead: 1400,
            modelId: 'gemini-3.8-flash-s',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 1
          }
        ],
        [{ idx: 2, name: 'run_command' }],
        epochSec
      );
      createConvDb(
        path.join(convDir, `${subNestedId}.db`),
        [
          {
            inTok: 300,
            outTok: 100,
            cacheRead: 600,
            modelId: 'gemini-3.8-flash-s',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 1
          }
        ],
        [{ idx: 2, name: 'read_file' }],
        epochSec
      );
      createConvDb(
        path.join(convDir, `${orphanId}.db`),
        [
          {
            inTok: 400,
            outTok: 100,
            cacheRead: 500,
            modelId: 'gemini-3.8-flash-s',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 1
          }
        ],
        [{ idx: 2, name: 'list_dir' }],
        epochSec
      );

      const engine = new GlobalAnalyticsEngine(tmpDir);
      const overview = engine.getGlobalOverview();

      // Only the 1 root session counts toward conversations/sessions (orphan subagent excluded)
      expect(overview.totalConversations).toBe(1);
      expect(overview.projects?.length).toBe(1);
      expect(overview.projects?.[0].conversationCount).toBe(1);
      // Total tokens include root (2000) + sub1 (10800) + sub2 (2000) + subNested (1000) + orphan (1000) = 16800
      expect(overview.totalTokens.total).toBe(16800);
      expect(overview.projects?.[0].tokenCount).toBe(16800);
      expect(overview.totalRequests).toBe(6);

      // dailyProjectStats only contains rootId (deduplicated)
      const dayBucket = overview.dailyProjectStats?.['2026-11-10']?.['/Users/oren/WorkSpace/Apps/demo'];
      expect(dayBucket?.conversationIds).toEqual([rootId]);

      // subagentDistribution aggregates across all subagents by agentName
      expect(overview.subagentDistribution?.length).toBe(2);
      expect(overview.subagentDistribution?.[0].agentName).toBe('research');
      expect(overview.subagentDistribution?.[0].runs).toBe(3); // sub1 + subNested + orphan
      expect(overview.subagentDistribution?.[0].totalTokens).toBe(12800);
      expect(overview.subagentDistribution?.[1].agentName).toBe('self');
      expect(overview.subagentDistribution?.[1].runs).toBe(1);
      expect(overview.subagentDistribution?.[1].totalTokens).toBe(2000);

      // Session details default-merge root + descendants (excluding orphan)
      const session = engine.getSessionDetails(rootId);
      expect(session).not.toBeNull();
      // Main context steps remain isolated to main session (1 step)
      expect(session!.steps.length).toBe(1);
      expect(session!.steps[0].ctx).toBe(1800);
      // Merged tokens = root (2000) + sub1 (10800) + sub2 (2000) + subNested (1000) = 15800
      expect(session!.totalTokens.total).toBe(15800);
      expect(session!.totalRequests).toBe(5);
      // Merged models include both Opus (main) and Flash (subagents)
      expect(session!.models?.map((m) => m.modelId)).toEqual([
        'gemini-3.8-flash-s',
        'claude-opus-4-6-thinking'
      ]);
      // Merged tools include subagent tool calls + main invoke_subagent
      const toolCounts = Object.fromEntries((session!.tools || []).map((t) => [t.rawName, t.count]));
      expect(toolCounts).toEqual({
        read_file: 2,
        invoke_subagent: 1,
        grep_search: 1,
        run_command: 1
      });
      // Session subagents breakdown
      expect(session!.subagents?.mainTokens).toBe(2000);
      expect(session!.subagents?.subagentTokens).toBe(13800);
      expect(session!.subagents?.totalRuns).toBe(3);
      expect(session!.subagents?.items.map((x) => x.agentName)).toEqual(['research', 'self']);

      // Session speedTimeline merges main + descendant subagent requests by canonical modelId
      expect(session!.speedTimeline).toBeDefined();
      expect(session!.speedTimeline!.slots.length).toBe(1);
      const slotModels = session!.speedTimeline!.slots[0].models;
      expect(Object.keys(slotModels).sort()).toEqual([
        'claude-opus-4-6-thinking',
        'gemini-3.8-flash-s'
      ]);
      expect(slotModels['claude-opus-4-6-thinking'].requests).toBe(1);
      expect(slotModels['gemini-3.8-flash-s'].requests).toBe(4);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('GlobalAnalyticsEngine builds multi-slot session speedTimeline across subagent timestamps and invalidates cache on db update', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-speed-timeline-'));
    try {
      const convDir = path.join(tmpDir, 'conversations');
      fs.mkdirSync(convDir, { recursive: true });

      const rootId = 'aaaa1111-1111-1111-1111-111111111111';
      const subId = 'bbbb2222-2222-2222-2222-222222222222';
      const t0 = Math.floor(new Date('2026-11-10T10:00:00').getTime() / 1000);
      const t1 = t0 + 600; // 10 minutes later
      const wsUri = '["file:///Users/oren/WorkSpace/Apps/demo"]';

      const sumDb = new DatabaseSync(path.join(tmpDir, 'conversation_summaries.db'));
      sumDb.exec(`
        CREATE TABLE conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          title TEXT,
          step_count INTEGER,
          last_modified_time TEXT,
          project_id TEXT,
          agent_name TEXT,
          workspace_uris TEXT,
          status TEXT,
          parent_conversation_id TEXT,
          nesting_depth INTEGER
        );
      `);
      sumDb
        .prepare(
          `INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(rootId, 'Root', 1, '2026-11-10T10:00:00', 'proj-1', '', wsUri, 'IDLE', '', 0);
      sumDb
        .prepare(
          `INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(subId, 'Sub', 1, '2026-11-10T10:10:00', 'proj-1', 'research', wsUri, 'IDLE', rootId, 1);
      sumDb.close();

      createConvDb(
        path.join(convDir, `${rootId}.db`),
        [
          {
            inTok: 1000,
            outTok: 300,
            cacheRead: 500,
            streamSec: 3,
            modelId: 'gemini-3.8-flash-s',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 1
          }
        ],
        [],
        t0
      );
      createConvDb(
        path.join(convDir, `${subId}.db`),
        [
          {
            inTok: 1200,
            outTok: 160,
            cacheRead: 800,
            streamSec: 2,
            modelId: 'gemini-3.8-flash-n',
            modelName: 'Gemini 3.8 Flash (High)',
            stepIdx: 1
          }
        ],
        [],
        t1
      );

      const engine = new GlobalAnalyticsEngine(tmpDir);
      const first = engine.getSessionDetails(rootId);
      expect(first?.speedTimeline?.slots.length).toBe(2);
      expect(first?.speedTimeline?.slots[0].models['gemini-3.8-flash-s'].effOutTok).toBe(300);
      expect(first?.speedTimeline?.slots[1].models['gemini-3.8-flash-n'].effOutTok).toBe(160);

      // Update subagent DB with an extra request at a different size/mtime and verify cache refresh
      const subDbPath = path.join(convDir, `${subId}.db`);
      const subDb = new DatabaseSync(subDbPath);
      const metaBlob = buildStepMetaBlob(t1 + 10);
      subDb.prepare('INSERT INTO steps (idx, step_type, step_payload, metadata) VALUES (?, ?, ?, ?)').run(
        2,
        15,
        Buffer.alloc(0),
        metaBlob
      );
      subDb.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)').run(
        1,
        buildGenMetadataBlob({
          inTok: 500,
          outTok: 240,
          cacheRead: 400,
          streamSec: 3,
          modelId: 'gemini-3.8-flash-n',
          modelName: 'Gemini 3.8 Flash (High)',
          stepIdx: 2
        })
      );
      subDb.close();
      const nextTime = new Date(Date.now() + 5000);
      fs.utimesSync(subDbPath, nextTime, nextTime);

      const updated = engine.getSessionDetails(rootId);
      expect(updated?.speedTimeline?.slots[1].models['gemini-3.8-flash-n'].requests).toBe(2);
      expect(updated?.speedTimeline?.slots[1].models['gemini-3.8-flash-n'].effOutTok).toBe(400);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('computeSubagentBreakdown & renderSubagentDistribution deduplicate multi-day runs and auto-hide when empty', () => {
    const overview: GlobalAnalyticsOverview = {
      totalConversations: 1,
      totalRequests: 10,
      totalTokens: { input: 2000, output: 1000, cacheRead: 7000, thinking: 0, total: 10000 },
      cacheEfficiency: 77.8,
      avgTtft: 1,
      avgTokPerSec: 100,
      topProjects: [],
      timeRangeSeries: [
        { date: '2026-11-08', inputTok: 1000, outTok: 500, cacheRead: 3500, requests: 5 },
        { date: '2026-11-09', inputTok: 1000, outTok: 500, cacheRead: 3500, requests: 5 }
      ],
      modelDistribution: [],
      dailyModelStats: {},
      toolDistribution: [],
      dailyToolStats: {},
      dailySubagentStats: {
        '2026-11-08': {
          research: {
            agentName: 'research',
            runs: 1,
            inTok: 500,
            outTok: 250,
            cacheRead: 2250,
            thinkTok: 0,
            requests: 2,
            conversationIds: ['sub-shared']
          }
        },
        '2026-11-09': {
          research: {
            agentName: 'research',
            runs: 1,
            inTok: 500,
            outTok: 250,
            cacheRead: 2250,
            thinkTok: 0,
            requests: 3,
            conversationIds: ['sub-shared']
          }
        }
      }
    };

    const now = new Date('2026-11-09T12:00:00');
    const processed = computeProcessedColumns(overview, 'last-7-days', null, '', '', now);
    const breakdown = computeSubagentBreakdown(overview, 'last-7-days', null, processed, '', '', now);

    expect(breakdown).not.toBeNull();
    // sub-shared spans Nov 8 and Nov 9 -> deduplicated to 1 run
    expect(breakdown!.totalRuns).toBe(1);
    expect(breakdown!.subagentTokens).toBe(6000);
    expect(breakdown!.mainTokens).toBe(4000);

    const fakeSection = { style: { display: 'none' } };
    const fakeContainer = { innerHTML: '' };
    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) =>
        id === 'analytics-subagents-section'
          ? fakeSection
          : id === 'analytics-subagents-list'
            ? fakeContainer
            : null
    };

    try {
      renderSubagentDistribution(overview, 'last-7-days', null, processed);
      expect(fakeSection.style.display).toBe('');
      expect(fakeContainer.innerHTML).toContain('Main Agent');
      expect(fakeContainer.innerHTML).toContain('40.0%');
      expect(fakeContainer.innerHTML).toContain('Subagents');
      expect(fakeContainer.innerHTML).toContain('60.0%');
      expect(fakeContainer.innerHTML).toContain('1 run');
      expect(fakeContainer.innerHTML).toContain('research');

      // Session without subagents hides the section automatically
      const plainSession: SessionAnalyticsData = {
        cascadeId: '00000000-0000-0000-0000-000000000001',
        totalTokens: { input: 100, output: 50, cacheRead: 200, thinking: 0, total: 350 },
        totalRequests: 1,
        cacheEfficiency: 66.7,
        avgTtft: 1,
        avgTokPerSec: 100,
        steps: []
      };
      const sessionProcessed = computeProcessedColumns(overview, 'session', plainSession);
      renderSubagentDistribution(overview, 'session', plainSession, sessionProcessed);
      expect(fakeSection.style.display).toBe('none');
      expect(fakeContainer.innerHTML).toBe('');
    } finally {
      if (origDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = origDocument;
      }
    }
  });

  test('getSessionDetails counts step_type=14 user turns on the main session separately from requests', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-session-turns-'));
    const convDir = path.join(tmpDir, 'conversations');
    fs.mkdirSync(convDir, { recursive: true });

    const rootId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const subId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const wsUri = 'file:///Users/oren/WorkSpace/Apps/demo';
    const epochSec = Math.floor(new Date('2026-11-10T10:00:00').getTime() / 1000);

    try {
      const sumDb = new DatabaseSync(path.join(tmpDir, 'conversation_summaries.db'));
      sumDb.exec(`
        CREATE TABLE conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          title TEXT,
          step_count INTEGER,
          last_modified_time TEXT,
          project_id TEXT,
          agent_name TEXT,
          workspace_uris TEXT,
          status TEXT,
          parent_conversation_id TEXT,
          nesting_depth INTEGER
        );
      `);
      const ins = sumDb.prepare(`
        INSERT INTO conversation_summaries (
          conversation_id, title, step_count, last_modified_time,
          project_id, agent_name, workspace_uris, status,
          parent_conversation_id, nesting_depth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      ins.run(rootId, 'Main Task', 6, '2026-11-10T10:00:00', 'proj-1', '', wsUri, 'IDLE', '', 0);
      ins.run(subId, 'Sub Task', 3, '2026-11-10T10:01:00', 'proj-1', 'research', wsUri, 'IDLE', rootId, 1);
      sumDb.close();

      const rootDbPath = path.join(convDir, `${rootId}.db`);
      createConvDb(
        rootDbPath,
        [
          { inTok: 100, outTok: 20, cacheRead: 200, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', stepIdx: 1 },
          { inTok: 100, outTok: 20, cacheRead: 200, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', stepIdx: 2 },
          { inTok: 100, outTok: 20, cacheRead: 200, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', stepIdx: 4 }
        ],
        [],
        epochSec
      );
      const rootDb = new DatabaseSync(rootDbPath);
      rootDb.prepare('INSERT INTO steps (idx, step_type, step_payload, metadata) VALUES (?, ?, ?, ?)').run(0, 14, Buffer.alloc(0), buildStepMetaBlob(epochSec));
      rootDb.prepare('INSERT INTO steps (idx, step_type, step_payload, metadata) VALUES (?, ?, ?, ?)').run(3, 14, Buffer.alloc(0), buildStepMetaBlob(epochSec));
      rootDb.close();

      const subDbPath = path.join(convDir, `${subId}.db`);
      createConvDb(
        subDbPath,
        [
          { inTok: 50, outTok: 10, cacheRead: 100, modelId: 'gemini-3.8-flash-s', modelName: 'Gemini 3.8 Flash (High)', stepIdx: 1 }
        ],
        [],
        epochSec
      );
      const subDb = new DatabaseSync(subDbPath);
      subDb.prepare('INSERT INTO steps (idx, step_type, step_payload, metadata) VALUES (?, ?, ?, ?)').run(0, 14, Buffer.alloc(0), buildStepMetaBlob(epochSec));
      subDb.close();

      const engine = new GlobalAnalyticsEngine(tmpDir);
      const session = engine.getSessionDetails(rootId);
      expect(session).not.toBeNull();
      expect(session!.steps.length).toBe(3);
      expect(session!.totalRequests).toBe(4);
      expect(session!.sessionTurns).toBe(2);

      const overview = engine.getGlobalOverview();
      const dayBucket = overview.timeRangeSeries.find((d) => d.date === '2026-11-10');
      expect(dayBucket?.userTurns).toBe(2);
      const hourBucket = overview.hourlySeries?.find((h) => h.hourKey === '2026-11-10 10:00');
      expect(hourBucket?.userTurns).toBe(2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
