import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AccountTracker, isUntrackedAccount } from './account-tracker';
import { QuotaTracker } from './quota-tracker';
import { canonicalizeTool, getModelPricingRates, resolveCanonicalModelId } from '../shared/catalog';
import { resolveSummaryProjectInfo } from '../shared/project';
import {
  buildSessionTreeIndex,
  resolveSubagentAgentName,
  type SessionTreeIndex
} from '../shared/session';
import { buildSessionSpeedTimeline, computeStepTps, computeWeightedTps } from '../shared/tps';
import type {
  AccountTokenStat,
  ConversationSummary,
  GlobalAnalyticsOverview,
  SessionAnalyticsData,
  SubagentBreakdownSummary,
  SubagentStatItem,
  TimedSpeedSample
} from '../types';
import {
  extractGenMetadataStep,
  extractTimestampFromStepMeta,
  extractToolInfo,
  getDbSignature,
  openDb
} from './sqlite-proto';
import {
  parseSessionCacheEntry,
  extractTimedSamplesFromRows,
  parseEpochSecFromIso,
  getFileMtimeSec
} from './analytics/session-loader';
import type {
  AnalyticsCache,
  CacheEntry,
  TokenBreakdown,
  ModelBucket
} from './analytics/types';
import {
  buildGlobalOverview,
  accumulateDailyProjectStat,
  accumulateDailySubagentStat
} from './analytics/aggregator';

export type { CacheEntry, TokenBreakdown, ModelBucket };

const CACHE_FILE_NAME = 'aura_analytics_cache_v15.json';

function isLegacyCacheFile(fileName: string): boolean {
  return (
    fileName !== CACHE_FILE_NAME &&
    fileName.startsWith('aura_analytics_cache') &&
    fileName.endsWith('.json')
  );
}

const SESSION_DB_FILE_RE = /^([0-9a-f-]{36})\.db(?:-(?:wal|journal))?$/i;
const SUMMARIES_DB_FILE_RE = /^conversation_summaries\.db(?:-(?:wal|journal))?$/i;
const MAX_SESSION_DETAILS_CACHE_SIZE = 20;

export class GlobalAnalyticsEngine {
  private readonly baseDir: string;
  private readonly cachePath: string;
  private readonly accountTracker: AccountTracker;
  private readonly quotaTracker: QuotaTracker;
  private cache: AnalyticsCache;
  private readonly timedSamplesCache = new Map<
    string,
    { sig: string; samples: TimedSpeedSample[] }
  >();
  private readonly sessionDetailsCache = new Map<
    string,
    { compositeSig: string; data: SessionAnalyticsData }
  >();
  private readonly lastKnownSessionSigs = new Map<string, string>();
  private lastKnownSummariesSig: string | null = null;
  private summariesCache: {
    sig: string;
    summaries: ConversationSummary[];
    tree: SessionTreeIndex;
  } | null = null;
  private overviewCache: {
    revision: number;
    summariesSig: string;
    data: GlobalAnalyticsOverview;
  } | null = null;
  private revision = 1;
  private isWatching = false;
  private baseWatcher: fs.FSWatcher | null = null;
  private convWatcher: fs.FSWatcher | null = null;
  private watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWatchDirty = false;
  private pendingSummariesCheck = false;
  private readonly pendingConvIds = new Set<string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private cacheDirty = false;
  private isWritingCache = false;
  private writeFailureCount = 0;

  constructor(baseDir: string, accountTracker?: AccountTracker, quotaTracker?: QuotaTracker) {
    this.baseDir = baseDir;
    this.cachePath = path.join(baseDir, CACHE_FILE_NAME);
    this.accountTracker =
      accountTracker ||
      new AccountTracker({
        storageDir: baseDir
      });
    this.quotaTracker =
      quotaTracker ||
      new QuotaTracker({
        storageDir: baseDir
      });
    this.pruneObsoleteCaches();
    this.cache = this.loadCache();
  }

  public getAccountTracker(): AccountTracker {
    return this.accountTracker;
  }

  public getQuotaTracker(): QuotaTracker {
    return this.quotaTracker;
  }

  public getRevision(): number {
    return this.revision;
  }

  public startWatching(debounceMs = 400): void {
    if (this.isWatching) return;
    this.isWatching = true;

    try {
      if (fs.existsSync(this.baseDir)) {
        this.baseWatcher = fs.watch(this.baseDir, (_eventType, filename) => {
          if (!filename) {
            this.pendingSummariesCheck = true;
            this.scheduleWatchFlush(debounceMs);
            return;
          }
          if (SUMMARIES_DB_FILE_RE.test(filename)) {
            this.pendingSummariesCheck = true;
            this.scheduleWatchFlush(debounceMs);
            return;
          }
          if (filename === 'conversations') {
            this.ensureConvWatcher(debounceMs);
            this.pendingSummariesCheck = true;
            this.scheduleWatchFlush(debounceMs);
          }
        });
      }
    } catch {
      // Degrade cleanly if filesystem watching fails
    }

    this.ensureConvWatcher(debounceMs);
  }

  private ensureConvWatcher(debounceMs = 400): void {
    if (this.convWatcher) return;
    const convDir = path.join(this.baseDir, 'conversations');
    try {
      if (fs.existsSync(convDir)) {
        this.convWatcher = fs.watch(convDir, (_eventType, filename) => {
          if (!filename) {
            this.pendingWatchDirty = true;
            this.scheduleWatchFlush(debounceMs);
            return;
          }
          const m = SESSION_DB_FILE_RE.exec(filename);
          if (m) {
            this.pendingConvIds.add(m[1]);
            this.scheduleWatchFlush(debounceMs);
          }
        });
      }
    } catch {
      // Degrade cleanly if conversation watching fails
    }
  }

  private scheduleWatchFlush(debounceMs = 400): void {
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
    }
    this.watchDebounceTimer = setTimeout(() => {
      this.flushWatchChanges();
    }, debounceMs);
  }

  private flushWatchChanges(): void {
    this.watchDebounceTimer = null;
    let mutated = this.pendingWatchDirty;
    this.pendingWatchDirty = false;

    if (this.pendingSummariesCheck) {
      this.pendingSummariesCheck = false;
      const sumPath = path.join(this.baseDir, 'conversation_summaries.db');
      const sig = getDbSignature(sumPath);
      if (sig !== this.lastKnownSummariesSig) {
        mutated = true;
        this.summariesCache = null;
      }
    }

    const convDir = path.join(this.baseDir, 'conversations');
    for (const convId of this.pendingConvIds) {
      const dbPath = path.join(convDir, `${convId}.db`);
      const sig = getDbSignature(dbPath);
      const prevSig = this.lastKnownSessionSigs.get(convId);
      if (sig !== prevSig) {
        mutated = true;
        this.lastKnownSessionSigs.set(convId, sig ?? 'missing');
        this.sessionDetailsCache.delete(convId);
        this.timedSamplesCache.delete(convId);
      }
    }
    this.pendingConvIds.clear();

    if (mutated) {
      this.revision += 1;
      this.overviewCache = null;
    }
  }

  public notifySessionSignature(convId: string, sig: string | null): boolean {
    if (!convId) return false;
    const prevSig = this.lastKnownSessionSigs.get(convId);
    const normalizedSig = sig ?? 'missing';
    if (prevSig === normalizedSig) return false;

    this.lastKnownSessionSigs.set(convId, normalizedSig);
    this.sessionDetailsCache.delete(convId);
    this.timedSamplesCache.delete(convId);
    this.revision += 1;
    this.overviewCache = null;
    return true;
  }

  private recordObservedSessionSignature(convId: string, sig: string): void {
    const prevSig = this.lastKnownSessionSigs.get(convId);
    if (!prevSig) {
      this.lastKnownSessionSigs.set(convId, sig);
      return;
    }
    if (prevSig !== sig) {
      this.notifySessionSignature(convId, sig);
    }
  }

  public dispose(): void {
    this.isWatching = false;
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
    if (this.baseWatcher) {
      try {
        this.baseWatcher.close();
      } catch {}
      this.baseWatcher = null;
    }
    if (this.convWatcher) {
      try {
        this.convWatcher.close();
      } catch {}
      this.convWatcher = null;
    }
    this.pendingConvIds.clear();
    this.flushCache();
  }

  private setSessionDetailsCache(
    convId: string,
    entry: { compositeSig: string; data: SessionAnalyticsData }
  ): void {
    if (this.sessionDetailsCache.has(convId)) {
      this.sessionDetailsCache.delete(convId);
    }
    this.sessionDetailsCache.set(convId, entry);
    if (this.sessionDetailsCache.size > MAX_SESSION_DETAILS_CACHE_SIZE) {
      const oldestKey = this.sessionDetailsCache.keys().next().value;
      if (oldestKey) this.sessionDetailsCache.delete(oldestKey);
    }
  }

  private pruneObsoleteCaches(): void {
    try {
      if (!fs.existsSync(this.baseDir)) return;
      const entries = fs.readdirSync(this.baseDir);
      for (const name of entries) {
        if (isLegacyCacheFile(name)) {
          try {
            fs.unlinkSync(path.join(this.baseDir, name));
          } catch {}
        }
      }
    } catch {}
  }

  private loadCache(): AnalyticsCache {
    try {
      if (fs.existsSync(this.cachePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.cachePath, 'utf8')) as Partial<AnalyticsCache>;
        if (parsed && parsed.sessions && typeof parsed.sessions === 'object') {
          return { version: parsed.version || 1, sessions: parsed.sessions };
        }
      }
    } catch {}
    return { version: 1, sessions: {} };
  }

  private scheduleSaveCache(resetFailures = true, delayMs = 400): void {
    if (resetFailures) {
      this.writeFailureCount = 0;
    }
    this.cacheDirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.writeCacheAtomicAsync();
    }, delayMs);
  }

  private async writeCacheAtomicAsync(): Promise<void> {
    if (!this.cacheDirty || this.isWritingCache) return;
    this.isWritingCache = true;
    const tmpPath = `${this.cachePath}.tmp.${Date.now()}`;
    try {
      const data = JSON.stringify(this.cache);
      await fsPromises.writeFile(tmpPath, data, 'utf8');
      await fsPromises.rename(tmpPath, this.cachePath);
      this.cacheDirty = false;
      this.writeFailureCount = 0;
    } catch {
      this.writeFailureCount += 1;
      try {
        if (fs.existsSync(tmpPath)) await fsPromises.unlink(tmpPath);
      } catch {}
      if (this.writeFailureCount <= 3) {
        this.scheduleSaveCache(false, 1000 * Math.pow(2, this.writeFailureCount));
      }
    } finally {
      this.isWritingCache = false;
    }
  }

  public flushCache(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.cacheDirty) return;
    const tmpPath = `${this.cachePath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.cache), 'utf8');
      fs.renameSync(tmpPath, this.cachePath);
      this.cacheDirty = false;
    } catch {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
    }
  }

  private getSummariesWithTree(): {
    summaries: ConversationSummary[];
    tree: SessionTreeIndex;
    sig: string | null;
  } {
    const dbPath = path.join(this.baseDir, 'conversation_summaries.db');
    const sig = getDbSignature(dbPath);
    if (!sig) {
      this.summariesCache = null;
      this.lastKnownSummariesSig = null;
      return { summaries: [], tree: buildSessionTreeIndex([]), sig: null };
    }

    if (this.summariesCache && this.summariesCache.sig === sig) {
      return this.summariesCache;
    }

    const db = openDb(dbPath);
    if (!db) {
      if (this.summariesCache) return this.summariesCache;
      return { summaries: [], tree: buildSessionTreeIndex([]), sig: null };
    }

    try {
      const rows = db
        .prepare(
          `
          SELECT conversation_id, title, step_count, last_modified_time, project_id, agent_name, workspace_uris, status, parent_conversation_id, nesting_depth
          FROM conversation_summaries
          ORDER BY last_modified_time DESC
        `
        )
        .all();
      const summaries: ConversationSummary[] = (rows || []).map((r) => ({
        conversationId: String(r.conversation_id || ''),
        title: String(r.title || ''),
        stepCount: Number(r.step_count || 0),
        lastModifiedTime: String(r.last_modified_time || ''),
        projectId: String(r.project_id || ''),
        agentName: String(r.agent_name || ''),
        workspaceUris: String(r.workspace_uris || ''),
        status: String(r.status || ''),
        parentConversationId: String(r.parent_conversation_id || ''),
        nestingDepth: Number(r.nesting_depth || 0)
      }));
      const tree = buildSessionTreeIndex(summaries);
      this.summariesCache = { sig, summaries, tree };
      this.lastKnownSummariesSig = sig;
      return { summaries, tree, sig };
    } catch {
      const tree = buildSessionTreeIndex([]);
      this.lastKnownSummariesSig = sig;
      return { summaries: [], tree, sig: null };
    } finally {
      try {
        db.close();
      } catch {}
    }
  }

  public getSummaries(): ConversationSummary[] {
    return [...this.getSummariesWithTree().summaries];
  }

  public getSummaryById(
    convId: string
  ): Pick<ConversationSummary, 'projectId' | 'workspaceUris'> | null {
    const dbPath = path.join(this.baseDir, 'conversation_summaries.db');
    if (!fs.existsSync(dbPath)) return null;

    const db = openDb(dbPath);
    if (!db) return null;

    try {
      const row = db
        .prepare(
          `
          SELECT project_id, workspace_uris
          FROM conversation_summaries
          WHERE conversation_id = ?
          LIMIT 1
        `
        )
        .get(convId);
      if (!row) return null;
      return {
        projectId: String(row.project_id || ''),
        workspaceUris: String(row.workspace_uris || '')
      };
    } catch {
      return null;
    } finally {
      try {
        db.close();
      } catch {}
    }
  }

  public getGlobalOverview(force = false): GlobalAnalyticsOverview {
    const convDir = path.join(this.baseDir, 'conversations');
    const { summaries, tree: sessionTree, sig: summariesSig } = this.getSummariesWithTree();

    if (
      !force &&
      this.isWatching &&
      this.overviewCache &&
      this.overviewCache.revision === this.revision &&
      this.overviewCache.summariesSig === summariesSig
    ) {
      return this.overviewCache.data;
    }

    const homeDir = os.homedir();
    let cacheUpdated = false;
    const entriesMap = new Map<string, CacheEntry>();

    for (const s of summaries) {
      const convId = s.conversationId;
      const dbPath = path.join(convDir, `${convId}.db`);
      const sig = getDbSignature(dbPath);
      if (!sig) continue;
      this.recordObservedSessionSignature(convId, sig);

      let entry = this.cache.sessions[convId];
      if (!entry || entry.sig !== sig) {
        const parsedEntry = parseSessionCacheEntry(dbPath, sig, this.accountTracker, s.lastModifiedTime);
        if (!parsedEntry) continue;
        entry = parsedEntry;
        this.cache.sessions[convId] = entry;
        cacheUpdated = true;
      }
      entriesMap.set(convId, entry);
    }

    if (cacheUpdated) {
      this.scheduleSaveCache();
    }

    const result = buildGlobalOverview({
      summaries,
      sessionTree,
      entries: entriesMap,
      accountTracker: this.accountTracker,
      quotaTracker: this.quotaTracker,
      homeDir
    });

    this.overviewCache = {
      revision: this.revision,
      summariesSig: summariesSig ?? 'missing',
      data: result
    };
    return result;
  }

  private getOrReadSubagentTimedSamples(
    subId: string,
    subDbPath: string,
    sig: string,
    lastModifiedTime?: string
  ): TimedSpeedSample[] {
    const cached = this.timedSamplesCache.get(subId);
    if (cached && cached.sig === sig) {
      this.timedSamplesCache.delete(subId);
      this.timedSamplesCache.set(subId, cached);
      return cached.samples;
    }

    const db = openDb(subDbPath);
    if (!db) return [];

    const fallbackTsSec =
      parseEpochSecFromIso(lastModifiedTime) || getFileMtimeSec(subDbPath);

    try {
      const stepTimeMap = new Map<number, number>();
      try {
        const stepRows = db.prepare('SELECT idx, metadata FROM steps').all();
        for (const sr of stepRows || []) {
          const ts = extractTimestampFromStepMeta(sr.metadata);
          if (ts) stepTimeMap.set(Number(sr.idx), ts);
        }
      } catch {}

      const rows = db.prepare('SELECT data FROM gen_metadata ORDER BY idx ASC').all();
      const samples = extractTimedSamplesFromRows(rows, stepTimeMap, fallbackTsSec);

      if (this.timedSamplesCache.size >= 500) {
        const oldestKey = this.timedSamplesCache.keys().next().value;
        if (oldestKey) this.timedSamplesCache.delete(oldestKey);
      }
      this.timedSamplesCache.set(subId, { sig, samples });
      return samples;
    } catch {
      return [];
    } finally {
      try {
        db.close();
      } catch {}
    }
  }

  public getSessionDetails(convId: string, force = false): SessionAnalyticsData | null {
    if (!convId || !/^[0-9a-f-]{36}$/i.test(convId)) return null;
    const convDir = path.join(this.baseDir, 'conversations');
    const dbPath = path.join(convDir, `${convId}.db`);
    const mainSig = getDbSignature(dbPath);
    if (!mainSig) {
      this.sessionDetailsCache.delete(convId);
      this.lastKnownSessionSigs.delete(convId);
      return null;
    }

    const { tree: sessionTree } = this.getSummariesWithTree();
    const descendantIds = sessionTree.collectDescendantIds(convId);
    const subSigParts: string[] = [];
    for (const subId of descendantIds) {
      const subSig = getDbSignature(path.join(convDir, `${subId}.db`));
      subSigParts.push(`${subId}:${subSig ?? 'missing'}`);
    }
    const compositeSig = `${mainSig}|${subSigParts.join(',')}`;

    if (!force) {
      const cachedDetails = this.sessionDetailsCache.get(convId);
      if (cachedDetails && cachedDetails.compositeSig === compositeSig) {
        this.sessionDetailsCache.delete(convId);
        this.sessionDetailsCache.set(convId, cachedDetails);
        return cachedDetails.data;
      }
    }

    const db = openDb(dbPath);
    if (!db) return null;

    try {
      const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
      const mainSummaryMeta = sessionTree.summaryById.get(convId);
      if ((!rows || rows.length === 0) && descendantIds.length === 0) {
        this.sessionDetailsCache.delete(convId);
        return null;
      }
      this.recordObservedSessionSignature(convId, mainSig);

      const mainFallbackTsSec =
        parseEpochSecFromIso(mainSummaryMeta?.lastModifiedTime) || getFileMtimeSec(dbPath);

      const mainStepTimeMap = new Map<number, number>();
      const sessionToolsMap: Record<string, number> = {};
      let sessionTurns = 0;
      try {
        const stepRows = db
          .prepare('SELECT idx, step_type, metadata FROM steps')
          .all();
        for (const sr of stepRows || []) {
          if (sr.step_type === 14) {
            sessionTurns += 1;
          }
          const ts = extractTimestampFromStepMeta(sr.metadata);
          if (ts) mainStepTimeMap.set(Number(sr.idx), ts);
        }

        const toolRows = db
          .prepare('SELECT step_payload FROM steps WHERE step_type = 132 AND step_payload IS NOT NULL')
          .all();
        for (const tr of toolRows || []) {
          const t = extractToolInfo(tr.step_payload);
          if (t) sessionToolsMap[t] = (sessionToolsMap[t] || 0) + 1;
        }
      } catch {
        try {
          const turnRow = db
            .prepare('SELECT COUNT(*) AS cnt FROM steps WHERE step_type = 14')
            .get();
          sessionTurns = Number(turnRow?.cnt ?? 0);
        } catch {}
        try {
          const toolRows = db.prepare('SELECT step_payload FROM steps WHERE step_type = 132 AND step_payload IS NOT NULL').all();
          for (const tr of toolRows || []) {
            const t = extractToolInfo(tr.step_payload);
            if (t) sessionToolsMap[t] = (sessionToolsMap[t] || 0) + 1;
          }
        } catch {}
      }

      let mainIn = 0;
      let mainOut = 0;
      let mainCache = 0;
      let totalIn = 0;
      let totalOut = 0;
      let totalCache = 0;
      let totalThink = 0;
      let ttftSum = 0;
      let validCount = 0;
      let sessionEffOut = 0;
      let sessionEffSec = 0;
      const sessionTpsList: number[] = [];
      let sessionTurnDurSum = 0;
      let sessionValidTurnCount = 0;
      const sessionModelsMap: Record<string, ModelBucket> = {};
      const allSpeedSamples: TimedSpeedSample[] = [];
      const sessionAccountMap: Record<string, AccountTokenStat> = {};
      const currentAccount = this.accountTracker.getCurrentAccount();

      const steps = (rows || []).map((r) => {
        const parsed = extractGenMetadataStep(r.data);
        mainIn += parsed.inTok;
        mainOut += parsed.outTok;
        mainCache += parsed.cacheRead;
        totalIn += parsed.inTok;
        totalOut += parsed.outTok;
        totalCache += parsed.cacheRead;
        totalThink += parsed.thinkTok;

        if (parsed.ttftSec > 0) {
          ttftSum += parsed.ttftSec;
          validCount++;
        }

        const tpsRes = computeStepTps(parsed.outTok, parsed.ttftSec, parsed.streamSec, parsed.totDur);
        const stepEffOut = parsed.outTok > 0 && tpsRes.effectiveSec > 0 ? parsed.outTok : 0;
        const stepEffSec = stepEffOut > 0 ? tpsRes.effectiveSec : 0;
        const hasValidTps = stepEffSec > 0 && tpsRes.displayTps > 0;
        const roundedTps = hasValidTps ? Math.round(tpsRes.displayTps) : 0;

        if (parsed.outTok > 0 && tpsRes.totDur > 0) {
          sessionTurnDurSum += tpsRes.totDur;
          sessionValidTurnCount++;
        }
        if (hasValidTps) {
          sessionEffOut += stepEffOut;
          sessionEffSec += stepEffSec;
          sessionTpsList.push(roundedTps);
        }

        const stepTs = parsed.stepIdx !== null ? mainStepTimeMap.get(parsed.stepIdx) : undefined;
        const resolvedTs = stepTs && stepTs > 1_000_000_000 ? stepTs : mainFallbackTsSec;
        const modelKey = resolveCanonicalModelId(parsed.rawModelId, parsed.modelName);

        if (
          stepEffOut > 0 &&
          stepEffSec > 0 &&
          tpsRes.displayTps > 0 &&
          resolvedTs &&
          resolvedTs > 1_000_000_000 &&
          modelKey !== 'unknown' &&
          !parsed.modelName.toLowerCase().includes('unknown')
        ) {
          allSpeedSamples.push({
            ts: resolvedTs,
            modelId: modelKey,
            modelName: parsed.modelName,
            effOutTok: stepEffOut,
            effSec: stepEffSec
          });
        }

        if (!sessionModelsMap[modelKey]) {
          sessionModelsMap[modelKey] = {
            modelId: modelKey,
            modelName: parsed.modelName,
            inTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            streamSec: 0,
            ttftSec: 0,
            effOutTok: 0,
            effSec: 0,
            count: 0
          };
        }
        const mb = sessionModelsMap[modelKey];
        mb.inTok += parsed.inTok;
        mb.outTok += parsed.outTok;
        mb.cacheRead += parsed.cacheRead;
        mb.thinkTok += parsed.thinkTok;
        mb.streamSec += parsed.streamSec;
        mb.ttftSec += parsed.ttftSec;
        mb.effOutTok += stepEffOut;
        mb.effSec += stepEffSec;
        mb.count += 1;

        const effectiveStepTs =
          stepTs && stepTs > 1_000_000_000 ? stepTs : mainFallbackTsSec;
        const stepAccount = this.accountTracker.matchAccountForTimestamp(effectiveStepTs);
        if (!sessionAccountMap[stepAccount]) {
          sessionAccountMap[stepAccount] = {
            account: stepAccount,
            totalTokens: 0,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            conversationCount: 1,
            isCurrent: stepAccount === currentAccount,
            isUntracked: stepAccount.toLowerCase() === 'untracked'
          };
        }
        const accItem = sessionAccountMap[stepAccount];
        const stepModelRates = getModelPricingRates(modelKey || parsed.modelName);
        const stepCost =
          (parsed.inTok * stepModelRates.inputRate +
            parsed.outTok * stepModelRates.outputRate +
            parsed.cacheRead * stepModelRates.cacheRate) /
          1_000_000;
        accItem.cost = (accItem.cost || 0) + stepCost;
        accItem.inputTok += parsed.inTok;
        accItem.outTok += parsed.outTok;
        accItem.cacheRead += parsed.cacheRead;
        accItem.thinkTok += parsed.thinkTok;
        accItem.totalTokens += parsed.inTok + parsed.outTok + parsed.cacheRead;
        accItem.requests += 1;

        return {
          idx: Number(parsed.stepIdx !== null ? parsed.stepIdx : 0),
          stepIdx: parsed.stepIdx !== null ? parsed.stepIdx : 0,
          inTok: parsed.inTok,
          outTok: parsed.outTok,
          cacheRead: parsed.cacheRead,
          thinkTok: parsed.thinkTok,
          respTok: parsed.respTok,
          ctx: parsed.ctx,
          ttft: parsed.ttftSec,
          ttftSec: parsed.ttftSec,
          stream: parsed.streamSec,
          streamSec: parsed.streamSec,
          totDur: parsed.totDur,
          tokPerSec: Math.round(tpsRes.displayTps),
          modelId: modelKey,
          modelName: parsed.modelName,
          account: stepAccount
        };
      });

      const subagentItemsMap = new Map<string, SubagentStatItem>();
      let subagentTokens = 0;
      let subagentRequests = 0;
      const processedSubConvIds = new Set<string>();
      let subagentCacheUpdated = false;

      for (const subId of descendantIds) {
        if (processedSubConvIds.has(subId)) continue;
        processedSubConvIds.add(subId);

        const subMeta = sessionTree.summaryById.get(subId);
        const subDbPath = path.join(convDir, `${subId}.db`);
        const subSig = getDbSignature(subDbPath);
        if (!subSig) continue;
        this.recordObservedSessionSignature(subId, subSig);

        const subSamples = this.getOrReadSubagentTimedSamples(
          subId,
          subDbPath,
          subSig,
          subMeta?.lastModifiedTime
        );
        if (subSamples.length > 0) {
          allSpeedSamples.push(...subSamples);
        }

        let entry = this.cache.sessions[subId];
        if (!entry || entry.sig !== subSig) {
          const parsedEntry = parseSessionCacheEntry(
            subDbPath,
            subSig,
            this.accountTracker,
            subMeta?.lastModifiedTime
          );
          if (!parsedEntry) continue;
          entry = parsedEntry;
          this.cache.sessions[subId] = entry;
          subagentCacheUpdated = true;
        }

        const agentName = resolveSubagentAgentName(subMeta?.agentName);
        let statItem = subagentItemsMap.get(agentName);
        if (!statItem) {
          statItem = {
            agentName,
            runs: 0,
            totalTokens: 0,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0
          };
          subagentItemsMap.set(agentName, statItem);
        }

        statItem.runs += 1;
        statItem.inputTok += entry.inTok;
        statItem.outTok += entry.outTok;
        statItem.cacheRead += entry.cacheRead;
        statItem.thinkTok += entry.thinkTok;
        const entryTokens = entry.inTok + entry.outTok + entry.cacheRead;
        statItem.totalTokens += entryTokens;
        statItem.requests += entry.reqCount;

        subagentTokens += entryTokens;
        subagentRequests += entry.reqCount;
        totalIn += entry.inTok;
        totalOut += entry.outTok;
        totalCache += entry.cacheRead;
        totalThink += entry.thinkTok;

        if (entry.models) {
          for (const [mKey, mb] of Object.entries(entry.models)) {
            if (!sessionModelsMap[mKey]) {
              sessionModelsMap[mKey] = {
                modelId: mb.modelId,
                modelName: mb.modelName,
                inTok: 0,
                outTok: 0,
                cacheRead: 0,
                thinkTok: 0,
                streamSec: 0,
                ttftSec: 0,
                effOutTok: 0,
                effSec: 0,
                count: 0
              };
            }
            const sm = sessionModelsMap[mKey];
            sm.inTok += mb.inTok;
            sm.outTok += mb.outTok;
            sm.cacheRead += mb.cacheRead;
            sm.thinkTok += mb.thinkTok;
            sm.streamSec += mb.streamSec;
            sm.ttftSec += mb.ttftSec;
            sm.effOutTok += mb.effOutTok;
            sm.effSec += mb.effSec;
            sm.count += mb.count;
          }
        }

        if (entry.tools) {
          for (const [tName, cnt] of Object.entries(entry.tools)) {
            sessionToolsMap[tName] = (sessionToolsMap[tName] || 0) + cnt;
          }
        }

        if (entry.dailyAccountStats) {
          for (const dayAcc of Object.values(entry.dailyAccountStats)) {
            for (const [accKey, st] of Object.entries(dayAcc)) {
              if (!sessionAccountMap[accKey]) {
                sessionAccountMap[accKey] = {
                  account: accKey,
                  totalTokens: 0,
                  cost: 0,
                  inputTok: 0,
                  outTok: 0,
                  cacheRead: 0,
                  thinkTok: 0,
                  requests: 0,
                  conversationCount: 1,
                  isCurrent: accKey === currentAccount,
                  isUntracked: accKey.toLowerCase() === 'untracked'
                };
              }
              const item = sessionAccountMap[accKey];
              item.inputTok += st.inTok;
              item.outTok += st.outTok;
              item.cacheRead += st.cacheRead;
              item.thinkTok += st.thinkTok;
              item.totalTokens += st.inTok + st.outTok + st.cacheRead;
              item.cost = (item.cost || 0) + (st.cost || 0);
              item.requests += st.requests;
            }
          }
        }
      }

      if (subagentCacheUpdated) {
        this.scheduleSaveCache();
      }

      const totalRaw = totalIn + totalCache;
      const efficiency = totalRaw > 0 ? Math.round((totalCache / totalRaw) * 1000) / 10 : 0;
      const avgTtft = validCount > 0 ? Math.round((ttftSum / validCount) * 100) / 100 : 0;
      const avgTokPerSec = computeWeightedTps(sessionEffOut, sessionEffSec);

      const sessionModels = Object.values(sessionModelsMap)
        .filter(
          (m) =>
            (m.inTok + m.outTok + m.cacheRead > 0 || m.count > 0) &&
            m.modelId !== 'unknown' &&
            !m.modelName.toLowerCase().includes('unknown')
        )
        .map((m) => ({
          modelId: m.modelId,
          modelName: m.modelName,
          totalTokens: m.inTok + m.outTok + m.cacheRead,
          inputTok: m.inTok,
          outTok: m.outTok,
          cacheRead: m.cacheRead,
          thinkTok: m.thinkTok,
          requests: m.count,
          avgTps: computeWeightedTps(m.effOutTok, m.effSec),
          avgTtft: m.count > 0 ? Math.round((m.ttftSec / m.count) * 100) / 100 : 0
        }))
        .sort((a, b) => b.totalTokens - a.totalTokens);

      const totalToolCount = Object.values(sessionToolsMap).reduce((a, b) => a + b, 0);
      const sessionTools = Object.entries(sessionToolsMap)
        .map(([rawName, count]) => {
          const info = canonicalizeTool(rawName);
          return {
            rawName,
            name: info.name,
            category: info.category,
            color: info.color,
            count,
            percentage: totalToolCount > 0 ? Math.round((count / totalToolCount) * 1000) / 10 : 0
          };
        })
        .sort((a, b) => b.count - a.count);

      let p50Rate = avgTokPerSec;
      if (sessionTpsList.length > 0) {
        sessionTpsList.sort((a, b) => a - b);
        p50Rate = sessionTpsList[Math.floor(sessionTpsList.length * 0.5)];
      }

      const avgTurnLatency =
        sessionValidTurnCount > 0
          ? Math.round((sessionTurnDurSum / sessionValidTurnCount) * 100) / 100
          : 0;

      const summaryMeta = mainSummaryMeta ?? this.getSummaryById(convId);
      const project = summaryMeta
        ? resolveSummaryProjectInfo(summaryMeta, os.homedir())
        : undefined;
      const speedTimeline = buildSessionSpeedTimeline(allSpeedSamples);

      const subagentItems = Array.from(subagentItemsMap.values()).sort(
        (a, b) =>
          b.totalTokens - a.totalTokens ||
          b.runs - a.runs ||
          a.agentName.localeCompare(b.agentName)
      );

      const subagentsBreakdown: SubagentBreakdownSummary | undefined =
        subagentItems.length > 0 || descendantIds.length > 0
          ? {
              mainTokens: mainIn + mainOut + mainCache,
              subagentTokens,
              mainRequests: steps.length,
              subagentRequests,
              totalRuns: descendantIds.length,
              items: subagentItems
            }
          : undefined;

      const accountDistribution = Object.values(sessionAccountMap).sort((a, b) => {
        if (a.isUntracked && !b.isUntracked) return 1;
        if (!a.isUntracked && b.isUntracked) return -1;
        const costDiff = (b.cost || 0) - (a.cost || 0);
        if (Math.abs(costDiff) > 0.0001) return costDiff;
        return b.totalTokens - a.totalTokens || b.requests - a.requests;
      });

      const data: SessionAnalyticsData = {
        cascadeId: convId,
        project,
        totalTokens: {
          input: totalIn,
          output: totalOut,
          cacheRead: totalCache,
          thinking: totalThink,
          total: totalIn + totalOut + totalCache
        },
        totalRequests: steps.length + subagentRequests,
        sessionTurns,
        cacheEfficiency: efficiency,
        avgTtft,
        avgTokPerSec,
        p50TokPerSec: p50Rate,
        e2eTokPerSec: p50Rate,
        avgTurnLatency,
        models: sessionModels,
        tools: sessionTools,
        accounts: accountDistribution,
        steps,
        speedTimeline,
        subagents: subagentsBreakdown
      };

      this.setSessionDetailsCache(convId, { compositeSig, data });
      return data;
    } catch {
      return null;
    } finally {
      try {
        db.close();
      } catch {}
    }
  }
}
