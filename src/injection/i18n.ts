import type { LocalePackage } from './locales';
import { agGlobal } from './types';

const RE_HAS_CJK = /[\u4e00-\u9fa5]/;
const RE_PURE_ALPHA = /^\s*[a-zA-Z]+\s*$/;
const RE_HAS_ALPHA = /[a-zA-Z]/;

function getOrigTextMap() {
  if (!agGlobal.__ag_orig_text_map) {
    agGlobal.__ag_orig_text_map = new WeakMap();
  }
  return agGlobal.__ag_orig_text_map;
}

export function restoreAllTranslations(root: Element | null = document.body): void {
  if (!root) return;
  const origTextMap = getOrigTextMap();
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const rec = origTextMap.get(node);
      if (rec && node.nodeValue === rec.lastVal) {
        node.nodeValue = rec.origRaw;
        origTextMap.delete(node);
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
        el.removeAttribute('data-ag-orig-title');
        el.removeAttribute('data-ag-orig-title-last');
      }
      const origPlaceholder = el.getAttribute('data-ag-orig-placeholder');
      if (origPlaceholder !== null) {
        el.setAttribute('placeholder', origPlaceholder);
        el.removeAttribute('data-ag-orig-placeholder');
        el.removeAttribute('data-ag-orig-placeholder-last');
      }
      const origAria = el.getAttribute('data-ag-orig-aria-label');
      if (origAria !== null) {
        el.setAttribute('aria-label', origAria);
        el.removeAttribute('data-ag-orig-aria-label');
        el.removeAttribute('data-ag-orig-aria-label-last');
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
  if (agGlobal.__ag_i18n_observer) {
    try {
      agGlobal.__ag_i18n_observer.disconnect();
    } catch {}
    agGlobal.__ag_i18n_observer = null;
  }

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
        replacement = withoutDot.endsWith('。') ? withoutDot : `${withoutDot}。`;
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

  function translateTextNode(node: Text): void {
    const currentVal = node.nodeValue;
    if (!currentVal) return;

    const rec = origTextMap.get(node);
    if (rec && rec.lastVal === currentVal && rec.ver === patchVersion) {
      return;
    }
    const origRaw = rec && rec.lastVal === currentVal ? rec.origRaw : currentVal;

    const nextVal = computeTextTranslation(origRaw);
    if (nextVal !== null) {
      origTextMap.set(node, { origRaw, lastVal: nextVal, ver: patchVersion });
      if (node.nodeValue !== nextVal) {
        node.nodeValue = nextVal;
      }
    } else if (rec && rec.lastVal === currentVal) {
      node.nodeValue = origRaw;
      origTextMap.delete(node);
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
    const savedLast = el.getAttribute(`${origDataAttr}-last`);
    const origVal = savedOrig && savedLast === cur ? savedOrig : cur;
    const trimmed = origVal.trim();
    const nextVal = customResolver
      ? customResolver(trimmed)
      : typeof dict[trimmed] === 'string'
        ? dict[trimmed]
        : null;
    if (typeof nextVal === 'string') {
      el.setAttribute(origDataAttr, origVal);
      el.setAttribute(`${origDataAttr}-last`, nextVal);
      if (cur !== nextVal) {
        el.setAttribute(attrName, nextVal);
      }
    } else if (savedOrig && savedLast === cur) {
      el.setAttribute(attrName, savedOrig);
      el.removeAttribute(origDataAttr);
      el.removeAttribute(`${origDataAttr}-last`);
    }
  }

  function translateElementAttrs(el: Element): void {
    translateSingleAttr(el, 'title', 'data-ag-orig-title', null);
    translateSingleAttr(el, 'placeholder', 'data-ag-orig-placeholder', null);
    translateSingleAttr(el, 'aria-label', 'data-ag-orig-aria-label', (atrim) => {
      if (typeof dict[atrim] === 'string') return dict[atrim];
      if (pkg?.attributePatterns) {
        for (let i = 0; i < pkg.attributePatterns.length; i++) {
          const rule = pkg.attributePatterns[i];
          if (rule.pattern.test(atrim)) {
            return atrim.replace(rule.pattern, rule.replace as any);
          }
        }
      }
      return null;
    });
  }

  const walkerFilter: NodeFilter = {
    acceptNode(node: Node): number {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.matches(excludeSelector)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (el.hasAttribute('title') || el.hasAttribute('aria-label') || el.hasAttribute('placeholder')) {
          translateElementAttrs(el);
        }
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  };

  function scanAndTranslate(root: Node | null = document.body): void {
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

    if (
      rootEl.hasAttribute('title') ||
      rootEl.hasAttribute('aria-label') ||
      rootEl.hasAttribute('placeholder')
    ) {
      translateElementAttrs(rootEl);
    }

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, walkerFilter);
    while (walker.nextNode()) {
      translateTextNode(walker.currentNode as Text);
    }
  }

  scanAndTranslate(document.body);

  const dirtyRoots = new Set<Node>();
  let pending = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  function flushTranslations(): void {
    pending = false;
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
    requestAnimationFrame(flushTranslations);
    fallbackTimer = setTimeout(flushTranslations, 80);
  }

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
      attributeFilter: ['title', 'aria-label', 'placeholder']
    });
  }

  return dict;
}
