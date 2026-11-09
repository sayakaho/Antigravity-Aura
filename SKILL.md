---
name: aura-dashboard
description: Antigravity-Aura（Aura Dashboard）— Antigravity 原生主题预设、排版增强、中英切换与全栈性能遥测插件（Plugin + Sidecar 架构）。通过 Antigravity 宿主原生托管后台 Sidecar 进程，支持 CDP 实时样式注入、会话指标遥测胶囊与侧边栏分析/控制台。
---

# Antigravity-Aura（Aura Dashboard）技术契约与二次开发指南（AI Agent Reference）

> **架构定位**：本插件以 Antigravity 官方原生 **Plugin + Sidecar** 机制运行，生命周期完全绑定宿主应用（零外部系统常驻守护）。为 Antigravity 提供类 Claude 亮/暗配色预设、输入框底部工具栏共线重构与 Hover 修复、三链字体排版、中英界面切换（`language: "default" | "zh-CN"`）、实时遥测胶囊（`tok/s · TTFT · Ctx 水位 · Out`）与多维性能分析看板。

---

## 一、仓库源码结构与构建边界（`src/`）

| 目录 / 文件 | 核心职责 | 说明 |
| :--- | :--- | :--- |
| `src/types/` | 核心类型契约 | `AuraConfig`、`EmbeddedAssets`、`BootPayload`、`GlobalAnalyticsOverview`、`LiveMetricsPayload` 等 |
| `src/shared/` | 前后端共享纯逻辑 | [`tps.ts`](src/shared/tps.ts)（统一 TPS/加权规则）、[`config-schema.ts`](src/shared/config-schema.ts)（规范化与强校验 Patch）、[`catalog.ts`](src/shared/catalog.ts)（模型名称/定价/工具分类）、[`format.ts`](src/shared/format.ts) |
| `src/server/` | Sidecar Node ESM 后端 | [`index.ts`](src/server/index.ts)（HTTP API 与调度）、[`cdp-client.ts`](src/server/cdp-client.ts)（CDP 自动发现与注入）、[`config-bundle.ts`](src/server/config-bundle.ts)（脚本合成与热重载）、[`analytics-engine.ts`](src/server/analytics-engine.ts)（全局/会话聚合与 `aura_analytics_cache_v9.json` 缓存）、[`metrics-capsule.ts`](src/server/metrics-capsule.ts)、[`sqlite-proto.ts`](src/server/sqlite-proto.ts)（`node:sqlite` + BigInt Protobuf 解码） |
| `src/injection/` | 宿主浏览器注入运行时 | [`index.ts`](src/injection/index.ts)（入口）、[`theme-preset.ts`](src/injection/theme-preset.ts)（亮暗预设与 Sidecar 同步）、[`metrics-pill.ts`](src/injection/metrics-pill.ts)（遥测胶囊与路由监听）、[`i18n.ts`](src/injection/i18n.ts) & [`i18n.json`](src/injection/i18n.json)、[`healer.ts`](src/injection/healer.ts)（设置弹窗死锁与缩放快捷键）、[`experiments.ts`](src/injection/experiments.ts)（`StorageEvent` 实验 Flag 同步）、[`theme.css`](src/injection/theme.css) |
| `src/panel/` | Auxiliary Pane 控制台 | [`index.html`](src/panel/index.html)、[`styles.css`](src/panel/styles.css)、[`index.ts`](src/panel/index.ts)、[`settings.ts`](src/panel/settings.ts)、[`theme-sync.ts`](src/panel/theme-sync.ts)、[`analytics/*`](src/panel/analytics/index.ts)（8 档时间维度、KPI、Overview/Timeline、Model TPS、Latency vs. TTFT 散点图） |
| `src/presets/` | 用户改装层模板 | `config.json`、`custom.css`、`custom.js`、`i18n.override.json` |
| `scripts/` | 工程脚本 | [`build.ts`](scripts/build.ts)（单包内联构建）、[`link.ts`](scripts/link.ts)、[`unlink.ts`](scripts/unlink.ts) |
| `tests/` | Bun 单元测试 | `charts-base`、`config-bundle`、`config-schema`、`experiments`、`proto`、`tps-metrics` |

> [!IMPORTANT]
> **内联构建与热更新边界（必读）**：
> - `src/panel/*` 与只读注入资产（`src/injection/{index.ts,theme.css,i18n.json}`）在生产构建时通过 `define.__AURA_EMBEDDED_ASSETS__` 压缩并内联进 `dist/sidecars/dashboard/main.mjs`（[`EMBEDDED_ASSETS`](src/server/paths.ts#L10-L17)）；在单元测试等未定义该常量的环境中自动为 `null`，回退读取磁盘源码。
> - **修改 `src/` 代码后**，必须执行 `bun run build`（或持续运行 `bun run dev`）重新编译 `dist/`，并按需重启 Antigravity 宿主使新后端生效；
> - **修改运行期用户目录 `PLUGIN_DATA` 下的文件**，无需重编即可热生效或通过 `POST /api/reload` 瞬时重编译下发。

---

## 二、编译产物目录结构（`dist/`）

遵循 Antigravity 官方 `/plugin` 规范产出 11 个精简文件，通过 `bun run link:plugin` 软链接至 `~/.gemini/config/plugins/aura-dashboard/`：

```text
dist/                               # 部署至 ~/.gemini/config/plugins/aura-dashboard/
├── plugin.json                     # 插件清单（name, displayName, version, logo, author, suggestedPrompts）
├── README.md                       # 用户说明文档
├── assets/
│   └── logo.svg                    # 插件矢量图标
├── skills/
│   └── aura-theme/SKILL.md         # 随插件安装后面向 Agent 的运行期控制技能
└── sidecars/
    └── dashboard/                  # 【原生 Sidecar 引擎】
        ├── sidecar.json            # restart_policy: always 与 Aux Pane 视图入口 (path: "/")
        ├── package.json            # {"type": "module"}
        ├── main.mjs                # 自包含 Node ESM 单文件后端（内联面板 UI + 注入引擎/CSS/i18n）
        └── user/                   # 【仅用于首次启动初始化 PLUGIN_DATA 的种子模板】
            ├── config.json         # 默认配置模板
            ├── custom.css          # 用户自定义追加 CSS
            ├── i18n.override.json  # 用户自定义汉化词条覆盖
            └── custom.js           # 前端扩展沙箱 (ctx / boot)
```

---

## 三、构建、校验、部署与管理

```bash
bun install                 # 安装开发依赖 (@types/bun, @types/node, typescript)
bun run typecheck           # TypeScript 严格检查 (tsc --noEmit)
bun test                    # 运行全部 6 组单元测试
bun run build               # 生产压缩并单包内联构建至 dist/
bun run dev                 # 监听 src/ 变动增量重建 dist/
bun run link:plugin         # 创建 ~/.gemini/config/plugins/aura-dashboard -> ./dist 软链接
bun run unlink:plugin       # 移除插件软链接
```

插件校验与启停管理：
```bash
agy plugin validate ./dist
agy plugin enable aura-dashboard
agy plugin disable aura-dashboard
```

UI 导航深链接：
- 侧边栏面板：[Aura Dashboard](sidecar://aura-dashboard/dashboard/)
- 插件设置页：[Aura Dashboard](customization://aura-dashboard)

---

## 四、配置契约、`PLUGIN_DATA` 改装与 HTTP API

### 1. 运行期配置持久化位置
- 实际生效目录：`process.env.PLUGIN_DATA || process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR`，Antigravity 默认传入 `~/.gemini/antigravity/plugin_data/aura-dashboard/`（由 [`initDataDirectory`](src/server/paths.ts#L72-L88) 在首次启动时从 `user/` 拷贝缺失的 4 个文件，已存在文件绝不覆盖）。

### 2. `AuraConfig` 核心字段与约束（[`src/shared/config-schema.ts`](src/shared/config-schema.ts)）
- `enabled`: `boolean`（全局总开关，设为 `false` 时宿主运行时自动卸载注入节点并恢复原状）
- `channel`: `'auto' | 'light' | 'dark'`（默认 `'auto'`）
- `language`: `'default' | 'zh-CN'`（默认 `'default'` 英文原生；设为 `'zh-CN'` 启用深度汉化，支持 `i18n.override.json` 追加或覆盖词条）
- `presets.light`: `'high-contrast' | 'claude-desktop-purewhite' | 'default'`（兼容历史别名如 `chuanban-warm-white`、`claude-desktop-official`）
- `presets.dark`: `'claude-dark' | 'vintage-dark' | 'default'`（兼容历史别名如 `vintage-deep`、`absoulutely-chuanban`）
- `typography`: `{ primarySans, customPrimarySans, fallbackSans, customFallbackSans, mono, customMono, fontSize }`（`fontSize` 范围 `10–28`，默认 `15`）
- `composer`: `{ collinear, waxSeal, hideArrows }`
- `telemetry`: `{ enabled, interval }`（`interval` 范围 `500–30000` ms，默认 `2000`）
- `modules`: `{ deadlockHealer, customCss, customJs }`
- `advanced`: `{ labsDeveloperMode, experimentalFlags }`（服务端与前端双层拦截崩溃性 Flag `labs-concierge-agent` 与 `context-window-selector`）
- `contextLimit`: 可选正整数（`1000–10000000`，默认 `256000`）

### 3. `user/custom.js` 前端沙箱上下文（`ctx` / `boot`）
当 `modules.customJs` 为 `true` 时在顶层主窗口执行，注入参数：
- `version`、`preset`、`config`、`modules`、`features`、`themeVars`、`dict`、`metrics`、`syncPreset()`、`ensureMetricsPill(forceLayout?)`。

### 4. Sidecar HTTP API 端点（[`src/server/index.ts`](src/server/index.ts)）
默认监听宿主分配的 `ANTIGRAVITY_SIDECAR_WEB_PORT`（脱离宿主本地调试回退至 `51980`）：
- `GET /api/status`：返回 CDP 连接状态、窗口数、端口、补丁版本哈希、CSS 字节数、当前预设、模块开关与最新遥测快照。
- `GET /api/config` / `POST /api/config`：读取或按 `applyConfigPatch` 强校验合并更新配置（非法字段返回 HTTP `400`），并立即通过 CDP 推送热更新。
- `POST /api/reload`：强制重编译 `user/*` 与注入包并推流至全部活跃宿主窗口。
- `GET /api/system-fonts`：聚合宿主字体接口与 `fc-list` 系统字体列表。
- `GET /api/analytics/overview`：返回全量历史对话聚合概览（日/小时 Token 序列、分模型日/小时性能与 TPS 桶、工具分布、Workspace 项目统计）。
- `GET /api/analytics/session?id=<uuid>`：返回指定或最近活跃会话的逐步指标、P50/平均 TPS、延迟与模型/工具拆解。
