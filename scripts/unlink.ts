import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const home = os.homedir();
const pluginsDir = path.join(home, '.gemini', 'config', 'plugins');
const targetLink = path.join(pluginsDir, 'aura-dashboard');

if (fs.existsSync(targetLink)) {
  try {
    const stat = fs.lstatSync(targetLink);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(targetLink);
      console.log(`[Aura Unlink] Successfully unlinked: ${targetLink}`);
    } else {
      console.warn(`[Aura Unlink] ${targetLink} is not a symlink. Skipping for safety.`);
    }
  } catch (err) {
    console.error('[Aura Unlink] Error unlinking:', err);
  }
} else {
  console.log('[Aura Unlink] No existing plugin link found.');
}
