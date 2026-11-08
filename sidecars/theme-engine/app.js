// Frontend script for Chuanban Theme Sidecar Web UI (Native Antigravity Style)

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

let currentConfig = null;

async function saveConfig(patch) {
  try {
    const res = await window.sidecar.fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      const data = await res.json();
      currentConfig = data.config;
      showToast('配置已实时生效');
    } else {
      showToast('保存失败');
    }
  } catch (err) {
    console.error('saveConfig failed:', err);
    showToast('请求异常');
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

async function loadConfig() {
  try {
    const res = await window.sidecar.fetch('/api/config', { method: 'GET' });
    if (!res.ok) return;
    const { config } = await res.json();
    currentConfig = config;

    // 1. Preset
    updateSegmentedUI('preset-segmented', config.preset || 'high-contrast');

    // 2. Wax Seal
    const waxToggle = document.getElementById('toggle-wax-seal');
    if (waxToggle) waxToggle.checked = config.composer?.waxSeal !== false;

    // 3. Composer Align
    const alignVal = config.composer?.collinear !== false ? 'collinear' : 'native';
    updateSegmentedUI('composer-align-segmented', alignVal);

    // 4. Hide Arrows
    const arrowsToggle = document.getElementById('toggle-hide-arrows');
    if (arrowsToggle) arrowsToggle.checked = config.composer?.hideArrows !== false;

    // 5. Sans Font
    const sansSelect = document.getElementById('select-font-sans');
    const sansRow = document.getElementById('row-custom-sans');
    const sansInput = document.getElementById('input-custom-sans');
    if (sansSelect) {
      sansSelect.value = config.typography?.sans || 'default';
      if (sansRow) sansRow.style.display = sansSelect.value === 'custom' ? 'flex' : 'none';
    }
    if (sansInput) sansInput.value = config.typography?.customSans || '';

    // 6. Mono Font
    const monoSelect = document.getElementById('select-font-mono');
    const monoRow = document.getElementById('row-custom-mono');
    const monoInput = document.getElementById('input-custom-mono');
    if (monoSelect) {
      monoSelect.value = config.typography?.mono || 'default';
      if (monoRow) monoRow.style.display = monoSelect.value === 'custom' ? 'flex' : 'none';
    }
    if (monoInput) monoInput.value = config.typography?.customMono || '';

    // 7. Font Size
    updateSegmentedUI('font-size-segmented', config.typography?.fontSize || 16);

    // 8. Telemetry
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
      if (text) text.textContent = '正常运行';
      if (sublabel) {
        sublabel.textContent = `已连接至宿主 (${data.targetCount || 1} 个窗口 · 端口 ${data.cdpPort || '-'})`;
      }
    } else {
      if (dot) dot.classList.add('disconnected');
      if (text) text.textContent = '寻找窗口中';
      if (sublabel) sublabel.textContent = '正在检测 Antigravity 宿主调试端口...';
    }
  } catch (e) {
    console.error('updateStatus failed:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Load configuration & start status polling
  loadConfig();
  updateStatus();
  setInterval(updateStatus, 3000);

  // 1. Preset segmented
  const presetContainer = document.getElementById('preset-segmented');
  if (presetContainer) {
    presetContainer.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        updateSegmentedUI('preset-segmented', val);
        saveConfig({ preset: val });
      });
    });
  }

  // 2. Wax Seal toggle
  const waxToggle = document.getElementById('toggle-wax-seal');
  if (waxToggle) {
    waxToggle.addEventListener('change', () => {
      saveConfig({ composer: { waxSeal: waxToggle.checked } });
    });
  }

  // 3. Composer Align segmented
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

  // 4. Hide Arrows toggle
  const arrowsToggle = document.getElementById('toggle-hide-arrows');
  if (arrowsToggle) {
    arrowsToggle.addEventListener('change', () => {
      saveConfig({ composer: { hideArrows: arrowsToggle.checked } });
    });
  }

  // 5. Sans font select & custom input
  const sansSelect = document.getElementById('select-font-sans');
  const sansRow = document.getElementById('row-custom-sans');
  const sansInput = document.getElementById('input-custom-sans');
  if (sansSelect) {
    sansSelect.addEventListener('change', () => {
      const isCustom = sansSelect.value === 'custom';
      if (sansRow) sansRow.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        saveConfig({ typography: { sans: sansSelect.value } });
      } else if (sansInput) {
        sansInput.focus();
      }
    });
  }
  if (sansInput) {
    const commitCustomSans = () => {
      if (sansSelect && sansSelect.value === 'custom') {
        saveConfig({ typography: { sans: 'custom', customSans: sansInput.value.trim() } });
      }
    };
    sansInput.addEventListener('change', commitCustomSans);
    sansInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitCustomSans();
        sansInput.blur();
      }
    });
  }

  // 6. Mono font select & custom input
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
    const commitCustomMono = () => {
      if (monoSelect && monoSelect.value === 'custom') {
        saveConfig({ typography: { mono: 'custom', customMono: monoInput.value.trim() } });
      }
    };
    monoInput.addEventListener('change', commitCustomMono);
    monoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitCustomMono();
        monoInput.blur();
      }
    });
  }

  // 7. Font size segmented
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

  // 8. Telemetry toggle & interval
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

  // 9. Force Reload Button
  const reloadBtn = document.getElementById('btn-force-reload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      reloadBtn.style.opacity = '0.6';
      try {
        const res = await window.sidecar.fetch('/api/reload', { method: 'POST' });
        if (res.ok) {
          const resData = await res.json();
          showToast(`已强制重载并注入 ${(resData.cssLength / 1024).toFixed(1)} KB 样式`);
          await updateStatus();
        } else {
          showToast('重载失败');
        }
      } catch (err) {
        showToast('请求异常');
      } finally {
        reloadBtn.disabled = false;
        reloadBtn.style.opacity = '1';
      }
    });
  }
});
