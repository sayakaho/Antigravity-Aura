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

export function parseRgb(colorStr: string): { r: number; g: number; b: number; alpha: number } | null {
  if (!colorStr) return null;
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
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
        syncTheme(hostColorMode);
      }
    } else if (event.data?.type === 'theme-change') {
      const vars = event.data?.payload?.cssVariables;
      if (vars && typeof vars['--background'] === 'string') {
        const parsed = parseRgb(vars['--background']);
        if (parsed) {
          hostColorMode = getLuminance(parsed.r, parsed.g, parsed.b) > 0.179 ? 'light' : 'dark';
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
