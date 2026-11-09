/**
 * Aura Dashboard · Main Client Entrypoint
 */

import type { SidecarStatusResponse } from '../types';
import { initTimeRangeControls, refreshAnalytics } from './analytics/index';
import { bindSettingsControls, loadConfig, loadSystemFonts, showToast } from './settings';
import { initThemeListener, syncTheme } from './theme-sync';

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
  } catch (err) {
    console.error('updateStatus failed:', err);
  }
}

async function initApp(): Promise<void> {
  initThemeListener();
  syncTheme();

  await loadSystemFonts();
  await loadConfig();
  void updateStatus();
  setInterval(() => void updateStatus(), 3000);

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

  const tabAnalytics = document.getElementById('tab-nav-analytics');
  const tabSettings = document.getElementById('tab-nav-settings');
  const viewAnalytics = document.getElementById('view-analytics');
  const viewSettings = document.getElementById('view-settings');

  const switchTab = (tab: 'analytics' | 'settings') => {
    const isAnalytics = tab === 'analytics';
    tabAnalytics?.classList.toggle('active', isAnalytics);
    tabSettings?.classList.toggle('active', !isAnalytics);
    if (viewAnalytics) viewAnalytics.style.display = isAnalytics ? 'block' : 'none';
    if (viewSettings) viewSettings.style.display = isAnalytics ? 'none' : 'block';
    if (isAnalytics) void refreshAnalytics();
  };

  tabAnalytics?.addEventListener('click', () => switchTab('analytics'));
  tabSettings?.addEventListener('click', () => switchTab('settings'));

  document.getElementById('btn-refresh-analytics')?.addEventListener('click', () => {
    void refreshAnalytics();
  });

  initTimeRangeControls();

  if (typeof window.sidecar?.onWorkspaceChange === 'function') {
    window.sidecar.onWorkspaceChange(() => {
      void refreshAnalytics();
    });
  }

  await refreshAnalytics();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initApp());
} else {
  void initApp();
}
