// Frontend script for Chuanban Theme Sidecar Web UI (Native Antigravity Capsule Style)

// ============================================================================
// Antigravity Native Sidecar Theme Synchronization Engine
// 对标官方 Device Hub / Compose Preview，100% 自动感知宿主深浅外观切换
// ============================================================================

let hostColorMode = null; // 'dark' | 'light' | null

function getLuminance(r, g, b) {
  const f = (n) => {
    const o = n / 255;
    return o <= 0.03928 ? o / 12.92 : Math.pow((o + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function parseRgb(colorStr) {
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

function detectEffectiveTheme() {
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

function syncTheme(forcedTheme) {
  const effectiveTheme = (forcedTheme === 'light' || forcedTheme === 'dark') ? forcedTheme : detectEffectiveTheme();
  const html = document.documentElement;
  if (html.getAttribute('data-theme') !== effectiveTheme) {
    html.setAttribute('data-theme', effectiveTheme);
  }
  if (html.style.colorScheme !== effectiveTheme) {
    html.style.colorScheme = effectiveTheme;
  }
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'ag-theme-sync') {
    const payload = event.data.payload || {};
    if (payload.scheme === 'light' || payload.scheme === 'dark') {
      hostColorMode = payload.scheme;
      syncTheme(hostColorMode);
    }
  } else if (event.data?.type === 'theme-change') {
    const vars = event.data?.payload?.cssVariables;
    if (vars) {
      if (typeof vars['--background'] === 'string') {
        const parsed = parseRgb(vars['--background']);
        if (parsed) {
          hostColorMode = getLuminance(parsed.r, parsed.g, parsed.b) > 0.179 ? 'light' : 'dark';
        }
      }
    }
    syncTheme(hostColorMode);
  }
});

if (window.matchMedia) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onMediaChange = () => syncTheme();
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onMediaChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(onMediaChange);
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

const I18N = {
  'zh-CN': {
    pageTitle: '川瓣主题与排版配置',
    pageDesc: '配置界面字体、排版对齐、输入框微浮雕与实时性能遥测。',
    secAppearanceTitle: '外观与主题',
    secAppearanceDesc: '为浅色与深色模式分别定制配色预设与微浮雕外框。',
    lightPresetLabel: '浅色模式预设',
    lightPresetSub: '系统处于浅色外观时生效的主题配色方案。',
    optHighContrast: 'Claude 浅色',
    optClaudeWhite: '经典净白',
    optDefault: '官方原生',
    darkPresetLabel: '深色模式预设',
    darkPresetSub: '系统处于深色外观时生效的主题配色方案。',
    optClaudeDark: 'Claude 暗色',
    optVintageDark: '极简暖暗',
    waxSealLabel: '古朴暗红蜡封输入框',
    waxSealSub: '首页保持呼吸感外框，聚焦态浮现古朴暗红蜡封高光。',
    secLanguageTitle: '界面语言设置',
    secLanguageDesc: '切换 Antigravity 宿主与本控制台的显示语言。',
    languageLabel: '界面语言 (Language)',
    languageSub: '支持官方纯英或川瓣高质量中文汉化。',
    optLangDefault: 'English (Default)',
    optLangChinese: '简体中文 (Chinese)',
    secTypoTitle: '字体排版系统',
    secTypoDesc: '自动读取系统字体，支持西文首选、中文字体回退拆分与字阶微调。',
    sansPrimaryLabel: '界面无衬线字体 (Sans 首选 / 西文)',
    sansPrimarySub: '用于界面西文、拉丁字符、数字与主 UI 控件。',
    optSansPrimaryDefault: 'Default',
    optCustomInput: '自定义字体名...',
    customSansPrimaryLabel: '自定义首选字体族',
    customSansPrimarySub: '输入已安装的无衬线西文字体名。',
    sansFallbackLabel: '无衬线备用字体 (Fallback / 中文字体)',
    sansFallbackSub: '首选字体缺少字符时优先回退（如更纱黑体、苹方、霞鹜文楷）。',
    optSansFallbackDefault: 'Default',
    customSansFallbackLabel: '自定义备用中文字体族',
    customSansFallbackSub: '输入已安装的无衬线中文字体名。',
    monoLabel: '代码与等宽字体 (Mono)',
    monoSub: '用于代码块、终端输出、行号与等宽数据展示。',
    optMonoDefault: 'Default',
    customMonoLabel: '自定义等宽字体族',
    customMonoSub: '输入已安装的等宽代码字体名。',
    fontSizeLabel: '对话正文字阶大小',
    fontSizeSub: '调整聊天正文与 Markdown 阅读字阶基准。',
    secComposerTitle: '组件对齐与排版',
    secComposerDesc: '重排输入框外围元数据与新建会话工具栏。',
    composerAlignLabel: '底部组件排版模式',
    composerAlignSub: '将工具栏下移居左，遥测/模型/模式右对齐共线。',
    optCollinear: '绝对水平共线',
    optNative: '官方原生',
    hideArrowsLabel: '移除工具栏尾部下拉箭头',
    hideArrowsSub: '消除项目与检出下拉的小三角，统一微浮雕背景。',
    secTelemetryTitle: '实时性能遥测',
    secTelemetryDesc: '监控模型生成速度（tok/s）、首字耗时（TTFT）与上下文水位。',
    metricsPillLabel: '会话实时指标胶囊',
    metricsPillSub: '在模型选择器左侧显示实时流式速率与悬浮双层详情。',
    metricsIntervalLabel: '遥测采样频率',
    metricsIntervalSub: '从本地 SQLite 会话数据库同步指标的检测周期。',
    secStatusTitle: 'CDP 引擎状态',
    statusLabel: '宿主连接状态',
    statusConnected: '正常运行',
    statusConnecting: '寻找窗口中',
    reloadLabel: '样式热重载',
    reloadSub: '重新编译当前配置并向所有窗口即时推送最新样式。',
    btnReload: '立即重新应用',
    toastApplied: '配置已实时生效',
    toastReloaded: '已强制重新加载并应用'
  },
  default: {
    pageTitle: 'Chuanban Theme & Layout Settings',
    pageDesc: 'Configure interface typography, layout alignment, composer wax seal, and real-time telemetry.',
    secAppearanceTitle: 'Appearance & Themes',
    secAppearanceDesc: 'Customize color presets and composer micro-relief borders for Light and Dark modes.',
    lightPresetLabel: 'Light Mode Preset',
    lightPresetSub: 'Active color scheme when the system is in light appearance.',
    optHighContrast: 'Claude Light',
    optClaudeWhite: 'Pure Light',
    optDefault: 'Native Default',
    darkPresetLabel: 'Dark Mode Preset',
    darkPresetSub: 'Active color scheme when the system is in dark appearance.',
    optClaudeDark: 'Claude Dark',
    optVintageDark: 'Vintage Deep',
    waxSealLabel: 'Vintage Wax Seal Composer',
    waxSealSub: 'Subtle outer glow border on home, glowing vintage dark red on focus.',
    secLanguageTitle: 'Language & Localization',
    secLanguageDesc: 'Switch display language for Antigravity host and this control panel.',
    languageLabel: 'UI Language',
    languageSub: 'Choose official English or Chuanban Chinese localization.',
    optLangDefault: 'English (Default)',
    optLangChinese: 'Chinese (简体中文)',
    secTypoTitle: 'Typography System',
    secTypoDesc: 'Enumerate system fonts directly with primary Latin font and CJK fallback separation.',
    sansPrimaryLabel: 'Primary Sans Font (Latin / Western)',
    sansPrimarySub: 'Used for Latin characters, numbers, and primary UI elements.',
    optSansPrimaryDefault: 'Default',
    optCustomInput: 'Custom font name...',
    customSansPrimaryLabel: 'Custom Primary Font Family',
    customSansPrimarySub: 'Enter an installed Latin sans-serif font family.',
    sansFallbackLabel: 'Fallback Sans Font (Chinese / CJK)',
    sansFallbackSub: 'Fallback for CJK characters (PingFang SC, Sarasa UI SC, LXGW WenKai).',
    optSansFallbackDefault: 'Default',
    customSansFallbackLabel: 'Custom Fallback Font Family',
    customSansFallbackSub: 'Enter an installed CJK sans-serif font family.',
    monoLabel: 'Code & Monospace Font (Mono)',
    monoSub: 'Used for codeblocks, terminal output, and monospace alignment.',
    optMonoDefault: 'Default',
    customMonoLabel: 'Custom Monospace Font Family',
    customMonoSub: 'Enter an installed monospace font family.',
    fontSizeLabel: 'Chat Message Font Size',
    fontSizeSub: 'Base reading font size for conversational text and Markdown.',
    secComposerTitle: 'Component Layout & Alignment',
    secComposerDesc: 'Rearrange composer outer metadata and new session toolbars.',
    composerAlignLabel: 'Bottom Toolbar Layout',
    composerAlignSub: 'Move project bar left, align telemetry/model/mode horizontally.',
    optCollinear: 'Absolute Collinear',
    optNative: 'Official Native',
    hideArrowsLabel: 'Hide Dropdown Arrows',
    hideArrowsSub: 'Remove small arrows from toolbar buttons for a cleaner aesthetic.',
    secTelemetryTitle: 'Real-time Telemetry',
    secTelemetryDesc: 'Monitor model speed (tok/s), TTFT, and context usage.',
    metricsPillLabel: 'Session Live Metrics Capsule',
    metricsPillSub: 'Displays token rate pill on composer with hover detailed popup.',
    metricsIntervalLabel: 'Telemetry Sampling Rate',
    metricsIntervalSub: 'SQLite conversation database polling interval.',
    secStatusTitle: 'CDP Engine Status',
    statusLabel: 'Host Connection Status',
    statusConnected: 'Connected',
    statusConnecting: 'Searching window...',
    reloadLabel: 'Style Hot Reload',
    reloadSub: 'Recompile active configuration and push latest styles to all windows.',
    btnReload: 'Reapply Now',
    toastApplied: 'Configuration applied in real-time',
    toastReloaded: 'Styles recompiled and re-injected'
  }
};

let currentLang = 'default';
let currentConfig = null;
let systemFontsList = [];

function applyI18n(lang) {
  currentLang = lang === 'zh-CN' ? 'zh-CN' : 'default';
  const dict = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

async function saveConfig(patch) {
  try {
    const res = await window.sidecar.fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const data = await res.json();
      currentConfig = data.config;
      showToast(I18N[currentLang].toastApplied);
    } else {
      showToast('Save failed');
    }
  } catch (err) {
    console.error('saveConfig failed:', err);
    showToast('Network error');
  }
}

function updateSegmentedUI(containerId, activeVal) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.segment-btn').forEach((btn) => {
    if (btn.getAttribute('data-val') === String(activeVal)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function populateFontSelect(selectId, defaultLabel, fonts, selectedVal) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '';

  const defOpt = document.createElement('option');
  defOpt.value = 'default';
  defOpt.textContent = defaultLabel;
  select.appendChild(defOpt);

  const optGroup = document.createElement('optgroup');
  optGroup.label = currentLang === 'zh-CN' ? '系统已安装字体' : 'System Installed Fonts';

  for (const font of fonts) {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    optGroup.appendChild(opt);
  }
  select.appendChild(optGroup);

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = currentLang === 'zh-CN' ? '自定义字体名...' : 'Custom font name...';
  select.appendChild(customOpt);

  if (!selectedVal || selectedVal === 'default') {
    select.value = 'default';
  } else if (fonts.includes(selectedVal)) {
    select.value = selectedVal;
  } else {
    select.value = 'custom';
  }
}

async function loadSystemFonts() {
  try {
    const res = await window.sidecar.fetch('/api/system-fonts', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.fonts)) {
        systemFontsList = data.fonts;
      }
    }
  } catch (e) {
    console.error('loadSystemFonts failed:', e);
  }
}

async function loadConfig() {
  try {
    const res = await window.sidecar.fetch('/api/config', { method: 'GET' });
    if (!res.ok) return;
    const { config } = await res.json();
    currentConfig = config;

    // 0. Language
    const lang = config.language || 'default';
    const langSelect = document.getElementById('select-language');
    if (langSelect) langSelect.value = lang;
    applyI18n(lang);

    // 1. Presets
    const lightVal = config.presets?.light || 'high-contrast';
    const darkVal = config.presets?.dark || 'claude-dark';
    updateSegmentedUI('preset-light-segmented', lightVal);
    updateSegmentedUI('preset-dark-segmented', darkVal);

    // 2. Wax Seal
    const waxToggle = document.getElementById('toggle-wax-seal');
    if (waxToggle) waxToggle.checked = config.composer?.waxSeal !== false;

    // 3. Typography
    const typo = config.typography || {};
    populateFontSelect(
      'select-font-sans-primary',
      I18N[currentLang].optSansPrimaryDefault,
      systemFontsList,
      typo.primarySans
    );
    populateFontSelect(
      'select-font-sans-fallback',
      I18N[currentLang].optSansFallbackDefault,
      systemFontsList,
      typo.fallbackSans
    );
    populateFontSelect(
      'select-font-mono',
      I18N[currentLang].optMonoDefault,
      systemFontsList,
      typo.mono
    );

    const primarySelect = document.getElementById('select-font-sans-primary');
    const primaryRow = document.getElementById('row-custom-sans-primary');
    const primaryInput = document.getElementById('input-custom-sans-primary');
    if (primarySelect && primaryRow) {
      primaryRow.style.display = primarySelect.value === 'custom' ? 'flex' : 'none';
      if (primaryInput) primaryInput.value = typo.customPrimarySans || '';
    }

    const fallbackSelect = document.getElementById('select-font-sans-fallback');
    const fallbackRow = document.getElementById('row-custom-sans-fallback');
    const fallbackInput = document.getElementById('input-custom-sans-fallback');
    if (fallbackSelect && fallbackRow) {
      fallbackRow.style.display = fallbackSelect.value === 'custom' ? 'flex' : 'none';
      if (fallbackInput) fallbackInput.value = typo.customFallbackSans || '';
    }

    const monoSelect = document.getElementById('select-font-mono');
    const monoRow = document.getElementById('row-custom-mono');
    const monoInput = document.getElementById('input-custom-mono');
    if (monoSelect && monoRow) {
      monoRow.style.display = monoSelect.value === 'custom' ? 'flex' : 'none';
      if (monoInput) monoInput.value = typo.customMono || '';
    }

    // Font size
    updateSegmentedUI('font-size-segmented', typo.fontSize || 16);

    // 4. Composer
    const alignVal = config.composer?.collinear !== false ? 'collinear' : 'native';
    updateSegmentedUI('composer-align-segmented', alignVal);
    const arrowsToggle = document.getElementById('toggle-hide-arrows');
    if (arrowsToggle) arrowsToggle.checked = config.composer?.hideArrows !== false;

    // 5. Telemetry
    const metricsToggle = document.getElementById('toggle-metrics');
    if (metricsToggle) metricsToggle.checked = config.telemetry?.enabled !== false;
    updateSegmentedUI('metrics-interval-segmented', config.telemetry?.interval || 2000);
  } catch (e) {
    console.error('loadConfig failed:', e);
  }
}

async function updateStatus() {
  try {
    const res = await window.sidecar.fetch('/api/status', { method: 'GET' });
    if (!res.ok) return;
    const data = await res.json();

    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const sublabel = document.getElementById('status-sublabel');

    if (data.connected) {
      if (dot) dot.classList.remove('disconnected');
      if (text) text.textContent = I18N[currentLang].statusConnected;
      if (sublabel) {
        sublabel.textContent =
          currentLang === 'zh-CN'
            ? `已连接至宿主 (${data.targetCount || 1} 个窗口 · 端口 ${data.cdpPort || '-'})`
            : `Connected to host (${data.targetCount || 1} window(s) · port ${data.cdpPort || '-'})`;
      }
    } else {
      if (dot) dot.classList.add('disconnected');
      if (text) text.textContent = I18N[currentLang].statusConnecting;
      if (sublabel) {
        sublabel.textContent =
          currentLang === 'zh-CN' ? '正在检测 Antigravity 宿主调试端口...' : 'Detecting Antigravity CDP port...';
      }
    }
  } catch (e) {
    console.error('updateStatus failed:', e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  syncTheme();
  // 1. Load system fonts & config
  await loadSystemFonts();
  await loadConfig();
  updateStatus();
  setInterval(updateStatus, 3000);

  // 2. Language Select Menu
  const langSelect = document.getElementById('select-language');
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      const val = langSelect.value;
      applyI18n(val);
      // Refresh default labels in selects
      const typo = currentConfig?.typography || {};
      populateFontSelect('select-font-sans-primary', I18N[currentLang].optSansPrimaryDefault, systemFontsList, typo.primarySans);
      populateFontSelect('select-font-sans-fallback', I18N[currentLang].optSansFallbackDefault, systemFontsList, typo.fallbackSans);
      populateFontSelect('select-font-mono', I18N[currentLang].optMonoDefault, systemFontsList, typo.mono);
      saveConfig({ language: val });
    });
  }

  // 3. Light Preset Segmented
  const lightContainer = document.getElementById('preset-light-segmented');
  if (lightContainer) {
    lightContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        updateSegmentedUI('preset-light-segmented', val);
        saveConfig({ presets: { light: val } });
      });
    });
  }

  // 4. Dark Preset Segmented
  const darkContainer = document.getElementById('preset-dark-segmented');
  if (darkContainer) {
    darkContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        updateSegmentedUI('preset-dark-segmented', val);
        saveConfig({ presets: { dark: val } });
      });
    });
  }

  // 5. Wax Seal Toggle
  const waxToggle = document.getElementById('toggle-wax-seal');
  if (waxToggle) {
    waxToggle.addEventListener('change', () => {
      saveConfig({ composer: { waxSeal: waxToggle.checked } });
    });
  }

  // 6. Sans Primary Font Select & Input
  const primarySelect = document.getElementById('select-font-sans-primary');
  const primaryRow = document.getElementById('row-custom-sans-primary');
  const primaryInput = document.getElementById('input-custom-sans-primary');
  if (primarySelect) {
    primarySelect.addEventListener('change', () => {
      const isCustom = primarySelect.value === 'custom';
      if (primaryRow) primaryRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { primarySans: primarySelect.value } });
      } else if (primaryInput) {
        primaryInput.focus();
      }
    });
  }
  if (primaryInput) {
    const commitPrimary = () => {
      if (primarySelect && primarySelect.value === 'custom') {
        saveConfig({
          typography: {
            primarySans: 'custom',
            customPrimarySans: primaryInput.value.trim()
          }
        });
      }
    };
    primaryInput.addEventListener('change', commitPrimary);
    primaryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitPrimary();
        primaryInput.blur();
      }
    });
  }

  // 7. Sans Fallback Font Select & Input
  const fallbackSelect = document.getElementById('select-font-sans-fallback');
  const fallbackRow = document.getElementById('row-custom-sans-fallback');
  const fallbackInput = document.getElementById('input-custom-sans-fallback');
  if (fallbackSelect) {
    fallbackSelect.addEventListener('change', () => {
      const isCustom = fallbackSelect.value === 'custom';
      if (fallbackRow) fallbackRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { fallbackSans: fallbackSelect.value } });
      } else if (fallbackInput) {
        fallbackInput.focus();
      }
    });
  }
  if (fallbackInput) {
    const commitFallback = () => {
      if (fallbackSelect && fallbackSelect.value === 'custom') {
        saveConfig({
          typography: {
            fallbackSans: 'custom',
            customFallbackSans: fallbackInput.value.trim()
          }
        });
      }
    };
    fallbackInput.addEventListener('change', commitFallback);
    fallbackInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitFallback();
        fallbackInput.blur();
      }
    });
  }

  // 8. Mono Font Select & Input
  const monoSelect = document.getElementById('select-font-mono');
  const monoRow = document.getElementById('row-custom-mono');
  const monoInput = document.getElementById('input-custom-mono');
  if (monoSelect) {
    monoSelect.addEventListener('change', () => {
      const isCustom = monoSelect.value === 'custom';
      if (monoRow) monoRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { mono: monoSelect.value } });
      } else if (monoInput) {
        monoInput.focus();
      }
    });
  }
  if (monoInput) {
    const commitMono = () => {
      if (monoSelect && monoSelect.value === 'custom') {
        saveConfig({
          typography: {
            mono: 'custom',
            customMono: monoInput.value.trim()
          }
        });
      }
    };
    monoInput.addEventListener('change', commitMono);
    monoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitMono();
        monoInput.blur();
      }
    });
  }

  // 9. Font Size Segmented
  const sizeContainer = document.getElementById('font-size-segmented');
  if (sizeContainer) {
    sizeContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        updateSegmentedUI('font-size-segmented', val);
        saveConfig({ typography: { fontSize: val } });
      });
    });
  }

  // 10. Composer Align Segmented
  const alignContainer = document.getElementById('composer-align-segmented');
  if (alignContainer) {
    alignContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        updateSegmentedUI('composer-align-segmented', val);
        saveConfig({ composer: { collinear: val === 'collinear' } });
      });
    });
  }

  // 11. Hide Arrows Toggle
  const arrowsToggle = document.getElementById('toggle-hide-arrows');
  if (arrowsToggle) {
    arrowsToggle.addEventListener('change', () => {
      saveConfig({ composer: { hideArrows: arrowsToggle.checked } });
    });
  }

  // 12. Telemetry Toggle & Interval
  const metricsToggle = document.getElementById('toggle-metrics');
  if (metricsToggle) {
    metricsToggle.addEventListener('change', () => {
      saveConfig({ telemetry: { enabled: metricsToggle.checked } });
    });
  }
  const intervalContainer = document.getElementById('metrics-interval-segmented');
  if (intervalContainer) {
    intervalContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        updateSegmentedUI('metrics-interval-segmented', val);
        saveConfig({ telemetry: { interval: val } });
      });
    });
  }

  // 13. Force Reload Button
  const reloadBtn = document.getElementById('btn-force-reload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      reloadBtn.style.opacity = '0.6';
      try {
        const res = await window.sidecar.fetch('/api/reload', { method: 'POST' });
        if (res.ok) {
          showToast(I18N[currentLang].toastReloaded);
          await updateStatus();
        } else {
          showToast('Reload failed');
        }
      } catch (err) {
        showToast('Request error');
      } finally {
        reloadBtn.disabled = false;
        reloadBtn.style.opacity = '1';
      }
    });
  }
});
