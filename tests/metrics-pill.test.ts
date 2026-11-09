import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

class MockClassList {
  private readonly items: Set<string>;
  constructor(initial: string[] = []) {
    this.items = new Set(initial.filter(Boolean));
  }
  add(...tokens: string[]): void {
    for (const t of tokens) this.items.add(t);
  }
  remove(...tokens: string[]): void {
    for (const t of tokens) this.items.delete(t);
  }
  contains(token: string): boolean {
    return this.items.has(token);
  }
}

interface MockElementInit {
  id?: string;
  tagName?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  textContent?: string;
  offsetWidth?: number;
  offsetHeight?: number;
  offsetParent?: unknown;
  closestAside?: boolean;
  onClick?: () => void;
}

class MockElement {
  public id: string;
  public readonly tagName: string;
  public readonly classList: MockClassList;
  public readonly style: Record<string, string> = {};
  public textContent: string;
  public innerText: string;
  public offsetWidth: number;
  public offsetHeight: number;
  public offsetParent: unknown;
  public clicks = 0;
  public onclick: ((e: { stopPropagation: () => void }) => void) | null = null;
  public onmouseenter: (() => void) | null = null;
  public onmouseleave: (() => void) | null = null;
  private readonly attrs: Map<string, string>;
  private readonly closestAside: boolean;
  private readonly onClickHandler?: () => void;

  constructor(init: MockElementInit = {}) {
    this.id = init.id ?? '';
    this.tagName = (init.tagName ?? 'DIV').toUpperCase();
    this.classList = new MockClassList(init.classes);
    this.attrs = new Map(Object.entries(init.attrs ?? {}));
    this.textContent = init.textContent ?? '';
    this.innerText = this.textContent;
    this.offsetWidth = init.offsetWidth ?? 0;
    this.offsetHeight = init.offsetHeight ?? 0;
    this.offsetParent = init.offsetParent !== undefined ? init.offsetParent : {};
    this.closestAside = init.closestAside ?? false;
    this.onClickHandler = init.onClick;
  }

  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  closest(selector: string): MockElement | null {
    if (selector === 'aside' && this.closestAside) {
      return this;
    }
    return null;
  }

  click(): void {
    this.clicks += 1;
    this.onClickHandler?.();
    this.onclick?.({ stopPropagation: () => {} });
  }

  matchesSingle(singleSelector: string): boolean {
    let rest = singleSelector.trim();
    if (!rest) return false;

    const attrMatches: Array<{ name: string; op?: string; val?: string }> = [];
    rest = rest.replace(/\[([^\]=]+)(?:([*]?=)"([^"]*)")?\]/g, (_m, name: string, op?: string, val?: string) => {
      attrMatches.push({ name: name.trim(), op, val });
      return '';
    });

    const classMatches: string[] = [];
    rest = rest.replace(/\.([a-zA-Z0-9_-]+)/g, (_m, cls: string) => {
      classMatches.push(cls);
      return '';
    });

    const tagMatch = rest.trim().toUpperCase();
    if (tagMatch && this.tagName !== tagMatch) {
      return false;
    }
    for (const cls of classMatches) {
      if (!this.classList.contains(cls)) return false;
    }
    for (const attr of attrMatches) {
      const actual = this.attrs.get(attr.name);
      if (actual === undefined) return false;
      if (attr.op === '=' && actual !== attr.val) return false;
      if (attr.op === '*=' && !actual.includes(attr.val ?? '')) return false;
    }
    return true;
  }
}

class MockDocument {
  public readonly elements: MockElement[];
  public readonly documentElement = new MockElement({ tagName: 'HTML' });
  public hidden = false;

  constructor(elements: MockElement[] = []) {
    this.elements = elements;
  }

  getElementById(id: string): MockElement | null {
    return this.elements.find((el) => el.id === id) ?? null;
  }

  addEventListener(): void {}

  querySelectorAll<T = MockElement>(selector: string): T[] {
    const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
    return this.elements.filter((el) => parts.some((part) => el.matchesSingle(part))) as unknown as T[];
  }

  querySelector<T = MockElement>(selector: string): T | null {
    return this.querySelectorAll<T>(selector)[0] ?? null;
  }
}

describe('toggleAuraSidecar', () => {
  const globals = globalThis as Record<string, unknown>;
  const origWindow = globals.window;
  const origDocument = globals.document;
  const origHistory = globals.history;
  const origRaf = globals.requestAnimationFrame;
  const origCancelRaf = globals.cancelAnimationFrame;

  let mockDoc: MockDocument;
  let replaceStateCalls: string[];
  let popStateEvents: number;
  let rafQueue: Array<{ id: number; cb: () => void; cancelled: boolean }>;
  let nextRafId: number;

  function setupMockEnv(initialUrl = 'https://127.0.0.1:54417/c/11111111-1111-1111-1111-111111111111'): void {
    replaceStateCalls = [];
    popStateEvents = 0;
    rafQueue = [];
    nextRafId = 1;
    mockDoc = new MockDocument();

    const mockLocation = { href: initialUrl, pathname: new URL(initialUrl).pathname, search: new URL(initialUrl).search, hash: '' };
    const mockHistory = {
      state: null as unknown,
      replaceState(state: unknown, _title: string, url: string) {
        mockHistory.state = state;
        const resolved = new URL(url, mockLocation.href);
        mockLocation.href = resolved.href;
        mockLocation.pathname = resolved.pathname;
        mockLocation.search = resolved.search;
        mockLocation.hash = resolved.hash;
        replaceStateCalls.push(url);
      }
    };

    const mockWindow = {
      location: mockLocation,
      history: mockHistory,
      addEventListener: () => {},
      getComputedStyle: () => ({ display: 'flex', visibility: 'visible', position: 'relative' }),
      dispatchEvent(evt: { type?: string }) {
        if (evt?.type === 'popstate') popStateEvents += 1;
        return true;
      }
    };

    globals.window = mockWindow;
    globals.document = mockDoc;
    globals.history = mockHistory;
    globals.requestAnimationFrame = (cb: () => void) => {
      const entry = { id: nextRafId++, cb, cancelled: false };
      rafQueue.push(entry);
      return entry.id;
    };
    globals.cancelAnimationFrame = (id: number) => {
      const entry = rafQueue.find((r) => r.id === id);
      if (entry) entry.cancelled = true;
    };
  }

  function flushRaf(): void {
    const batch = rafQueue.splice(0);
    for (const item of batch) {
      if (!item.cancelled) item.cb();
    }
  }

  beforeEach(() => {
    setupMockEnv();
  });

  afterEach(() => {
    if (origWindow === undefined) delete globals.window;
    else globals.window = origWindow;
    if (origDocument === undefined) delete globals.document;
    else globals.document = origDocument;
    if (origHistory === undefined) delete globals.history;
    else globals.history = origHistory;
    if (origRaf === undefined) delete globals.requestAnimationFrame;
    else globals.requestAnimationFrame = origRaf;
    if (origCancelRaf === undefined) delete globals.cancelAnimationFrame;
    else globals.cancelAnimationFrame = origCancelRaf;
  });

  test('ignores open left <aside> and expands collapsed right pane onto Aura route', async () => {
    const { toggleAuraSidecar } = await import('../src/injection/metrics-pill');

    const leftAside = new MockElement({ tagName: 'aside', offsetWidth: 260, offsetHeight: 900 });
    const collapsedPane = new MockElement({
      attrs: { 'data-aux-pane-open': 'false', 'data-side-panel-open': 'false' }
    });
    const toggleBtn = new MockElement({
      tagName: 'button',
      attrs: { 'data-testid': 'toggle-aux-sidebar', 'aria-expanded': 'false', 'aria-label': 'Toggle Side Panel' },
      offsetWidth: 28,
      offsetHeight: 28,
      onClick: () => {
        collapsedPane.setAttribute('data-aux-pane-open', 'true');
        toggleBtn.setAttribute('aria-expanded', 'true');
      }
    });
    mockDoc.elements.push(leftAside, collapsedPane, toggleBtn);

    toggleAuraSidecar();

    expect(toggleBtn.clicks).toBe(1);
    expect(replaceStateCalls.length).toBe(1);
    expect(replaceStateCalls[0]).toContain('tab=sidecar__aura-dashboard%2Fdashboard__%2F');
    expect(popStateEvents).toBe(1);
  });

  test('finds toggle button via data-ag-orig-aria-label when i18n translated aria-label', async () => {
    const { toggleAuraSidecar } = await import('../src/injection/metrics-pill');

    const openContainer = new MockElement({
      attrs: {
        'data-aux-pane-open': 'true',
        'data-active-tab-id': 'sidecar__aura-dashboard/dashboard__/'
      },
      offsetWidth: 680,
      offsetHeight: 900
    });
    const translatedToggleBtn = new MockElement({
      tagName: 'button',
      attrs: {
        'aria-label': '切换侧边面板',
        'data-ag-orig-aria-label': 'Toggle Side Panel'
      },
      offsetWidth: 28,
      offsetHeight: 28
    });
    mockDoc.elements.push(openContainer, translatedToggleBtn);

    toggleAuraSidecar();

    expect(translatedToggleBtn.clicks).toBe(1);
  });

  test('switches to mounted Aura tab instead of collapsing when another sidecar is active', async () => {
    const { toggleAuraSidecar } = await import('../src/injection/metrics-pill');

    const openContainer = new MockElement({
      attrs: {
        'data-aux-pane-open': 'true',
        'data-active-tab-id': 'sidecar__android-cli-plugin/device-hub__/'
      },
      offsetWidth: 680,
      offsetHeight: 900
    });
    const toggleBtn = new MockElement({
      tagName: 'button',
      attrs: { 'data-testid': 'toggle-aux-sidebar', 'aria-expanded': 'true' },
      offsetWidth: 28,
      offsetHeight: 28
    });
    const auraTab = new MockElement({
      tagName: 'button',
      classes: ['agy-aux-tab'],
      attrs: { 'data-tab-id': 'sidecar__aura-dashboard/dashboard__/', title: 'Aura Dashboard' },
      textContent: 'Aura Dashboard',
      offsetWidth: 140,
      offsetHeight: 28
    });
    mockDoc.elements.push(openContainer, toggleBtn, auraTab);

    toggleAuraSidecar();

    expect(auraTab.clicks).toBe(1);
    expect(toggleBtn.clicks).toBe(0);
  });

  test('routes to Aura via Option A without collapsing panel when another sidecar is active and Aura tab is unmounted', async () => {
    const { toggleAuraSidecar } = await import('../src/injection/metrics-pill');

    const openContainer = new MockElement({
      attrs: {
        'data-aux-pane-open': 'true',
        'data-active-tab-id': 'sidecar__android-cli-plugin/device-hub__/'
      },
      offsetWidth: 680,
      offsetHeight: 900
    });
    const toggleBtn = new MockElement({
      tagName: 'button',
      attrs: { 'data-testid': 'toggle-aux-sidebar', 'aria-expanded': 'true' },
      offsetWidth: 28,
      offsetHeight: 28
    });
    mockDoc.elements.push(openContainer, toggleBtn);

    toggleAuraSidecar();

    expect(toggleBtn.clicks).toBe(0);
    expect(replaceStateCalls.length).toBe(1);
    expect(replaceStateCalls[0]).toContain('tab=sidecar__aura-dashboard%2Fdashboard__%2F');
    expect(popStateEvents).toBe(1);
  });

  test('selects Aura tab asynchronously after panel expands when tab mounts lazily on next frame', async () => {
    const { toggleAuraSidecar } = await import('../src/injection/metrics-pill');

    const paneContainer = new MockElement({
      attrs: { 'data-aux-pane-open': 'false' }
    });
    const auraTab = new MockElement({
      tagName: 'button',
      classes: ['agy-aux-tab'],
      attrs: { 'data-tab-id': 'sidecar__aura-dashboard/dashboard__/' },
      textContent: 'Aura Dashboard',
      offsetWidth: 140,
      offsetHeight: 28
    });
    const toggleBtn = new MockElement({
      tagName: 'button',
      attrs: { 'data-testid': 'toggle-aux-sidebar', 'aria-expanded': 'false' },
      offsetWidth: 28,
      offsetHeight: 28,
      onClick: () => {
        paneContainer.setAttribute('data-aux-pane-open', 'true');
        toggleBtn.setAttribute('aria-expanded', 'true');
        mockDoc.elements.push(auraTab);
      }
    });
    mockDoc.elements.push(paneContainer, toggleBtn);

    toggleAuraSidecar();
    expect(toggleBtn.clicks).toBe(1);
    expect(auraTab.clicks).toBe(0);

    flushRaf();
    expect(auraTab.clicks).toBe(1);
  });

  test('cancels pending tab activation if user toggles closed immediately before next frame', async () => {
    const { toggleAuraSidecar } = await import('../src/injection/metrics-pill');

    const paneContainer = new MockElement({
      attrs: { 'data-aux-pane-open': 'false' }
    });
    const auraTab = new MockElement({
      tagName: 'button',
      classes: ['agy-aux-tab'],
      attrs: { 'data-tab-id': 'sidecar__aura-dashboard/dashboard__/' },
      textContent: 'Aura Dashboard',
      offsetWidth: 140,
      offsetHeight: 28
    });
    const toggleBtn = new MockElement({
      tagName: 'button',
      attrs: { 'data-testid': 'toggle-aux-sidebar', 'aria-expanded': 'false' },
      offsetWidth: 28,
      offsetHeight: 28,
      onClick: () => {
        const nextOpen = paneContainer.getAttribute('data-aux-pane-open') !== 'true';
        paneContainer.setAttribute('data-aux-pane-open', nextOpen ? 'true' : 'false');
        toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        if (nextOpen && !mockDoc.elements.includes(auraTab)) {
          mockDoc.elements.push(auraTab);
        }
      }
    });
    mockDoc.elements.push(paneContainer, toggleBtn);

    // 1st click expands
    toggleAuraSidecar();
    expect(toggleBtn.clicks).toBe(1);
    expect(paneContainer.getAttribute('data-aux-pane-open')).toBe('true');

    // Simulate Aura mounted & active before 2nd rapid click collapses panel
    paneContainer.setAttribute('data-active-tab-id', 'sidecar__aura-dashboard/dashboard__/');
    toggleAuraSidecar();
    expect(toggleBtn.clicks).toBe(2);
    expect(paneContainer.getAttribute('data-aux-pane-open')).toBe('false');

    // Flushing cancelled rAF must not trigger stale auraTab.click()
    flushRaf();
    expect(auraTab.clicks).toBe(0);
  });

  test('rebinds stale onclick closure on existing #ag-live-metrics-pill during hot re-injection', async () => {
    const { normalizeAuraConfig } = await import('../src/shared/config-schema');
    const { initMetricsCapsule } = await import('../src/injection/metrics-pill');
    const { agGlobal } = await import('../src/injection/types');

    let staleCalls = 0;
    const existingPill = new MockElement({
      id: 'ag-live-metrics-pill',
      offsetWidth: 120,
      offsetHeight: 24
    });
    existingPill.onclick = () => {
      staleCalls += 1;
    };

    const openContainer = new MockElement({
      attrs: {
        'data-aux-pane-open': 'true',
        'data-active-tab-id': 'sidecar__android-cli-plugin/device-hub__/'
      },
      offsetWidth: 680,
      offsetHeight: 900
    });
    const auraTab = new MockElement({
      tagName: 'button',
      classes: ['agy-aux-tab'],
      attrs: { 'data-tab-id': 'sidecar__aura-dashboard/dashboard__/' },
      textContent: 'Aura Dashboard',
      offsetWidth: 140,
      offsetHeight: 28
    });
    mockDoc.elements.push(existingPill, openContainer, auraTab);

    try {
      initMetricsCapsule(true, normalizeAuraConfig({}).selectors);
      existingPill.click();

      expect(staleCalls).toBe(0);
      expect(auraTab.clicks).toBe(1);
    } finally {
      if (agGlobal.__ag_metrics_route_watcher) {
        clearInterval(agGlobal.__ag_metrics_route_watcher);
        agGlobal.__ag_metrics_route_watcher = null;
      }
    }
  });
});
