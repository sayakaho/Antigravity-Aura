---
name: aura-theme
description: Control, inspect, and configure Antigravity interface appearance, Claude-style theme presets, typography font families, and live telemetry metrics via the Aura Dashboard plugin.
---

# Aura Dashboard & Theme Control Skill

This skill allows agents to inspect and manipulate Antigravity interface styles, Claude-inspired theme presets, typography font chains, and live metrics telemetry provided by the Aura Dashboard plugin.

---

## 1. Quick Reference & Available Presets

### Theme Presets
| Preset Key | Mode | Description |
| :--- | :--- | :--- |
| `high-contrast` | Light | High-contrast warm paper theme, warm off-white background with strong readability |
| `claude-desktop-purewhite` | Light | Pure white Claude-style background with gentle paper tones |
| `claude-dark` | Dark | Claude official dark carbon theme, soft low-fatigue slate dark |
| `vintage-dark` | Dark | Vintage deep espresso brown dark theme |
| `default` | Any | Fallback to original host theme colors |

### Typography & Fonts
- **Primary Sans**: `Anthropic Sans`, `Sarasa UI SC`, `PingFang SC`, `system-ui`, or custom font family name.
- **Code Mono**: `Anthropic Mono`, `Sarasa Mono Slab SC`, `JetBrains Mono`, `Fira Code`, or `ui-monospace`.
- **Base Font Size**: Integer in pixels (default `16`, typical range `13`–`20`).

---

## 2. Configuration Management

Aura Dashboard persists active settings in the plugin data directory:
- **Location**: `~/.gemini/antigravity/plugin_data/aura-dashboard/config.json` (or `process.env.PLUGIN_DATA/config.json`)
- **Fallback Template**: `<plugin_root>/user/config.json`

### Direct API Control (Preferred when Sidecar is Running)

The Sidecar runs on a local loopback port managed by Antigravity (available in `process.env.ANTIGRAVITY_SIDECAR_WEB_PORT` or via local inspection):

#### Inspect Status & Metrics
```bash
curl -s http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/status
```

#### Switch Theme Preset
To change the theme preset (e.g. switch to dark):
```bash
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/config \
  -H "Content-Type: application/json" \
  -d '{"presets": {"light": "high-contrast", "dark": "claude-dark"}}'
```

#### Adjust Typography & Font Size
```bash
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/config \
  -H "Content-Type: application/json" \
  -d '{"typography": {"primarySans": "Anthropic Sans", "mono": "Anthropic Mono", "fontSize": 16}}'
```

#### Trigger Live Style Reload
To force recompilation and push fresh CSS into all open Antigravity windows:
```bash
curl -s -X POST http://127.0.0.1:${ANTIGRAVITY_SIDECAR_WEB_PORT:-51980}/api/reload
```

---

## 3. Telemetry & Analytics Inspection

When the user asks about token consumption, generation speed, or session history:
- **Global Overview**: `GET /api/analytics/overview` (totals, cache hit rates, daily breakdown)
- **Active Session Details**: `GET /api/analytics/session?id=<conversation_id>` (step-by-step TPS, TTFT, token counts)
- **Recent Sessions**: `GET /api/analytics/conversations`
