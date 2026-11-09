<div align="center">

<img src="assets/logo.svg" alt="Antigravity Aura" width="88" height="88" />

# Antigravity Aura

**Native Plugin + Sidecar suite delivering Claude-inspired themes, multi-layer typography, bilingual localization, and real-time SQLite performance telemetry for Google Antigravity.**

[![Version](https://img.shields.io/badge/version-0.1.0-7A1F1A.svg)](https://github.com/sayakaho/Antigravity-Aura/releases)
[![Release CI](https://github.com/sayakaho/Antigravity-Aura/actions/workflows/release.yml/badge.svg)](https://github.com/sayakaho/Antigravity-Aura/actions/workflows/release.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13.0%20(node%3Asqlite)-339933.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/sayakaho/Antigravity-Aura)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](package.json)

English | [简体中文](README.zh-CN.md)

[Features](#features) · [Screenshots](#screenshots) · [Installation](#installation) · [Configuration](#configuration) · [Architecture](#architecture) · [Development](#development) · [Attribution](#attribution)

</div>

---

## Overview

**Antigravity Aura** (packaged as `aura-dashboard`) runs cleanly inside Google Antigravity's native **Plugin + Sidecar** lifecycle. Rather than patching client `.asar` archives or running external OS daemons, the Sidecar boots alongside the host application, discovers active windows over Chrome DevTools Protocol (CDP), parses Antigravity's local SQLite conversation store with built-in `node:sqlite`, and serves an integrated Auxiliary Pane Webview for live analytics and customization.

---

## Screenshots

> [!NOTE]
> Screenshot slots are reserved below for the current v0.1.0 release UI. Capture images to the paths listed and uncomment the image tags to display them here.

### Workspace & Live Telemetry Capsule

> **Placeholder** — Save screenshot to `assets/screenshot-workspace.png`  
> Recommended view: main workspace with Light/Dark theme active, collinear composer bottom toolbar, and live telemetry capsule (`tok/s · TTFT · Ctx · Out`) with hover details.

<!-- ![Workspace & Telemetry Capsule](assets/screenshot-workspace.png) -->

### Analytics Dashboard & Preferences

| Analytics View (`assets/screenshot-analytics.png`) | Preferences View (`assets/screenshot-preferences.png`) |
| :--- | :--- |
| **Placeholder** — KPI summary cards, Token Activity (`Overview` / `Timeline`), `Model Speed Trends`, and `Turn Latency vs. TTFT` scatter plot. | **Placeholder** — Light/Dark theme presets, system font selectors, telemetry polling interval, CDP connection status, and instant hot-reload controls. |
| <!-- ![Analytics Dashboard](assets/screenshot-analytics.png) --> | <!-- ![Preferences Console](assets/screenshot-preferences.png) --> |

---

## Features

- **Claude-Inspired Light & Dark Presets**: Independent configuration for Light (`Claude Light`, `Pure Light`, `Native Default`) and Dark (`Claude Dark`, `Vintage Deep`, `Native Default`) appearances.
- **Three-Chain Typography System**: Automatic enumeration of locally installed fonts via host APIs and `fc-list`, with separate stacks for primary Latin sans, CJK fallback, monospace code blocks, and reading size (`10–28px`).
- **Composer & Interface Refinements**:
  - Collinear bottom toolbar alignment (telemetry capsule, model selector, and mode selector aligned horizontally with optional arrow hiding).
  - Optional Vintage Wax Seal composer focus border and new-session toolbar hover styling fixes.
  - Bilingual UI localization (`English (Default)` / `Chinese (Simplified)`) with reversible `WeakMap` text restoration and custom dictionary overrides.
- **Real-Time Telemetry Capsule**: Inline composer indicator polling local SQLite/Protobuf conversation data (`tok/s · TTFT · Ctx% · Out`); click to toggle the Auxiliary Pane.
- **Multi-Dimensional Analytics Dashboard**:
  - Eight selectable time ranges (`Session`, `Today`, `Yesterday`, `This Week`, `This Month`, `Last 7 Days`, `Last 30 Days`, `Custom`).
  - Unified weighted TPS rules across capsule, session turns, model trends, and daily/hourly rollups via [`src/shared/tps.ts`](src/shared/tps.ts).
  - Six KPI cards (tokens, weighted/P50 throughput & turn latency, requests/turns, cache hit rate, average TTFT, per-model API cost estimate), `Overview` / `Timeline` session charts, `Turn Latency vs. TTFT` scatter distribution (`P50` / `P95` references), and model/tool/workspace breakdowns.
- **Host Resilience & Hot Reload**: Routing deadlock and zoom-shortcut healers, `StorageEvent`-synchronized safe experimental flags (blocking unstable flags at both schema and injection layers), and instant CDP style hot-reload (`Reapply Now`).

---

## Requirements

| Dependency | Requirement | Scope |
| :--- | :--- | :--- |
| **Google Antigravity** | Native Plugin + Sidecar support, CDP enabled | Runtime |
| **Node.js** | `>= 22.13.0` (built-in `node:sqlite`) | Runtime |
| **Bun** | `>= 1.2` | Source build & tests only |
| **Platform** | macOS, Windows, or Linux | Runtime & build |

---

## Installation

### Option 1: Install from Release Archive (Recommended)

1. Download the latest `aura-dashboard-v*.zip` (and optional `.sha256` checksum) from [GitHub Releases](https://github.com/sayakaho/Antigravity-Aura/releases).
2. Extract the archive contents directly into:
   ```text
   ~/.gemini/config/plugins/aura-dashboard
   ```
   *(Ensure `plugin.json` sits at the root of that folder.)*
3. Restart Antigravity. Click the telemetry capsule on the composer or open **⋮ → Extensions → Aura Dashboard** in the session header.

### Option 2: Build & Link from Source

```bash
git clone https://github.com/sayakaho/Antigravity-Aura.git
cd Antigravity-Aura

bun install
bun run typecheck      # Strict TypeScript check
bun test               # Unit test suite
bun run build          # Production single-bundle build into dist/
bun run link:plugin    # Symlink dist/ -> ~/.gemini/config/plugins/aura-dashboard
```

Verify the packaged manifest and manage plugin activation using the Antigravity CLI:

```bash
agy plugin validate ./dist
agy plugin enable aura-dashboard
agy plugin disable aura-dashboard
```

---

## Configuration

All visual, typography, telemetry, and advanced settings can be adjusted live from **Auxiliary Pane → Preferences** without restarting Antigravity.

For file-based customization, Antigravity provisions a persistent `PLUGIN_DATA` directory on first launch at `~/.gemini/antigravity/plugin_data/aura-dashboard/` seeded from [`src/presets/`](src/presets). Existing files are never overwritten across plugin upgrades.

| File | Purpose |
| :--- | :--- |
| `config.json` | Schema-validated plugin configuration (`presets`, `typography`, `composer`, `telemetry`, `language`, `advanced`). |
| `custom.css` | User stylesheet appended after built-in theme rules when `modules.customCss` is enabled. |
| `custom.js` | Top-level window extension script receiving the runtime `ctx` sandbox when `modules.customJs` is enabled. |
| `i18n.override.json` | Custom key-value overrides merged on top of the built-in localization dictionary (`zh-CN`). |

> **Optional Fonts**: High-contrast typography presets pair well with `Anthropic Sans`, `Anthropic Serif`, `Anthropic Mono`, `Sarasa Gothic`, or `LXGW WenKai`. Any installed system font can be selected directly in Preferences.

---

## Architecture

```text
Antigravity Host (Electron + CDP + Local SQLite/Protobuf Store)
   │
   ├──► Sidecar Server (dist/sidecars/dashboard/main.mjs)
   │       ├── SQLite + BigInt Protobuf Decoder & Global Analytics Cache
   │       ├── Config Normalizer & Live Injection Bundle Compiler
   │       ├── CDP Client Manager (auto-discovery + hot CSS/JS injection)
   │       └── HTTP UI & REST API (Auxiliary Pane Webview)
   │
   └──► Host Top-Level Window (Injected Runtime)
           ├── Theme Presets, Typography Vars & Wax Seal / Collinear Composer
           ├── WeakMap UI Localizer & Routing/Zoom Healers
           └── Inline Telemetry Capsule + Safe Experiment StorageEvent Sync
```

<details>
<summary>Repository Structure</summary>

```text
Antigravity-Aura/
├── .github/workflows/release.yml   # Automated CI verification, Release Zip & SHA256 workflow
├── assets/                         # Plugin SVG icon and documentation preview assets
├── scripts/                        # Bun build pipeline (build.ts, link.ts, unlink.ts)
├── skills/aura-theme/SKILL.md      # Runtime agent skill distributed inside the plugin bundle
├── src/
│   ├── injection/                  # Browser runtime engine, theme.css, i18n, healers, experiments
│   ├── panel/                      # Auxiliary Pane frontend (analytics/*, settings, theme-sync)
│   ├── presets/                    # Seed templates copied to dist/sidecars/dashboard/user/
│   ├── server/                     # Sidecar Node ESM backend, SQLite/Protobuf, CDP & HTTP API
│   ├── shared/                     # Shared pure modules (tps, config-schema, catalog, format)
│   └── types/                      # Shared TypeScript contracts & Sidecar SDK declarations
├── tests/                          # Bun unit tests across analytics, schema, proto & injection
├── package.json
├── plugin.json                     # Antigravity /plugin manifest
├── SKILL.md                        # Developer & AI Agent technical contract reference
└── tsconfig.json
```

</details>

For complete technical contracts, schema details, embedded-asset boundaries, and Sidecar HTTP API documentation, see [`SKILL.md`](SKILL.md).

---

## Development

```bash
bun run dev            # Watch src/ and rebuild dist/ incrementally
bun run typecheck      # Run TypeScript compiler in strict mode
bun test               # Execute all unit tests
bun run build          # Produce optimized single-bundle dist/ (11 files, ~308 KB)
bun run unlink:plugin  # Remove ~/.gemini/config/plugins/aura-dashboard symlink
```

Releases are automated via [`.github/workflows/release.yml`](.github/workflows/release.yml) on `v*` git tag pushes or manual `workflow_dispatch` runs, running frozen installs, typechecking, unit tests, Node 22 `node:sqlite` + syntax checks, `/plugin` layout validation, and checksum packaging.

---

## Attribution

**Antigravity Aura** originally evolved from [**Anarcadia/chuanban-antigravity-theme-patch**](https://github.com/Anarcadia/chuanban-antigravity-theme-patch) created by **船板 ([@Anarcadia](https://github.com/Anarcadia))**, whose early work is gratefully acknowledged:

- **Inherited Foundations**: The warm-paper high-contrast light palette concept, multi-chain `Anthropic` / `Sarasa` typography pairing, base Simplified Chinese UI dictionary, inline composer metrics capsule idea, and settings routing deadlock fix approach.
- **Independent Evolution**: Transitioned away from external OS background daemons to Antigravity's native `Plugin + Sidecar` lifecycle; rewrote the full stack in Strict TypeScript with Bun single-bundle embedding; added the Auxiliary Pane Analytics & Preferences Webview, dark presets (`claude-dark` / `vintage-dark`), toggleable UI language, unified TPS engine, collinear new-session hover fixes, `StorageEvent` experiment synchronization, unit tests, and automated CI/Release workflows.
- **History & License**: Full Git commit history is preserved in this repository to maintain transparent attribution. Project metadata and original code added here are declared under the [`MIT`](package.json) license (note: the upstream repository did not ship a `LICENSE` file).
