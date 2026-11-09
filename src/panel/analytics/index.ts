import type { GlobalAnalyticsOverview, SessionAnalyticsData } from '../../types';
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

let rawOverview: GlobalAnalyticsOverview | null = null;
let currentRange: TimeRangeOption = 'last-30-days';
let customStartDate = '';
let customEndDate = '';
let activeSessionData: SessionAnalyticsData | null = null;

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

export async function applyTimeRangeFilter(range: TimeRangeOption): Promise<void> {
  currentRange = range;
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
}
