/**
 * Aura Dashboard · Main Client Entrypoint
 */

import type { SidecarStatusResponse } from '../types';
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

let onSessionActivated: ((cascadeId: string) => void) | null = null;

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
    if (nextCascadeId) {
      onSessionActivated?.(nextCascadeId);
    }
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
  let lastKnownCascadeId = '';
  let lastWorkspaceSig: string | null = null;

  const applyTabUI = (tab: PanelTab) => {
    activeTab = tab;
    const isAnalytics = tab === 'analytics';
    tabAnalytics?.classList.toggle('active', isAnalytics);
    tabSettings?.classList.toggle('active', !isAnalytics);
    if (viewAnalytics) viewAnalytics.style.display = isAnalytics ? 'block' : 'none';
    if (viewSettings) viewSettings.style.display = isAnalytics ? 'none' : 'block';
  };

  const switchTab = (tab: PanelTab) => {
    applyTabUI(tab);
    savePanelTabState(tab);
    if (tab === 'analytics') void refreshAnalytics();
  };

  // 首个 await 前同步还原 Tab 与时间范围控件状态，避免从默认状态闪跳
  applyTabUI(activeTab);
  initTimeRangeControls();
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('aura-preload');
  });

  onSessionActivated = (nextCascadeId: string) => {
    const currentRenderedId = getActiveSessionId();
    const changed =
      (lastKnownCascadeId !== '' && nextCascadeId !== lastKnownCascadeId) ||
      (currentRenderedId !== null && currentRenderedId !== nextCascadeId);
    lastKnownCascadeId = nextCascadeId;
    if (changed && activeTab === 'analytics') {
      void refreshAnalytics();
    }
  };

  tabAnalytics?.addEventListener('click', () => switchTab('analytics'));
  tabSettings?.addEventListener('click', () => switchTab('settings'));

  document.getElementById('btn-refresh-analytics')?.addEventListener('click', () => {
    void refreshAnalytics();
  });

  const syncExternalTabState = (nextTab: PanelTab) => {
    if (nextTab === activeTab) return;
    applyTabUI(nextTab);
    if (nextTab === 'analytics') void refreshAnalytics();
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
    if (!document.hidden) syncExternalTabState(loadPanelTabState());
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
      if (activeTab === 'analytics') void refreshAnalytics();
    });
  }

  setInterval(() => void updateStatus(), 3000);

  await Promise.allSettled([
    loadSystemFonts(),
    loadConfig(),
    updateStatus(),
    activeTab === 'analytics' ? refreshAnalytics() : Promise.resolve()
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initApp());
} else {
  void initApp();
}
