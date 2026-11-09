<div align="center">

<img src="assets/logo.png" alt="Antigravity Aura" width="88" height="88" />

# Antigravity Aura

**Anthropic 风格的明暗主题、字体混排与本地性能监控插件，基于 Google Antigravity 原生 Plugin + Sidecar 机制实现。**

[![Version](https://img.shields.io/badge/version-0.1.0-7A1F1A.svg)](https://github.com/sayakaho/Antigravity-Aura/releases)
[![Release CI](https://github.com/sayakaho/Antigravity-Aura/actions/workflows/release.yml/badge.svg)](https://github.com/sayakaho/Antigravity-Aura/actions/workflows/release.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13.0%20(node%3Asqlite)-339933.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/sayakaho/Antigravity-Aura)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | 简体中文

[功能特性](#功能特性) · [界面预览](#界面预览) · [安装](#安装) · [配置](#配置) · [架构](#架构) · [致谢](#致谢)

</div>

## 简介

**Antigravity Aura** 运行于 Google Antigravity 的原生 Plugin + Sidecar 生命周期内，无需修改客户端 `.asar` 归档或常驻系统守护进程。Sidecar 随宿主启动后，通过 CDP 协议向活跃窗口热注入样式与脚本，并使用 Node 22 内置的 `node:sqlite` 解析本地对话库，在侧边栏提供实时性能统计与偏好设置面板。

## 界面预览

### 主工作台

![Antigravity Aura 主工作台对比](assets/screenshot-workspace.png)

### 侧边栏面板

<table>
  <tr>
    <th width="50%">Analytics 性能统计</th>
    <th width="50%">Preferences 偏好设置</th>
  </tr>
  <tr>
    <td valign="top" align="center">
      <img src="assets/screenshot-analytics.png" alt="Analytics 性能统计" width="100%" />
    </td>
    <td valign="top" align="center">
      <img src="assets/screenshot-preferences.png" alt="Preferences 偏好设置" width="100%" />
    </td>
  </tr>
</table>

## 功能特性

- **明暗主题预设**：支持亮色与暗色模式独立配置，内置 Claude 暖纸色、纯白、复古深色及原生默认主题。
- **字体栈独立配置**：自动枚举本机已安装字体，支持分别指定西文、中日韩回退、等宽代码字体及正文阅读字号。
- **界面与输入框细节**：
  - 底部工具栏水平对齐，支持隐藏下拉箭头。
  - 提供暗红蜡封风格的输入框聚焦边框，修复新建对话页工具栏的悬停样式异常。
  - 基于 `WeakMap` 实现中英界面无损切换，支持自定义词典覆盖。
- **输入框实时指标**：在输入框左侧展示最近一轮回复的生成速率、首字延迟、上下文占用与输出长度，点击即可切换侧边栏面板。
- **本地性能看板**：
  - 支持按当前会话或指定时间范围聚合统计。
  - 统计 Token 用量、加权平均与 P50 生成速率、轮次延迟、缓存命中率、平均 TTFT 及模型 API 成本估算。
  - 提供会话时间线、延迟与首字耗时散点分布，以及按模型、工具调用和工作区的占比明细。
- **稳定性修复与热重载**：修复设置页路由死锁与缩放快捷键失效问题，提供经安全过滤的实验性特性开关，支持跨窗口配置即时重载。

## 环境要求

| 依赖 | 要求 | 适用阶段 |
| :--- | :--- | :--- |
| **Google Antigravity** | 支持 Plugin + Sidecar 且开启 CDP 端口 | 运行时 |
| **Node.js** | `>= 22.13.0`，内置 `node:sqlite` | 运行时 |
| **Bun** | `>= 1.2` | 源码构建与测试 |
| **系统** | macOS / Windows / Linux | 运行与构建 |

## 安装

### 使用 Antigravity 安装

将本仓库链接直接复制发送给 **Antigravity**，让它为你完成安装并启用插件：

```text
请帮我安装这个 Antigravity 插件：https://github.com/sayakaho/Antigravity-Aura
```

安装完成后重启 Antigravity 即可加载插件。

### 下载构建产物

1. 去 [GitHub Releases](https://github.com/sayakaho/Antigravity-Aura/releases) 下载最新的 `aura-dashboard-v*.zip`。
2. 解压至插件目录，确保 `plugin.json` 位于该目录根部：
   ```text
   ~/.gemini/config/plugins/aura-dashboard
   ```
3. 重启 Antigravity，点击输入框左侧指标胶囊或通过右上角 **⋮ → Extensions → Aura Dashboard** 打开面板。

### 源码构建

```bash
git clone https://github.com/sayakaho/Antigravity-Aura.git
cd Antigravity-Aura

bun install
bun run typecheck
bun test
bun run build
bun run link:plugin
```

可通过 Antigravity CLI 校验并管理插件状态：

```bash
agy plugin validate ./dist
agy plugin enable aura-dashboard
agy plugin disable aura-dashboard
```

## 配置

常规主题、字体与采样参数可直接在侧边栏 **Preferences** 中实时修改。

首次启动时，宿主会在 `~/.gemini/antigravity/plugin_data/aura-dashboard/` 下初始化持久化配置目录。后续更新插件不会覆盖该目录中的文件：

| 文件 | 说明 |
| :--- | :--- |
| `config.json` | 插件主配置文件 |
| `custom.css` | 启用 `modules.customCss` 后追加加载的自定义样式表 |
| `custom.js` | 启用 `modules.customJs` 后在顶层窗口执行的扩展脚本 |
| `i18n.override.json` | 覆盖内置中文词典的自定义词条 |

> 推荐搭配 `Anthropic Sans`、`Anthropic Serif`、`Anthropic Mono`、`Sarasa Gothic` 或 `LXGW WenKai` 字体使用。

## 架构

```text
Antigravity Host
   │
   ├──► Sidecar Server — dist/sidecars/dashboard/main.mjs
   │       ├── SQLite 与 Protobuf 对话记录解析
   │       ├── 配置校验与注入脚本编译
   │       ├── CDP 窗口发现与 CSS/JS 热推送
   │       └── 本地 HTTP 服务与侧边栏 Webview 接口
   │
   └──► Host Window — Injected Runtime
           ├── 主题变量、字体栈与输入框布局样式
           ├── WeakMap 本地化替换与路由/缩放修复
           └── 实时指标胶囊与实验特性同步
```

<details>
<summary>目录结构</summary>

```text
Antigravity-Aura/
├── .github/workflows/release.yml   # CI 校验与构建发布流程
├── assets/                         # 插件图标与预览截图
├── scripts/                        # 构建与插件软链脚本
├── skills/aura-theme/SKILL.md      # 内置技能声明、配置 Schema 与 HTTP 接口规范
├── src/
│   ├── injection/                  # 窗口注入运行时、主题样式与修复模块
│   ├── panel/                      # 侧边栏 Webview 前端
│   ├── presets/                    # 用户配置目录初始模板
│   ├── server/                     # Sidecar 后端服务与数据解析
│   ├── shared/                     # 前后端通用计算与配置校验
│   └── types/                      # TypeScript 类型与 SDK 声明
├── tests/                          # 单元测试
├── LICENSE
├── package.json
├── plugin.json                     # 插件清单
└── tsconfig.json
```

</details>

配置结构、扩展脚本契约与 HTTP 接口细节参见 [`skills/aura-theme/SKILL.md`](skills/aura-theme/SKILL.md)。

## 致谢

本项目参考了 **船板（[@Anarcadia](https://github.com/Anarcadia)）** 的 [**chuanban-antigravity-theme-patch**](https://github.com/Anarcadia/chuanban-antigravity-theme-patch)，主要借鉴了以下部分：

- 暖纸色亮色配色方案与字体混排思路
- 初版简体中文界面翻译词典
- 输入框实时指标胶囊构想

本项目遵循 [MIT](LICENSE) 协议开源。
