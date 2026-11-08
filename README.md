# 船板的 Antigravity 书卷配色、高对比、类Claude风格、白天主题 & 字体优化与汉化全栈补丁 (v5.1.0)

[![Version](https://img.shields.io/badge/version-5.1.0-7A1F1A.svg)](https://github.com/Anarcadia/chuanban-antigravity-theme-patch)
[![Plugin](https://img.shields.io/badge/Antigravity-Native%20Plugin-blue.svg)](https://github.com/Anarcadia/chuanban-antigravity-theme-patch)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0%20(22.13%2B%20Full)-339933.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](https://github.com/Anarcadia/chuanban-antigravity-theme-patch)

> **本页面为补丁主介绍、版本演进历程与部署指南。**  
> 供 AI Agent 执行部署与二次改装读取的完整技术契约存放于仓库根目录的 **[`SKILL.md`](SKILL.md)**。

---

## 🔗 核心资源链接

| 端点名称 | 链接地址 | 定位与包含内容 |
| :--- | :--- | :--- |
| **1. Google Drive 全套资源包（含字体）** | [**Google Drive 官方共享文件夹**](https://drive.google.com/drive/folders/1NX92SgVUqtSjWg6bt6sIJXy-cn7J_boC) | **全套必备字体库**。内置 **Anthropic 官方原版字体族**（`Anthropic Sans` / `Anthropic Serif` / `Anthropic Mono`）与 **更纱黑体超集**（`Sarasa-SuperTTC.ttc`）。 |
| **2. GitHub 项目代码库** | [**sayakaho/chuanban-antigravity-theme-patch**](https://github.com/sayakaho/chuanban-antigravity-theme-patch) | **原生插件完整体**。包含原生插件元信息 `plugin.json`、侧边栏控制台 `sidecars/`、核心资源 `core/`、个人改装层 `user/` 及 Agent 专用 `SKILL.md`。 |

---

## 🖼️ 实机样式演示

### 1. 三栏工作台：高对比暖纸主题 + 输入框底部组件绝对水平共线 + 实时指标胶囊
![三栏对话与工件阅读视图](assets/preview-workspace-chat-and-artifact.png)

### 2. 新建对话首页：全界面深度汉化 + 工具栏下移共线
![新建对话首页视图](assets/preview-home-new-conversation.png)

---

## 🕒 版本更新历程

- **2026-11-08（v5.1.0 · 架构升级为 Antigravity 原生 Plugin + Sidecar）**：
  1. **宿主生命周期原生绑定，彻底消除外部系统常驻**：全面弃用操作系统级 `launchd` / `systemd` / `install.mjs`，改为由 Antigravity 官方插件规范加载。应用启动即注入，应用退出即终止，零后台常驻、零系统侵入；
  2. **新增 Auxiliary Pane 侧边栏可视化控制面板**：在右侧辅助面板无缝渲染主题控制台，直观监控 CDP 状态、实时流式速率（tok/s）与首字延迟（TTFT），支持一键样式热重载与风格预设切换；
  3. **输入框外围组件排版深度优化**：
     - 输入框右下角元数据项严格按「遥测胶囊 -> 模型选择器 -> 模式选择器」顺序排列并右对齐；
     - 新建会话上方工具栏（项目、检出方式、分支）下移至输入框底部左侧并与右侧 3 项在同一水平基准线绝对共线对齐（`0.0px` 误差），移除多余占位与下拉箭头，统一微浮雕交互；
     - 修复输入框多行长文本滚动负向死锁截断缺陷。
- **2026-11-04（v5.0.0 · 模块化成品包与双平台全栈内核）**：
  - 架构重组为只读核心与 `user/` 开放改装层，支持 Node 22.13+ `node:sqlite` 实时性能遥测胶囊。
- **2026-11-01（v4）**：
  - 增补模型选择器与 TanStack Router 深度汉化词典。

---

## 🚀 原生插件安装与使用指南

### 一、快速安装
将本仓库目录软链接到 Antigravity 全局插件目录：

```bash
ln -s "/path/to/chuanban-antigravity-theme-patch" ~/.gemini/config/plugins/chuanban-theme
```

Antigravity 会自动识别插件并立即在后台拉起 `theme-engine` Sidecar 服务，随应用同生共死。

通过 CLI 随时启停：
```bash
agy plugin enable chuanban-theme
agy plugin disable chuanban-theme
```

### 二、打开侧边栏控制面板
在任意会话右上角 **⋮** 菜单中选择 **Extensions → 川瓣主题与指标** 打开，即可：
- 实时查看当前 CDP 端口与挂载窗口数量；
- 点击 **实时重载样式** 按钮瞬时热刷新修改后的 CSS；
- 一键切换主题预设（高对比暖白 / Claude 暗色）。
