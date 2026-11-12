import { buildSessionAnalyticsEndpoint } from '../../shared/session';
import type { GlobalAnalyticsOverview, SessionAnalyticsData } from '../../types';
import { type AnalyticsRefreshMode } from './auto-refresh';
import {
  ANALYTICS_RANGE_STORAGE_KEY,
  PROJECT_SCOPE_STORAGE_KEY,
  loadAnalyticsRangeState,
  loadProjectScopeState,
  parseAnalyticsRangeState,
  parseProjectScopeState,
  saveAnalyticsRangeState,
  saveProjectScopeState,
  type AnalyticsRangeState,
  type ProjectScopeMode
} from '../panel-state';
import {
  renderActivityChart,
  renderLatencyTtftDistributionChart,
  renderModelTpsChart
} from './charts';
import {
  computeProcessedColumns,
  renderMetricCards,
  renderModelDistribution,
  renderProjectDistribution,
  renderSubagentDistribution,
  renderToolDistribution
} from './metrics';
import { getRangeDisplayTitle, type TimeRangeOption } from './time-range';

export interface RefreshAnalyticsOptions {
  mode?: AnalyticsRefreshMode;
  force?: boolean;
  preserveScroll?: boolean;
}

const initialRangeState = loadAnalyticsRangeState();
let rawOverview: GlobalAnalyticsOverview | null = null;
let currentRange: TimeRangeOption = initialRangeState.range;
let customStartDate = initialRangeState.customStartDate;
let customEndDate = initialRangeState.customEndDate;
let currentProjectScope: ProjectScopeMode = loadProjectScopeState();
let activeSessionData: SessionAnalyticsData | null = null;
let rangeListenersBound = false;
let refreshSeq = 0;
let activeRefreshPromise: Promise<void> | null = null;
let pendingRefreshOptions: Required<RefreshAnalyticsOptions> | null = null;
let overviewDirty = false;

export function getActiveSessionId(): string | null {
  return activeSessionData?.cascadeId ?? null;
}

export async function fetchOverview(force = false): Promise<GlobalAnalyticsOverview | null> {
  try {
    const endpoint = force ? '/api/analytics/overview?force=1' : '/api/analytics/overview';
    const res = await window.sidecar.fetch(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: GlobalAnalyticsOverview };
    return json.ok && json.data ? json.data : null;
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch overview:', err);
    return null;
  }
}

async function fetchActiveSessionState(force = false): Promise<{
  resolved: boolean;
  data: SessionAnalyticsData | null;
}> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversationId') || window.sidecar?.conversationId || '';
    const endpoint = buildSessionAnalyticsEndpoint(convId, force);
    const res = await window.sidecar.fetch(endpoint, { method: 'GET' });
    if (!res.ok) return { resolved: false, data: null };
    const json = (await res.json()) as { ok?: boolean; data?: SessionAnalyticsData };
    if (json.ok && json.data) {
      return { resolved: true, data: json.data };
    }
    return { resolved: json.ok === false, data: null };
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch active session:', err);
    return { resolved: false, data: null };
  }
}

export async function fetchActiveSession(force = false): Promise<SessionAnalyticsData | null> {
  const result = await fetchActiveSessionState(force);
  return result.data;
}

async function ensureFreshOverviewIfDirty(): Promise<void> {
  if (!overviewDirty && rawOverview) return;
  const overview = await fetchOverview();
  if (overview) {
    rawOverview = overview;
    overviewDirty = false;
  }
}

function syncCustomDateInputs(): void {
  const startInput = document.getElementById('custom-date-start') as HTMLInputElement | null;
  const endInput = document.getElementById('custom-date-end') as HTMLInputElement | null;
  if (startInput) startInput.value = customStartDate;
  if (endInput) endInput.value = customEndDate;
}

function updateRangeControlUI(range: TimeRangeOption): void {
  const segmented = document.getElementById('analytics-timerange-segmented');
  segmented?.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-range') === range);
  });

  const customInputs = document.getElementById('custom-range-inputs');
  if (customInputs) {
    customInputs.style.display = range === 'custom' ? 'flex' : 'none';
  }
}

function updateProjectScopeControlUI(scope: ProjectScopeMode): void {
  const segmented = document.getElementById('projects-scope-segmented');
  segmented?.querySelectorAll('.segment-btn').forEach((btn) => {
    const isActive = btn.getAttribute('data-scope') === scope;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderRangeDependentViews(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption,
  preserveScroll = false
): void {
  const processed = computeProcessedColumns(
    overview,
    range,
    activeSessionData,
    customStartDate,
    customEndDate
  );
  renderMetricCards(processed, range, overview, activeSessionData, customStartDate, customEndDate);
  renderActivityChart(
    processed.columns,
    getRangeDisplayTitle(range),
    range,
    activeSessionData,
    undefined,
    { preserveScroll }
  );
  renderModelDistribution(overview, range, activeSessionData, customStartDate, customEndDate);
  renderSubagentDistribution(
    overview,
    range,
    activeSessionData,
    processed,
    customStartDate,
    customEndDate
  );
  renderToolDistribution(overview, range, activeSessionData, customStartDate, customEndDate);
  renderProjectDistribution(
    overview,
    range,
    activeSessionData,
    currentProjectScope,
    customStartDate,
    customEndDate
  );
  renderModelTpsChart(overview, range, activeSessionData, customStartDate, customEndDate);
  renderLatencyTtftDistributionChart(
    overview,
    range,
    activeSessionData,
    customStartDate,
    customEndDate
  );
}

async function applyExternalRangeState(next: AnalyticsRangeState): Promise<void> {
  if (
    next.range === currentRange &&
    next.customStartDate === customStartDate &&
    next.customEndDate === customEndDate
  ) {
    return;
  }

  currentRange = next.range;
  customStartDate = next.customStartDate;
  customEndDate = next.customEndDate;
  syncCustomDateInputs();
  updateRangeControlUI(currentRange);

  if (currentRange === 'session') {
    const sessionRes = await fetchActiveSessionState();
    if (sessionRes.resolved) {
      activeSessionData = sessionRes.data;
    }
  } else if (overviewDirty) {
    await ensureFreshOverviewIfDirty();
  }

  if (rawOverview && currentRange === next.range) {
    renderRangeDependentViews(rawOverview, currentRange);
  }
}

export async function applyTimeRangeFilter(range: TimeRangeOption): Promise<void> {
  currentRange = range;
  saveAnalyticsRangeState({ range: currentRange, customStartDate, customEndDate });
  updateRangeControlUI(range);

  if (range === 'session' || !activeSessionData) {
    const sessionRes = await fetchActiveSessionState();
    if (sessionRes.resolved) {
      activeSessionData = sessionRes.data;
    }
  }
  if (range !== 'session' && overviewDirty) {
    await ensureFreshOverviewIfDirty();
  }

  if (rawOverview && currentRange === range) {
    renderRangeDependentViews(rawOverview, range);
  }
}

function normalizeRefreshOptions(
  options: RefreshAnalyticsOptions = {}
): Required<RefreshAnalyticsOptions> {
  return {
    mode: options.mode ?? 'manual',
    force: options.force ?? false,
    preserveScroll: options.preserveScroll ?? false
  };
}

function mergeRefreshOptions(
  a: Required<RefreshAnalyticsOptions> | null,
  b: Required<RefreshAnalyticsOptions>
): Required<RefreshAnalyticsOptions> {
  if (!a) return b;
  const mode: AnalyticsRefreshMode =
    a.mode === 'manual' || b.mode === 'manual'
      ? 'manual'
      : a.mode === 'initial' || b.mode === 'initial'
        ? 'initial'
        : 'auto';
  return {
    mode,
    force: a.force || b.force,
    preserveScroll: a.preserveScroll && b.preserveScroll
  };
}

async function runRefreshPass(initialOptions: Required<RefreshAnalyticsOptions>): Promise<void> {
  const refreshBtn = document.getElementById('btn-refresh-analytics');
  const liveStatus = document.getElementById('analytics-live-status');
  let nextOptions: Required<RefreshAnalyticsOptions> | null = initialOptions;
  let usedSpinner = false;
  let usedLivePulse = false;

  try {
    while (nextOptions) {
      const opts: Required<RefreshAnalyticsOptions> = nextOptions;
      nextOptions = null;

      if (opts.mode !== 'auto') {
        usedSpinner = true;
        refreshBtn?.classList.add('loading');
      } else {
        usedLivePulse = true;
        liveStatus?.classList.add('is-updating');
      }

      const seq = ++refreshSeq;
      const canDeferOverview =
        opts.mode === 'auto' &&
        !opts.force &&
        currentRange === 'session' &&
        currentProjectScope === 'follow' &&
        rawOverview !== null &&
        activeSessionData !== null;

      if (canDeferOverview) {
        overviewDirty = true;
      }

      const [overview, sessionRes] = await Promise.all([
        canDeferOverview ? Promise.resolve(null) : fetchOverview(opts.force),
        fetchActiveSessionState(opts.force)
      ]);

      if (!canDeferOverview && overview) {
        rawOverview = overview;
        overviewDirty = false;
      }
      if (sessionRes.resolved) {
        activeSessionData = sessionRes.data;
      }

      if (seq !== refreshSeq || pendingRefreshOptions) {
        const queued = pendingRefreshOptions;
        pendingRefreshOptions = null;
        if (queued) {
          nextOptions = {
            mode: queued.mode,
            force: queued.force,
            preserveScroll: opts.preserveScroll && queued.preserveScroll
          };
        }
        continue;
      }

      updateRangeControlUI(currentRange);
      updateProjectScopeControlUI(currentProjectScope);
      if (rawOverview) {
        renderRangeDependentViews(rawOverview, currentRange, opts.preserveScroll);
      }

      if (pendingRefreshOptions) {
        nextOptions = pendingRefreshOptions;
        pendingRefreshOptions = null;
      }
    }
  } finally {
    if (usedSpinner && refreshBtn) {
      setTimeout(() => {
        if (!activeRefreshPromise) {
          refreshBtn.classList.remove('loading');
        }
      }, 300);
    }
    if (usedLivePulse && liveStatus) {
      setTimeout(() => {
        if (!activeRefreshPromise) {
          liveStatus.classList.remove('is-updating');
        }
      }, 300);
    }
  }
}

export async function refreshAnalytics(options: RefreshAnalyticsOptions = {}): Promise<void> {
  const normalized = normalizeRefreshOptions(options);
  if (activeRefreshPromise) {
    pendingRefreshOptions = mergeRefreshOptions(pendingRefreshOptions, normalized);
    return activeRefreshPromise;
  }
  activeRefreshPromise = runRefreshPass(normalized).finally(() => {
    activeRefreshPromise = null;
  });
  return activeRefreshPromise;
}

function applyProjectScope(scope: ProjectScopeMode): void {
  currentProjectScope = scope;
  saveProjectScopeState(scope);
  updateProjectScopeControlUI(scope);
  if (rawOverview) {
    renderProjectDistribution(
      rawOverview,
      currentRange,
      activeSessionData,
      currentProjectScope,
      customStartDate,
      customEndDate
    );
  }
  if (scope === 'all-time' && overviewDirty) {
    void ensureFreshOverviewIfDirty().then(() => {
      if (rawOverview && currentProjectScope === 'all-time') {
        renderProjectDistribution(
          rawOverview,
          currentRange,
          activeSessionData,
          currentProjectScope,
          customStartDate,
          customEndDate
        );
      }
    });
  }
}

function applyExternalProjectScope(nextScope: ProjectScopeMode): void {
  if (nextScope === currentProjectScope) return;
  currentProjectScope = nextScope;
  updateProjectScopeControlUI(currentProjectScope);
  if (rawOverview) {
    renderProjectDistribution(
      rawOverview,
      currentRange,
      activeSessionData,
      currentProjectScope,
      customStartDate,
      customEndDate
    );
  }
  if (nextScope === 'all-time' && overviewDirty) {
    void ensureFreshOverviewIfDirty().then(() => {
      if (rawOverview && currentProjectScope === 'all-time') {
        renderProjectDistribution(
          rawOverview,
          currentRange,
          activeSessionData,
          currentProjectScope,
          customStartDate,
          customEndDate
        );
      }
    });
  }
}

export function initTimeRangeControls(): void {
  syncCustomDateInputs();
  updateRangeControlUI(currentRange);
  updateProjectScopeControlUI(currentProjectScope);

  if (rangeListenersBound) return;
  rangeListenersBound = true;

  const segmented = document.getElementById('analytics-timerange-segmented');
  segmented?.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range') as TimeRangeOption | null;
      if (range) void applyTimeRangeFilter(range);
    });
  });

  const projectScopeSegmented = document.getElementById('projects-scope-segmented');
  projectScopeSegmented?.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scope = btn.getAttribute('data-scope');
      if (scope === 'follow' || scope === 'all-time') {
        applyProjectScope(scope);
      }
    });
  });

  const startInput = document.getElementById('custom-date-start') as HTMLInputElement | null;
  const endInput = document.getElementById('custom-date-end') as HTMLInputElement | null;
  const applyCustomBtn = document.getElementById('btn-apply-custom-range');

  applyCustomBtn?.addEventListener('click', () => {
    if (startInput?.value && endInput?.value) {
      customStartDate = startInput.value;
      customEndDate = endInput.value;
      void applyTimeRangeFilter('custom');
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === PROJECT_SCOPE_STORAGE_KEY) {
      applyExternalProjectScope(parseProjectScopeState(event.newValue));
      return;
    }
    if (event.key !== ANALYTICS_RANGE_STORAGE_KEY && event.key !== null) return;
    if (event.key === null) {
      applyExternalProjectScope(loadProjectScopeState());
    }
    const next =
      event.key === null
        ? loadAnalyticsRangeState()
        : parseAnalyticsRangeState(event.newValue);
    void applyExternalRangeState(next);
  });

  const syncFromStorage = () => {
    applyExternalProjectScope(loadProjectScopeState());
    void applyExternalRangeState(loadAnalyticsRangeState());
  };

  window.addEventListener('focus', syncFromStorage);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFromStorage();
  });
}
