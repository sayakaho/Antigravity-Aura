import { AccountTracker, isUntrackedAccount } from '../account-tracker';
import { QuotaTracker } from '../quota-tracker';
import { canonicalizeTool, canonicalModelName } from '../../shared/catalog';
import { formatLocalDateAndHourKeys } from '../../shared/format';
import { resolveSummaryProjectInfo, type ResolvedProjectInfo } from '../../shared/project';
import {
  isSubagentSummary,
  resolveSubagentAgentName,
  type SessionTreeIndex
} from '../../shared/session';
import { computeWeightedTps } from '../../shared/tps';
import type {
  AccountDailyStat,
  AccountHourlyStat,
  AccountTokenStat,
  ConversationSummary,
  DailySeriesPoint,
  GlobalAnalyticsOverview,
  HourlySeriesPoint,
  ModelDailyStat,
  ProjectDailyStat,
  ProjectStatItem,
  RangePerfFields,
  SubagentDailyStat,
  SubagentStatItem
} from '../../types';
import {
  accumulateAccountDailyStat,
  accumulateAccountHourlyStat,
  accumulateModelDailyStat
} from './session-loader';
import type { CacheEntry, ModelBucket } from './types';

export function mergeBreakdownPerf(target: RangePerfFields, src: RangePerfFields): void {
  target.effOutTok = (target.effOutTok || 0) + (src.effOutTok || 0);
  target.effSec = (target.effSec || 0) + (src.effSec || 0);
  target.ttftSum = (target.ttftSum || 0) + (src.ttftSum || 0);
  target.ttftCount = (target.ttftCount || 0) + (src.ttftCount || 0);
  target.turnDurSum = (target.turnDurSum || 0) + (src.turnDurSum || 0);
  target.validTurnCount = (target.validTurnCount || 0) + (src.validTurnCount || 0);
  if (src.tpsHist) {
    if (!target.tpsHist) target.tpsHist = {};
    for (const [k, cnt] of Object.entries(src.tpsHist)) {
      target.tpsHist[k] = (target.tpsHist[k] || 0) + cnt;
    }
  }
}

export function accumulateDailyProjectStat(
  target: Record<string, Record<string, ProjectDailyStat>>,
  dateKey: string,
  projInfo: ResolvedProjectInfo,
  rootConvId: string | null,
  inTok: number,
  outTok: number,
  cacheRead: number,
  requests: number
): void {
  if (!dateKey || dateKey.startsWith('0001')) return;
  if (!target[dateKey]) target[dateKey] = {};
  if (!target[dateKey][projInfo.projectKey]) {
    target[dateKey][projInfo.projectKey] = {
      projectKey: projInfo.projectKey,
      name: projInfo.name,
      fullPath: projInfo.fullPath,
      displayPath: projInfo.displayPath,
      badgeText: projInfo.badgeText,
      isWorkspace: projInfo.isWorkspace,
      inTok: 0,
      outTok: 0,
      cacheRead: 0,
      requests: 0,
      conversationIds: []
    };
  }
  const stat = target[dateKey][projInfo.projectKey];
  stat.inTok += inTok;
  stat.outTok += outTok;
  stat.cacheRead += cacheRead;
  stat.requests += requests;
  if (rootConvId && !stat.conversationIds.includes(rootConvId)) {
    stat.conversationIds.push(rootConvId);
  }
}

export function accumulateDailySubagentStat(
  target: Record<string, Record<string, SubagentDailyStat>>,
  dateKey: string,
  agentName: string,
  subConvId: string,
  inTok: number,
  outTok: number,
  cacheRead: number,
  thinkTok: number,
  requests: number
): void {
  if (!dateKey || dateKey.startsWith('0001')) return;
  if (!target[dateKey]) target[dateKey] = {};
  if (!target[dateKey][agentName]) {
    target[dateKey][agentName] = {
      agentName,
      runs: 0,
      inTok: 0,
      outTok: 0,
      cacheRead: 0,
      thinkTok: 0,
      requests: 0,
      conversationIds: []
    };
  }
  const stat = target[dateKey][agentName];
  stat.inTok += inTok;
  stat.outTok += outTok;
  stat.cacheRead += cacheRead;
  stat.thinkTok += thinkTok;
  stat.requests += requests;
  if (subConvId && !stat.conversationIds.includes(subConvId)) {
    stat.conversationIds.push(subConvId);
    stat.runs = stat.conversationIds.length;
  }
}

export interface BuildOverviewOptions {
  summaries: ConversationSummary[];
  sessionTree: SessionTreeIndex;
  entries: Map<string, CacheEntry>;
  accountTracker: AccountTracker;
  quotaTracker: QuotaTracker;
  homeDir: string;
}

export function buildGlobalOverview(opts: BuildOverviewOptions): GlobalAnalyticsOverview {
  const { summaries, sessionTree, entries, accountTracker, quotaTracker, homeDir } = opts;

  let totalIn = 0;
  let totalOut = 0;
  let totalCache = 0;
  let totalThink = 0;
  let totalRequests = 0;
  let ttftSum = 0;
  let ttftCount = 0;
  let globalEffOutTokens = 0;
  let globalEffSeconds = 0;
  const globalTpsList: number[] = [];
  let globalTurnDurSum = 0;
  let globalValidTurnCount = 0;

  const globalRootSessionIds = new Set<string>();
  const projectRootSessionIds: Record<string, Set<string>> = {};
  const projectStats: Record<string, ProjectStatItem> = {};
  const globalDailyProjectStats: Record<string, Record<string, ProjectDailyStat>> = {};
  const dateSeries: Record<string, DailySeriesPoint> = {};
  const hourSeries: Record<string, HourlySeriesPoint> = {};
  const globalModelMap: Record<string, ModelBucket> = {};
  const globalDailyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
  const globalHourlyModelStats: Record<string, Record<string, ModelDailyStat>> = {};
  const globalDailyToolStats: Record<string, Record<string, number>> = {};
  const globalToolsMap: Record<string, number> = {};
  const globalSubagentMap: Record<string, SubagentStatItem> = {};
  const globalDailySubagentStats: Record<string, Record<string, SubagentDailyStat>> = {};
  const globalDailyAccountStats: Record<string, Record<string, AccountDailyStat>> = {};
  const globalHourlyAccountStats: Record<string, Record<string, AccountHourlyStat>> = {};

  for (const s of summaries) {
    const convId = s.conversationId;
    const entry = entries.get(convId);
    if (!entry) continue;

    const isSubagent = isSubagentSummary(s);
    const rootConvId = sessionTree.resolveRootConversationId(convId);

    totalIn += entry.inTok;
    totalOut += entry.outTok;
    totalCache += entry.cacheRead;
    totalThink += entry.thinkTok;
    const convReq = entry.reqCount || s.stepCount || 1;
    totalRequests += convReq;

    if ((entry.ttftCount || 0) > 0 && (entry.ttftSum || 0) > 0) {
      ttftSum += entry.ttftSum || 0;
      ttftCount += entry.ttftCount || 0;
    } else if (entry.ttft > 0) {
      ttftSum += entry.ttft;
      ttftCount++;
    }
    if (entry.tpsList && entry.tpsList.length > 0) {
      globalTpsList.push(...entry.tpsList);
    }
    if (entry.effSec && entry.effSec > 0) {
      globalEffOutTokens += entry.effOutTok || 0;
      globalEffSeconds += entry.effSec;
    }
    if (entry.turnDurSum) {
      globalTurnDurSum += entry.turnDurSum;
      globalValidTurnCount += entry.validTurnCount || 0;
    }

    const projInfo = resolveSummaryProjectInfo(s, homeDir);
    if (!projectStats[projInfo.projectKey]) {
      projectStats[projInfo.projectKey] = {
        projectKey: projInfo.projectKey,
        name: projInfo.name,
        fullPath: projInfo.fullPath,
        displayPath: projInfo.displayPath,
        badgeText: projInfo.badgeText,
        isWorkspace: projInfo.isWorkspace,
        conversationCount: 0,
        tokenCount: 0,
        inputTok: 0,
        outTok: 0,
        cacheRead: 0,
        requests: 0
      };
      projectRootSessionIds[projInfo.projectKey] = new Set<string>();
    }
    const pStat = projectStats[projInfo.projectKey];
    if (rootConvId) {
      globalRootSessionIds.add(rootConvId);
      projectRootSessionIds[projInfo.projectKey].add(rootConvId);
    }
    pStat.tokenCount += entry.inTok + entry.outTok + entry.cacheRead;
    pStat.inputTok += entry.inTok;
    pStat.outTok += entry.outTok;
    pStat.cacheRead += entry.cacheRead;
    pStat.requests += convReq;

    const hasSubagentActivity =
      isSubagent && (entry.inTok + entry.outTok + entry.cacheRead > 0 || entry.reqCount > 0);
    const subagentName = hasSubagentActivity ? resolveSubagentAgentName(s.agentName) : '';
    if (hasSubagentActivity) {
      if (!globalSubagentMap[subagentName]) {
        globalSubagentMap[subagentName] = {
          agentName: subagentName,
          runs: 0,
          totalTokens: 0,
          inputTok: 0,
          outTok: 0,
          cacheRead: 0,
          thinkTok: 0,
          requests: 0
        };
      }
      const sg = globalSubagentMap[subagentName];
      sg.runs += 1;
      sg.inputTok += entry.inTok;
      sg.outTok += entry.outTok;
      sg.cacheRead += entry.cacheRead;
      sg.thinkTok += entry.thinkTok;
      sg.totalTokens += entry.inTok + entry.outTok + entry.cacheRead;
      sg.requests += convReq;
    }

    if (entry.dailyBreakdown && Object.keys(entry.dailyBreakdown).length > 0) {
      for (const [dateKey, d] of Object.entries(entry.dailyBreakdown)) {
        accumulateDailyProjectStat(
          globalDailyProjectStats,
          dateKey,
          projInfo,
          rootConvId,
          d.inTok,
          d.outTok,
          d.cacheRead,
          d.requests
        );
        if (hasSubagentActivity) {
          accumulateDailySubagentStat(
            globalDailySubagentStats,
            dateKey,
            subagentName,
            convId,
            d.inTok,
            d.outTok,
            d.cacheRead,
            d.thinkTok || 0,
            d.requests
          );
        }
        if (!dateSeries[dateKey]) {
          dateSeries[dateKey] = {
            date: dateKey,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            userTurns: 0,
            effOutTok: 0,
            effSec: 0,
            ttftSum: 0,
            ttftCount: 0,
            turnDurSum: 0,
            validTurnCount: 0,
            tpsHist: {},
            latencySamples: []
          };
        }
        dateSeries[dateKey].inputTok += d.inTok;
        dateSeries[dateKey].outTok += d.outTok;
        dateSeries[dateKey].cacheRead += d.cacheRead;
        dateSeries[dateKey].thinkTok = (dateSeries[dateKey].thinkTok || 0) + (d.thinkTok || 0);
        dateSeries[dateKey].requests += d.requests;
        mergeBreakdownPerf(dateSeries[dateKey], d);
        const dayLatencySamples = entry.dailyLatencySamples?.[dateKey];
        if (dayLatencySamples && dayLatencySamples.length > 0) {
          if (!dateSeries[dateKey].latencySamples) {
            dateSeries[dateKey].latencySamples = [];
          }
          dateSeries[dateKey].latencySamples!.push(...dayLatencySamples);
        }
      }
    } else {
      const { dateKey } = formatLocalDateAndHourKeys(
        s.lastModifiedTime ? new Date(s.lastModifiedTime) : new Date(entry.lastModified)
      );
      accumulateDailyProjectStat(
        globalDailyProjectStats,
        dateKey,
        projInfo,
        rootConvId,
        entry.inTok,
        entry.outTok,
        entry.cacheRead,
        convReq
      );
      if (hasSubagentActivity) {
        accumulateDailySubagentStat(
          globalDailySubagentStats,
          dateKey,
          subagentName,
          convId,
          entry.inTok,
          entry.outTok,
          entry.cacheRead,
          entry.thinkTok,
          convReq
        );
      }
      if (!dateSeries[dateKey]) {
        dateSeries[dateKey] = {
          date: dateKey,
          inputTok: 0,
          outTok: 0,
          cacheRead: 0,
          thinkTok: 0,
          requests: 0,
          userTurns: 0,
          effOutTok: 0,
          effSec: 0,
          ttftSum: 0,
          ttftCount: 0,
          turnDurSum: 0,
          validTurnCount: 0,
          tpsHist: {},
          latencySamples: []
        };
      }
      dateSeries[dateKey].inputTok += entry.inTok;
      dateSeries[dateKey].outTok += entry.outTok;
      dateSeries[dateKey].cacheRead += entry.cacheRead;
      dateSeries[dateKey].thinkTok = (dateSeries[dateKey].thinkTok || 0) + entry.thinkTok;
      dateSeries[dateKey].requests += convReq;
    }

    if (entry.hourlyBreakdown) {
      for (const [hourKey, h] of Object.entries(entry.hourlyBreakdown)) {
        if (!hourSeries[hourKey]) {
          hourSeries[hourKey] = {
            hourKey,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            userTurns: 0,
            effOutTok: 0,
            effSec: 0,
            ttftSum: 0,
            ttftCount: 0,
            turnDurSum: 0,
            validTurnCount: 0,
            tpsHist: {}
          };
        }
        hourSeries[hourKey].inputTok += h.inTok;
        hourSeries[hourKey].outTok += h.outTok;
        hourSeries[hourKey].cacheRead += h.cacheRead;
        hourSeries[hourKey].thinkTok = (hourSeries[hourKey].thinkTok || 0) + (h.thinkTok || 0);
        hourSeries[hourKey].requests += h.requests;
        mergeBreakdownPerf(hourSeries[hourKey], h);
      }
    }

    if (!isSubagent && entry.dailyUserTurns) {
      for (const [dKey, turns] of Object.entries(entry.dailyUserTurns)) {
        if (!dateSeries[dKey]) {
          dateSeries[dKey] = {
            date: dKey,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            userTurns: 0,
            effOutTok: 0,
            effSec: 0,
            ttftSum: 0,
            ttftCount: 0,
            turnDurSum: 0,
            validTurnCount: 0,
            tpsHist: {},
            latencySamples: []
          };
        }
        dateSeries[dKey].userTurns = (dateSeries[dKey].userTurns || 0) + turns;
      }
    }

    if (!isSubagent && entry.hourlyUserTurns) {
      for (const [hKey, turns] of Object.entries(entry.hourlyUserTurns)) {
        if (!hourSeries[hKey]) {
          hourSeries[hKey] = {
            hourKey: hKey,
            inputTok: 0,
            outTok: 0,
            cacheRead: 0,
            thinkTok: 0,
            requests: 0,
            userTurns: 0,
            effOutTok: 0,
            effSec: 0,
            ttftSum: 0,
            ttftCount: 0,
            turnDurSum: 0,
            validTurnCount: 0,
            tpsHist: {}
          };
        }
        hourSeries[hKey].userTurns = (hourSeries[hKey].userTurns || 0) + turns;
      }
    }

    if (entry.models) {
      for (const [mKey, m] of Object.entries(entry.models)) {
        if (!globalModelMap[mKey]) {
          globalModelMap[mKey] = {
            modelId: m.modelId,
            modelName: m.modelName,
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
        const gm = globalModelMap[mKey];
        if ((!gm.modelName || gm.modelName === 'Unknown Model') && m.modelName) {
          gm.modelName = m.modelName;
        }
        gm.inTok += m.inTok;
        gm.outTok += m.outTok;
        gm.cacheRead += m.cacheRead;
        gm.thinkTok += m.thinkTok;
        gm.streamSec += m.streamSec;
        gm.ttftSec += m.ttftSec;
        gm.effOutTok += m.effOutTok;
        gm.effSec += m.effSec;
        gm.count += m.count;
      }
    }

    if (entry.dailyModelStats) {
      for (const [dKey, dModels] of Object.entries(entry.dailyModelStats)) {
        for (const [mKey, dm] of Object.entries(dModels)) {
          const effectiveId = dm.modelId || mKey;
          const effectiveName = dm.modelName || canonicalModelName(effectiveId);
          accumulateModelDailyStat(
            globalDailyModelStats,
            dKey,
            mKey,
            effectiveId,
            effectiveName,
            dm.inTok,
            dm.outTok,
            dm.cacheRead,
            dm.thinkTok,
            dm.streamSec,
            dm.ttftSec,
            dm.effOutTok || 0,
            dm.effSec || 0,
            dm.requests
          );
        }
      }
    }

    if (entry.hourlyModelStats) {
      for (const [hKey, hModels] of Object.entries(entry.hourlyModelStats)) {
        for (const [mKey, hm] of Object.entries(hModels)) {
          const effectiveId = hm.modelId || mKey;
          const effectiveName = hm.modelName || canonicalModelName(effectiveId);
          accumulateModelDailyStat(
            globalHourlyModelStats,
            hKey,
            mKey,
            effectiveId,
            effectiveName,
            hm.inTok,
            hm.outTok,
            hm.cacheRead,
            hm.thinkTok,
            hm.streamSec,
            hm.ttftSec,
            hm.effOutTok || 0,
            hm.effSec || 0,
            hm.requests
          );
        }
      }
    }

    if (entry.tools) {
      for (const [tName, tCount] of Object.entries(entry.tools)) {
        globalToolsMap[tName] = (globalToolsMap[tName] || 0) + tCount;
      }
    }
    if (entry.dailyTools) {
      for (const [dKey, dTools] of Object.entries(entry.dailyTools)) {
        if (!globalDailyToolStats[dKey]) globalDailyToolStats[dKey] = {};
        for (const [tName, tCount] of Object.entries(dTools)) {
          globalDailyToolStats[dKey][tName] = (globalDailyToolStats[dKey][tName] || 0) + tCount;
        }
      }
    }
    if (entry.dailyAccountStats) {
      for (const [dateKey, dayAccounts] of Object.entries(entry.dailyAccountStats)) {
        for (const [accountKey, st] of Object.entries(dayAccounts)) {
          accumulateAccountDailyStat(
            globalDailyAccountStats,
            dateKey,
            accountKey,
            st.inTok,
            st.outTok,
            st.cacheRead,
            st.thinkTok,
            st.requests,
            rootConvId || convId,
            st.cost || 0
          );
        }
      }
    }
    if (entry.hourlyAccountStats) {
      for (const [hourKey, hourAccounts] of Object.entries(entry.hourlyAccountStats)) {
        for (const [accountKey, st] of Object.entries(hourAccounts)) {
          accumulateAccountHourlyStat(
            globalHourlyAccountStats,
            hourKey,
            accountKey,
            st.inTok,
            st.outTok,
            st.cacheRead,
            st.thinkTok,
            st.requests,
            st.cost || 0
          );
        }
      }
    }
  }

  const totalRaw = totalIn + totalCache;
  const efficiency = totalRaw > 0 ? Math.round((totalCache / totalRaw) * 1000) / 10 : 0;
  const avgTtft = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 100) / 100 : 0;

  const avgRate = computeWeightedTps(globalEffOutTokens, globalEffSeconds);
  let p50Rate = avgRate;
  if (globalTpsList.length > 0) {
    globalTpsList.sort((a, b) => a - b);
    p50Rate = globalTpsList[Math.floor(globalTpsList.length * 0.5)];
  }

  const avgTurnLatency =
    globalValidTurnCount > 0
      ? Math.round((globalTurnDurSum / globalValidTurnCount) * 100) / 100
      : 0;

  for (const [projKey, pStat] of Object.entries(projectStats)) {
    pStat.conversationCount = projectRootSessionIds[projKey]?.size ?? 0;
  }

  const projects = Object.values(projectStats).sort(
    (a, b) =>
      b.tokenCount - a.tokenCount ||
      b.conversationCount - a.conversationCount ||
      a.name.localeCompare(b.name)
  );

  const topProjects = projects.slice(0, 5).map((p) => ({
    projectId: p.name,
    conversationCount: p.conversationCount,
    tokenCount: p.tokenCount
  }));

  const timeRangeSeries = Object.values(dateSeries).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const hourlySeries = Object.values(hourSeries).sort((a, b) =>
    a.hourKey.localeCompare(b.hourKey)
  );

  const modelDistribution = Object.values(globalModelMap)
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

  const totalToolCalls = Object.values(globalToolsMap).reduce((a, b) => a + b, 0);
  const toolDistribution = Object.entries(globalToolsMap)
    .map(([rawName, count]) => {
      const info = canonicalizeTool(rawName);
      return {
        rawName,
        name: info.name,
        category: info.category,
        color: info.color,
        count,
        percentage: totalToolCalls > 0 ? Math.round((count / totalToolCalls) * 1000) / 10 : 0
      };
    })
    .sort((a, b) => b.count - a.count);

  const subagentDistribution = Object.values(globalSubagentMap).sort(
    (a, b) =>
      b.totalTokens - a.totalTokens ||
      b.runs - a.runs ||
      a.agentName.localeCompare(b.agentName)
  );

  const currentAccount = accountTracker.getCurrentAccount();
  const globalAccountMap: Record<string, AccountTokenStat> = {};
  const accountSessionIds: Record<string, Set<string>> = {};

  for (const dayAccounts of Object.values(globalDailyAccountStats)) {
    for (const [acc, st] of Object.entries(dayAccounts)) {
      if (!globalAccountMap[acc]) {
        const isUntracked = isUntrackedAccount(acc);
        globalAccountMap[acc] = {
          account: acc,
          totalTokens: 0,
          cost: 0,
          inputTok: 0,
          outTok: 0,
          cacheRead: 0,
          thinkTok: 0,
          requests: 0,
          conversationCount: 0,
          isCurrent: !isUntracked && acc === currentAccount,
          isUntracked
        };
        accountSessionIds[acc] = new Set<string>();
      }
      const item = globalAccountMap[acc];
      item.inputTok += st.inTok;
      item.outTok += st.outTok;
      item.cacheRead += st.cacheRead;
      item.thinkTok += st.thinkTok;
      item.totalTokens += st.inTok + st.outTok + st.cacheRead;
      item.cost = (item.cost || 0) + (st.cost || 0);
      item.requests += st.requests;
      for (const cid of st.conversationIds || []) {
        accountSessionIds[acc].add(cid);
      }
    }
  }

  for (const [acc, ids] of Object.entries(accountSessionIds)) {
    if (globalAccountMap[acc]) {
      globalAccountMap[acc].conversationCount = ids.size;
    }
  }

  const now = new Date();
  const last5HourKeys: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getTime() - i * 3600 * 1000);
    last5HourKeys.push(formatLocalDateAndHourKeys(d).hourKey);
  }

  const last7DateKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 86400 * 1000);
    last7DateKeys.push(formatLocalDateAndHourKeys(d).dateKey);
  }

  for (const [acc, item] of Object.entries(globalAccountMap)) {
    if (!item.isUntracked) {
      let tokens5h = 0;
      let cost5h = 0;
      for (const hk of last5HourKeys) {
        const st = globalHourlyAccountStats[hk]?.[acc];
        if (st) {
          tokens5h += st.inTok + st.outTok + st.cacheRead;
          cost5h += st.cost || 0;
        }
      }

      let tokens7d = 0;
      let cost7d = 0;
      for (const dk of last7DateKeys) {
        const st = globalDailyAccountStats[dk]?.[acc];
        if (st) {
          tokens7d += st.inTok + st.outTok + st.cacheRead;
          cost7d += st.cost || 0;
        }
      }

      const isCurrent = !item.isUntracked && acc === currentAccount;
      const cap = quotaTracker.getAccountQuotaCapacity(
        acc,
        tokens5h,
        tokens7d,
        isCurrent ? item.totalTokens : undefined,
        isCurrent ? item.cost : undefined,
        cost5h,
        cost7d
      );
      item.quotaCapacity = cap;
      item.userTier = cap.userTier;
      item.planName = cap.planName;
      item.planDetails = cap.planDetails;
    }
  }

  const accountDistribution = Object.values(globalAccountMap).sort((a, b) => {
    if (a.isUntracked && !b.isUntracked) return 1;
    if (!a.isUntracked && b.isUntracked) return -1;
    const costDiff = (b.cost || 0) - (a.cost || 0);
    if (Math.abs(costDiff) > 0.0001) return costDiff;
    return b.totalTokens - a.totalTokens || b.requests - a.requests;
  });

  return {
    totalConversations: globalRootSessionIds.size,
    totalRequests,
    totalTokens: {
      input: totalIn,
      output: totalOut,
      cacheRead: totalCache,
      thinking: totalThink,
      total: totalIn + totalOut + totalCache
    },
    cacheEfficiency: efficiency,
    avgTtft,
    avgTokPerSec: avgRate,
    p50TokPerSec: p50Rate,
    e2eTokPerSec: p50Rate,
    avgTurnLatency,
    topProjects,
    projects,
    dailyProjectStats: globalDailyProjectStats,
    timeRangeSeries,
    hourlySeries,
    modelDistribution,
    dailyModelStats: globalDailyModelStats,
    hourlyModelStats: globalHourlyModelStats,
    toolDistribution,
    dailyToolStats: globalDailyToolStats,
    subagentDistribution,
    dailySubagentStats: globalDailySubagentStats,
    accountDistribution,
    dailyAccountStats: globalDailyAccountStats,
    hourlyAccountStats: globalHourlyAccountStats
  };
}
