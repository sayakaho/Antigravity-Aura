# Antigravity-Aura（Aura Dashboard）— 书卷配色、高对比类 Claude 风格主题 · 字体排版 · 汉化与性能遥测全栈插件 (v0.1.0)

[![Version](https://img.shields.io/badge/version-0.1.0-7A1F1A.svg)](https://github.com/sayakaho/Antigravity-Aura)
[![Plugin](https://img.shields.io/badge/Antigravity-Native%20Plugin-blue.svg)](https://github.com/sayakaho/Antigravity-Aura)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13.0%20(node%3Asqlite)-339933.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/sayakaho/Antigravity-Aura)

> **本页面为插件功能介绍、版本演进与安装开发指南。**  
> 供 AI Agent 读取的源码模块结构、配置 Schema、`PLUGIN_DATA` 热改装与 HTTP API 技术契约存放于仓库根目录 **[`SKILL.md`](SKILL.md)**。

---

## 🔗 核心资源链接

| 端点名称 | 链接地址 | 定位与包含内容 |
| :--- | :--- | :--- |
| **1. Google Drive 推荐字体包** | [**Google Drive 官方共享文件夹**](https://drive.google.com/drive/folders/1NX92SgVUqtSjWg6bt6sIJXy-cn7J_boC) | **可选高质感字体库**。包含 `Anthropic Sans` / `Anthropic Serif` / `Anthropic Mono` 与 `Sarasa-SuperTTC.ttc` 等超集字体。 |
| **2. GitHub 项目代码库** | [**sayakaho/Antigravity-Aura**](https://github.com/sayakaho/Antigravity-Aura) | **Strict TypeScript + Bun 源码与原生插件产线**。源码收敛于 `src/`；构建产物 `dist/` 输出符合 Antigravity `/plugin` 规范的自包含包（内联单文件 Sidecar `main.mjs`、Skill 与 `user/` 个人改装层）。 |

---

## 🖼️ 实机样式演示

### 1. 三栏工作台：高对比暖纸主题 + 输入框底部组件共线对齐 + 实时遥测胶囊
![三栏对话与工件阅读视图](assets/preview-workspace-chat-and-artifact.png)

### 2. 新建对话首页：工具栏下移共线 + Hover 统一高亮 + 全界面深度汉化
![新建对话首页视图](assets/preview-home-new-conversation.png)

---

## 🕒 版本更新历程

- **2026-11-09（v0.1.0 · Antigravity-Aura 独立项目首个版本：Strict TypeScript 全栈重构、`/plugin` 单包内联与 TPS 口径统一）**：
  1. **全栈 Strict TypeScript 重构与 `/plugin` 单包内联产线**：后端服务、CDP 直连引擎、SQLite/Protobuf 解码器、DOM 注入运行时及侧边栏双视图面板全面重构为严格类型 TypeScript；经 [`scripts/build.ts`](scripts/build.ts) 压缩并内联面板前端与只读核心注入资产至单一 `sidecars/dashboard/main.mjs`，剥离冗余预览大图与中间产物，`dist/` 精简为 `11` 个核心文件（约 `308 KB`）。
  2. **遥测与看板 TPS / 性能口径彻底统一**：抽取公共 [`src/shared/tps.ts`](src/shared/tps.ts)，桌面实时胶囊、会话明细、全局日/小时趋势与模型速率曲线严格共享同一判定规则（`stream >= 0.25s` 且速率 `∈ (0, 600] tok/s` 时优先取流式速率，否则回退端到端速率，并按 Token 与有效耗时加权汇总）。
  3. **多维分析完善与交互细节修复**：
     - 修复时间范围切换时吞吐量与平均 TTFT 不动态重算、空自定义日期崩溃、`Session` 视图成本分模型核算偏差与深浅色图表配色错位问题；
     - 新增 `Turn Latency vs. TTFT` 散点分布图（含 `y = x` 基准与 `P50 / P95` 参考线）以及 `Session` 模式下「上下文水位面积图 Overview / 按步堆叠柱状图 Timeline」切换；
     - 修复新建对话界面底部多组件 Hover 透明背景失效问题；实验 Flag 改为同窗 `StorageEvent` 增量同步并过滤不稳定开关。
- **2026-11-08（前身演进 · 升级为 Antigravity 原生 Plugin + Sidecar）**：
  1. **宿主生命周期原生绑定，彻底消除外部系统常驻**：弃用操作系统级 `launchd` / `systemd` 常驻脚本，改为由 Antigravity 原生插件机制托管，宿主启动即运行、退出即释放；
  2. **新增 Auxiliary Pane 侧边栏可视化控制台**：集成 CDP 连接监控、流式速率与 TTFT 统计、样式热重载及亮/暗色预设切换；
  3. **输入框底部组件重构与死锁修复**：实现新建对话工具栏下移并与遥测胶囊、模型选择器、模式选择器水平共线，移除冗余下拉箭头，修复设置路由 URL 死锁及快捷键缩放失效问题。
- **2026-11-04（上游基石 · 模块化架构与 SQLite 实时遥测）**：
  - 支持基于 Node 22.13+ 原生 `node:sqlite` 的对话库增量解析与输入框实时指标胶囊（`tok/s · TTFT · Ctx 水位 · Out`），开放 `user/` 个性化覆盖层。
- **2026-11-01（上游基石 · 汉化与排版体系）**：
  - 增补模型选择器与 TanStack Router 深度汉化词典。

---

## 🚀 安装与本地开发指南

### 方式一：源码构建与软链接（推荐开发者）

```bash
git clone https://github.com/sayakaho/Antigravity-Aura.git
cd Antigravity-Aura

bun install
bun run typecheck      # 严格 TypeScript 类型检查
bun test               # 运行单元测试套件
bun run build          # 编译并内联打包至 dist/
bun run link:plugin    # 将 dist/ 软链接至 ~/.gemini/config/plugins/aura-dashboard
```

重启 Antigravity 即可生效。日常修改 `src/` 可运行 `bun run dev` 开启 `--watch` 增量重建；验证官方清单可执行 `agy plugin validate ./dist`。卸载软链接可执行 `bun run unlink:plugin`。

### 方式二：下载 Release 产物一键安装（推荐普通用户）

1. 在 [GitHub Releases](https://github.com/sayakaho/Antigravity-Aura/releases) 页面下载最新的 `aura-dashboard-v*.zip`；
2. 解压至 `~/.gemini/config/plugins/aura-dashboard`；
3. 重启 Antigravity，宿主会自动拉起 Sidecar 并在 `~/.gemini/antigravity/plugin_data/aura-dashboard/` 初始化个人配置文件。

### 常用 CLI 管理命令
```bash
agy plugin enable aura-dashboard     # 启用插件
agy plugin disable aura-dashboard    # 禁用插件
agy plugin validate ./dist           # 校验插件目录规范
```

---

## 🛠️ 项目工程架构

本项目采用 **Strict TypeScript + Bun** 单体架构，彻底分离**开发源码（`src/`）**与**标准插件分发包（`dist/`）**：

```text
Antigravity-Aura/
├── .github/workflows/release.yml   # GitHub Actions CI 自动构建并打包 Release Zip
├── package.json                    # 脚本入口 (build, dev, test, typecheck, link:plugin, unlink:plugin)
├── tsconfig.json                   # 严格 TypeScript 编译检查配置
├── plugin.json                     # 官方 Plugin 清单源文件（含 name, logo, suggestedPrompts）
├── assets/                         # 矢量图标 (logo.svg) 与 README 预览图
├── skills/                         # 随插件分发的 Agent 技能 (skills/aura-theme/SKILL.md)
├── scripts/                        # 构建与链接脚本 (build.ts, link.ts, unlink.ts)
├── tests/                          # Bun 单元测试 (charts-base, config-bundle, config-schema, experiments, proto, tps-metrics)
├── src/                            # 【TypeScript 全栈源码】
│   ├── types/                      # 全局核心契约与 Sidecar SDK 类型声明
│   ├── shared/                     # 前后端共享逻辑 (TPS 统一口径、模型与工具目录/定价、配置 Schema、格式化)
│   ├── panel/                      # 侧边栏 Webview 前端 (analytics/*, settings, theme-sync, index.html, styles.css)
│   ├── server/                     # Sidecar 守护进程、WAL/Protobuf 解码、指标胶囊、配置包合成与 CDP 引擎
│   ├── injection/                  # 宿主窗口注入引擎 (主题同步、汉化、指标胶囊、死锁/缩放修复、实验特性、theme.css)
│   └── presets/                    # 个人改装层种子模板（打包时复制至 dist/sidecars/dashboard/user/）
└── dist/                           # 【/plugin 规范输出包：11 个文件，~308 KB（单文件 main.mjs 内联前端与只读核心）】
```

---

## 🧭 侧边栏控制面板（Auxiliary Pane）

点击输入框左侧**遥测胶囊**，或在会话右上角 **⋮ → Extensions → Aura Dashboard** 打开侧边栏双视图面板：

- **Analytics 性能分析（默认视图）**：
  - **8 档时间维度联动**：支持 `Session`、`Today`、`Yesterday`、`This Week`、`This Month`、`Last 7 Days`、`Last 30 Days`、`Custom` 自定义区间。
  - **6 项核心 KPI**：Token 总量与分类占比条、加权速率 + P50 中位速率 + 平均轮次延迟、请求/轮次统计、缓存效率、平均 TTFT、分模型精算商业成本。
  - **交互式图表与分布**：Token Activity（Session 模式可切换 `Overview` 上下文水位面积图 / `Timeline` 按步柱状图）、`Model Speed Trends` 分模型速率折线、`Turn Latency vs. TTFT` 散点分布（含 `P50 / P95` 参考线），以及模型、工具生态、Workspace 项目分布。
- **Preferences 实时控制台**：
  - **外观与语言**：独立切换 Light（`Claude Light` / `Pure Light` / `Native Default`）与 Dark（`Claude Dark` / `Vintage Deep` / `Native Default`）预设；切换 UI 语言（默认 `English (Default)` / 一键切换 `Chinese (Simplified)` 简体中文）。
  - **字体与排版**：自动枚举本机已安装字体（`fc-list` + 宿主字库），独立配置西文主字体、CJK 回退字体、等宽代码字体与对话字号（`10–28px`）。
  - **布局、遥测与引擎热重载**：开关蜡封边框、底部工具栏共线、隐藏下拉箭头与遥测采样频率（`1.5s / 2.0s / 3.0s`）；实时监控 CDP 挂载窗口与端口，点击 **Reapply Now** 瞬时热重载样式；展开 **Advanced Settings** 控制开发者模式与安全实验特性。

---

## 🙏 Attribution

本项目独立演进前最初衍生自 **船板（[@Anarcadia](https://github.com/Anarcadia)）** 的开源项目 [**Anarcadia/chuanban-antigravity-theme-patch**](https://github.com/Anarcadia/chuanban-antigravity-theme-patch)。在此向原作者表示诚挚感谢：

- **继承自原项目的设计与基石**：Anthropic 暖纸高对比亮色主题审美、`Anthropic` / `Sarasa` 更纱黑体多链排版体系、基础中文界面词典、输入框实时指标胶囊（Metrics Capsule）构想，以及 Antigravity 设置页面路由死锁修复思路。
- **Antigravity-Aura 的后续独立构建**：脱离操作系统级常驻守护脚本并重构为 Antigravity 原生 `Plugin + Sidecar` 架构；全栈重构为 Strict TypeScript + Bun 单文件内联产线；新增 Auxiliary Pane 双视图面板（多维性能分析看板 Analytics 与实时控制台 Preferences）、深色主题预设（`claude-dark` / `vintage-dark`）、中英切换开关、前后端统一 TPS 口径、新建对话工具栏共线与 Hover 修复、安全实验 Flag 同步及自动化 CI/Release 发布工作流。
- **提交历史与许可声明**：本仓库保留完整的 Git 提交历史以留存原始贡献脉络。本项目的工程配置与包元数据采用 [`MIT`](package.json) 声明（注：上游原仓库未附带 `LICENSE` 文件）。
