import type { GlobalAnalyticsOverview, SessionAnalyticsData } from '../../types';
import {
  ANALYTICS_RANGE_STORAGE_KEY,
  loadAnalyticsRangeState,
  parseAnalyticsRangeState,
  saveAnalyticsRangeState,
  type AnalyticsRangeState
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
  renderToolDistribution
} from './metrics';
import { getRangeDisplayTitle, type TimeRangeOption } from './time-range';

const initialRangeState = loadAnalyticsRangeState();
let rawOverview: GlobalAnalyticsOverview | null = null;
let currentRange: TimeRangeOption = initialRangeState.range;
let customStartDate = initialRangeState.customStartDate;
let customEndDate = initialRangeState.customEndDate;
let activeSessionData: SessionAnalyticsData | null = null;
let rangeListenersBound = false;

export async function fetchOverview(): Promise<GlobalAnalyticsOverview | null> {
  try {
    const res = await window.sidecar.fetch('/api/analytics/overview', { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: GlobalAnalyticsOverview };
    return json.ok && json.data ? json.data : null;
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch overview:', err);
    return null;
  }
}

export async function fetchActiveSession(): Promise<SessionAnalyticsData | null> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversationId') || window.sidecar?.conversationId || '';
    const endpoint = convId
      ? `/api/analytics/session?id=${encodeURIComponent(convId)}`
      : '/api/analytics/session';
    const res = await window.sidecar.fetch(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: SessionAnalyticsData };
    return json.ok && json.data ? json.data : null;
  } catch (err) {
    console.error('[Aura Analytics] Failed to fetch active session:', err);
    return null;
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

function renderRangeDependentViews(
  overview: GlobalAnalyticsOverview,
  range: TimeRangeOption
): void {
  const processed = computeProcessedColumns(
    overview,
    range,
    activeSessionData,
    customStartDate,
    customEndDate
  );
  renderMetricCards(processed, range, overview, activeSessionData, customStartDate, customEndDate);
  renderActivityChart(processed.columns, getRangeDisplayTitle(range), range, activeSessionData);
  renderModelDistribution(overview, range, activeSessionData, customStartDate, customEndDate);
  renderToolDistribution(overview, range, activeSessionData, customStartDate, customEndDate);
  renderModelTpsChart(overview, range, activeSessionData, customStartDate, customEndDate);
  renderLatencyTtftDistributionChart(activeSessionData);
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

  if (currentRange === 'session' && !activeSessionData) {
    activeSessionData = await fetchActiveSession();
  }

  if (rawOverview) {
    renderRangeDependentViews(rawOverview, currentRange);
  }
}

export async function applyTimeRangeFilter(range: TimeRangeOption): Promise<void> {
  currentRange = range;
  saveAnalyticsRangeState({ range: currentRange, customStartDate, customEndDate });
  updateRangeControlUI(range);

  if (!activeSessionData) {
    activeSessionData = await fetchActiveSession();
  }

  if (rawOverview) {
    renderRangeDependentViews(rawOverview, range);
  }
}

export async function refreshAnalytics(): Promise<void> {
  const refreshBtn = document.getElementById('btn-refresh-analytics');
  refreshBtn?.classList.add('loading');

  try {
    const [overview, session] = await Promise.all([fetchOverview(), fetchActiveSession()]);
    if (overview) rawOverview = overview;
    if (session) activeSessionData = session;

    updateRangeControlUI(currentRange);
    if (rawOverview) {
      renderRangeDependentViews(rawOverview, currentRange);
      renderProjectDistribution(rawOverview.topProjects);
    }
  } finally {
    if (refreshBtn) {
      setTimeout(() => refreshBtn.classList.remove('loading'), 300);
    }
  }
}

export function initTimeRangeControls(): void {
  syncCustomDateInputs();
  updateRangeControlUI(currentRange);

  if (rangeListenersBound) return;
  rangeListenersBound = true;

  const segmented = document.getElementById('analytics-timerange-segmented');
  segmented?.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range') as TimeRangeOption | null;
      if (range) void applyTimeRangeFilter(range);
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
    if (event.key !== ANALYTICS_RANGE_STORAGE_KEY && event.key !== null) return;
    const next =
      event.key === null
        ? loadAnalyticsRangeState()
        : parseAnalyticsRangeState(event.newValue);
    void applyExternalRangeState(next);
  });

  const syncFromStorage = () => {
    void applyExternalRangeState(loadAnalyticsRangeState());
  };

  window.addEventListener('focus', syncFromStorage);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFromStorage();
  });
}
