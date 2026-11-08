import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const home = os.homedir();
const pluginsDir = path.join(home, '.gemini', 'config', 'plugins');
const targetLink = path.join(pluginsDir, 'aura-dashboard');
const distPath = path.resolve(import.meta.dir, '..', 'dist');

if (!fs.existsSync(distPath)) {
  console.error('[Aura Link] dist/ does not exist. Please run "bun run build" first.');
  process.exit(1);
}

if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}

if (fs.existsSync(targetLink)) {
  try {
    const stat = fs.lstatSync(targetLink);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(targetLink);
    }
  } catch (err) {
    console.error('[Aura Link] Failed to remove existing symlink:', err);
  }
}

try {
  fs.symlinkSync(distPath, targetLink, 'dir');
  console.log(`[Aura Link] Successfully linked plugin: ${targetLink} -> ${distPath}`);
  console.log('[Aura Link] Please restart Antigravity to load the plugin.');
} catch (err) {
  console.error('[Aura Link] Symlink creation failed:', err);
  process.exit(1);
}
