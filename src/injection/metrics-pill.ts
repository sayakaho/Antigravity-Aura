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

export function toggleAuraSidecar(): void {
  try {
    const toggleBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Toggle Side Panel"]');
    const auxTabs = Array.from(document.querySelectorAll<HTMLElement>('.agy-aux-tab, button.agy-aux-tab'));
    const auraTab = auxTabs.find(
      (t) =>
        t.getAttribute('data-tab-id')?.includes('aura-dashboard') ||
        t.innerText.includes('Aura Dashboard') ||
        t.getAttribute('title')?.includes('Aura Dashboard')
    );
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[src*="aura-dashboard"]');
    const sidePanel = document.querySelector<HTMLElement>(
      '[class*="aux-pane"], [class*="side-panel"], aside, [class*="auxiliary"]'
    );
    const isPanelOpen =
      Boolean(sidePanel && sidePanel.offsetWidth > 0) ||
      Boolean(iframe && iframe.offsetParent !== null && iframe.offsetWidth > 0);

    if (isPanelOpen) {
      const isAuraActive = Boolean(
        auraTab &&
          (auraTab.classList.contains('bg-secondary') ||
            auraTab.getAttribute('aria-selected') === 'true' ||
            (iframe && iframe.offsetParent !== null))
      );
      if (isAuraActive) {
        toggleBtn?.click();
      } else if (auraTab) {
        auraTab.click();
      } else {
        toggleBtn?.click();
      }
    } else {
      toggleBtn?.click();
      auraTab?.click();
    }
  } catch {
    // Non-fatal UI toggle failure
  }
}

function createMetricsPillElement(): HTMLElement {
  const pill = document.createElement('div');
  pill.id = 'ag-live-metrics-pill';
  pill.setAttribute('data-v', '4');
  pill.setAttribute('data-ag-row-mode', 'middle');
  pill.setAttribute('title', '点击展开 / 折叠 Aura Dashboard 侧边栏');
  pill.innerHTML = '<span id="ag-live-metrics-text"></span>';

  pill.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    document.getElementById('ag-live-metrics-tooltip')?.removeAttribute('data-visible');
    toggleAuraSidecar();
  };

  pill.addEventListener('mouseenter', () => {
    const tt = ensureMetricsTooltip();
    if (!tt || !tt.innerHTML) return;
    const r = pill.getBoundingClientRect();
    const ttWidth = Math.min(440, Math.max(370, tt.offsetWidth || 400));
    const left = Math.max(12, Math.min(r.left, window.innerWidth - ttWidth - 16));
    const bottomPx = Math.min(window.innerHeight - r.top + 8, window.innerHeight - (tt.offsetHeight || 220) - 12);
    tt.style.left = `${left}px`;
    tt.style.bottom = `${Math.max(8, bottomPx)}px`;
    tt.setAttribute('data-visible', '1');
  });

  pill.addEventListener('mouseleave', () => {
    document.getElementById('ag-live-metrics-tooltip')?.removeAttribute('data-visible');
  });

  return pill;
}

export function initMetricsCapsule(enabled: boolean, selectors: SelectorsConfig): (forceLayout?: boolean) => HTMLElement | null {
  agGlobal.__ag_metrics_config = { enabled, selectors };

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
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
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
