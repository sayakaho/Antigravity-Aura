import type { AuraConfig, DeepPartial, PanelConfigDTO } from '../types';

let currentConfig: PanelConfigDTO | null = null;
let systemFontsList: string[] = [];
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string): void {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    toastTimer = null;
  }, 2000);
}

export async function saveConfig(patch: DeepPartial<AuraConfig>): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const data = (await res.json()) as { config?: PanelConfigDTO };
      if (data.config) currentConfig = data.config;
      showToast('Configuration applied in real-time');
    } else {
      showToast('Save failed');
    }
  } catch (err) {
    console.error('saveConfig failed:', err);
    showToast('Network error');
  }
}

function patchPresets(partial: Partial<AuraConfig['presets']>): DeepPartial<AuraConfig> {
  return { presets: { ...currentConfig?.presets, ...partial } };
}

function patchComposer(partial: Partial<AuraConfig['composer']>): DeepPartial<AuraConfig> {
  return { composer: { ...currentConfig?.composer, ...partial } };
}

function patchTypography(partial: Partial<AuraConfig['typography']>): DeepPartial<AuraConfig> {
  return { typography: { ...currentConfig?.typography, ...partial } };
}

function patchTelemetry(partial: Partial<AuraConfig['telemetry']>): DeepPartial<AuraConfig> {
  return { telemetry: { ...currentConfig?.telemetry, ...partial } };
}

function patchAdvanced(partial: Partial<AuraConfig['advanced']>): DeepPartial<AuraConfig> {
  return { advanced: { ...currentConfig?.advanced, ...partial } };
}

export function updateSegmentedUI(containerId: string, activeVal: string | number): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  const target = String(activeVal);
  container.querySelectorAll('.segment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-val') === target);
  });
}

function populateFontSelect(
  selectId: string,
  defaultLabel: string,
  fonts: string[],
  selectedVal?: string
): void {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '';

  const defOpt = document.createElement('option');
  defOpt.value = 'default';
  defOpt.textContent = defaultLabel;
  select.appendChild(defOpt);

  const optGroup = document.createElement('optgroup');
  optGroup.label = 'System Installed Fonts';
  for (const font of fonts) {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    optGroup.appendChild(opt);
  }
  select.appendChild(optGroup);

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Custom font name...';
  select.appendChild(customOpt);

  if (!selectedVal || selectedVal === 'default') {
    select.value = 'default';
  } else if (fonts.includes(selectedVal)) {
    select.value = selectedVal;
  } else {
    select.value = 'custom';
  }
}

function syncTypographyControls(config: PanelConfigDTO): void {
  const typo = config.typography;
  populateFontSelect('select-font-sans-primary', 'Default', systemFontsList, typo?.primarySans);
  populateFontSelect('select-font-sans-fallback', 'Default', systemFontsList, typo?.fallbackSans);
  populateFontSelect('select-font-mono', 'Default', systemFontsList, typo?.mono);

  syncCustomFontField(
    'select-font-sans-primary',
    'row-custom-sans-primary',
    'input-custom-sans-primary',
    typo?.customPrimarySans
  );
  syncCustomFontField(
    'select-font-sans-fallback',
    'row-custom-sans-fallback',
    'input-custom-sans-fallback',
    typo?.customFallbackSans
  );
  syncCustomFontField('select-font-mono', 'row-custom-mono', 'input-custom-mono', typo?.customMono);

  updateSegmentedUI('font-size-segmented', typo?.fontSize || 15);
}

export async function loadSystemFonts(): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/system-fonts', { method: 'GET' });
    if (res.ok) {
      const data = (await res.json()) as { fonts?: unknown };
      if (Array.isArray(data.fonts)) {
        systemFontsList = data.fonts.filter((f): f is string => typeof f === 'string');
        if (currentConfig) {
          syncTypographyControls(currentConfig);
        }
      }
    }
  } catch (err) {
    console.error('loadSystemFonts failed:', err);
  }
}

function syncCustomFontField(
  selectId: string,
  rowId: string,
  inputId: string,
  customValue: string | undefined
): void {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  const row = document.getElementById(rowId);
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (select && row) {
    row.style.display = select.value === 'custom' ? 'flex' : 'none';
    if (input) input.value = customValue || '';
  }
}

export async function loadConfig(): Promise<void> {
  try {
    const res = await window.sidecar.fetch('/api/config', { method: 'GET' });
    if (!res.ok) return;
    const body = (await res.json()) as { config?: PanelConfigDTO };
    if (!body.config) return;
    const config = body.config;
    currentConfig = config;

    const langSelect = document.getElementById('select-language') as HTMLSelectElement | null;
    if (langSelect) langSelect.value = config.language || 'default';

    updateSegmentedUI('preset-light-segmented', config.presets?.light || 'high-contrast');
    updateSegmentedUI('preset-dark-segmented', config.presets?.dark || 'claude-dark');

    const waxToggle = document.getElementById('toggle-wax-seal') as HTMLInputElement | null;
    if (waxToggle) waxToggle.checked = config.composer?.waxSeal !== false;

    syncTypographyControls(config);

    const alignVal = config.composer?.collinear !== false ? 'collinear' : 'native';
    updateSegmentedUI('composer-align-segmented', alignVal);
    const arrowsToggle = document.getElementById('toggle-hide-arrows') as HTMLInputElement | null;
    if (arrowsToggle) arrowsToggle.checked = config.composer?.hideArrows !== false;

    const metricsToggle = document.getElementById('toggle-metrics') as HTMLInputElement | null;
    if (metricsToggle) metricsToggle.checked = config.telemetry?.enabled !== false;
    updateSegmentedUI('metrics-interval-segmented', config.telemetry?.interval || 2000);

    const labsToggle = document.getElementById('toggle-labs-dev-mode') as HTMLInputElement | null;
    if (labsToggle) labsToggle.checked = config.advanced?.labsDeveloperMode !== false;

    const channelSelect = document.getElementById('select-release-channel') as HTMLSelectElement | null;
    if (channelSelect) channelSelect.value = config.advanced?.releaseChannel || 'stable';

    const byoaToggle = document.getElementById('toggle-byoa') as HTMLInputElement | null;
    if (byoaToggle) byoaToggle.checked = config.advanced?.isByoa === true;

    const entToggle = document.getElementById('toggle-enterprise-disabled') as HTMLInputElement | null;
    if (entToggle) entToggle.checked = config.advanced?.isEnterpriseDisabled === true;

    const cdeToggle = document.getElementById('toggle-cde') as HTMLInputElement | null;
    if (cdeToggle) cdeToggle.checked = config.advanced?.cde === true;

    const hostSelect = document.getElementById('select-host-variant') as HTMLSelectElement | null;
    if (hostSelect) hostSelect.value = config.advanced?.hostVariant || 'default';

    const micToggle = document.getElementById('toggle-enable-microphone') as HTMLInputElement | null;
    if (micToggle) micToggle.checked = config.advanced?.enableMicrophone === true;
  } catch (err) {
    console.error('loadConfig failed:', err);
  }
}

function bindFontSelectAndCustomInput(opts: {
  selectId: string;
  rowId: string;
  inputId: string;
  selectField: 'primarySans' | 'fallbackSans' | 'mono';
  customField: 'customPrimarySans' | 'customFallbackSans' | 'customMono';
}): void {
  const select = document.getElementById(opts.selectId) as HTMLSelectElement | null;
  const row = document.getElementById(opts.rowId);
  const input = document.getElementById(opts.inputId) as HTMLInputElement | null;

  select?.addEventListener('change', () => {
    const isCustom = select.value === 'custom';
    if (row) row.style.display = isCustom ? 'flex' : 'none';
    if (!isCustom) {
      void saveConfig(patchTypography({ [opts.selectField]: select.value }));
    } else {
      input?.focus();
    }
  });

  if (input) {
    const commit = () => {
      if (select?.value === 'custom') {
        void saveConfig(
          patchTypography({
            [opts.selectField]: 'custom',
            [opts.customField]: input.value.trim()
          })
        );
      }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commit();
        input.blur();
      }
    });
  }
}

export function bindSettingsControls(): void {
  const langSelect = document.getElementById('select-language') as HTMLSelectElement | null;
  langSelect?.addEventListener('change', () => {
    const language: AuraConfig['language'] = langSelect.value === 'zh-CN' ? 'zh-CN' : 'default';
    void saveConfig({ language });
  });

  document
    .getElementById('preset-light-segmented')
    ?.querySelectorAll('.segment-btn')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val') || 'high-contrast';
        updateSegmentedUI('preset-light-segmented', val);
        void saveConfig(patchPresets({ light: val }));
      });
    });

  document
    .getElementById('preset-dark-segmented')
    ?.querySelectorAll('.segment-btn')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val') || 'claude-dark';
        updateSegmentedUI('preset-dark-segmented', val);
        void saveConfig(patchPresets({ dark: val }));
      });
    });

  const waxToggle = document.getElementById('toggle-wax-seal') as HTMLInputElement | null;
  waxToggle?.addEventListener('change', () => {
    void saveConfig(patchComposer({ waxSeal: waxToggle.checked }));
  });

  bindFontSelectAndCustomInput({
    selectId: 'select-font-sans-primary',
    rowId: 'row-custom-sans-primary',
    inputId: 'input-custom-sans-primary',
    selectField: 'primarySans',
    customField: 'customPrimarySans'
  });

  bindFontSelectAndCustomInput({
    selectId: 'select-font-sans-fallback',
    rowId: 'row-custom-sans-fallback',
    inputId: 'input-custom-sans-fallback',
    selectField: 'fallbackSans',
    customField: 'customFallbackSans'
  });

  bindFontSelectAndCustomInput({
    selectId: 'select-font-mono',
    rowId: 'row-custom-mono',
    inputId: 'input-custom-mono',
    selectField: 'mono',
    customField: 'customMono'
  });

  document
    .getElementById('font-size-segmented')
    ?.querySelectorAll('.segment-btn')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        if (!Number.isFinite(val)) return;
        updateSegmentedUI('font-size-segmented', val);
        void saveConfig(patchTypography({ fontSize: val }));
      });
    });

  document
    .getElementById('composer-align-segmented')
    ?.querySelectorAll('.segment-btn')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val') || 'collinear';
        updateSegmentedUI('composer-align-segmented', val);
        void saveConfig(patchComposer({ collinear: val === 'collinear' }));
      });
    });

  const arrowsToggle = document.getElementById('toggle-hide-arrows') as HTMLInputElement | null;
  arrowsToggle?.addEventListener('change', () => {
    void saveConfig(patchComposer({ hideArrows: arrowsToggle.checked }));
  });

  const metricsToggle = document.getElementById('toggle-metrics') as HTMLInputElement | null;
  metricsToggle?.addEventListener('change', () => {
    void saveConfig(patchTelemetry({ enabled: metricsToggle.checked }));
  });

  document
    .getElementById('metrics-interval-segmented')
    ?.querySelectorAll('.segment-btn')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-val'));
        if (!Number.isFinite(val)) return;
        updateSegmentedUI('metrics-interval-segmented', val);
        void saveConfig(patchTelemetry({ interval: val }));
      });
    });

  const advBtn = document.getElementById('btn-toggle-advanced-settings');
  const advContent = document.getElementById('advanced-settings-content');
  if (advBtn && advContent) {
    advBtn.addEventListener('click', () => {
      const isExpanded = advBtn.classList.contains('expanded');
      advBtn.classList.toggle('expanded', !isExpanded);
      advBtn.setAttribute('aria-expanded', String(!isExpanded));
      advContent.style.display = isExpanded ? 'none' : 'block';
    });
  }

  const labsToggle = document.getElementById('toggle-labs-dev-mode') as HTMLInputElement | null;
  labsToggle?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ labsDeveloperMode: labsToggle.checked }));
  });

  const channelSelect = document.getElementById('select-release-channel') as HTMLSelectElement | null;
  channelSelect?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ releaseChannel: channelSelect.value as any }));
  });

  const byoaToggle = document.getElementById('toggle-byoa') as HTMLInputElement | null;
  byoaToggle?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ isByoa: byoaToggle.checked }));
  });

  const entToggle = document.getElementById('toggle-enterprise-disabled') as HTMLInputElement | null;
  entToggle?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ isEnterpriseDisabled: entToggle.checked }));
  });

  const cdeToggle = document.getElementById('toggle-cde') as HTMLInputElement | null;
  cdeToggle?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ cde: cdeToggle.checked }));
  });

  const hostSelect = document.getElementById('select-host-variant') as HTMLSelectElement | null;
  hostSelect?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ hostVariant: hostSelect.value as any }));
  });

  const micToggle = document.getElementById('toggle-enable-microphone') as HTMLInputElement | null;
  micToggle?.addEventListener('change', () => {
    void saveConfig(patchAdvanced({ enableMicrophone: micToggle.checked }));
  });
}
