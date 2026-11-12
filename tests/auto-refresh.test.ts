import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AnalyticsAutoRefreshController,
  type AnalyticsRefreshRequest
} from '../src/panel/analytics/auto-refresh';
import { renderActivityChart } from '../src/panel/analytics/charts';
import { clearRenderedHtmlCache, setRenderedHtmlIfChanged } from '../src/panel/analytics/charts-base';
import type { ChartColumnData } from '../src/panel/analytics/charts-base';
import { GlobalAnalyticsEngine } from '../src/server/analytics-engine';
import { buildSessionAnalyticsEndpoint } from '../src/shared/session';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  modelId: string;
  modelName: string;
  stepIdx: number;
}): Buffer {
  const usage = Buffer.concat([
    encodeFieldVarint(2, opts.inTok),
    encodeFieldVarint(3, opts.outTok),
    encodeFieldVarint(5, opts.cacheRead),
    encodeFieldVarint(10, opts.outTok)
  ]);
  const chat = Buffer.concat([
    encodeFieldBytes(4, usage),
    encodeFieldBytes(11, encodeFieldVarint(1, 1)),
    encodeFieldBytes(12, encodeFieldVarint(1, 2)),
    encodeFieldBytes(19, opts.modelId),
    encodeFieldBytes(21, opts.modelName)
  ]);
  return Buffer.concat([encodeFieldBytes(1, chat), encodeFieldBytes(2, encodeVarint(opts.stepIdx))]);
}

function createConvDb(
  filePath: string,
  gens: Array<Parameters<typeof buildGenMetadataBlob>[0]>,
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
  const metaBlob = encodeFieldBytes(1, encodeFieldVarint(1, epochSec));

  for (let i = 0; i < gens.length; i++) {
    const g = gens[i];
    insertStep.run(g.stepIdx, 15, Buffer.alloc(0), metaBlob);
    insertGen.run(i, buildGenMetadataBlob(g));
  }
  db.close();
}

function appendGenToDb(
  filePath: string,
  idx: number,
  gen: Parameters<typeof buildGenMetadataBlob>[0],
  epochSec: number
): void {
  const db = new DatabaseSync(filePath);
  const metaBlob = encodeFieldBytes(1, encodeFieldVarint(1, epochSec));
  db.prepare('INSERT INTO steps (idx, step_type, step_payload, metadata) VALUES (?, ?, ?, ?)').run(
    gen.stepIdx,
    15,
    Buffer.alloc(0),
    metaBlob
  );
  db.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)').run(idx, buildGenMetadataBlob(gen));
  db.close();
}

describe('AnalyticsAutoRefreshController', () => {
  test('defers initial load until Analytics tab is active & visible', () => {
    const calls: AnalyticsRefreshRequest[] = [];
    const ctrl = new AnalyticsAutoRefreshController({
      initialTabActive: false,
      initialHidden: false,
      onRefresh: (req) => {
        calls.push(req);
      }
    });

    ctrl.triggerInitialLoad();
    expect(calls).toEqual([]);

    // Hidden while switching tab -> still waits for visibility
    ctrl.onVisibilityChange(true);
    ctrl.onTabChange(true);
    expect(calls).toEqual([]);

    ctrl.onVisibilityChange(false);
    expect(calls).toEqual([{ mode: 'initial', force: false, preserveScroll: false }]);
    ctrl.dispose();
  });

  test('tracks analyticsRevision baseline, preserves scroll on telemetry update, and resets on session switch', () => {
    const calls: AnalyticsRefreshRequest[] = [];
    const ctrl = new AnalyticsAutoRefreshController({
      initialTabActive: true,
      initialHidden: false,
      onRefresh: (req) => {
        calls.push(req);
      }
    });

    ctrl.triggerInitialLoad();
    expect(calls.length).toBe(1);

    // First revision snapshot establishes baseline without extra refresh
    ctrl.onStatusSnapshot({
      analyticsRevision: 5,
      activeCascadeId: 'conv-a',
      renderedSessionId: 'conv-a'
    });
    expect(calls.length).toBe(1);

    // Same revision & session -> no-op
    ctrl.onStatusSnapshot({
      analyticsRevision: 5,
      activeCascadeId: 'conv-a',
      renderedSessionId: 'conv-a'
    });
    expect(calls.length).toBe(1);

    // Revision bumped -> auto refresh preserves scroll
    ctrl.onStatusSnapshot({
      analyticsRevision: 6,
      activeCascadeId: 'conv-a',
      renderedSessionId: 'conv-a'
    });
    expect(calls[1]).toEqual({ mode: 'auto', force: false, preserveScroll: true });

    // Session switched -> resets preserveScroll to false
    ctrl.onStatusSnapshot({
      analyticsRevision: 6,
      activeCascadeId: 'conv-b',
      renderedSessionId: 'conv-a'
    });
    expect(calls[2]).toEqual({ mode: 'auto', force: false, preserveScroll: false });
    ctrl.dispose();
  });

  test('defers auto-refresh while user is interacting and flushes after grace window', async () => {
    const calls: AnalyticsRefreshRequest[] = [];
    const ctrl = new AnalyticsAutoRefreshController({
      initialTabActive: true,
      initialHidden: false,
      interactionGraceMs: 40,
      onRefresh: (req) => {
        calls.push(req);
      }
    });

    ctrl.triggerInitialLoad();
    ctrl.onStatusSnapshot({ analyticsRevision: 1, activeCascadeId: 'conv-1', renderedSessionId: 'conv-1' });
    ctrl.onInteractionChange(true);

    ctrl.onStatusSnapshot({ analyticsRevision: 2, activeCascadeId: 'conv-1', renderedSessionId: 'conv-1' });
    expect(calls.length).toBe(1);

    ctrl.onInteractionChange(false);
    // Cancel pending grace flush if user starts interacting again immediately
    await sleep(10);
    ctrl.onInteractionChange(true);
    await sleep(50);
    expect(calls.length).toBe(1);

    ctrl.onInteractionChange(false);
    await sleep(60);
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual({ mode: 'auto', force: false, preserveScroll: true });
    ctrl.dispose();
  });

  test('marks dirty when hidden/inactive, flushes on return, and supports force manual refresh', () => {
    const calls: AnalyticsRefreshRequest[] = [];
    const ctrl = new AnalyticsAutoRefreshController({
      initialTabActive: true,
      initialHidden: false,
      onRefresh: (req) => {
        calls.push(req);
      }
    });

    ctrl.triggerInitialLoad();
    ctrl.onStatusSnapshot({ analyticsRevision: 1, activeCascadeId: 'c1', renderedSessionId: 'c1' });
    ctrl.onTabChange(false);
    ctrl.onStatusSnapshot({ analyticsRevision: 2, activeCascadeId: 'c1', renderedSessionId: 'c1' });
    ctrl.onWorkspaceChange();
    expect(calls.length).toBe(1);

    ctrl.onTabChange(true);
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual({ mode: 'auto', force: false, preserveScroll: true });

    ctrl.triggerManualRefresh();
    expect(calls[2]).toEqual({ mode: 'manual', force: true, preserveScroll: true });
    ctrl.dispose();
  });

  test('buildSessionAnalyticsEndpoint appends force=1 when forced', () => {
    expect(buildSessionAnalyticsEndpoint('abc', false)).toBe('/api/analytics/session?fallbackId=abc');
    expect(buildSessionAnalyticsEndpoint('abc', true)).toBe('/api/analytics/session?fallbackId=abc&force=1');
    expect(buildSessionAnalyticsEndpoint('', true)).toBe('/api/analytics/session?force=1');
  });
});

describe('GlobalAnalyticsEngine revision, caching & file watching', () => {
  test('caches session & global overview, detects subagent/main mutations cleanly, and honors force', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-auto-refresh-engine-'));
    const convDir = path.join(tmpDir, 'conversations');
    fs.mkdirSync(convDir, { recursive: true });

    const rootId = '11111111-1111-1111-1111-111111111111';
    const subId = '22222222-2222-2222-2222-222222222222';
    const epochSec = Math.floor(new Date('2026-11-12T10:00:00Z').getTime() / 1000);

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
    ins.run(rootId, 'Root', 1, '2026-11-12T10:00:00Z', 'p1', '', '["file:///tmp/demo"]', 'IDLE', '', 0);
    ins.run(subId, 'Sub', 1, '2026-11-12T10:01:00Z', 'p1', 'research', '["file:///tmp/demo"]', 'IDLE', rootId, 1);
    sumDb.close();

    const rootDbPath = path.join(convDir, `${rootId}.db`);
    const subDbPath = path.join(convDir, `${subId}.db`);
    createConvDb(
      rootDbPath,
      [{ inTok: 100, outTok: 20, cacheRead: 50, modelId: 'gemini-2.5-flash', modelName: 'Gemini 2.5 Flash', stepIdx: 0 }],
      epochSec
    );
    createConvDb(
      subDbPath,
      [{ inTok: 40, outTok: 10, cacheRead: 20, modelId: 'gemini-2.5-flash', modelName: 'Gemini 2.5 Flash', stepIdx: 0 }],
      epochSec + 5
    );

    const engine = new GlobalAnalyticsEngine(tmpDir);
    try {
      engine.startWatching(40);
      const rev0 = engine.getRevision();

      const ov1 = engine.getGlobalOverview();
      const ov2 = engine.getGlobalOverview();
      expect(ov2).toBe(ov1);
      expect(ov1.timeRangeSeries.length).toBeGreaterThan(0);
      const allLatencySamples = ov1.timeRangeSeries.flatMap((d) => d.latencySamples || []);
      expect(allLatencySamples.length).toBe(2);
      expect(allLatencySamples[0].ttft).toBe(1);
      expect(allLatencySamples[0].stream).toBe(2);
      expect(allLatencySamples[0].totDur).toBe(3);

      const s1 = engine.getSessionDetails(rootId);
      const s2 = engine.getSessionDetails(rootId);
      expect(s2).toBe(s1);
      expect(s1?.totalTokens.total).toBe(240);

      // Force recomputes fresh object references
      const sForced = engine.getSessionDetails(rootId, true);
      expect(sForced).not.toBe(s1);
      expect(sForced?.totalTokens.total).toBe(240);

      // Deduplicates CDP signature notifications
      expect(engine.notifySessionSignature(rootId, 'custom-sig-1')).toBe(true);
      const revAfterSig = engine.getRevision();
      expect(revAfterSig).toBe(rev0 + 1);
      expect(engine.notifySessionSignature(rootId, 'custom-sig-1')).toBe(false);
      expect(engine.getRevision()).toBe(revAfterSig);

      // Flush disk cache should NOT trigger watcher revision bump
      engine.flushCache();
      await sleep(90);
      expect(engine.getRevision()).toBe(revAfterSig);

      // Mutate subagent DB -> fs.watch bumps revision & session composite cache invalidates
      appendGenToDb(
        subDbPath,
        1,
        { inTok: 60, outTok: 30, cacheRead: 10, modelId: 'gemini-2.5-flash', modelName: 'Gemini 2.5 Flash', stepIdx: 1 },
        epochSec + 20
      );

      const sUpdated = engine.getSessionDetails(rootId);
      expect(sUpdated).not.toBe(sForced);
      expect(sUpdated?.totalTokens.total).toBe(340);

      // Even if getSessionDetails already observed subagent DB update before fs.watch flushed,
      // revision bumped once and flushWatchChanges does not miss or double-bump overview invalidation.
      const revObserved = engine.getRevision();
      expect(revObserved).toBeGreaterThan(revAfterSig);
      await sleep(100);
      expect(engine.getRevision()).toBe(revObserved);

      const ovUpdated = engine.getGlobalOverview();
      expect(ovUpdated).not.toBe(ov1);
      expect(ovUpdated.totalTokens.total).toBe(340);
    } finally {
      engine.dispose();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Chart DOM deduplication & preserveScroll', () => {
  test('setRenderedHtmlIfChanged skips redundant innerHTML writes and resets on clear', () => {
    let writeCount = 0;
    let rawHtml = '';
    const fakeEl = {
      get innerHTML() {
        return rawHtml;
      },
      set innerHTML(val: string) {
        writeCount++;
        rawHtml = val;
      }
    } as unknown as HTMLElement;

    expect(setRenderedHtmlIfChanged(fakeEl, '<div>A</div>', 'key-1')).toBe(true);
    expect(writeCount).toBe(1);
    expect(setRenderedHtmlIfChanged(fakeEl, '<div>A</div>', 'key-1')).toBe(false);
    expect(writeCount).toBe(1);
    expect(setRenderedHtmlIfChanged(fakeEl, '<div>A</div>', 'key-2')).toBe(true);
    expect(writeCount).toBe(2);

    clearRenderedHtmlCache(fakeEl);
    expect(setRenderedHtmlIfChanged(fakeEl, '<div>A</div>', 'key-2')).toBe(true);
    expect(writeCount).toBe(3);
  });

  test('renderActivityChart preserves non-pinned horizontal scroll position when preserveScroll=true', async () => {
    const makeCols = (count: number, extraTok = 0): ChartColumnData[] =>
      Array.from({ length: count }, (_, idx) => ({
        label: `Day ${idx + 1}`,
        tooltipHeader: `2026-10-${String((idx % 28) + 1).padStart(2, '0')}`,
        inputTok: 1000 + (idx === count - 1 ? extraTok : 0),
        outTok: 300,
        cacheRead: 500,
        requests: 2
      }));

    const fakeStage = {
      scrollLeft: 0,
      scrollWidth: 900,
      clientWidth: 320,
      addEventListener: () => {}
    };
    const fakeMaskLeft = { style: { opacity: '0' } };
    const fakeMaskRight = { style: { opacity: '0' } };
    let containerHtml = '';

    const fakeWrapper = {
      get innerHTML() {
        return containerHtml;
      },
      set innerHTML(v: string) {
        containerHtml = v;
      },
      querySelector: (sel: string) => {
        if (sel === '#chart-stage-container') return fakeStage;
        if (sel === '#chart-mask-left') return fakeMaskLeft;
        if (sel === '#chart-mask-right') return fakeMaskRight;
        return null;
      },
      querySelectorAll: () => []
    };

    const origDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'analytics-activity-chart' ? fakeWrapper : null)
    };

    try {
      // Initial render (preserveScroll=false) snaps to latest right edge
      renderActivityChart(makeCols(50, 0), 'Last 30 Days', 'last-30-days', null, undefined, {
        preserveScroll: false
      });
      await sleep(75);
      expect(fakeStage.scrollLeft).toBe(900);

      // User scrolls back to historical date
      fakeStage.scrollLeft = 180;

      // Auto-refresh with updated latest bar & preserveScroll=true preserves scrollLeft=180
      renderActivityChart(makeCols(50, 500), 'Last 30 Days', 'last-30-days', null, undefined, {
        preserveScroll: true
      });
      await sleep(75);
      expect(fakeStage.scrollLeft).toBe(180);

      // When pinned near right edge, preserveScroll=true keeps following newest bar
      fakeStage.scrollLeft = 900 - 320 - 10; // within 24px threshold
      renderActivityChart(makeCols(50, 900), 'Last 30 Days', 'last-30-days', null, undefined, {
        preserveScroll: true
      });
      await sleep(75);
      expect(fakeStage.scrollLeft).toBe(900);
    } finally {
      (globalThis as { document?: unknown }).document = origDocument;
    }
  });
});
