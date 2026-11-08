/**
 * Aura Dashboard · Main Client Entrypoint (TypeScript)
 */

import { initThemeListener, syncTheme } from './theme-sync';
import { refreshAnalytics, initTimeRangeControls } from './analytics';
import type { AuraConfig } from '../types';

declare global {
  interface Window {
    sidecar: {
      fetch: (url: string, init?: RequestInit) => Promise<Response>;
    };
  }
}

let currentConfig: AuraConfig | null = null;
let systemFontsList: string[] = [];

export function showToast(msg: string): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

export async function saveConfig(patch: Partial<AuraConfig>): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const data = await res.json();
      currentConfig = data.config;
      showToast('Configuration applied in real-time');
    } else {
      showToast('Save failed');
    }
  } catch (err) {
    console.error('saveConfig failed:', err);
    showToast('Network error');
  }
}

export function updateSegmentedUI(containerId: string, activeVal: string | number): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.segment-btn').forEach((btn) => {
    if (btn.getAttribute('data-val') === String(activeVal)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export function populateFontSelect(
  selectId: string,
  defaultLabel: string,
  fonts: string[],
  selectedVal?: string
): void {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '';

  const defOpt = document.createElement('option');
  defOpt.value = 'default';
  defOpt.textContent = defaultLabel;
  select.appendChild(defOpt);

  const optGroup = document.createElement('optgroup');
  optGroup.label = 'System Installed Fonts';

  for (const font of fonts) {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    optGroup.appendChild(opt);
  }
  select.appendChild(optGroup);

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Custom font name...';
  select.appendChild(customOpt);

  if (!selectedVal || selectedVal === 'default') {
    select.value = 'default';
  } else if (fonts.includes(selectedVal)) {
    select.value = selectedVal;
  } else {
    select.value = 'custom';
  }
}

export async function loadSystemFonts(): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/system-fonts', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.fonts)) {
        systemFontsList = data.fonts;
      }
    }
  } catch (e) {
    console.error('loadSystemFonts failed:', e);
  }
}

export async function loadConfig(): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/config', { method: 'GET' });
    if (!res.ok) return;
    const { config } = await res.json();
    currentConfig = config;

    // 0. Language
    const langSelect = document.getElementById('select-language') as HTMLSelectElement | null;
    if (langSelect) langSelect.value = config.language || 'default';

    // 1. Presets
    const lightVal = config.presets?.light || 'high-contrast';
    const darkVal = config.presets?.dark || 'claude-dark';
    updateSegmentedUI('preset-light-segmented', lightVal);
    updateSegmentedUI('preset-dark-segmented', darkVal);

    // 2. Wax Seal
    const waxToggle = document.getElementById('toggle-wax-seal') as HTMLInputElement | null;
    if (waxToggle) waxToggle.checked = config.composer?.waxSeal !== false;

    // 3. Typography
    const typo = config.typography || {};
    populateFontSelect('select-font-sans-primary', 'Default', systemFontsList, typo.primarySans);
    populateFontSelect('select-font-sans-fallback', 'Default', systemFontsList, typo.fallbackSans);
    populateFontSelect('select-font-mono', 'Default', systemFontsList, typo.mono);

    const primarySelect = document.getElementById('select-font-sans-primary') as HTMLSelectElement | null;
    const primaryRow = document.getElementById('row-custom-sans-primary');
    const primaryInput = document.getElementById('input-custom-sans-primary') as HTMLInputElement | null;
    if (primarySelect && primaryRow) {
      primaryRow.style.display = primarySelect.value === 'custom' ? 'flex' : 'none';
      if (primaryInput) primaryInput.value = typo.customPrimarySans || '';
    }

    const fallbackSelect = document.getElementById('select-font-sans-fallback') as HTMLSelectElement | null;
    const fallbackRow = document.getElementById('row-custom-sans-fallback');
    const fallbackInput = document.getElementById('input-custom-sans-fallback') as HTMLInputElement | null;
    if (fallbackSelect && fallbackRow) {
      fallbackRow.style.display = fallbackSelect.value === 'custom' ? 'flex' : 'none';
      if (fallbackInput) fallbackInput.value = typo.customFallbackSans || '';
    }

    const monoSelect = document.getElementById('select-font-mono') as HTMLSelectElement | null;
    const monoRow = document.getElementById('row-custom-mono');
    const monoInput = document.getElementById('input-custom-mono') as HTMLInputElement | null;
    if (monoSelect && monoRow) {
      monoRow.style.display = monoSelect.value === 'custom' ? 'flex' : 'none';
      if (monoInput) monoInput.value = typo.customMono || '';
    }

    // Font size
    updateSegmentedUI('font-size-segmented', typo.fontSize || 16);

    // 4. Composer
    const alignVal = config.composer?.collinear !== false ? 'collinear' : 'native';
    updateSegmentedUI('composer-align-segmented', alignVal);
    const arrowsToggle = document.getElementById('toggle-hide-arrows') as HTMLInputElement | null;
    if (arrowsToggle) arrowsToggle.checked = config.composer?.hideArrows !== false;

    // 5. Telemetry
    const metricsToggle = document.getElementById('toggle-metrics') as HTMLInputElement | null;
    if (metricsToggle) metricsToggle.checked = config.telemetry?.enabled !== false;
    updateSegmentedUI('metrics-interval-segmented', config.telemetry?.interval || 2000);
  } catch (e) {
    console.error('loadConfig failed:', e);
  }
}

export async function updateStatus(): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/status', { method: 'GET' });
    if (!res.ok) return;
    const data = await res.json();

    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const sublabel = document.getElementById('status-sublabel');

    if (data.connected) {
      if (dot) dot.classList.remove('disconnected');
      if (text) text.textContent = 'Connected';
      if (sublabel) {
        sublabel.textContent = `Connected to host (${data.targetCount || 1} window(s) · port ${data.cdpPort || '-'})`;
      }
    } else {
      if (dot) dot.classList.add('disconnected');
      if (text) text.textContent = 'Searching window...';
      if (sublabel) {
        sublabel.textContent = 'Detecting Antigravity CDP port...';
      }
    }
  } catch (e) {
    console.error('updateStatus failed:', e);
  }
}

async function initApp(): Promise<void> {
  initThemeListener();
  syncTheme();

  await loadSystemFonts();
  await loadConfig();
  updateStatus();
  setInterval(updateStatus, 3000);

  // 1. Language Select
  const langSelect = document.getElementById('select-language') as HTMLSelectElement | null;
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      saveConfig({ language: langSelect.value as any });
    });
  }

  // 2. Light Preset Segmented
  const lightContainer = document.getElementById('preset-light-segmented');
  if (lightContainer) {
    lightContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val') || 'high-contrast';
        updateSegmentedUI('preset-light-segmented', val);
        saveConfig({ presets: { ...currentConfig?.presets, light: val } as any });
      });
    });
  }

  // 3. Dark Preset Segmented
  const darkContainer = document.getElementById('preset-dark-segmented');
  if (darkContainer) {
    darkContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val') || 'claude-dark';
        updateSegmentedUI('preset-dark-segmented', val);
        saveConfig({ presets: { ...currentConfig?.presets, dark: val } as any });
      });
    });
  }

  // 4. Wax Seal Toggle
  const waxToggle = document.getElementById('toggle-wax-seal') as HTMLInputElement | null;
  if (waxToggle) {
    waxToggle.addEventListener('change', () => {
      saveConfig({ composer: { ...currentConfig?.composer, waxSeal: waxToggle.checked } as any });
    });
  }

  // 5. Sans Primary Font Select & Input
  const primarySelect = document.getElementById('select-font-sans-primary') as HTMLSelectElement | null;
  const primaryRow = document.getElementById('row-custom-sans-primary');
  const primaryInput = document.getElementById('input-custom-sans-primary') as HTMLInputElement | null;
  if (primarySelect) {
    primarySelect.addEventListener('change', () => {
      const isCustom = primarySelect.value === 'custom';
      if (primaryRow) primaryRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { ...currentConfig?.typography, primarySans: primarySelect.value } as any });
      } else if (primaryInput) {
        primaryInput.focus();
      }
    });
  }
  if (primaryInput) {
    const commitPrimary = () => {
      if (primarySelect && primarySelect.value === 'custom') {
        saveConfig({
          typography: {
            ...currentConfig?.typography,
            primarySans: 'custom',
            customPrimarySans: primaryInput.value.trim()
          } as any
        });
      }
    };
    primaryInput.addEventListener('change', commitPrimary);
    primaryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitPrimary();
        primaryInput.blur();
      }
    });
  }

  // 6. Sans Fallback Font Select & Input
  const fallbackSelect = document.getElementById('select-font-sans-fallback') as HTMLSelectElement | null;
  const fallbackRow = document.getElementById('row-custom-sans-fallback');
  const fallbackInput = document.getElementById('input-custom-sans-fallback') as HTMLInputElement | null;
  if (fallbackSelect) {
    fallbackSelect.addEventListener('change', () => {
      const isCustom = fallbackSelect.value === 'custom';
      if (fallbackRow) fallbackRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { ...currentConfig?.typography, fallbackSans: fallbackSelect.value } as any });
      } else if (fallbackInput) {
        fallbackInput.focus();
      }
    });
  }
  if (fallbackInput) {
    const commitFallback = () => {
      if (fallbackSelect && fallbackSelect.value === 'custom') {
        saveConfig({
          typography: {
            ...currentConfig?.typography,
            fallbackSans: 'custom',
            customFallbackSans: fallbackInput.value.trim()
          } as any
        });
      }
    };
    fallbackInput.addEventListener('change', commitFallback);
    fallbackInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitFallback();
        fallbackInput.blur();
      }
    });
  }

  // 7. Mono Font Select & Input
  const monoSelect = document.getElementById('select-font-mono') as HTMLSelectElement | null;
  const monoRow = document.getElementById('row-custom-mono');
  const monoInput = document.getElementById('input-custom-mono') as HTMLInputElement | null;
  if (monoSelect) {
    monoSelect.addEventListener('change', () => {
      const isCustom = monoSelect.value === 'custom';
      if (monoRow) monoRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { ...currentConfig?.typography, mono: monoSelect.value } as any });
      } else if (monoInput) {
        monoInput.focus();
      }
    });
  }
  if (monoInput) {
    const commitMono = () => {
      if (monoSelect && monoSelect.value === 'custom') {
        saveConfig({
          typography: {
            ...currentConfig?.typography,
            mono: 'custom',
            customMono: monoInput.value.trim()
          } as any
        });
      }
    };
    monoInput.addEventListener('change', commitMono);
    monoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitMono();
        monoInput.blur();
      }
    });
  }

  // 8. Font Size Segmented
  const sizeContainer = document.getElementById('font-size-segmented');
  if (sizeContainer) {
    sizeContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        updateSegmentedUI('font-size-segmented', val);
        saveConfig({ typography: { ...currentConfig?.typography, fontSize: val } as any });
      });
    });
  }

  // 9. Composer Align Segmented
  const alignContainer = document.getElementById('composer-align-segmented');
  if (alignContainer) {
    alignContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        updateSegmentedUI('composer-align-segmented', val || 'collinear');
        saveConfig({ composer: { ...currentConfig?.composer, collinear: val === 'collinear' } as any });
      });
    });
  }

  // 10. Hide Arrows Toggle
  const arrowsToggle = document.getElementById('toggle-hide-arrows') as HTMLInputElement | null;
  if (arrowsToggle) {
    arrowsToggle.addEventListener('change', () => {
      saveConfig({ composer: { ...currentConfig?.composer, hideArrows: arrowsToggle.checked } as any });
    });
  }

  // 11. Telemetry Toggle & Interval
  const metricsToggle = document.getElementById('toggle-metrics') as HTMLInputElement | null;
  if (metricsToggle) {
    metricsToggle.addEventListener('change', () => {
      saveConfig({ telemetry: { ...currentConfig?.telemetry, enabled: metricsToggle.checked } as any });
    });
  }
  const intervalContainer = document.getElementById('metrics-interval-segmented');
  if (intervalContainer) {
    intervalContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        updateSegmentedUI('metrics-interval-segmented', val);
        saveConfig({ telemetry: { ...currentConfig?.telemetry, interval: val } as any });
      });
    });
  }

  // 12. Force Reload Button
  const reloadBtn = document.getElementById('btn-force-reload') as HTMLButtonElement | null;
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
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
      } catch (err) {
        showToast('Request error');
      } finally {
        reloadBtn.disabled = false;
        reloadBtn.style.opacity = '1';
      }
    });
  }

  // 13. Navigation Tabs (Analytics vs Settings)
  const tabAnalytics = document.getElementById('tab-nav-analytics');
  const tabSettings = document.getElementById('tab-nav-settings');
  const viewAnalytics = document.getElementById('view-analytics');
  const viewSettings = document.getElementById('view-settings');

  const switchTab = (tab: 'analytics' | 'settings') => {
    if (tab === 'analytics') {
      tabAnalytics?.classList.add('active');
      tabSettings?.classList.remove('active');
      if (viewAnalytics) viewAnalytics.style.display = 'block';
      if (viewSettings) viewSettings.style.display = 'none';
      refreshAnalytics();
    } else {
      tabSettings?.classList.add('active');
      tabAnalytics?.classList.remove('active');
      if (viewSettings) viewSettings.style.display = 'block';
      if (viewAnalytics) viewAnalytics.style.display = 'none';
    }
  };

  tabAnalytics?.addEventListener('click', () => switchTab('analytics'));
  tabSettings?.addEventListener('click', () => switchTab('settings'));

  // 14. Analytics Refresh Button
  const refreshAnalyticsBtn = document.getElementById('btn-refresh-analytics');
  refreshAnalyticsBtn?.addEventListener('click', () => refreshAnalytics());

  // 15. Time Range Filters Initialization
  initTimeRangeControls();

  // Initial Analytics Fetch
  refreshAnalytics();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
