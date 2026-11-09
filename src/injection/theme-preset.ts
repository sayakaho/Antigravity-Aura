import { normalizeDarkPreset, normalizeLightPreset } from '../shared/config-schema';
import type { PresetConfig } from '../types';
import { agGlobal } from './types';

// 防止 Antigravity 从 localStorage 读取非原生预设名后触发主题白屏
const ALL_CUSTOM_PRESET_NAMES = new Set([
  'high-contrast',
  'claude-desktop-purewhite',
  'vintage-dark',
  'claude-dark',
  'vintage-deep',
  'chuanban-warm-white',
  'claude-desktop-official',
  'absoulutely-chuanban'
]);

function detectEffectiveColorScheme(themeMode?: string): 'light' | 'dark' {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }
  const inlineScheme = document.documentElement.style.colorScheme;
  if (inlineScheme === 'light' || inlineScheme === 'dark') {
    return inlineScheme;
  }
  try {
    const computed = getComputedStyle(document.documentElement).colorScheme;
    if (computed === 'light' || computed === 'dark') return computed;
  } catch {
    // Non-fatal in headless documents
  }
  if (document.body) {
    if (document.body.classList.contains('theme-dark')) return 'dark';
    if (document.body.classList.contains('theme-light')) return 'light';
  }
  try {
    const mode = localStorage.getItem('theme-mode');
    if (mode === 'light' || mode === 'dark') return mode;
  } catch {
    // Storage access may be restricted
  }
  if (window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  }
  return 'light';
}

function broadcastThemeToSidecars(scheme: 'light' | 'dark', preset: string): void {
  try {
    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      iframes[i]?.contentWindow?.postMessage(
        {
          type: 'ag-theme-sync',
          payload: { scheme, preset, colorScheme: scheme }
        },
        '*'
      );
    }
  } catch {
    // Cross-origin frame postMessage is safe to ignore
  }
}

export function initThemePresetSync(presetsCfg: PresetConfig, themeMode?: string): () => void {
  const normalizedLightDefault = normalizeLightPreset(presetsCfg.light, 'high-contrast');

  if (normalizedLightDefault && agGlobal.__ag_last_boot_preset !== normalizedLightDefault) {
    agGlobal.__ag_last_boot_preset = normalizedLightDefault;
    try {
      Storage.prototype.setItem.call(localStorage, 'theme-color-flavor', normalizedLightDefault);
    } catch {
      // Ignore storage write restriction
    }
  }

  const syncDualThemePreset = () => {
    try {
      const scheme = detectEffectiveColorScheme(themeMode);
      const html = document.documentElement;
      if (html.getAttribute('data-ag-color-scheme') !== scheme) {
        html.setAttribute('data-ag-color-scheme', scheme);
      }

      const activeLightPreset = normalizeLightPreset(presetsCfg.light, 'high-contrast');
      const activeDarkPreset = normalizeDarkPreset(presetsCfg.dark, 'claude-dark');

      html.setAttribute('data-ag-light-preset', activeLightPreset);
      html.setAttribute('data-ag-dark-preset', activeDarkPreset);

      const targetPreset = scheme === 'dark' ? activeDarkPreset : activeLightPreset;
      if (html.getAttribute('data-ag-preset') !== targetPreset) {
        html.setAttribute('data-ag-preset', targetPreset);
      }

      broadcastThemeToSidecars(scheme, targetPreset);
    } catch {
      // Avoid crashing host DOM mutations
    }
  };

  agGlobal.__ag_sync_preset_fn = syncDualThemePreset;
  agGlobal.__ag_sync_color_scheme_fn = syncDualThemePreset;

  if (!agGlobal.__ag_theme_media_listener_installed && window.matchMedia) {
    agGlobal.__ag_theme_media_listener_installed = true;
    try {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onMediaChange = () => agGlobal.__ag_sync_color_scheme_fn?.();
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onMediaChange);
      }
    } catch {
      // Ignore unsupported matchMedia
    }
  }

  if (!agGlobal.__ag_theme_observer_installed) {
    agGlobal.__ag_theme_observer_installed = true;
    try {
      const themeObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
            agGlobal.__ag_sync_color_scheme_fn?.();
            break;
          }
        }
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
      if (document.body) {
        themeObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'style']
        });
      }
    } catch {
      // Ignore observer setup failures
    }
  }

  if (!agGlobal.__ag_sidecar_mount_observer_installed && document.body) {
    agGlobal.__ag_sidecar_mount_observer_installed = true;
    try {
      const sidecarObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node instanceof Element && (node.tagName === 'IFRAME' || node.querySelector('iframe'))) {
              setTimeout(() => agGlobal.__ag_sync_color_scheme_fn?.(), 50);
              return;
            }
          }
        }
      });
      sidecarObserver.observe(document.body, { childList: true, subtree: true });
    } catch {
      // Ignore observer setup failures
    }
  }

  if (!agGlobal.__ag_preset_hook_installed) {
    agGlobal.__ag_preset_hook_installed = true;
    try {
      const origGetItem = localStorage.getItem.bind(localStorage);
      localStorage.getItem = function (key: string): string | null {
        const val = origGetItem(key);
        if (key === 'theme-preset-light' && val && ALL_CUSTOM_PRESET_NAMES.has(val)) {
          return 'Default Light';
        }
        return val;
      };

      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (key: string, val: string): void {
        if (key === 'theme-preset-light' && ALL_CUSTOM_PRESET_NAMES.has(val)) {
          val = 'Default Light';
        }
        origSetItem(key, val);
        if (key === 'theme-preset-light' || key === 'theme-mode' || key === 'theme-color-flavor') {
          setTimeout(() => {
            agGlobal.__ag_sync_preset_fn?.();
            agGlobal.__ag_sync_color_scheme_fn?.();
          }, 50);
        }
      };
    } catch {
      // Ignore storage hook restrictions
    }
  }

  syncDualThemePreset();
  return syncDualThemePreset;
}
