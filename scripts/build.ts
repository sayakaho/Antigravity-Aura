/**
 * Aura Dashboard · Universal Plugin Distribution Build System (Bun)
 *
 * Compiles TypeScript entrypoints (`src/panel/index.ts`, `src/injection/index.ts`, `src/server/index.ts`)
 * and packages static assets into a clean Antigravity Plugin distribution inside `dist/`.
 */

import { build } from 'bun';
import fs from 'node:fs';
import path from 'node:path';
import type { EmbeddedAssets } from '../src/types';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SIDECAR_DIST_DIR = path.join(DIST_DIR, 'sidecars', 'dashboard');
const USER_DIST_DIR = path.join(SIDECAR_DIST_DIR, 'user');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 清理 dist/ 内部产物但保留 dist 目录本身，避免破坏 ~/.gemini/config/plugins/aura-dashboard 软链接。
 */
function cleanDirContents(dirPath: string): void {
  ensureDir(dirPath);
  for (const entry of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function copyFileSafe(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

export async function runBuild(isDev = false): Promise<void> {
  const startTime = Date.now();
  const version = readPackageVersion();
  const cacheBustToken = `${version}-${startTime}`;
  const shouldMinify = !isDev;
  console.log(
    `[Aura Build] Starting single-bundle Antigravity plugin build (v${version}, ${isDev ? 'dev' : 'prod'})...`
  );

  // 1. Clean dist contents while preserving root dist/ directory
  cleanDirContents(DIST_DIR);
  ensureDir(SIDECAR_DIST_DIR);
  ensureDir(USER_DIST_DIR);

  // 2. Compile Panel Webview Client in-memory (Browser IIFE)
  const clientRes = await build({
    entrypoints: [path.join(SRC_DIR, 'panel', 'index.ts')],
    minify: shouldMinify,
    sourcemap: 'none',
    target: 'browser',
    format: 'iife'
  });
  if (!clientRes.success || clientRes.outputs.length === 0) {
    throw new Error(`Client build failed:\n${clientRes.logs.map(String).join('\n')}`);
  }
  const panelJs = await clientRes.outputs[0].text();

  // 3. Compile Injection Runtime Engine in-memory (Browser IIFE)
  const runtimeRes = await build({
    entrypoints: [path.join(SRC_DIR, 'injection', 'index.ts')],
    minify: shouldMinify,
    sourcemap: 'none',
    target: 'browser',
    format: 'iife'
  });
  if (!runtimeRes.success || runtimeRes.outputs.length === 0) {
    throw new Error(`Injection runtime build failed:\n${runtimeRes.logs.map(String).join('\n')}`);
  }
  const coreRuntimeJs = await runtimeRes.outputs[0].text();

  // 4. Collect read-only panel + injection assets for inline embedding
  const rawHtml = fs.readFileSync(path.join(SRC_DIR, 'panel', 'index.html'), 'utf8');
  const panelHtml = rawHtml.replace(/__AURA_VERSION__/g, cacheBustToken);
  const panelCss = fs.readFileSync(path.join(SRC_DIR, 'panel', 'styles.css'), 'utf8');
  const coreThemeCss = fs.readFileSync(path.join(SRC_DIR, 'injection', 'theme.css'), 'utf8');
  const coreI18n = JSON.parse(
    fs.readFileSync(path.join(SRC_DIR, 'injection', 'i18n.json'), 'utf8')
  ) as Record<string, string>;

  const embeddedAssets: EmbeddedAssets = {
    panelHtml,
    panelCss,
    panelJs,
    coreThemeCss,
    coreRuntimeJs,
    coreI18n
  };

  // 5. Compile Single-File Sidecar Server with Embedded Assets (Node ESM)
  console.log('[Aura Build] Compiling self-contained sidecar bundle (src/server/index.ts -> main.mjs)...');
  const serverRes = await build({
    entrypoints: [path.join(SRC_DIR, 'server', 'index.ts')],
    outdir: SIDECAR_DIST_DIR,
    naming: 'main.mjs',
    minify: shouldMinify,
    sourcemap: 'none',
    target: 'node',
    format: 'esm',
    external: ['sidecar_sdk', 'node:sqlite'],
    define: {
      __AURA_VERSION__: JSON.stringify(version),
      __AURA_EMBEDDED_ASSETS__: JSON.stringify(embeddedAssets)
    }
  });
  if (!serverRes.success) {
    throw new Error(`Sidecar server build failed:\n${serverRes.logs.map(String).join('\n')}`);
  }

  // 6. Copy ONLY Editable User Customization Seed Templates (`user/*`)
  copyDirRecursive(path.join(SRC_DIR, 'presets'), USER_DIST_DIR);

  // 7. Assemble Sidecar Package & Manifest (cross-platform; host injects sidecar_sdk ESM loader)
  fs.writeFileSync(
    path.join(SIDECAR_DIST_DIR, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2) + '\n',
    'utf8'
  );

  const sidecarManifest = {
    command: 'node',
    args: ['main.mjs'],
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
    JSON.stringify(sidecarManifest, null, 2) + '\n',
    'utf8'
  );

  // 8. Assemble Strict /plugin Root Metadata & Capabilities (no bloated previews or redundant SKILL.md)
  copyFileSafe(path.join(ROOT_DIR, 'plugin.json'), path.join(DIST_DIR, 'plugin.json'));
  copyFileSafe(path.join(ROOT_DIR, 'README.md'), path.join(DIST_DIR, 'README.md'));
  copyFileSafe(path.join(ROOT_DIR, 'LICENSE'), path.join(DIST_DIR, 'LICENSE'));
  copyFileSafe(path.join(ROOT_DIR, 'assets', 'logo.png'), path.join(DIST_DIR, 'assets', 'logo.png'));
  copyDirRecursive(path.join(ROOT_DIR, 'skills'), path.join(DIST_DIR, 'skills'));

  const elapsed = Date.now() - startTime;
  console.log(`[Aura Build] Plugin distribution assembled into dist/ (${elapsed}ms)`);
}

function startWatchMode(): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let building = false;
  let pendingRebuild = false;

  const triggerBuild = async () => {
    if (building) {
      pendingRebuild = true;
      return;
    }
    building = true;
    try {
      await runBuild(true);
    } catch (err) {
      console.error('[Aura Build] Rebuild error:', err);
    } finally {
      building = false;
      if (pendingRebuild) {
        pendingRebuild = false;
        void triggerBuild();
      }
    }
  };

  console.log('[Aura Build] Watching src/ for incremental rebuilds...');
  fs.watch(SRC_DIR, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      console.log(`[Aura Build] Change detected (${filename}), rebuilding...`);
      void triggerBuild();
    }, 150);
  });
}

if (import.meta.main) {
  const watchMode = process.argv.includes('--watch');
  try {
    await runBuild(watchMode);
  } catch (err) {
    console.error('[Aura Build] Fatal error:', err);
    if (!watchMode) process.exit(1);
  }
  if (watchMode) {
    startWatchMode();
  }
}
