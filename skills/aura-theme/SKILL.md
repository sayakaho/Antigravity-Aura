---
name: aura-theme
description: Control, inspect, configure, and extend the Antigravity Aura (aura-dashboard) plugin—covering Claude-inspired light/dark themes, multi-chain typography, multilingual localization (English, Simplified Chinese, Japanese, Korean), authentic Google account switcher & Language Server restart synchronization, quota calibration and token analytics, host resilience (auto-healer), user runtime customization, CDP hot reload, and Sidecar HTTP APIs.
---

# Antigravity Aura (`aura-dashboard`) Control & Technical Reference

This skill equips agents to configure appearance, typography, language, composer layout, Google account management, host flags, and `PLUGIN_DATA` customizations, as well as inspect real-time telemetry and historical analytics via the **Aura Dashboard** native Plugin + Sidecar architecture.

### Quick UI Links
- Open Sidecar Panel (Analytics & Preferences): `[Aura Dashboard](sidecar://aura-dashboard/dashboard/)`
- Open Plugin Management Page: `[Aura Dashboard](customization://aura-dashboard)`

---

## 1. Presets, Typography & Multilingual Reference

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

### Multilingual Localization (`config.language`)
Supports non-destructive `WeakMap`-based dynamic DOM text replacement:
- `'default'`: Native English interface.
- `'zh-CN'`: Simplified Chinese (简体中文).
- `'ja-JP'`: Japanese (日本語).
- `'ko-KR'`: Korean (한국어).

---

## 2. Configuration, Account Vault & `PLUGIN_DATA` Layer

On first startup, the Sidecar seeds template files from `<plugin_root>/sidecars/dashboard/user/` into the persistent data directory without overwriting user changes:
- **Effective Directory**: `process.env.PLUGIN_DATA || process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR`, defaulting to `~/.gemini/antigravity/plugin_data/aura-dashboard/`.

| File | Purpose |
| :--- | :--- |
| `config.json` | Schema-validated master configuration (`AuraConfig`). |
| `accounts_vault.json` | Persistent snapshot database of saved Google accounts, OAuth tokens, avatars, and membership tiers. |
| `account_timeline.json` | Temporal intervals tracking active account spans for token usage attribution across sessions. |
| `quota_calibration.json` | Empirical 5h and weekly quota token capacities calibrated against Language Server summary RPCs. |
| `custom.css` | User stylesheet appended after built-in styles when `modules.customCss` is `true`. |
| `i18n.override.json` | Custom JSON dictionary merged on top of active translation dictionaries. |
| `custom.js` | Top-level window hook evaluated with `(ctx, boot)` when `modules.customJs` is `true`. |

### Validated `AuraConfig` Fields
- `enabled` (`boolean`): Master toggle; `false` cleanly uninstalls runtime DOM attributes/nodes and restores original i18n text.
- `channel`: `'auto' | 'light' | 'dark'` (default `'auto'`).
- `language`: `'default' | 'zh-CN' | 'ja-JP' | 'ko-KR'` (default `'default'`).
- `composer`: `{ collinear: boolean, waxSeal: boolean, hideArrows: boolean }`.
- `telemetry`: `{ enabled: boolean, interval: number }` (`interval` clamped to `500–30000` ms, default `2000`).
- `modules`: `{ deadlockHealer: boolean, customCss: boolean, customJs: boolean }`.
- `advanced`: `{ labsDeveloperMode: boolean, experimentalFlags: Record<string, boolean> }` — crash-prone flags `labs-concierge-agent` and `context-window-selector` are stripped at both schema validation and browser storage sync layers.
- `themeVars`: `Record<string, string>` CSS variable overrides (send `""` or `null` in a config patch to delete a key).
- `selectors`: `{ inputBoxId, branchPillInBox, homeGreeting, excludeI18n }`.

### Host Resilience & Auto-Healer
`src/server/host-healer.ts` automatically inspects the Antigravity host `app.asar` on Sidecar boot. If `--remote-debugging-port=0` is missing from `dist/main.js`, it patches the asar in-place in memory, establishing CDP connectivity without requiring terminal command lines or manual tooling.

---

## 3. Account Management & Language Server Synchronization

Aura embeds an authentic Google Account Switcher bar directly into the host sidebar (`src/injection/account-bar.ts`), featuring real avatars, display names, emails, and subscription badges with a Material Design 3 Google One style popover.

### Account Switching Pipeline
When switching accounts (`/api/accounts/switch` or UI click):
1. **Keychain Update**: Writes the target OAuth payload into the macOS Keychain under `service="gemini", account="antigravity"`.
2. **App Storage Update**: Synchronizes `agy.onboarding.lastLoginUsername` in `~/Library/Application Support/Antigravity/app_storage.json`.
3. **Language Server Restart**: Antigravity's core auth context resides inside the background `language_server` binary. Aura triggers a graceful exit via `LanguageServerService/Exit` RPC (with fallback to `SIGTERM` on the hub PID). Electron's `monitorLsCrashInternal` supervisor automatically re-spawns the Language Server after a 2-second cooldown, forcing it to reload the newly written Keychain credentials.
4. **Host Window Reload**: Dispatches a CDP `Page.reload` to re-mount the UI with the fresh session.

---

## 4. Sidecar HTTP API & Direct Control

The Sidecar listens locally on `ANTIGRAVITY_SIDECAR_WEB_PORT` (standalone fallback `51980`):

### General & Preferences
| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/status` | CDP connection status, target count, port, bundle version hash, CSS size, active preset/modules, and latest live metrics. |
| `GET /api/config` | Returns normalized `PanelConfigDTO`. |
| `POST /api/config` | Validates and applies a partial `AuraConfig` patch via `applyConfigPatch` (HTTP `400` on invalid types/ranges) and pushes hot updates over CDP. |
| `POST /api/reload` | Recompiles `user/*` assets and bundle, then pushes updates to all connected host windows. |
| `POST /api/reload-window` | Triggers a hard reload of all attached host Electron windows over CDP. |
| `GET /api/system-fonts` | Enumerates locally installed fonts via host font query + `fc-list`. |
| `POST /api/open-directory` | Opens a local directory path in the OS file manager (Finder / Explorer). |

### Account Vault & Management
| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/accounts/vault` | Returns the current active account email and all saved account profiles from `accounts_vault.json`. |
| `POST /api/accounts/save-current` | Captures active Keychain credentials into the persistent vault. |
| `POST /api/accounts/switch` | Body: `{"email": "user@example.com", "reloadWindow": true}`. Updates Keychain, restarts Language Server, and reloads host window. |
| `POST /api/accounts/delete` | Body: `{"email": "user@example.com"}`. Removes target account from the vault. |
| `GET /api/analytics/accounts` | Returns current active account email and timeline history for token usage attribution. |

### Analytics & Telemetry
| Method & Path | Purpose |
| :--- | :--- |
| `GET /api/analytics/overview` | Global token totals, cache efficiency, weighted/P50 TPS, avg TTFT, turn latency, daily/hourly series, model/tool/project distributions. |
| `GET /api/analytics/session?id=<uuid>` | Step-by-step TPS, TTFT, latency, token counts, and model/tool breakdowns for the target or latest active conversation. |

### Common CLI & `curl` Examples

```bash
# Inspect Sidecar & CDP status
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/status

# Switch Language to Japanese and presets to High Contrast / Claude Dark
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/config \
  -H "Content-Type: application/json" \
  -d '{"language": "ja-JP", "presets": {"light": "high-contrast", "dark": "claude-dark"}}'

# List saved Google accounts in vault
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/accounts/vault

# Switch to a target Google account (updates Keychain, restarts LS, reloads window)
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/accounts/switch \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Recompile user/* files and push live styles to all open windows
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/reload

# Inspect analytics overview or active session metrics
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/analytics/overview
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/analytics/session
```

---

## 5. Source Architecture & Build Boundaries (Repo Development)

When modifying plugin source code inside the repository rather than editing runtime files in `PLUGIN_DATA`:

- **Single-Bundle Inlining**: `scripts/build.ts` compiles `src/panel/index.ts` and `src/injection/index.ts` in-memory, embeds read-only panel/injection HTML, CSS, JS, and `i18n.json` via `define.__AURA_EMBEDDED_ASSETS__` into `dist/sidecars/dashboard/main.mjs` (`EMBEDDED_ASSETS` returns `null` in unit tests so disk fallback remains active), and copies `src/presets/*` into `dist/sidecars/dashboard/user/`.
- **Unified TPS Contract**: Live telemetry capsule and all Analytics views share the exact same throughput rules in `src/shared/tps.ts` (`stream >= 0.25s` and `rate ∈ (0, 600] tok/s`, otherwise E2E latency; token-weighted aggregations).
- **Build & Validate Commands**:
  ```bash
  bun run typecheck && bun test && bun run build
  agy plugin validate ./dist
  bun run link:plugin
  ```
