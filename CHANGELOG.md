# Changelog

All notable changes to **Antigravity Aura** will be documented in this file.

## [0.3.3] - 2026-11-19

### Changed
- **Dynamic Context Waterline via Host Checkpointer**: Deprecated redundant `contextLimit` user configuration. The telemetry capsule now dynamically reads the exact context compression watermark from the Language Server's `GetAvailableModels` (`CASCADE_USE_EXPERIMENT_CHECKPOINTER.max_token_limit`, falling back to `maxTokens`), with offline recovery from SQLite `gen_metadata` (`ctxLimit`).
- **Active Model Switching Tracking**: Monitored the host's `[data-testid="model-selector-trigger"]` via CDP and injection observers to immediately refresh context limits and telemetry metrics upon switching models.

## [0.3.2] - 2026-11-19

### Added
- **Authentic Google Account Switcher & Vault Sync**: Integrated in-panel Google account switcher bar featuring authentic user avatar, real name, email, subscription plan badge, and automatic Keychain/storage credential vault synchronization.
- **Client Toggle & Server Entitlement Guidance**: Added clear, multilingual warning notices (`* Client-side toggles only`) at the top of the Advanced Settings panel and under BYOA to clarify that client toggles depend on Google server-side service entitlements.
- **Strict Base Key Contracts for Multilingual Engine**: Introduced `PANEL_BASE_KEYS` and `HOST_BASE_KEYS` contracts as single sources of truth, enforcing 1:1 parity and zero missing translations across English, `zh-CN`, `ja-JP`, and `ko-KR`.

### Changed
- **Hardened `__APP_CONFIG__` & Storage Architecture**: Implemented full Proxy traps (`get`, `set`, `has`, `ownKeys`, `getOwnPropertyDescriptor`) and pre-initialization on `window.__APP_CONFIG__` to prevent React component trees from permanently caching `isDevMode: false`.
- **Async `nativeStorage` Bridge Hooks**: Added lifecycle hooks on `window.nativeStorage` to ensure experimental flag overrides synchronize immediately upon Electron storage readiness.

### Fixed
- **Settings Developer Mode Disappearance**: Resolved the root cause behind Antigravity settings hiding the `Developer` screen by ensuring `canApplyDeveloperOverrides` evaluates to `true` on initial React tree mount, preventing user flag overrides from being discarded.
- **Remote Mendel Override Tamper Prevention**: Added a prototype-level Storage Tamper Guard to protect user-configured `customFlagOverrides` and environment overrides from being wiped by background Mendel remote experiments.

## [0.3.1] - 2026-11-18

### Added
- **Multilingual Localization Engine**: Migrated monolithic `i18n.json` into a typed locales registry supporting `zh-CN`, `ja-JP`, and `ko-KR` across both host UI injection and the Aura Dashboard control panel.
- **Zero-Config Host Auto-Healing**: Added `host-healer` support to automatically prepare host CDP injection readiness.

### Changed
- **Modular Injection Stylesheet Architecture**: Split monolithic `theme.css` into focused modules under `src/injection/styles/` (`base`, `typography`, `presets-light`, `presets-dark`, `composer`, `metrics-capsule`) with symmetric theme preset synchronization and refined panel contrast.

### Fixed
- **Dark Mode Sidebar Hover Mask Collapse**: Defined `--ag-theme-sidebar` in dark presets to eliminate the cyclic `--sidebar` variable reference that collapsed `.agy-row-actions::before` fade masks into full transparency, synced hover `--row-bg` blending, aligned dark/light sidebar typography, project headers, and menu/dialog hierarchy, and scoped light-only inset shell rules.

## [0.3.0] - 2026-11-16

### Added
- **Commercial API Cost Equivalent Pricing**: Switched account ranking and consumption telemetry from raw token volume to true commercial API value ($), ranking accounts by actual billing value.
- **GitHub Contribution-Style 30-Day Quota Heatmap**: Rendered a 30-day temporal grid heatmap below each account card with 5-tier dynamic color scaling, tracking rolling 5h and weekly quota capacity evolution.
- **Account Plan Pill & Subscription Details**: Integrated with Language Server `GetUserStatus` to display official subscription tiers (`planName`) as pills next to account names, with full plan credits in hover tooltips.
- **Quota Window Transitions Middleware Buffer**: Added a compact, bounded intermediate audit buffer for window transitions to accurately measure marginal token and cost drops.

### Fixed
- **Quota Calibration Deadlock & Cold-Start Self-Healing**: Resolved the permanent `Calibrating Quota Capacity...` freeze by decoupling 5h and weekly baselines, adding self-healing uninitialized baseline fraction and cost repairs.
- **Session View "No Account Activity" Scope Bug**: Prioritized `all-time` scope over `session` range in account distribution, allowing historical accounts to remain visible and fully populated with quota capacities.
- **Clarified Account Spent vs Quota Upper Bound**: Explicitly labeled consumed API cost as `Spent: $XX.XX` and eliminated raw token outputs from quota window pills to prevent conceptual confusion.

## [0.2.4] - 2026-11-15

### Added
- **Account Token Tracking & Temporal Distribution**: Track token consumption, session volume, and timeline distribution across logged-in accounts using `account_timeline.json` and active onboarding credentials.
- **Data-Driven 5h & Weekly Quota Capacity**: Real-time extraction of 5-hour and weekly quota remaining fractions via Language Server `RetrieveUserQuotaSummary` RPC, dynamically computing true token capacity using incremental differential calibration ($\Delta \text{Tokens} / \Delta Q$).
- **Persistent Quota Calibration**: Auto-persists calibrated capacities to `plugin_data/aura-dashboard/quota_calibration.json` with weighted EMA smoothing, ensuring immediate availability across reloads and cold starts.

### Fixed
- **Quota Cold-Start & Scale Invariance**: Completely eliminated hardcoded 500k/3.5M defaults and artificial 10M clamps, preventing skewed estimations when installing mid-cycle or after untracked historical usage.

## [0.2.3] - 2026-11-13

### Added
- **Token Analytics Hero Card Redesign**: Restructured the hero card into a three-row layout with top header, dual-column metrics with inline share percentages (e.g. `(55.7%)`), full-width micro-ratio bar, and dedicated `Thinking` token tracking.
- **Cache Health Strip & Hit-Rate Overlay**: Added a multi-tier cache health strip (`healthy`, `degraded`, `break`) to session overview, hover cache hit % trajectory curve, cache break guide lines, and one-click jump to Timeline.
- **Telemetry Capsule Layout & Micro-Icons**: Refreshed metrics capsule tooltip with dedicated SVG micro-icons (`new`, `cached`, `think`, `resp`), full i18n support, and breakdown chips.
- **Event-Driven Auto-Refresh**: Added server-side revision caching with file watching and auto-refresh for live sessions without full-page reloads.

### Changed
- **Model Speed Trends Axis & Font Alignment**: Aligned `Model Speed Trends` to use the unified 48px sticky Y-axis and matched viewport/font size with `Token Activity`.
- **Global Token Share Scaling**: Model token consumption progress bars now scale proportionally based on total consumed tokens across models rather than relative to the top model.
- **Subtle Chart Gridlines**: Enhanced horizontal reference gridlines across all charts with refined dash intervals (`3 4`) and balanced opacity (`0.55`) for clear legibility without overpowering foreground curves.

### Fixed
- **Analytics SVG Viewport Collapse**: Explicitly locked `.chart-stage .analytics-svg` and `#tps-svg-element` to 220px to eliminate aspect-ratio height collapse, vertical guide line offsets, and bottom dead space.
- **User Prompt Turn Count & Range Scoping**: Accurately counted user prompt turns for session turns, scoped thinking tokens and empty fallbacks strictly within selected time ranges, and normalized unit plurals.

## [0.2.2] - 2026-11-10

### Added
- **Subagent Execution Analytics**: Added a conditional **Subagent Execution** breakdown section below the performance charts showing main vs. subagent token/request split and deduplicated per-agent run counts across time ranges and `Session` view.
- **Session Speed Trends Time Buckets**: Switched `Session` mode **Model Speed Trends** to adaptive active time buckets (`30s`–`1d`, folding idle pauses with dashed gap dividers) and merged main plus descendant subagent requests into per-`modelId` throughput curves.
- **Model Speed Trends Legend Bar**: Added a wrapped model legend below the chart header with color parity synced to **Model Token Consumption**.

### Changed
- **Root-Session Deduplication**: Counted only root sessions for global and workspace session totals (excluding subagents and orphan subagent threads) while retaining full token, model, and tool consumption and default-merging descendant trees in `Session` mode.
- **Compact Speed Tooltips**: Displayed raw `modelId` labels in **Model Speed Trends** hover tooltips while keeping full disambiguated names in the legend bar.

## [0.2.1] - 2026-11-10

### Changed
- **Parallel Panel Startup & Theme Preload**: Parallelized initial config, telemetry, and analytics requests on panel boot, added an immediate loading skeleton before first paint, and cached panel theme variables in local storage to reduce startup flash.

### Fixed
- **Live Session Sync Across Switches**: Prioritized live CDP cascade IDs over stale iframe query fallbacks in `/api/analytics/session`, pushed session changes on `focus` and `visibilitychange`, and cleanly reset stale session context when switching conversations.
- **Telemetry Capsule Sidecar Toggle & Rebinding**: Prevented the left `<aside>` sidebar from being misdetected as an open Aux Pane, switched to explicit host selectors (`toggle-aux-sidebar`, `data-aux-pane-open`, `data-tab-id`), handled i18n-translated toggle buttons via `data-ag-orig-aria-label`, added SPA `popstate` route targeting and bounded async activation, and rebound `#ag-live-metrics-pill` handlers during hot re-injection.

## [0.2.0] - 2026-11-10

### Added
- **Panel State Persistence**: Remembers the active tab (`Analytics` / `Preferences`), selected analytics time range (including custom dates), and workspace scope toggle across reloads and windows.
- **Workspace Distribution Overhaul**: Added a `Follow Range` / `All Time` switch synced with the active filter and session, removed the 5-project cap, grouped standalone threads under `Conversations`, and added path tooltips plus click-to-open in the system file manager.

### Changed
- **Dynamic Model Aggregation**: Groups model usage and speed trends by canonical `modelId` with deterministic palette colors instead of static model lists, paired with refreshed model card badges and `tok/s` layout.
- **Token-Proportional Workspace Bars**: Scaled workspace distribution bars strictly by share of total tokens with a visible minimum marker.
- **Documentation**: Reorganized the feature overview in `README.md` and `README.zh-CN.md` around telemetry/analytics and theme/typography pillars.

### Fixed
- **Menu & Portal Font Inheritance**: Overrode `body[data-agy-font]` font variables so custom Latin, CJK, and monospace font stacks propagate reliably into floating menus and portals.

## [0.1.0] - 2026-11-09

### Added
- Initial standalone release built on Google Antigravity's native Plugin + Sidecar architecture with zero `.asar` patching.
- Real-time composer telemetry capsule (`tok/s`, TTFT, context headroom, output tokens) and multi-dimensional local SQLite analytics dashboard.
- Independent light/dark theme presets, separate Latin/CJK/monospace font stacks, lossless English / Simplified Chinese localization, live CDP hot reload, and host compatibility/Labs helpers.
