import { describe, expect, test } from 'bun:test';
import {
  ANALYTICS_RANGE_STORAGE_KEY,
  PANEL_TAB_STORAGE_KEY,
  loadAnalyticsRangeState,
  loadPanelTabState,
  parseAnalyticsRangeState,
  parsePanelTab,
  saveAnalyticsRangeState,
  savePanelTabState,
  type StorageLike
} from '../src/panel/panel-state';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    }
  };
}

describe('Panel UI state persistence helpers', () => {
  test('saves and loads active top-level panel tab with safe fallback', () => {
    const store = createMemoryStorage();
    expect(loadPanelTabState(store)).toBe('analytics');

    savePanelTabState('settings', store);
    expect(store.getItem(PANEL_TAB_STORAGE_KEY)).toBe('settings');
    expect(loadPanelTabState(store)).toBe('settings');

    expect(parsePanelTab('unknown-tab')).toBe('analytics');
    expect(loadPanelTabState(null)).toBe('analytics');
  });

  test('saves and loads analytics range state including custom dates', () => {
    const store = createMemoryStorage();
    expect(loadAnalyticsRangeState(store)).toEqual({
      range: 'last-30-days',
      customStartDate: '',
      customEndDate: ''
    });

    saveAnalyticsRangeState(
      {
        range: 'custom',
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-09'
      },
      store
    );
    expect(loadAnalyticsRangeState(store)).toEqual({
      range: 'custom',
      customStartDate: '2026-11-01',
      customEndDate: '2026-11-09'
    });

    saveAnalyticsRangeState(
      {
        range: 'session',
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-09'
      },
      store
    );
    expect(loadAnalyticsRangeState(store)).toEqual({
      range: 'session',
      customStartDate: '2026-11-01',
      customEndDate: '2026-11-09'
    });
  });

  test('sanitizes corrupted or invalid persisted analytics range payloads', () => {
    expect(parseAnalyticsRangeState('not-json')).toEqual({
      range: 'last-30-days',
      customStartDate: '',
      customEndDate: ''
    });

    const dirtyStore = createMemoryStorage({
      [ANALYTICS_RANGE_STORAGE_KEY]: JSON.stringify({
        range: 'all-time',
        customStartDate: '11/01/2026',
        customEndDate: '2026-11-09'
      })
    });
    expect(loadAnalyticsRangeState(dirtyStore)).toEqual({
      range: 'last-30-days',
      customStartDate: '',
      customEndDate: '2026-11-09'
    });
  });

  test('degrades cleanly when storage throws SecurityError', () => {
    const blockedStorage: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      }
    };

    expect(loadPanelTabState(blockedStorage)).toBe('analytics');
    expect(loadAnalyticsRangeState(blockedStorage)).toEqual({
      range: 'last-30-days',
      customStartDate: '',
      customEndDate: ''
    });
    expect(() => savePanelTabState('settings', blockedStorage)).not.toThrow();
    expect(() =>
      saveAnalyticsRangeState(
        { range: 'today', customStartDate: '', customEndDate: '' },
        blockedStorage
      )
    ).not.toThrow();
  });
});
