import { LOCALES, type LocalePackage } from './locales';
import { agGlobal } from './types';

const RE_HAS_CJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
const RE_PURE_ALPHA = /^\s*[a-zA-Z]+\s*$/;
const RE_HAS_ALPHA = /[a-zA-Z]/;

let hostReverseLookupMap: Map<string, string> | null = null;

function getHostReverseLookupMap(): Map<string, string> {
  if (hostReverseLookupMap) return hostReverseLookupMap;
  hostReverseLookupMap = new Map();
  for (const pkg of Object.values(LOCALES)) {
    for (const [enKey, translation] of Object.entries(pkg.translations)) {
      if (translation && typeof translation === 'string') {
        const transTrim = translation.trim();
        if (transTrim && !hostReverseLookupMap.has(transTrim)) {
          hostReverseLookupMap.set(transTrim, enKey);
        }
      }
    }
  }
  return hostReverseLookupMap;
}

interface TextNodeRecord {
  origRaw: string;
  lastVal: string;
  ver: string;
  lang?: string;
}

function getOrigTextMap(): WeakMap<Text, TextNodeRecord> {
  if (!agGlobal.__ag_orig_text_map) {
    agGlobal.__ag_orig_text_map = new WeakMap<Text, TextNodeRecord>();
  }
  return agGlobal.__ag_orig_text_map as WeakMap<Text, TextNodeRecord>;
}

function restoreAriaLabels(root: Element | null = document.body || document.documentElement): void {
  if (!root) return;
  try {
    const attrEls = root.querySelectorAll('[data-ag-orig-aria-label]');
    for (let i = 0; i < attrEls.length; i++) {
      const el = attrEls[i];
      const origAria = el.getAttribute('data-ag-orig-aria-label');
      if (origAria !== null) {
        el.setAttribute('aria-label', origAria);
      }
      el.removeAttribute('data-ag-orig-aria-label');
      el.removeAttribute('data-ag-orig-aria-label-last');
      el.removeAttribute('data-ag-role');
    }
  } catch {}
}

export function restoreAllTranslations(root: Element | null = document.body): void {
  if (!root) return;
  restoreAriaLabels(root);
  const origTextMap = getOrigTextMap();
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const rec = origTextMap.get(node);
      if (rec) {
        if (node.nodeValue !== rec.origRaw) {
          node.nodeValue = rec.origRaw;
        }
        rec.lastVal = rec.origRaw;
      }
    }
    const attrEls = root.querySelectorAll(
      '[data-ag-orig-title], [data-ag-orig-placeholder], [data-ag-orig-aria-label]'
    );
    for (let i = 0; i < attrEls.length; i++) {
      const el = attrEls[i];
      const origTitle = el.getAttribute('data-ag-orig-title');
      if (origTitle !== null) {
        el.setAttribute('title', origTitle);
        el.setAttribute('data-ag-orig-title-last', origTitle);
      }
      const origPlaceholder = el.getAttribute('data-ag-orig-placeholder');
      if (origPlaceholder !== null) {
        el.setAttribute('placeholder', origPlaceholder);
        el.setAttribute('data-ag-orig-placeholder-last', origPlaceholder);
      }
      const origAria = el.getAttribute('data-ag-orig-aria-label');
      if (origAria !== null) {
        el.setAttribute('aria-label', origAria);
        el.setAttribute('data-ag-orig-aria-label-last', origAria);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

export function initI18n(
  enabled: boolean,
  pkg: LocalePackage | null,
  userOverrideDict: Record<string, string>,
  excludeSelector: string,
  patchVersion: string
): Record<string, string> {
  if (agGlobal.__ag_i18n_cleanup) {
    try {
      agGlobal.__ag_i18n_cleanup();
    } catch {}
    agGlobal.__ag_i18n_cleanup = null;
  }
  if (agGlobal.__ag_i18n_observer) {
    try {
      agGlobal.__ag_i18n_observer.disconnect();
    } catch {}
    agGlobal.__ag_i18n_observer = null;
  }

  // 架构级净化：彻底还原可能残留在宿主 DOM 中的 aria-label，严禁任何形式的无障碍定位属性篡改
  restoreAriaLabels(document.body || document.documentElement);

  const baseDict = pkg ? pkg.translations : {};
  const dict = Object.assign(Object.create(null) as Record<string, string>, baseDict, userOverrideDict || {});
  agGlobal.__ag_i18n_dict = dict;

  const hasTranslations = Object.keys(dict).length > 0 || Boolean(pkg?.patterns?.length);
  if (!enabled || !hasTranslations) {
    restoreAllTranslations(document.body);
    return dict;
  }

  const origTextMap = getOrigTextMap();

  function isExcludedElement(el: Element | null): boolean {
    if (!el || el.nodeType !== 1) return true;
    return Boolean(el.closest(excludeSelector));
  }

  function computeTextTranslation(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let replacement = dict[trimmed];
    if (typeof replacement !== 'string' && trimmed.endsWith('.')) {
      const withoutDot = dict[trimmed.slice(0, -1)];
      if (typeof withoutDot === 'string') {
        const period = pkg?.code === 'ko-KR' ? '.' : '。';
        replacement =
          withoutDot.endsWith(period) || withoutDot.endsWith('.') || withoutDot.endsWith('。')
            ? withoutDot
            : `${withoutDot}${period}`;
      }
    }
    if (typeof replacement === 'string') {
      if (RE_HAS_CJK.test(replacement) && RE_PURE_ALPHA.test(raw)) {
        return replacement;
      }
      return raw.replace(trimmed, replacement);
    }

    if (!RE_HAS_ALPHA.test(trimmed)) return null;

    if (pkg?.patterns && pkg.patterns.length > 0) {
      for (let i = 0; i < pkg.patterns.length; i++) {
        const rule = pkg.patterns[i];
        if (rule.pattern.test(trimmed)) {
          return raw.replace(rule.pattern, rule.replace as any);
        }
      }
    }

    return null;
  }

  const currentLangCode = pkg?.code || 'default';

  function translateTextNode(node: Text): void {
    const currentVal = node.nodeValue;
    if (!currentVal) return;

    const rec = origTextMap.get(node);
    if (
      rec &&
      rec.lastVal === currentVal &&
      rec.ver === patchVersion &&
      rec.lang === currentLangCode
    ) {
      return;
    }
    // 根源防竞态：只要 rec 存在，origRaw 永久以记录的英文原文为准；首次捕获时支持反向溯源英文原文
    let origRaw = currentVal;
    if (rec) {
      origRaw = rec.origRaw;
    } else {
      const trimmed = currentVal.trim();
      const rev = getHostReverseLookupMap().get(trimmed);
      if (rev) {
        origRaw = currentVal.replace(trimmed, rev);
      }
    }

    const nextVal = computeTextTranslation(origRaw);
    if (nextVal !== null) {
      origTextMap.set(node, {
        origRaw,
        lastVal: nextVal,
        ver: patchVersion,
        lang: currentLangCode
      });
      if (node.nodeValue !== nextVal) {
        node.nodeValue = nextVal;
      }
    } else if (rec) {
      if (node.nodeValue !== origRaw) {
        node.nodeValue = origRaw;
      }
      rec.lastVal = origRaw;
      rec.ver = patchVersion;
      rec.lang = currentLangCode;
    }
  }

  function translateSingleAttr(
    el: Element,
    attrName: string,
    origDataAttr: string,
    customResolver: ((trimmed: string) => string | null) | null
  ): void {
    const cur = el.getAttribute(attrName);
    if (!cur) return;
    const savedOrig = el.getAttribute(origDataAttr);
    let origVal = savedOrig !== null ? savedOrig : cur;
    if (savedOrig === null) {
      const trimmedCur = cur.trim();
      const rev = getHostReverseLookupMap().get(trimmedCur);
      if (rev) {
        origVal = cur.replace(trimmedCur, rev);
      }
    }
    const trimmed = origVal.trim();
    const nextVal = customResolver
      ? customResolver(trimmed)
      : typeof dict[trimmed] === 'string'
        ? dict[trimmed]
        : null;
    if (typeof nextVal === 'string') {
      if (savedOrig === null) {
        el.setAttribute(origDataAttr, origVal);
      }
      el.setAttribute(`${origDataAttr}-last`, nextVal);
      if (cur !== nextVal) {
        el.setAttribute(attrName, nextVal);
      }
    } else if (savedOrig !== null) {
      if (cur !== savedOrig) {
        el.setAttribute(attrName, savedOrig);
      }
      el.setAttribute(`${origDataAttr}-last`, savedOrig);
    }
  }

  function translateElementAttrs(el: Element): void {
    translateSingleAttr(el, 'title', 'data-ag-orig-title', null);
    translateSingleAttr(el, 'placeholder', 'data-ag-orig-placeholder', null);
  }

  const walkerFilter: NodeFilter = {
    acceptNode(node: Node): number {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.matches(excludeSelector)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (el.hasAttribute('title') || el.hasAttribute('placeholder')) {
          translateElementAttrs(el);
        }
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  };

  function scanAndTranslate(root: Node | null = document.body || document.documentElement): void {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      const txt = root as Text;
      if (txt.parentElement && !isExcludedElement(txt.parentElement)) {
        translateTextNode(txt);
      }
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const rootEl = root as Element;
    if (isExcludedElement(rootEl)) return;

    // 显式批量刷新所有已知被翻译过或含有待翻译属性的元素，确保无层级遗漏
    try {
      const attrEls = rootEl.querySelectorAll(
        '[title], [placeholder], [data-ag-orig-title], [data-ag-orig-placeholder]'
      );
      for (let i = 0; i < attrEls.length; i++) {
        const el = attrEls[i];
        if (!isExcludedElement(el)) {
          translateElementAttrs(el);
        }
      }
    } catch {}

    if (
      rootEl.hasAttribute('title') ||
      rootEl.hasAttribute('placeholder')
    ) {
      translateElementAttrs(rootEl);
    }

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, walkerFilter);
    while (walker.nextNode()) {
      translateTextNode(walker.currentNode as Text);
    }
  }

  scanAndTranslate(document.body || document.documentElement);

  const dirtyRoots = new Set<Node>();
  let pending = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  let rafId: number | null = null;

  function flushTranslations(): void {
    pending = false;
    rafId = null;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (dirtyRoots.size === 0) return;

    if (dirtyRoots.size > 200) {
      dirtyRoots.clear();
      try {
        scanAndTranslate(document.body);
      } catch {}
      return;
    }

    const roots = Array.from(dirtyRoots);
    const rootSet = new Set(roots);
    dirtyRoots.clear();

    for (const r of roots) {
      if (!r || !r.isConnected) continue;
      let covered = false;
      for (let p = r.parentNode; p; p = p.parentNode) {
        if (rootSet.has(p)) {
          covered = true;
          break;
        }
      }
      if (!covered) {
        try {
          scanAndTranslate(r);
        } catch {}
      }
    }
  }

  function scheduleFlush(): void {
    if (pending) return;
    pending = true;
    rafId = requestAnimationFrame(flushTranslations);
    fallbackTimer = setTimeout(flushTranslations, 80);
  }

  agGlobal.__ag_i18n_cleanup = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    dirtyRoots.clear();
    pending = false;
  };

  agGlobal.__ag_i18n_observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') {
        const t = m.target as Text;
        if (t.parentElement && !isExcludedElement(t.parentElement)) {
          dirtyRoots.add(t);
        }
      } else if (m.type === 'attributes') {
        const el = m.target;
        if (el instanceof Element && !isExcludedElement(el)) {
          try {
            translateElementAttrs(el);
          } catch {}
        }
      } else if (m.type === 'childList' && m.addedNodes.length > 0) {
        if (m.target instanceof Element && isExcludedElement(m.target)) {
          continue;
        }
        for (let j = 0; j < m.addedNodes.length; j++) {
          const n = m.addedNodes[j];
          if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
            dirtyRoots.add(n);
          }
        }
      }
    }
    if (dirtyRoots.size > 0) {
      scheduleFlush();
    }
  });

  const targetNode = document.body || document.documentElement;
  if (targetNode) {
    agGlobal.__ag_i18n_observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'placeholder']
    });
  }

  return dict;
}
