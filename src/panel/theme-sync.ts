/**
 * Aura Dashboard · Native Host Theme Synchronization Engine
 * W3C Relative Luminance Detection + PostMessage Bridge Sync
 */

let hostColorMode: 'dark' | 'light' | null = null;

export function getLuminance(r: number, g: number, b: number): number {
  const f = (n: number) => {
    const o = n / 255;
    return o <= 0.03928 ? o / 12.92 : Math.pow((o + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function parseColor(colorStr: string): { r: number; g: number; b: number; alpha: number } | null {
  if (!colorStr) return null;
  const str = colorStr.trim();
  // 1. Hex 格式 (#RRGGBB 或 #RGB)
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        alpha: 1
      };
    } else if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      };
    }
  }
  // 2. RGB/RGBA 格式
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      alpha: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
  }
  return null;
}

export function parseRgb(colorStr: string): { r: number; g: number; b: number; alpha: number } | null {
  return parseColor(colorStr);
}

export function detectEffectiveTheme(): 'dark' | 'light' {
  if (hostColorMode === 'light' || hostColorMode === 'dark') {
    return hostColorMode;
  }
  const inlineScheme = document.documentElement.style.colorScheme;
  if (inlineScheme === 'light' || inlineScheme === 'dark') {
    return inlineScheme;
  }

  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))';
  (document.body || document.documentElement).appendChild(probe);
  try {
    const computedBg = window.getComputedStyle(probe).backgroundColor;
    const parsed = parseRgb(computedBg);
    if (parsed && parsed.alpha > 0) {
      const lum = getLuminance(parsed.r, parsed.g, parsed.b);
      return lum > 0.179 ? 'light' : 'dark';
    }
  } catch (e) {
  } finally {
    probe.remove();
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function syncTheme(forcedTheme?: 'dark' | 'light'): void {
  const effectiveTheme = forcedTheme || detectEffectiveTheme();
  const html = document.documentElement;
  if (html.getAttribute('data-theme') !== effectiveTheme) {
    html.setAttribute('data-theme', effectiveTheme);
  }
  if (html.style.colorScheme !== effectiveTheme) {
    html.style.colorScheme = effectiveTheme;
  }
}

export function initThemeListener(): void {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'ag-theme-sync') {
      const payload = event.data.payload || {};
      if (payload.scheme === 'light' || payload.scheme === 'dark') {
        hostColorMode = payload.scheme;
        syncTheme(hostColorMode || undefined);
      }
    } else if (event.data?.type === 'theme-change') {
      const payload = event.data?.payload || {};
      // 1. 显式字段优先探测
      if (payload.scheme === 'light' || payload.scheme === 'dark') {
        hostColorMode = payload.scheme;
      } else if (payload.colorScheme === 'light' || payload.colorScheme === 'dark') {
        hostColorMode = payload.colorScheme;
      } else if (typeof payload.isDark === 'boolean') {
        hostColorMode = payload.isDark ? 'dark' : 'light';
      } else {
        // 2. 从宿主背景色变量中计算亮度
        const vars = payload.cssVariables || {};
        const bgCandidate = vars['--background'] || vars['--vscode-editor-background'] || vars['--sidebar-background'];
        if (typeof bgCandidate === 'string') {
          const parsed = parseColor(bgCandidate);
          if (parsed) {
            hostColorMode = getLuminance(parsed.r, parsed.g, parsed.b) > 0.179 ? 'light' : 'dark';
          }
        }
      }
      syncTheme(hostColorMode || undefined);
    }
  });

  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => syncTheme();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMediaChange);
    } else if (typeof (media as any).addListener === 'function') {
      (media as any).addListener(onMediaChange);
    }
  }

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      syncTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-theme']
    });
  }

  syncTheme();
}
