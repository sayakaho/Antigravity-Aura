/**
 * Aura Dashboard · Main Client Entrypoint
 */

import type { SidecarStatusResponse } from '../types';
import { AnalyticsAutoRefreshController } from './analytics/auto-refresh';
import { getActiveSessionId, initTimeRangeControls, refreshAnalytics } from './analytics/index';
import {
  PANEL_TAB_STORAGE_KEY,
  loadPanelTabState,
  parsePanelTab,
  savePanelTabState,
  type PanelTab
} from './panel-state';
import { bindSettingsControls, loadConfig, loadSystemFonts, showToast } from './settings';
import { initThemeListener, syncTheme } from './theme-sync';

interface StatusUpdatePayload {
  analyticsRevision?: number;
  activeCascadeId: string;
}

const INTERACTIVE_ANALYTICS_HOVER_SELECTOR =
  '#analytics-activity-chart .chart-stage, #analytics-model-tps-chart .chart-body, #analytics-latency-ttft-chart .chart-body, #overview-hit-legend-trigger, .project-path-pill[data-tooltip-path]';

let onStatusUpdate: ((payload: StatusUpdatePayload) => void) | null = null;

function bindAnalyticsInteractionTracking(
  viewAnalytics: HTMLElement | null,
  autoRefresh: AnalyticsAutoRefreshController,
  isAnalyticsTabActive: () => boolean
): void {
  if (!viewAnalytics) return;

  let hoverActive = false;
  let pointerDownActive = false;
  let scrollActive = false;
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;

  const syncInteractionState = () => {
    autoRefresh.onInteractionChange(hoverActive || pointerDownActive || scrollActive);
  };

  const clearScrollTimer = () => {
    if (scrollIdleTimer) {
      clearTimeout(scrollIdleTimer);
      scrollIdleTimer = null;
    }
  };

  const markScrollActive = () => {
    if (!isAnalyticsTabActive()) return;
    scrollActive = true;
    syncInteractionState();
    clearScrollTimer();
    scrollIdleTimer = setTimeout(() => {
      scrollIdleTimer = null;
      scrollActive = false;
      syncInteractionState();
    }, 350);
  };

  viewAnalytics.addEventListener('pointerover', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const nextHover = Boolean(target?.closest(INTERACTIVE_ANALYTICS_HOVER_SELECTOR));
    if (nextHover !== hoverActive) {
      hoverActive = nextHover;
      syncInteractionState();
    }
  });

  viewAnalytics.addEventListener('pointerout', (e) => {
    if (!hoverActive) return;
    const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    if (!related || !viewAnalytics.contains(related) || !related.closest(INTERACTIVE_ANALYTICS_HOVER_SELECTOR)) {
      hoverActive = false;
      syncInteractionState();
    }
  });

  viewAnalytics.addEventListener('pointerleave', () => {
    hoverActive = false;
    pointerDownActive = false;
    syncInteractionState();
  });

  viewAnalytics.addEventListener('pointerdown', () => {
    pointerDownActive = true;
    syncInteractionState();
  });

  window.addEventListener('pointerup', () => {
    if (!pointerDownActive) return;
    pointerDownActive = false;
    syncInteractionState();
  });

  window.addEventListener('pointercancel', () => {
    if (!pointerDownActive) return;
    pointerDownActive = false;
    syncInteractionState();
  });

  window.addEventListener('blur', () => {
    if (!hoverActive && !pointerDownActive && !scrollActive) return;
    hoverActive = false;
    pointerDownActive = false;
    scrollActive = false;
    clearScrollTimer();
    syncInteractionState();
  });

  viewAnalytics.addEventListener('wheel', markScrollActive, { passive: true });
  document.addEventListener(
    'scroll',
    (e) => {
      const target = e.target;
      if (
        target === document ||
        target === document.documentElement ||
        (target instanceof Element && target.classList.contains('chart-stage-scrollable'))
      ) {
        markScrollActive();
      }
    },
    { capture: true, passive: true }
  );
}

export async function updateStatus(): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/status', { method: 'GET' });
    if (!res.ok) return;
    const data = (await res.json()) as Partial<SidecarStatusResponse>;

    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const sublabel = document.getElementById('status-sublabel');

    if (data.connected) {
      dot?.classList.remove('disconnected');
      if (text) text.textContent = 'Connected';
      if (sublabel) {
        sublabel.textContent = `Connected to host (${data.targetCount || 1} window(s) · port ${data.cdpPort || '-'})`;
      }
    } else {
      dot?.classList.add('disconnected');
      if (text) text.textContent = 'Searching window...';
      if (sublabel) {
        sublabel.textContent = 'Detecting Antigravity CDP port...';
      }
    }

    const nextCascadeId =
      typeof data.activeCascadeId === 'string' && data.activeCascadeId
        ? data.activeCascadeId
        : typeof data.metrics?.cascadeId === 'string'
          ? data.metrics.cascadeId
          : '';
    onStatusUpdate?.({
      analyticsRevision:
        typeof data.analyticsRevision === 'number' ? data.analyticsRevision : undefined,
      activeCascadeId: nextCascadeId
    });
  } catch (err) {
    console.error('updateStatus failed:', err);
  }
}

async function initApp(): Promise<void> {
  initThemeListener();
  syncTheme();

  const tabAnalytics = document.getElementById('tab-nav-analytics');
  const tabSettings = document.getElementById('tab-nav-settings');
  const viewAnalytics = document.getElementById('view-analytics');
  const viewSettings = document.getElementById('view-settings');

  let activeTab: PanelTab = loadPanelTabState();
  let lastWorkspaceSig: string | null = null;

  const autoRefresh = new AnalyticsAutoRefreshController({
    initialTabActive: activeTab === 'analytics',
    initialHidden: typeof document !== 'undefined' ? document.hidden : false,
    interactionGraceMs: 250,
    onRefresh: (req) => refreshAnalytics(req)
  });

  const applyTabUI = (tab: PanelTab) => {
    activeTab = tab;
    const isAnalytics = tab === 'analytics';
    tabAnalytics?.classList.toggle('active', isAnalytics);
    tabSettings?.classList.toggle('active', !isAnalytics);
    if (viewAnalytics) viewAnalytics.style.display = isAnalytics ? 'block' : 'none';
    if (viewSettings) viewSettings.style.display = isAnalytics ? 'none' : 'block';
  };

  const switchTab = (tab: PanelTab) => {
    if (tab !== activeTab) {
      applyTabUI(tab);
      savePanelTabState(tab);
    }
    autoRefresh.onTabChange(tab === 'analytics');
  };

  // 首个 await 前同步还原 Tab 与时间范围控件状态，避免从默认状态闪跳
  applyTabUI(activeTab);
  initTimeRangeControls();
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('aura-preload');
  });

  onStatusUpdate = (snapshot) => {
    autoRefresh.onStatusSnapshot({
      analyticsRevision: snapshot.analyticsRevision,
      activeCascadeId: snapshot.activeCascadeId,
      renderedSessionId: getActiveSessionId()
    });
  };

  tabAnalytics?.addEventListener('click', () => switchTab('analytics'));
  tabSettings?.addEventListener('click', () => switchTab('settings'));

  document.getElementById('btn-refresh-analytics')?.addEventListener('click', () => {
    autoRefresh.triggerManualRefresh();
  });

  bindAnalyticsInteractionTracking(
    viewAnalytics,
    autoRefresh,
    () => activeTab === 'analytics'
  );

  const syncExternalTabState = (nextTab: PanelTab) => {
    if (nextTab === activeTab) return;
    applyTabUI(nextTab);
    autoRefresh.onTabChange(nextTab === 'analytics');
  };

  window.addEventListener('storage', (event) => {
    if (event.key === PANEL_TAB_STORAGE_KEY) {
      syncExternalTabState(parsePanelTab(event.newValue));
    } else if (event.key === null) {
      syncExternalTabState(loadPanelTabState());
    }
  });
  window.addEventListener('focus', () => syncExternalTabState(loadPanelTabState()));
  document.addEventListener('visibilitychange', () => {
    autoRefresh.onVisibilityChange(document.hidden);
    if (!document.hidden) {
      syncExternalTabState(loadPanelTabState());
      void updateStatus();
    }
  });

  bindSettingsControls();

  const reloadBtn = document.getElementById('btn-force-reload') as HTMLButtonElement | null;
  reloadBtn?.addEventListener('click', async () => {
    reloadBtn.disabled = true;
    reloadBtn.style.opacity = '0.6';
    try {
      const res = await window.sidecar.fetch('/api/reload', { method: 'POST' });
      if (res.ok) {
        showToast('Styles recompiled and re-applied');
        await updateStatus();
      } else {
        showToast('Reload failed');
      }
    } catch {
      showToast('Request error');
    } finally {
      reloadBtn.disabled = false;
      reloadBtn.style.opacity = '1';
    }
  });

  if (typeof window.sidecar?.onWorkspaceChange === 'function') {
    let initialAnalyticsQueued = activeTab === 'analytics';
    setTimeout(() => {
      initialAnalyticsQueued = false;
    }, 200);
    window.sidecar.onWorkspaceChange((uris) => {
      const nextSig = Array.isArray(uris) ? uris.join('|') : '';
      if (lastWorkspaceSig === null) {
        lastWorkspaceSig = nextSig;
        if (initialAnalyticsQueued) {
          initialAnalyticsQueued = false;
          return;
        }
      } else if (nextSig === lastWorkspaceSig) {
        return;
      } else {
        lastWorkspaceSig = nextSig;
      }
      autoRefresh.onWorkspaceChange();
    });
  }

  setInterval(() => {
    if (!document.hidden) {
      void updateStatus();
    }
  }, 2500);

  autoRefresh.triggerInitialLoad();

  await Promise.allSettled([loadSystemFonts(), loadConfig(), updateStatus()]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initApp());
} else {
  void initApp();
}
