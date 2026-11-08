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

## 🚀 安装与本地开发指南

### 方式一：终端一键构建与软链接（推荐开发者）

克隆仓库并执行一键编译与软链：

```bash
git clone https://github.com/sayakaho/chuanban-antigravity-theme-patch.git
cd chuanban-antigravity-theme-patch

bun install
bun run build          # 编译源码至 dist/ 标准插件包
bun run link:plugin    # 自动将 dist/ 软链接至 ~/.gemini/config/plugins/aura-dashboard
```

重启 Antigravity 即可开箱即用。开发时运行 `bun run dev`，改动 `src/` 代码毫秒级自动构建生效。

### 方式二：下载 Release 产物一键解压（推荐普通用户）

1. 在 GitHub Releases 页面下载最新的 `aura-dashboard-v*.zip`；
2. 解压至 `~/.gemini/config/plugins/aura-dashboard`；
3. 重启 Antigravity。

### 常用管理命令
```bash
agy plugin enable aura-dashboard    # 启用插件
agy plugin disable aura-dashboard   # 禁用插件
```

---

## 🛠️ 项目工程架构

本项目采用现代化 **TypeScript + Bun** 标准单体工程，将**仓库源码**与**宿主分发产物**彻底解耦：

```text
chuanban-antigravity-theme-patch/
├── .github/workflows/release.yml   # GitHub Actions CI 自动发布流水线
├── package.json                    # 统一构建脚本 (build, dev, link:plugin)
├── tsconfig.json                   # 严格 TypeScript 类型配置
├── plugin.json                     # 插件清单源定义
├── assets/                         # 矢量图标与截图
├── skills/                         # Agent 原生控制技能 (aura-theme)
├── scripts/                        # 构建装配脚本 (build.ts, link.ts)
├── src/                            # 【统一业务源码收敛于此】
│   ├── panel/                      # 侧边栏 Webview 前端 (TypeScript + CSS)
│   ├── server/                     # Sidecar 守护与遥测聚合服务
│   ├── injection/                  # 注入宿主主窗口的汉化与主题资产
│   ├── presets/                    # 只读初始配置与个性化覆盖模板
│   └── types/                      # 全局核心接口契约定义
└── dist/                           # 【CI / Build 编译输出的标准 Antigravity 插件包】
```

### 侧边栏控制面板入口
在任意会话右上角 **⋮** 菜单中选择 **Extensions → Aura Dashboard** 打开，即可：
- 实时查看当前 CDP 端口与挂载窗口数量；
- 点击 **实时重载样式** 按钮瞬时热刷新修改后的 CSS；
- 一键切换主题预设（高对比暖白 / Claude 暗色）。
