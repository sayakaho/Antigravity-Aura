/**
 * Aura Dashboard · Universal Plugin Distribution Build System (Bun)
 *
 * Compiles and packages source code from `src/` into a fully-compliant,
 * self-contained Antigravity Plugin distribution inside `dist/`.
 */

import { build } from 'bun';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SIDECAR_DIST_DIR = path.join(DIST_DIR, 'sidecars', 'dashboard');

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFileSafe(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function runBuild() {
  const startTime = Date.now();
  console.log('[Aura Build] Starting Antigravity plugin distribution build...');

  // 1. Prepare output directory
  ensureDir(SIDECAR_DIST_DIR);
  ensureDir(path.join(SIDECAR_DIST_DIR, 'dist'));
  ensureDir(path.join(SIDECAR_DIST_DIR, 'core'));
  ensureDir(path.join(SIDECAR_DIST_DIR, 'user'));

  // 2. Build Panel Client Bundle (Browser IIFE)
  console.log('[Aura Build] Compiling panel webview client (src/panel/index.ts)...');
  const clientRes = await build({
    entrypoints: [path.join(SRC_DIR, 'panel', 'index.ts')],
    outdir: SIDECAR_DIST_DIR,
    naming: 'app.js',
    minify: true,
    sourcemap: 'external',
    target: 'browser',
    format: 'iife'
  });

  if (!clientRes.success) {
    console.error('[Aura Build] Client build failed:', clientRes.logs);
    process.exit(1);
  }

  // Copy Panel Static Assets with Cache-Busting Version
  const rawHtml = fs.readFileSync(path.join(SRC_DIR, 'panel', 'index.html'), 'utf8');
  const cacheBustedHtml = rawHtml.replace(/\/styles\.css\?v=[^"']*/g, `/styles.css?t=${startTime}`);
  fs.writeFileSync(path.join(SIDECAR_DIST_DIR, 'index.html'), cacheBustedHtml, 'utf8');
  copyFileSafe(path.join(SRC_DIR, 'panel', 'styles.css'), path.join(SIDECAR_DIST_DIR, 'styles.css'));

  // 3. Build Server Aggregator Module (Node ESM)
  console.log('[Aura Build] Compiling server aggregator (src/server/aggregator.ts)...');
  const serverRes = await build({
    entrypoints: [path.join(SRC_DIR, 'server', 'aggregator.ts')],
    outdir: path.join(SIDECAR_DIST_DIR, 'dist'),
    naming: 'aggregator.js',
    minify: false,
    target: 'node',
    format: 'esm'
  });

  if (!serverRes.success) {
    console.error('[Aura Build] Server aggregator build failed:', serverRes.logs);
    process.exit(1);
  }

  // 4. Assemble Sidecar Service Entrypoint & Manifests
  copyFileSafe(path.join(SRC_DIR, 'server', 'index.mjs'), path.join(SIDECAR_DIST_DIR, 'main.mjs'));

  fs.writeFileSync(
    path.join(SIDECAR_DIST_DIR, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2),
    'utf8'
  );

  const sidecarManifest = {
    command: 'node',
    args: ['main.mjs'],
    env: {
      NODE_PATH: path.join(os.homedir(), '.gemini', 'antigravity', 'lib', 'node_modules')
    },
    restart_policy: 'always',
    display_name: 'Aura Dashboard',
    description: 'Antigravity global performance analytics, real-time telemetry and system preferences',
    has_web_ui: true,
    ui_config: {
      display_name: 'Aura Dashboard',
      views: [
        {
          path: '/',
          entrypoint: 'SIDECAR_UI_ENTRYPOINT_AUX_PANE',
          title: 'Aura Dashboard'
        }
      ]
    }
  };
  fs.writeFileSync(
    path.join(SIDECAR_DIST_DIR, 'sidecar.json'),
    JSON.stringify(sidecarManifest, null, 2),
    'utf8'
  );

  // Link sidecar_sdk to node_modules in sidecar directory for native resolution
  const sidecarNodeModules = path.join(SIDECAR_DIST_DIR, 'node_modules');
  ensureDir(sidecarNodeModules);
  const sysSdkDir = path.join(os.homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk');
  const targetSdkDir = path.join(sidecarNodeModules, 'sidecar_sdk');
  if (fs.existsSync(sysSdkDir) && !fs.existsSync(targetSdkDir)) {
    try {
      fs.symlinkSync(sysSdkDir, targetSdkDir, 'dir');
    } catch {
      copyDirRecursive(sysSdkDir, targetSdkDir);
    }
  }

  // 5. Package Injection Assets & Default Presets
  copyDirRecursive(path.join(SRC_DIR, 'injection'), path.join(SIDECAR_DIST_DIR, 'core'));
  copyDirRecursive(path.join(SRC_DIR, 'presets'), path.join(SIDECAR_DIST_DIR, 'user'));

  // 6. Assemble Root Plugin Metadata & Capabilities
  copyFileSafe(path.join(ROOT_DIR, 'plugin.json'), path.join(DIST_DIR, 'plugin.json'));
  copyFileSafe(path.join(ROOT_DIR, 'README.md'), path.join(DIST_DIR, 'README.md'));
  copyFileSafe(path.join(ROOT_DIR, 'SKILL.md'), path.join(DIST_DIR, 'SKILL.md'));
  copyDirRecursive(path.join(ROOT_DIR, 'assets'), path.join(DIST_DIR, 'assets'));
  copyDirRecursive(path.join(ROOT_DIR, 'skills'), path.join(DIST_DIR, 'skills'));

  const elapsed = Date.now() - startTime;
  console.log(`[Aura Build] Plugin distribution successfully assembled into dist/ (${elapsed}ms)`);
}

if (import.meta.main) {
  await runBuild();
}
