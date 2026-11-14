import { setupExperiments } from './experiments';
import { installHealers } from './healer';
import { initI18n, restoreAllTranslations } from './i18n';
import { initMetricsCapsule } from './metrics-pill';
import { initThemePresetSync } from './theme-preset';
import { agGlobal } from './types';

function applyThemeVars(varsObj: Record<string, string>): void {
  const prevKeys = Array.isArray(agGlobal.__ag_applied_theme_vars) ? agGlobal.__ag_applied_theme_vars : [];
  const nextKeys = Object.keys(varsObj || {});
  const rootStyle = document.documentElement.style;

  for (const k of prevKeys) {
    if (!(k in varsObj)) {
      rootStyle.removeProperty(k);
    }
  }
  for (const k of nextKeys) {
    const v = varsObj[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      rootStyle.setProperty(k, String(v).trim());
    } else {
      rootStyle.removeProperty(k);
    }
  }

  const root = document.documentElement;
  if (varsObj['--ag-chat-font-size']) root.setAttribute('data-ag-custom-font-size', 'true');
  else root.removeAttribute('data-ag-custom-font-size');

  if (varsObj['--ag-cfg-font-sans']) root.setAttribute('data-ag-custom-font', 'true');
  else root.removeAttribute('data-ag-custom-font');

  if (varsObj['--ag-cfg-font-mono']) root.setAttribute('data-ag-custom-mono', 'true');
  else root.removeAttribute('data-ag-custom-mono');

  agGlobal.__ag_applied_theme_vars = nextKeys;
}

function uninstallRuntime(patchVersion: string): void {
  document.getElementById('ag-custom-fonts')?.remove();
  document.getElementById('antigravity-user-custom-style')?.remove();
  document.getElementById('ag-live-metrics-pill')?.remove();
  document.getElementById('ag-live-metrics-tooltip')?.remove();

  if (agGlobal.__ag_i18n_observer) {
    try {
      agGlobal.__ag_i18n_observer.disconnect();
    } catch {}
    agGlobal.__ag_i18n_observer = null;
  }
  if (agGlobal.__ag_metrics_route_watcher) {
    clearInterval(agGlobal.__ag_metrics_route_watcher);
    agGlobal.__ag_metrics_route_watcher = null;
  }

  applyThemeVars({});
  const root = document.documentElement;
  for (const attr of [
    'data-ag-preset',
    'data-ag-light-preset',
    'data-ag-dark-preset',
    'data-ag-color-scheme',
    'data-ag-page-type',
    'data-ag-wax-seal',
    'data-ag-collinear',
    'data-ag-hide-arrows',
    'data-ag-os'
  ]) {
    root.removeAttribute(attr);
  }

  restoreAllTranslations(document.body);
  agGlobal.__ag_patch_version = `${patchVersion}-disabled`;
}

function bootstrap(): void {
  // 顶层窗口隔离：绝不注入 Artifact / HTML 预览等子 iframe
  if (window.top !== window) return;

  const boot = agGlobal.__AG_BOOT_PAYLOAD__;
  try {
    delete agGlobal.__AG_BOOT_PAYLOAD__;
  } catch {}

  if (!boot || typeof boot !== 'object') return;

  const patchVersion = boot.version || '0.1.0';
  if (boot.enabled === false) {
    uninstallRuntime(patchVersion);
    return;
  }

  const modules = boot.modules;
  const presetsCfg = boot.presets;
  const selectors = boot.selectors;
  const themeVars = boot.themeVars && typeof boot.themeVars === 'object' ? boot.themeVars : {};

  // 1. 原生实验特性与开发者模式前置同步（确保先于宿主内联脚本与 React 树挂载拦截 __APP_CONFIG__）
  setupExperiments(boot.advanced);

  // 2. 注入主题 CSS 与用户自定义 CSS
  const headTarget = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
  let style = document.getElementById('ag-custom-fonts') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'ag-custom-fonts';
    headTarget?.appendChild(style);
  }
  if (style.textContent !== (boot.cssText || '')) {
    style.textContent = boot.cssText || '';
  }

  const customCssText = boot.customCss || '';
  let userStyle = document.getElementById('antigravity-user-custom-style') as HTMLStyleElement | null;
  if (modules.customCss && customCssText.trim()) {
    if (!userStyle) {
      userStyle = document.createElement('style');
      userStyle.id = 'antigravity-user-custom-style';
      headTarget?.appendChild(userStyle);
    }
    if (userStyle.textContent !== customCssText) {
      userStyle.textContent = customCssText;
    }
  } else {
    userStyle?.remove();
  }

  applyThemeVars(themeVars);

  const root = document.documentElement;
  root.setAttribute('data-ag-wax-seal', modules.composerWaxSeal === false ? 'off' : 'on');
  root.setAttribute('data-ag-collinear', modules.composerCollinear === false ? 'off' : 'on');
  root.setAttribute('data-ag-hide-arrows', modules.composerHideArrows === false ? 'off' : 'on');

  const detectedOs =
    boot.platform ||
    (/Win/i.test(navigator.platform || '') ? 'win32' : /Mac/i.test(navigator.platform || '') ? 'darwin' : 'linux');
  root.setAttribute('data-ag-os', detectedOs);

  // 2. 安装死锁与快捷键修复器
  installHealers(modules.deadlockHealer !== false, detectedOs);

  // 3. 预设状态联动
  const syncPreset = initThemePresetSync(presetsCfg, boot.themeMode);
  agGlobal.__ag_patch_version = patchVersion;

  // 4. 输入栏性能指标胶囊
  const ensureMetricsPill = initMetricsCapsule(modules.metrics !== false, selectors, boot.language || 'default');

  // 6. 界面汉化引擎
  const dict = initI18n(modules.i18n === true, boot.i18nDict || {}, selectors.excludeI18n, patchVersion);

  // 7. 开放用户自定义前端脚本钩子 (user/custom.js)
  agGlobal.__AG_PATCH_CTX__ = {
    version: patchVersion,
    preset: presetsCfg.light,
    config: boot.config,
    modules,
    features: modules,
    themeVars,
    dict,
    get metrics() {
      return agGlobal.__ag_last_metrics || null;
    },
    syncPreset,
    ensureMetricsPill
  };

  if (modules.customJs && typeof boot.customJs === 'string' && boot.customJs.trim()) {
    try {
      const fn = new Function('ctx', 'boot', boot.customJs);
      fn(agGlobal.__AG_PATCH_CTX__, agGlobal.__AG_PATCH_CTX__);
    } catch (err) {
      console.error('[Aura] Error in user/custom.js:', err);
    }
  }
}

bootstrap();
