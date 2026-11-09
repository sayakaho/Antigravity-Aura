import { agGlobal } from './types';

/**
 * Antigravity 原生 TanStack Router 死锁与快捷键缩放缺陷修复（支持热重载更新激活态）。
 */
export function installHealers(enabled: boolean, detectedOs: string): void {
  agGlobal.__ag_settings_click_fn = (e: Event) => {
    if (!enabled) return;
    const target = e.target as Element | null;
    const btn = target?.closest?.('[data-testid="settings-button"]');
    if (!btn) return;

    const hasDialog = Boolean(document.querySelector('[role="dialog"]'));
    const urlHasSettings = window.location.search.includes('settingsOpen=true');
    if (!hasDialog && urlHasSettings) {
      const url = new URL(window.location.href);
      url.searchParams.delete('settingsOpen');
      url.searchParams.delete('settingsScreen');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  };

  if (!agGlobal.__ag_settings_guard_installed) {
    agGlobal.__ag_settings_guard_installed = true;
    document.addEventListener(
      'click',
      (e) => {
        agGlobal.__ag_settings_click_fn?.(e);
      },
      true
    );
  }

  agGlobal.__ag_zoom_keydown_fn = (e: KeyboardEvent) => {
    if (!enabled) return;
    const isMac = detectedOs === 'darwin';
    const modKey = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modKey || e.altKey) return;

    if (!e.shiftKey && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
      e.preventDefault();
      e.stopPropagation();
      agGlobal.electronNative?.zoomOut?.();
    } else if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
      e.preventDefault();
      e.stopPropagation();
      agGlobal.electronNative?.zoomIn?.();
    } else if (!e.shiftKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
      e.preventDefault();
      e.stopPropagation();
      agGlobal.electronNative?.zoomReset?.();
    }
  };

  if (!agGlobal.__ag_zoom_guard_installed) {
    agGlobal.__ag_zoom_guard_installed = true;
    window.addEventListener(
      'keydown',
      (e) => {
        agGlobal.__ag_zoom_keydown_fn?.(e);
      },
      true
    );
  }
}
