// Frontend script for Chuanban Theme Sidecar Web UI

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

async function updateStatus() {
  try {
    const res = await window.sidecar.fetch('/api/status', { method: 'GET' });
    if (!res.ok) return;
    const data = await res.json();

    const badge = document.getElementById('cdp-badge');
    const badgeText = document.getElementById('cdp-status-text');
    const valPort = document.getElementById('val-port');
    const valTargets = document.getElementById('val-targets');
    const valSize = document.getElementById('val-size');
    const valVersion = document.getElementById('val-version');

    if (data.connected) {
      badge.className = 'badge badge-connected';
      badgeText.textContent = 'CDP 正常运行';
    } else {
      badge.className = 'badge badge-disconnected';
      badgeText.textContent = '寻找窗口中';
    }

    if (valPort) valPort.textContent = data.cdpPort || '-';
    if (valTargets) valTargets.textContent = `${data.targetCount || 0} 个窗口`;
    if (valSize) valSize.textContent = data.cssLength ? `${(data.cssLength / 1024).toFixed(1)} KB` : '-';
    if (valVersion) valVersion.textContent = data.patchVersion || 'v5.1.0';

    // Highlight active preset
    if (data.preset) {
      document.querySelectorAll('.preset-chip').forEach(btn => {
        if (btn.getAttribute('data-preset') === data.preset) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  } catch (e) {
    console.error('Failed to update sidecar status:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initial poll & periodic refresh
  updateStatus();
  setInterval(updateStatus, 3000);

  // Reload button
  const reloadBtn = document.getElementById('btn-reload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      reloadBtn.style.opacity = '0.6';
      try {
        const res = await window.sidecar.fetch('/api/reload', { method: 'POST' });
        if (res.ok) {
          const resData = await res.json();
          showToast(`已重载并注入 ${(resData.cssLength / 1024).toFixed(1)} KB 样式`);
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

  // Preset chips
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const preset = chip.getAttribute('data-preset');
      try {
        const res = await window.sidecar.fetch('/api/toggle-preset', {
          method: 'POST',
          body: JSON.stringify({ preset })
        });
        if (res.ok) {
          showToast(`已切换至: ${chip.textContent}`);
          await updateStatus();
        }
      } catch (err) {
        showToast('切换失败');
      }
    });
  });
});
