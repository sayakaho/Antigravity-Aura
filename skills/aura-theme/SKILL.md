---
name: aura-theme
description: Control, inspect, configure, and extend the Antigravity Aura (aura-dashboard) plugin—covering Claude-inspired light/dark themes, multi-chain typography, bilingual localization (English / Simplified Chinese), composer layout controls, live telemetry capsule and performance analytics (TPS, TTFT, tokens, cost), host resilience/experimental flags, user runtime customization (config.json, custom.css, custom.js, i18n.override.json), CDP hot reload, and Sidecar HTTP APIs.
---

# Antigravity Aura (`aura-dashboard`) Control & Technical Reference

This skill equips agents to configure appearance, typography, language, composer layout, host flags, and `PLUGIN_DATA` customizations, as well as inspect real-time telemetry and historical analytics via the **Aura Dashboard** native Plugin + Sidecar architecture.

### Quick UI Links
- Open Sidecar Panel (Analytics & Preferences): `[Aura Dashboard](sidecar://aura-dashboard/dashboard/)`
- Open Plugin Management Page: `[Aura Dashboard](customization://aura-dashboard)`

---

## 1. Presets, Typography & Feature Reference

### Theme Presets
| Scope | Preset Key | Description |
| :--- | :--- | :--- |
| `presets.light` | `high-contrast` | Claude Light — high-contrast warm paper palette with crisp readability |
| `presets.light` | `claude-desktop-purewhite` | Pure Light — pure white surface paired with subtle paper accents |
| `presets.dark` | `claude-dark` | Claude Dark — soft, low-fatigue carbon slate dark palette |
| `presets.dark` | `vintage-dark` | Vintage Deep — deep espresso brown dark theme |
| Both | `default` | Native Default — preserve original host colors |

*(Legacy preset keys such as `chuanban-warm-white`, `claude-desktop-official`, `vintage-deep`, and `absoulutely-chuanban` are automatically migrated by `normalizeAuraConfig` in `src/shared/config-schema.ts`.)*

### Typography
- **Primary Latin Sans (`typography.primarySans`)**: e.g., `Anthropic Sans`, `Anthropic Serif Web`, `Inter`, or `'default'` / `'custom'` (`customPrimarySans`).
- **CJK Fallback (`typography.fallbackSans`)**: e.g., `Sarasa UI SC`, `LXGW WenKai Medium`, `PingFang SC`, or `'custom'` (`customFallbackSans`).
- **Monospace (`typography.mono`)**: e.g., `Anthropic Mono`, `Sarasa Mono SC`, `JetBrains Mono`, or `'custom'` (`customMono`).
- **Chat Font Size (`typography.fontSize`)**: Integer in `[10, 28]` px (default `15`).

---

## 2. Configuration & `PLUGIN_DATA` Customization Layer

On first startup, the Sidecar seeds missing files from `<plugin_root>/sidecars/dashboard/user/` into the persistent data directory without overwriting user changes:
- **Effective Directory**: `process.env.PLUGIN_DATA || process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR`, defaulting to `~/.gemini/antigravity/plugin_data/aura-dashboard/`.

| File | Purpose |
| :--- | :--- |
| `config.json` | Schema-validated master configuration (`AuraConfig`). |
| `custom.css` | User stylesheet appended after built-in styles when `modules.customCss` is `true`. |
| `i18n.override.json` | Custom JSON dictionary merged on top of built-in `zh-CN` translations. |
| `custom.js` | Top-level window hook evaluated with `(ctx, boot)` when `modules.customJs` is `true`. |

### Validated `AuraConfig` Fields
- `enabled` (`boolean`): Master toggle; `false` cleanly uninstalls runtime DOM attributes/nodes and restores original i18n text.
- `channel`: `'auto' | 'light' | 'dark'` (default `'auto'`).
- `language`: `'default' | 'zh-CN'` (default `'default'` English native; `'zh-CN'` enables non-destructive `WeakMap` Simplified Chinese localization).
- `composer`: `{ collinear: boolean, waxSeal: boolean, hideArrows: boolean }`.
- `telemetry`: `{ enabled: boolean, interval: number }` (`interval` clamped to `500–30000` ms, default `2000`).
- `modules`: `{ deadlockHealer: boolean, customCss: boolean, customJs: boolean }`.
- `advanced`: `{ labsDeveloperMode: boolean, experimentalFlags: Record<string, boolean> }` — crash-prone flags `labs-concierge-agent` and `context-window-selector` are stripped at both schema validation and browser storage sync layers.
- `themeVars`: `Record<string, string>` CSS variable overrides (send `""` or `null` in a config patch to delete a key).
- `selectors`: `{ inputBoxId, branchPillInBox, homeGreeting, excludeI18n }`.
- `contextLimit` *(optional)*: Positive integer in `[1000, 10000000]` (default `256000`).

### `user/custom.js` Sandbox Context (`ctx` / `boot`)
Passed into the top-level window script when `modules.customJs` is enabled:
`version`, `preset`, `config`, `modules`, `features`, `themeVars`, `dict`, `metrics` *(live getter)*, `syncPreset()`, `ensureMetricsPill(forceLayout?)`.

---

## 3. Sidecar HTTP API & Direct Control

The Sidecar listens locally on `ANTIGRAVITY_SIDECAR_WEB_PORT` (standalone fallback `51980`):

| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/status` | CDP connection status, target count, port, bundle version hash, CSS size, active preset/modules, and latest live metrics. |
| `GET /api/config` | Returns normalized `PanelConfigDTO`. |
| `POST /api/config` | Validates and applies a partial `AuraConfig` patch via `applyConfigPatch` (HTTP `400` on invalid types/ranges) and pushes hot updates over CDP. |
| `POST /api/reload` | Recompiles `user/*` assets and bundle, then pushes updates to all connected host windows. |
| `GET /api/system-fonts` | Enumerates locally installed fonts via host font query + `fc-list`. |
| `GET /api/analytics/overview` | Returns global token totals, cache efficiency, weighted/P50 TPS, avg TTFT, turn latency, daily/hourly series, model/tool/project distributions. |
| `GET /api/analytics/session?id=<uuid>` | Returns step-by-step TPS, TTFT, latency, token counts, and model/tool breakdowns for the target or latest active conversation. |

### Common CLI & `curl` Examples

```bash
# Inspect Sidecar & CDP status
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/status

# Switch Light/Dark presets and enable Simplified Chinese UI
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/config \
  -H "Content-Type: application/json" \
  -d '{"language": "zh-CN", "presets": {"light": "high-contrast", "dark": "claude-dark"}}'

# Update typography & composer layout
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/config \
  -H "Content-Type: application/json" \
  -d '{"typography": {"primarySans": "Anthropic Sans", "mono": "Anthropic Mono", "fontSize": 16}, "composer": {"collinear": true, "waxSeal": true}}'

# Recompile user/* files and push live styles to all open windows
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/reload

# Inspect analytics overview or active session metrics
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/analytics/overview
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/analytics/session
```

---

## 4. Source Architecture & Build Boundaries (Repo Development)

When modifying plugin source code inside the repository rather than editing runtime files in `PLUGIN_DATA`:

- **Single-Bundle Inlining**: `scripts/build.ts` compiles `src/panel/index.ts` and `src/injection/index.ts` in-memory, embeds read-only panel/injection HTML, CSS, JS, and `i18n.json` via `define.__AURA_EMBEDDED_ASSETS__` into `dist/sidecars/dashboard/main.mjs` (`EMBEDDED_ASSETS` returns `null` in unit tests so disk fallback remains active), and copies `src/presets/*` into `dist/sidecars/dashboard/user/`.
- **Unified TPS Contract**: Live telemetry capsule and all Analytics views share the exact same throughput rules in `src/shared/tps.ts` (`stream >= 0.25s` and `rate ∈ (0, 600] tok/s`, otherwise E2E latency; token-weighted aggregations).
- **Build & Validate Commands**:
  ```bash
  bun run typecheck && bun test && bun run build
  agy plugin validate ./dist
  bun run link:plugin
  ```
