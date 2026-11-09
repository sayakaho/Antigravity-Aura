import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EmbeddedAssets } from '../types';

declare const __AURA_VERSION__: string | undefined;
declare const __AURA_EMBEDDED_ASSETS__: EmbeddedAssets | undefined;

export const EMBEDDED_ASSETS: EmbeddedAssets | null = (() => {
  try {
    // Reference the compile-time define exactly once so Bun never duplicates the embedded JSON literal.
    return __AURA_EMBEDDED_ASSETS__ ?? null;
  } catch {
    return null;
  }
})();

export const HERE = path.dirname(fileURLToPath(import.meta.url));

function resolveDir(prodSub: string, devSub: string): string {
  const prodPath = path.join(HERE, prodSub);
  if (fs.existsSync(prodPath)) return prodPath;
  const devPath = path.resolve(HERE, devSub);
  if (fs.existsSync(devPath)) return devPath;
  return prodPath;
}

export const CORE_DIR = resolveDir('core', '../injection');
export const TEMPLATE_USER_DIR = resolveDir('user', '../presets');
export const USER_DIR =
  process.env.PLUGIN_DATA || process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || TEMPLATE_USER_DIR;
export const ASSETS_DIR = resolveDir('assets', '../../assets');
export const ANTIGRAVITY_DATA_DIR = path.join(os.homedir(), '.gemini', 'antigravity');
export const CONVERSATIONS_DIR = path.join(ANTIGRAVITY_DATA_DIR, 'conversations');

export function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function readTextSafe(filePath: string, fallback = ''): string {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

export function getFileMtimeSig(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return '0:0';
    const st = fs.statSync(filePath);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return '0:0';
  }
}

export function getAppVersion(): string {
  if (typeof __AURA_VERSION__ === 'string' && __AURA_VERSION__) {
    return __AURA_VERSION__;
  }
  const pkg = readJsonSafe<{ version?: string }>(path.resolve(HERE, '../../package.json'), {});
  return pkg.version || '0.1.0';
}

export function initDataDirectory(): void {
  try {
    if (!fs.existsSync(USER_DIR)) {
      fs.mkdirSync(USER_DIR, { recursive: true });
    }
    const seedFiles = ['config.json', 'custom.css', 'custom.js', 'i18n.override.json'];
    for (const file of seedFiles) {
      const dest = path.join(USER_DIR, file);
      const src = path.join(TEMPLATE_USER_DIR, file);
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch (err) {
    console.error('[Sidecar Engine] Failed to initialize data directory:', err);
  }
}
