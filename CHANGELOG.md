# Changelog

All notable changes to **Antigravity Aura** will be documented in this file.

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
