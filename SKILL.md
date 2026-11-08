---
name: chuanban-antigravity-theme-patch
description: 船板的 Antigravity 2.0 主题、排版增强与实时指标遥测插件（v5.1.0 原生 Plugin + Sidecar 架构）。通过 Antigravity 宿主原生托管后台 Sidecar 进程，支持 CDP 实时样式注入、全界面汉化、会话指标遥测胶囊与侧边栏控制台。
---

# 船板的 Antigravity 主题、排版与深度汉化原生插件（v5.1.0）

> **架构概括（致用户与执行端 AI Agent）**：
> - **设计目的**：以 Antigravity 官方原生的 **Plugin + Sidecar** 机制运行，为 Antigravity 宿主提供 Anthropic 暖纸护眼配色、输入框底部按钮重排与共线对齐、更纱黑体字阶排版、全界面深度汉化及实时指标遥测胶囊（`tok/s · TTFT · Ctx 水位 · Out`）。
> - **v5.1.0 架构升级**：
>   1. **原生 Plugin + Sidecar 生命周期托管**：彻底告别旧版操作系统级 `launchd` / `install.mjs` 常驻外挂脚本。插件生命周期完全与 Antigravity 宿主应用绑定，随应用启动即注入，应用退出即终止，零常驻、零泄漏；
>   2. **Auxiliary Pane 侧边栏可视化控制台**：支持在右侧辅助面板打开专属控制台，实时查看 CDP 挂载状态、一键热重载 CSS、切换风格预设与实时监控流式速率；
>   3. **开放 `user/` 独立改装层**：用户可随时在 `user/` 目录内自定义样式（`custom.css`）、词条（`i18n.override.json`）与配置（`config.json`），Sidecar 自动感知文件变更并实时推送至所有窗口。

---

## 一、插件目录结构

插件直接部署于 `~/.gemini/config/plugins/chuanban-theme/`（或符号链接指向本地开发仓库）：

```text
chuanban-theme/
├── plugin.json                 # 官方标准插件清单（名称、版本、logo 指向）
├── assets/
│   └── logo.svg                # 插件矢量图标（侧边栏与设置页展示）
├── sidecars/
│   └── theme-engine/           # 【原生 Sidecar 守护与 Web 引擎】
│       ├── sidecar.json        # 声明 restart_policy: always 与 Aux Pane 侧边栏入口
│       ├── package.json        # ES Module 标记
│       ├── main.mjs            # Node 进程后端（CDP 目标监听、SQLite 遥测、Web API）
│       ├── index.html          # 侧边栏控制面板 UI
│       ├── app.js              # 控制台前端交互脚本 (window.sidecar)
│       └── styles.css          # 控制台面板主题样式
├── core/                       # 【只读核心资源】
│   ├── theme.css               # 主题样式表（含组件共线对齐、输入框微浮雕、字体排版）
│   ├── runtime.js              # 客户端运行时引擎（DOM 汉化、指标胶囊挂载、死锁自愈）
│   └── i18n.json               # 标准汉化基准词典
└── user/                       # 【用户自定义改装层】
    ├── config.json             # 开关配置（preset、modules 开关、selectors 覆盖）
    ├── custom.css              # 用户自定义追加 CSS
    ├── i18n.override.json      # 用户自定义汉化词条覆盖
    └── custom.js               # 开放的前端 JS 钩子沙箱
```

---

## 二、部署与管理方式

### 1. 安装与启用
将本仓库目录软链接至全局插件目录即可完成安装：
```bash
ln -s "/path/to/chuanban-antigravity-theme-patch" ~/.gemini/config/plugins/chuanban-theme
```
Antigravity 会自动发现该插件并拉起 `theme-engine` Sidecar 服务，随应用同生共死。

通过 CLI 启停：
```bash
agy plugin enable chuanban-theme
agy plugin disable chuanban-theme
```

### 2. 侧边栏控制台入口
在任意会话右上角 **⋮** 菜单选择 **Extensions → 川瓣主题与指标** 打开，或直接通过协议唤起：
- [川瓣主题控制台](sidecar://chuanban-theme/theme-engine/)
- [插件设置页](customization://chuanban-theme)
