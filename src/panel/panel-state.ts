import type { TimeRangeOption } from './analytics/time-range';

export type PanelTab = 'analytics' | 'settings';
export type ProjectScopeMode = 'follow' | 'all-time';

export interface AnalyticsRangeState {
  range: TimeRangeOption;
  customStartDate: string;
  customEndDate: string;
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const PANEL_TAB_STORAGE_KEY = 'aura.panel.activeTab';
export const ANALYTICS_RANGE_STORAGE_KEY = 'aura.analytics.rangeState';
export const PROJECT_SCOPE_STORAGE_KEY = 'aura.analytics.projectScope';

const DEFAULT_RANGE_STATE: AnalyticsRangeState = {
  range: 'last-30-days',
  customStartDate: '',
  customEndDate: ''
};

const VALID_TIME_RANGES: ReadonlySet<string> = new Set<TimeRangeOption>([
  'session',
  'today',
  'yesterday',
  'this-week',
  'this-month',
  'last-7-days',
  'last-30-days',
  'custom'
]);

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function parsePanelTab(raw: string | null | undefined): PanelTab {
  return raw === 'settings' ? 'settings' : 'analytics';
}

export function loadPanelTabState(storage?: StorageLike | null): PanelTab {
  const store = resolveStorage(storage);
  if (!store) return 'analytics';
  try {
    return parsePanelTab(store.getItem(PANEL_TAB_STORAGE_KEY));
  } catch {
    return 'analytics';
  }
}

export function savePanelTabState(tab: PanelTab, storage?: StorageLike | null): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(PANEL_TAB_STORAGE_KEY, parsePanelTab(tab));
  } catch {
    // Restricted webview contexts may block storage writes
  }
}

export function parseAnalyticsRangeState(raw: string | null | undefined): AnalyticsRangeState {
  if (!raw) return { ...DEFAULT_RANGE_STATE };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_RANGE_STATE };
    }
    const obj = parsed as Record<string, unknown>;
    const range: TimeRangeOption =
      typeof obj.range === 'string' && VALID_TIME_RANGES.has(obj.range)
        ? (obj.range as TimeRangeOption)
        : DEFAULT_RANGE_STATE.range;
    const customStartDate =
      typeof obj.customStartDate === 'string' && DATE_KEY_RE.test(obj.customStartDate)
        ? obj.customStartDate
        : '';
    const customEndDate =
      typeof obj.customEndDate === 'string' && DATE_KEY_RE.test(obj.customEndDate)
        ? obj.customEndDate
        : '';
    return { range, customStartDate, customEndDate };
  } catch {
    return { ...DEFAULT_RANGE_STATE };
  }
}

export function loadAnalyticsRangeState(storage?: StorageLike | null): AnalyticsRangeState {
  const store = resolveStorage(storage);
  if (!store) return { ...DEFAULT_RANGE_STATE };
  try {
    return parseAnalyticsRangeState(store.getItem(ANALYTICS_RANGE_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_RANGE_STATE };
  }
}

export function saveAnalyticsRangeState(
  state: AnalyticsRangeState,
  storage?: StorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const sanitized: AnalyticsRangeState = {
    range: VALID_TIME_RANGES.has(state.range) ? state.range : DEFAULT_RANGE_STATE.range,
    customStartDate: DATE_KEY_RE.test(state.customStartDate) ? state.customStartDate : '',
    customEndDate: DATE_KEY_RE.test(state.customEndDate) ? state.customEndDate : ''
  };
  try {
    store.setItem(ANALYTICS_RANGE_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Restricted webview contexts may block storage writes
  }
}

export function parseProjectScopeState(raw: string | null | undefined): ProjectScopeMode {
  return raw === 'all-time' ? 'all-time' : 'follow';
}

export function loadProjectScopeState(storage?: StorageLike | null): ProjectScopeMode {
  const store = resolveStorage(storage);
  if (!store) return 'follow';
  try {
    return parseProjectScopeState(store.getItem(PROJECT_SCOPE_STORAGE_KEY));
  } catch {
    return 'follow';
  }
}

export function saveProjectScopeState(
  scope: ProjectScopeMode,
  storage?: StorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(PROJECT_SCOPE_STORAGE_KEY, parseProjectScopeState(scope));
  } catch {
    // Restricted webview contexts may block storage writes
  }
}
