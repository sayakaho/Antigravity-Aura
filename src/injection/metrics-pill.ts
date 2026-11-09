import type { LiveMetricsPayload, SelectorsConfig } from '../types';
import { agGlobal } from './types';

function extractCascadeId(): string {
  try {
    const m = window.location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
    if (m) return m[1];
    const q = new URLSearchParams(window.location.search).get('cascadeId');
    if (q && /^[0-9a-f-]{36}$/i.test(q)) return q;
    const selected = document.querySelector('[data-testid=conversation-row-sidebar][data-selected=true]');
    const cid = selected?.getAttribute('data-cascade-id');
    if (cid && /^[0-9a-f-]{36}$/i.test(cid)) return cid;
  } catch {
    // Ignore malformed query string
  }
  return '';
}

function ensureMetricsTooltip(): HTMLElement | null {
  let tt = document.getElementById('ag-live-metrics-tooltip');
  if (!tt && document.body) {
    tt = document.createElement('div');
    tt.id = 'ag-live-metrics-tooltip';
    document.body.appendChild(tt);
  } else if (tt && tt.parentElement !== document.body && document.body) {
    document.body.appendChild(tt);
  }
  return tt;
}

function findFooterRow(box: HTMLElement | null): Element | null {
  if (!box) return null;
  const rows = box.querySelectorAll('div.flex.w-full.items-center.justify-between');
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.querySelector('[data-testid="model-selector-trigger"], [data-testid="send-button"]')) {
      return r;
    }
  }
  return rows[rows.length - 1] || null;
}

const AURA_SIDECAR_ID = 'aura-dashboard/dashboard';
const AURA_TAB_ID = `sidecar__${AURA_SIDECAR_ID}__/`;

const TOGGLE_PANEL_BUTTON_SELECTOR = [
  'button[data-testid="toggle-aux-sidebar"]',
  'button[aria-label="Toggle Side Panel"]',
  'button[data-ag-orig-aria-label="Toggle Side Panel"]',
  'button[aria-label="切换侧边面板"]'
].join(', ');

const RIGHT_AUX_PANEL_SELECTOR =
  '[data-side-panel-body], [class*="aux-pane"], [class*="side-panel"], [class*="auxiliary"]';

let cancelPendingSidecarActivation: (() => void) | null = null;

function isInLeftSidebar(el: Element): boolean {
  return (el.tagName || '').toUpperCase() === 'ASIDE' || Boolean(el.closest?.('aside'));
}

function isElementVisible(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  if (el.hasAttribute?.('hidden') || el.getAttribute?.('aria-hidden') === 'true') {
    return false;
  }
  let isFixed = false;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(el);
      if (style?.display === 'none' || style?.visibility === 'hidden') {
        return false;
      }
      isFixed = style?.position === 'fixed';
    } catch {
      // Partial DOM test stubs may throw inside global getComputedStyle
    }
  }
  if ((el.offsetWidth ?? 0) <= 0 || (el.offsetHeight ?? 0) <= 0) {
    return false;
  }
  if (!isFixed && 'offsetParent' in el && el.offsetParent === null) {
    return false;
  }
  return true;
}

function findToggleSidePanelButton(): HTMLButtonElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>(TOGGLE_PANEL_BUTTON_SELECTOR)).filter(
    (btn) => !isInLeftSidebar(btn)
  );
  return candidates.find(isElementVisible) ?? candidates[0] ?? null;
}

function isAuraTabElement(tab: HTMLElement): boolean {
  const tabId = tab.getAttribute?.('data-tab-id') ?? '';
  const title = tab.getAttribute?.('title') ?? '';
  const origTitle = tab.getAttribute?.('data-ag-orig-title') ?? '';
  const ariaLabel = tab.getAttribute?.('aria-label') ?? '';
  const origAriaLabel = tab.getAttribute?.('data-ag-orig-aria-label') ?? '';
  const text = (tab.innerText || tab.textContent || '').trim();
  return (
    tabId === AURA_TAB_ID ||
    tabId.includes('aura-dashboard') ||
    text.includes('Aura Dashboard') ||
    title.includes('Aura Dashboard') ||
    origTitle.includes('Aura Dashboard') ||
    ariaLabel.includes('Aura Dashboard') ||
    origAriaLabel.includes('Aura Dashboard')
  );
}

function findAuraAuxTab(): HTMLElement | null {
  const exactTab = document.querySelector<HTMLElement>(`.agy-aux-tab[data-tab-id="${AURA_TAB_ID}"]`);
  if (exactTab && !isInLeftSidebar(exactTab)) {
    return exactTab;
  }
  const auxTabs = Array.from(document.querySelectorAll<HTMLElement>('.agy-aux-tab, button.agy-aux-tab')).filter(
    (tab) => !isInLeftSidebar(tab) && isAuraTabElement(tab)
  );
  return auxTabs.find(isElementVisible) ?? auxTabs[0] ?? null;
}

function isAuraTabSelected(tab: HTMLElement | null): boolean {
  if (!tab) return false;
  return Boolean(tab.classList?.contains('bg-secondary') || tab.getAttribute?.('aria-selected') === 'true');
}

function getSidecarUiState() {
  const toggleBtn = findToggleSidePanelButton();
  const auraTab = findAuraAuxTab();
  const auraIframeVisible = Array.from(
    document.querySelectorAll<HTMLIFrameElement>('iframe[src*="aura-dashboard"]')
  ).some(isElementVisible);

  const explicitOpenAttr = Array.from(
    document.querySelectorAll<HTMLElement>('[data-aux-pane-open="true"], [data-side-panel-open="true"]')
  ).some((el) => !isInLeftSidebar(el));

  const visibleSlots = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="sidecar-iframe-slot"][data-visible="true"]')
  ).filter((el) => !isInLeftSidebar(el) && isElementVisible(el));

  const rightPanelVisible = Array.from(document.querySelectorAll<HTMLElement>(RIGHT_AUX_PANEL_SELECTOR)).some(
    (el) => !isInLeftSidebar(el) && isElementVisible(el)
  );

  const isToggleExpanded = toggleBtn?.getAttribute?.('aria-expanded') === 'true';
  const isPanelOpen =
    explicitOpenAttr || isToggleExpanded || visibleSlots.length > 0 || rightPanelVisible || auraIframeVisible;

  const auraSlotActive = visibleSlots.some((el) =>
    (el.getAttribute?.('data-sidecar-id') ?? '').includes('aura-dashboard')
  );
  const auraHeaderActive = Array.from(document.querySelectorAll<HTMLElement>('[data-active-tab-id]')).some((el) => {
    const activeTabId = el.getAttribute?.('data-active-tab-id') ?? '';
    return activeTabId === AURA_TAB_ID || activeTabId.includes('aura-dashboard');
  });

  // `[data-active-tab-id]` persists while the pane is collapsed, so require `isPanelOpen`.
  const isAuraActive =
    isPanelOpen && (auraIframeVisible || auraSlotActive || auraHeaderActive || isAuraTabSelected(auraTab));

  return { toggleBtn, auraTab, isPanelOpen, isAuraActive };
}

function navigateToAuraTabRoute(): void {
  if (typeof window === 'undefined' || !window.location?.href || typeof window.history?.replaceState !== 'function') {
    return;
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') !== AURA_TAB_ID) {
      url.searchParams.set('tab', AURA_TAB_ID);
      window.history.replaceState(window.history.state ?? null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    const popEvent =
      typeof PopStateEvent === 'function'
        ? new PopStateEvent('popstate', { state: window.history.state ?? null })
        : typeof Event === 'function'
          ? new Event('popstate')
          : ({ type: 'popstate' } as Event);
    window.dispatchEvent?.(popEvent);
  } catch {
    // Ignore invalid URL environments
  }
}

function scheduleNextFrame(cb: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const rafId = requestAnimationFrame(cb);
    return () => {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
    };
  }
  const timerId = setTimeout(cb, 16);
  return () => clearTimeout(timerId);
}

function scheduleAuraTabActivation(remainingAttempts = 3): void {
  let cancelled = false;
  let clickedTab = false;
  let retriedRouteWhileOpen = false;
  let cancelPendingStep: (() => void) | null = null;

  const cancel = () => {
    cancelled = true;
    cancelPendingStep?.();
    cancelPendingStep = null;
  };
  cancelPendingSidecarActivation = cancel;

  const finish = () => {
    if (cancelPendingSidecarActivation === cancel) {
      cancelPendingSidecarActivation = null;
    }
  };

  const attempt = (left: number) => {
    if (cancelled) return;
    const state = getSidecarUiState();
    if (state.isAuraActive) {
      finish();
      return;
    }
    if (state.isPanelOpen) {
      if (state.auraTab && !clickedTab) {
        clickedTab = true;
        state.auraTab.click();
        finish();
        return;
      }
      if (!state.auraTab && !retriedRouteWhileOpen) {
        retriedRouteWhileOpen = true;
        navigateToAuraTabRoute();
      }
    }
    if (left <= 1) {
      finish();
      return;
    }
    const timerId = setTimeout(() => {
      cancelPendingStep = null;
      attempt(left - 1);
    }, 35);
    cancelPendingStep = () => clearTimeout(timerId);
  };

  cancelPendingStep = scheduleNextFrame(() => {
    cancelPendingStep = null;
    attempt(remainingAttempts);
  });
}

export function toggleAuraSidecar(): void {
  try {
    if (cancelPendingSidecarActivation) {
      cancelPendingSidecarActivation();
      cancelPendingSidecarActivation = null;
    }

    const { toggleBtn, auraTab, isPanelOpen, isAuraActive } = getSidecarUiState();

    if (isPanelOpen) {
      if (isAuraActive) {
        toggleBtn?.click();
      } else if (auraTab) {
        auraTab.click();
      } else {
        navigateToAuraTabRoute();
      }
      return;
    }

    // Set the target sidecar route before expanding so host opens directly onto Aura when supported.
    navigateToAuraTabRoute();
    if (!toggleBtn) return;
    toggleBtn.click();
    scheduleAuraTabActivation();
  } catch {
    // Non-fatal UI toggle failure
  }
}

function bindMetricsPillHandlers(pill: HTMLElement): void {
  pill.onclick = (e: MouseEvent) => {
    e?.stopPropagation?.();
    document.getElementById('ag-live-metrics-tooltip')?.removeAttribute('data-visible');
    toggleAuraSidecar();
  };

  pill.onmouseenter = () => {
    const tt = ensureMetricsTooltip();
    if (!tt || !tt.innerHTML) return;
    const r = pill.getBoundingClientRect();
    const ttWidth = Math.min(440, Math.max(370, tt.offsetWidth || 400));
    const left = Math.max(12, Math.min(r.left, window.innerWidth - ttWidth - 16));
    const bottomPx = Math.min(window.innerHeight - r.top + 8, window.innerHeight - (tt.offsetHeight || 220) - 12);
    tt.style.left = `${left}px`;
    tt.style.bottom = `${Math.max(8, bottomPx)}px`;
    tt.setAttribute('data-visible', '1');
  };

  pill.onmouseleave = () => {
    document.getElementById('ag-live-metrics-tooltip')?.removeAttribute('data-visible');
  };
}

function createMetricsPillElement(): HTMLElement {
  const pill = document.createElement('div');
  pill.id = 'ag-live-metrics-pill';
  pill.setAttribute('data-v', '4');
  pill.setAttribute('data-ag-row-mode', 'middle');
  pill.setAttribute('title', '点击展开 / 折叠 Aura Dashboard 侧边栏');
  pill.innerHTML = '<span id="ag-live-metrics-text"></span>';
  bindMetricsPillHandlers(pill);
  return pill;
}

export function initMetricsCapsule(enabled: boolean, selectors: SelectorsConfig): (forceLayout?: boolean) => HTMLElement | null {
  agGlobal.__ag_metrics_config = { enabled, selectors };

  // Rebind existing DOM pill on hot re-injection so click never stays attached to a stale closure.
  const existingPill = document.getElementById('ag-live-metrics-pill');
  if (existingPill) {
    bindMetricsPillHandlers(existingPill);
  }

  // 清除旧版遗留 ResizeObserver（纯 Flexbox 弹性省略已替代 JS 宽度重测）
  if (agGlobal.__ag_pill_resize_observer) {
    try {
      agGlobal.__ag_pill_resize_observer.disconnect();
    } catch {}
    agGlobal.__ag_pill_resize_observer = null;
  }
  if (agGlobal.__ag_metrics_ro) {
    try {
      agGlobal.__ag_metrics_ro.disconnect();
    } catch {}
    agGlobal.__ag_metrics_ro = null;
  }

  const ensureMetricsPill = (forceLayout = false): HTMLElement | null => {
    const cfg = agGlobal.__ag_metrics_config;
    if (!cfg || !cfg.enabled) {
      const existing = document.getElementById('ag-live-metrics-pill');
      if (existing) existing.style.display = 'none';
      document.getElementById('ag-live-metrics-tooltip')?.removeAttribute('data-visible');
      return null;
    }

    const box = document.getElementById(cfg.selectors.inputBoxId);
    if (!box) return null;
    const bottomRow = findFooterRow(box);
    const leftGroup = bottomRow?.children[0];
    if (!bottomRow || !(leftGroup instanceof HTMLElement)) return null;

    let pill = document.getElementById('ag-live-metrics-pill');
    if (!pill) {
      pill = createMetricsPillElement();
      leftGroup.appendChild(pill);
      return pill;
    }

    bindMetricsPillHandlers(pill);
    pill.setAttribute('data-ag-row-mode', 'middle');
    if (bottomRow.getAttribute('data-ag-row-mode') !== 'middle') {
      bottomRow.setAttribute('data-ag-row-mode', 'middle');
    }
    if (forceLayout || pill.parentElement !== leftGroup) {
      if (pill.parentElement !== leftGroup) {
        leftGroup.appendChild(pill);
      }
    }
    return pill;
  };

  agGlobal.__ag_ensure_metrics_pill_fn = ensureMetricsPill;

  agGlobal.__ag_render_metrics = (payload: LiveMetricsPayload | null) => {
    try {
      const cfg = agGlobal.__ag_metrics_config;
      if (!cfg?.enabled) return;
      agGlobal.__ag_last_metrics = payload;
      const currentId = extractCascadeId();
      const pill = ensureMetricsPill(false);
      const ttEl = ensureMetricsTooltip();
      if (!pill) return;

      if (!currentId || !payload || !payload.hasData || payload.cascadeId !== currentId) {
        if (pill.style.display !== 'none') pill.style.display = 'none';
        ttEl?.removeAttribute('data-visible');
        return;
      }

      const textEl = pill.querySelector('#ag-live-metrics-text');
      let changed = false;
      if (textEl && typeof payload.inlineHtml === 'string' && textEl.innerHTML !== payload.inlineHtml) {
        textEl.innerHTML = payload.inlineHtml;
        changed = true;
      }
      if (ttEl && typeof payload.tooltipHtml === 'string' && ttEl.innerHTML !== payload.tooltipHtml) {
        ttEl.innerHTML = payload.tooltipHtml;
      }
      if (pill.style.display !== 'inline-flex') {
        pill.style.display = 'inline-flex';
        changed = true;
      }
      if (changed) {
        ensureMetricsPill(true);
      }
    } catch {
      // Avoid breaking host frame
    }
  };

  const checkRouteAndMountMetrics = () => {
    try {
      if (document.hidden) return;
      const cfg = agGlobal.__ag_metrics_config;
      if (!cfg) return;

      const box = document.getElementById(cfg.selectors.inputBoxId);
      const hasBranchPillInBox = Boolean(box?.querySelector(cfg.selectors.branchPillInBox));
      const isHome =
        hasBranchPillInBox ||
        Boolean(document.querySelector(cfg.selectors.homeGreeting)) ||
        window.location.pathname === '/' ||
        !window.location.pathname.startsWith('/c/');
      const pageType = isHome ? 'home' : 'chat';
      if (document.documentElement.getAttribute('data-ag-page-type') !== pageType) {
        document.documentElement.setAttribute('data-ag-page-type', pageType);
      }

      if (!cfg.enabled) {
        const existing = document.getElementById('ag-live-metrics-pill');
        if (existing) existing.style.display = 'none';
        return;
      }

      const cid = extractCascadeId();
      if (!cid) {
        agGlobal.__ag_watched_cascade_id = '';
        const pill = document.getElementById('ag-live-metrics-pill');
        if (pill && pill.style.display !== 'none') pill.style.display = 'none';
        document.getElementById('ag-live-metrics-tooltip')?.removeAttribute('data-visible');
        return;
      }

      if (cid !== agGlobal.__ag_watched_cascade_id) {
        agGlobal.__ag_watched_cascade_id = cid;
        const pill = document.getElementById('ag-live-metrics-pill');
        if (pill && (!agGlobal.__ag_last_metrics || agGlobal.__ag_last_metrics.cascadeId !== cid)) {
          pill.style.display = 'none';
        }
        try {
          agGlobal.__agRequestMetrics?.(cid);
        } catch {}
        try {
          agGlobal.__ag_on_session_change?.(cid);
        } catch {}
      } else if (agGlobal.__ag_last_metrics && agGlobal.__ag_last_metrics.cascadeId === cid) {
        const pill = ensureMetricsPill(false);
        if (pill && agGlobal.__ag_last_metrics.hasData && pill.style.display === 'none') {
          agGlobal.__ag_render_metrics?.(agGlobal.__ag_last_metrics);
        }
      }
    } catch {
      // Safe no-op on transient DOM states
    }
  };

  if (!agGlobal.__ag_history_hook_installed) {
    agGlobal.__ag_history_hook_installed = true;
    const triggerRouteCheck = () => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          agGlobal.__ag_check_route_fn?.();
        }, 0);
      });
      setTimeout(() => {
        agGlobal.__ag_check_route_fn?.();
      }, 120);
    };

    const wrapHistory = (method: 'pushState' | 'replaceState') => {
      const orig = history[method];
      if (typeof orig !== 'function') return;
      history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        const ret = orig.apply(this, args);
        triggerRouteCheck();
        return ret;
      };
    };

    wrapHistory('pushState');
    wrapHistory('replaceState');
    window.addEventListener('popstate', triggerRouteCheck);
    window.addEventListener('focus', () => {
      if (document.hidden) return;
      const cid = extractCascadeId();
      if (cid) {
        try {
          agGlobal.__ag_on_session_change?.(cid);
        } catch {}
      }
      agGlobal.__ag_check_route_fn?.();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const cid = extractCascadeId();
        if (cid) {
          try {
            agGlobal.__ag_on_session_change?.(cid);
          } catch {}
        }
        agGlobal.__ag_check_route_fn?.();
      }
    });
  }

  agGlobal.__ag_check_route_fn = checkRouteAndMountMetrics;

  if (agGlobal.__ag_metrics_route_watcher) {
    clearInterval(agGlobal.__ag_metrics_route_watcher);
    agGlobal.__ag_metrics_route_watcher = null;
  }
  agGlobal.__ag_metrics_route_watcher = setInterval(checkRouteAndMountMetrics, 1500);
  checkRouteAndMountMetrics();

  return ensureMetricsPill;
}
