/**
 * Aura Dashboard · Bun Build Script
 * Builds both browser client bundle and Node.js server modules
 */

import { build } from "bun";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir);
const distDir = resolve(rootDir, "dist");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Clean up legacy build artifacts if present
for (const legacy of ["bundle.js", "bundle.js.map"]) {
  const p = resolve(distDir, legacy);
  if (existsSync(p)) {
    try {
      unlinkSync(p);
    } catch {}
  }
}

console.log("[Aura Dashboard] Building client bundle with Bun...");

const clientResult = await build({
  entrypoints: [resolve(rootDir, "src/client/index.ts")],
  outdir: rootDir,
  naming: "app.js",
  minify: true,
  sourcemap: "external",
  target: "browser",
  format: "iife",
});

if (!clientResult.success) {
  console.error("[Aura Dashboard] Client build failed:", clientResult.logs);
  process.exit(1);
}

console.log("[Aura Dashboard] Building server aggregator with Bun...");

const serverResult = await build({
  entrypoints: [resolve(rootDir, "src/server/aggregator.ts")],
  outdir: distDir,
  naming: "aggregator.js",
  minify: false,
  target: "node",
  format: "esm",
});

if (!serverResult.success) {
  console.error("[Aura Dashboard] Server build failed:", serverResult.logs);
  process.exit(1);
}

console.log("[Aura Dashboard] Build succeeded! Outputs: app.js & dist/aggregator.js");
