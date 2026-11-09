import { agGlobal } from './types';

const RE_HAS_CJK = /[\u4e00-\u9fa5]/;
const RE_PURE_ALPHA = /^\s*[a-zA-Z]+\s*$/;
const RE_HAS_ALPHA = /[a-zA-Z]/;
const RE_FILES_CHANGED = /^(\d+)\s+files?\s+changed$/i;
const RE_TOOLS = /^(\d+)\s+tools?$/i;
const RE_DEMOTED = /^(\d+)\s+demoted$/i;
const RE_EXCLUDED = /^(\d+)\s+excluded$/i;
const RE_TOOLS_EXCLUDED = /^(\d+)\s+tools?\s+excluded$/i;
const RE_ACTIVE_CONVS = /^(\d+)\s+active\s+conversations$/i;
const RE_SEE_ALL = /^See all\s*\((\d+)\)$/i;
const RE_SHOW_BREAKDOWNS = /^Show\s+(\d+)\s+breakdowns?$/i;
const RE_PERM_DELETE = /^Permanently delete\s+(.*)\s+including\s+(\d+)\s+active\s+conversations\.?$/i;
const RE_WORKED_FOR = /^Worked for\s+(\d+[smhd])$/i;
const RE_THOUGHT_FOR = /^Thought for\s+(\d+[smhd])$/i;
const RE_USED_LIMIT =
  /^You have used (some|all|most) of your (weekly|5-hour|five-hour|daily) limit,?\s*it will fully refresh in (.*)\.?$/i;
const RE_NOT_USED_LIMIT = /^You have not used any of your (weekly|5-hour|five-hour|daily) limit\.?$/i;
const RE_ARIA_BRANCH = /^Branch, current:\s*(.*)$/i;
const RE_ARIA_PROJECT = /^Select project, current:\s*(.*)$/i;

const DEGREE_MAP: Record<string, string> = { some: '部分', all: '全部', most: '大部分' };
const LIMIT_TYPE_MAP: Record<string, string> = {
  weekly: '每周',
  '5-hour': '5 小时',
  'five-hour': '5 小时',
  daily: '每日'
};

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
  rawDict: Record<string, string>,
  excludeSelector: string,
  patchVersion: string
): Record<string, string> {
  if (agGlobal.__ag_i18n_observer) {
    try {
      agGlobal.__ag_i18n_observer.disconnect();
    } catch {}
    agGlobal.__ag_i18n_observer = null;
  }

  const dict = Object.assign(Object.create(null) as Record<string, string>, rawDict || {});
  agGlobal.__ag_i18n_dict = dict;

  if (!enabled) {
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

    const c0 = trimmed.charCodeAt(0);
    if (c0 >= 48 && c0 <= 57) {
      if (RE_FILES_CHANGED.test(trimmed)) return raw.replace(RE_FILES_CHANGED, '$1 个文件变更');
      if (RE_TOOLS.test(trimmed)) return raw.replace(RE_TOOLS, '$1 个工具');
      if (RE_DEMOTED.test(trimmed)) return raw.replace(RE_DEMOTED, '$1 项已降级');
      if (RE_EXCLUDED.test(trimmed)) return raw.replace(RE_EXCLUDED, '$1 项已排除');
      if (RE_TOOLS_EXCLUDED.test(trimmed)) return raw.replace(RE_TOOLS_EXCLUDED, '$1 个工具已排除');
      if (RE_ACTIVE_CONVS.test(trimmed)) return raw.replace(RE_ACTIVE_CONVS, '$1 个进行中的会话');
      return null;
    }

    const firstUpper = trimmed[0].toUpperCase();
    if (firstUpper === 'S') {
      if (RE_SEE_ALL.test(trimmed)) return raw.replace(RE_SEE_ALL, '查看全部 ($1)');
      if (RE_SHOW_BREAKDOWNS.test(trimmed)) return raw.replace(RE_SHOW_BREAKDOWNS, '展开明细 ($1 项)');
    } else if (firstUpper === 'P') {
      if (RE_PERM_DELETE.test(trimmed)) {
        return raw.replace(RE_PERM_DELETE, '永久删除 $1 及 $2 个进行中的会话。');
      }
    } else if (firstUpper === 'W') {
      if (RE_WORKED_FOR.test(trimmed)) return raw.replace(RE_WORKED_FOR, '已工作 $1');
    } else if (firstUpper === 'T') {
      if (RE_THOUGHT_FOR.test(trimmed)) return raw.replace(RE_THOUGHT_FOR, '已思考 $1');
    } else if (firstUpper === 'Y') {
      const mUsed = trimmed.match(RE_USED_LIMIT);
      if (mUsed) {
        const degree = DEGREE_MAP[mUsed[1].toLowerCase()] || mUsed[1];
        const limitType = LIMIT_TYPE_MAP[mUsed[2].toLowerCase()] || mUsed[2];
        const timeStr = mUsed[3]
          .replace(/\.$/, '')
          .replace(/(\d+)\s*days?/gi, '$1 天')
          .replace(/(\d+)\s*hours?/gi, '$1 小时')
          .replace(/(\d+)\s*minutes?/gi, '$1 分钟')
          .replace(/(\d+)\s*seconds?/gi, '$1 秒')
          .replace(/,\s*/g, ' ')
          .trim();
        return `您已消耗${degree}${limitType}额度，将在 ${timeStr} 后完全重置。`;
      }
      const mNotUsed = trimmed.match(RE_NOT_USED_LIMIT);
      if (mNotUsed) {
        const limitType = LIMIT_TYPE_MAP[mNotUsed[1].toLowerCase()] || mNotUsed[1];
        return `您尚未消耗任何${limitType}额度。`;
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
      const mBranch = atrim.match(RE_ARIA_BRANCH);
      if (mBranch) {
        const bName = mBranch[1].trim();
        return `分支，当前：${bName === 'Select branch' ? '选择分支' : bName}`;
      }
      const mProj = atrim.match(RE_ARIA_PROJECT);
      if (mProj) {
        const pName = mProj[1].trim();
        return `选择项目，当前：${pName === 'No project' ? '未关联项目' : pName}`;
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
