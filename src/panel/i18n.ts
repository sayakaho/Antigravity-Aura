/**
 * Aura Dashboard · Panel Localization Engine & Dictionary
 */

import type { AuraConfig } from '../types';

let currentLang: AuraConfig['language'] = 'default';
try {
  const cached = typeof window !== 'undefined' && window.localStorage?.getItem('aura.panel.language');
  if (cached === 'zh-CN' || cached === 'ja-JP' || cached === 'ko-KR' || cached === 'default') {
    currentLang = cached;
  }
} catch {}

const origTextMap = new WeakMap<Node, string>();
const origAttrMap = new WeakMap<Element, Record<string, string>>();

export const PANEL_TRANSLATIONS_ZH: Record<string, string> = {
  // Navigation & Page Header
  'Aura Dashboard': 'Aura 控制台',
  'Analytics': '数据分析',
  'Preferences': '偏好设置',
  'Overview': '概览',
  'Active Session': '当前会话',
  'Custom Range': '自定义范围',
  'Comprehensive telemetry overview, session intelligence, and interface customization for Antigravity.':
    'Antigravity 深度性能遥测概览、会话智能分析与界面个性化定制。',

  // Time Range Selector
  'Session': '当前会话',
  'Today': '今日',
  'Yesterday': '昨日',
  'This Week': '本周',
  'This Month': '本月',
  'Last 7 Days': '近 7 天',
  'Last 30 Days': '近 30 天',
  'Custom': '自定义',
  'to': '至',
  'Apply': '应用',

  // Toolbar & Status
  'Global Conversation Intelligence': '全局会话智能洞察',
  'Live': '实时',
  'Refresh': '刷新',
  'Auto-updates when telemetry changes': '遥测数据变动时自动更新',
  'Loading telemetry data...': '正在加载遥测数据...',

  // Analytics Section Titles & Loading
  'Rendering timeline...': '正在渲染时间线...',
  'Model Token Consumption': '模型 Token 用量分布',
  'Token consumption, prompt caching, and request volume distributed by AI model.':
    '按 AI 模型统计的 Token 消耗、Prompt 缓存与请求调用量。',
  'Loading model metrics...': '正在加载模型指标...',
  'Rendering model speed trends...': '正在渲染模型速率走势...',
  'Rendering latency distribution...': '正在渲染延迟与 TTFT 分布...',
  'Subagent Execution': 'Subagent 执行分析',
  'Token consumption, run volume, and prompt caching delegated to autonomous subagents.':
    '委派给自主 Subagent 的 Token 消耗、执行轮次与 Prompt 缓存。',
  'Tool Ecosystem Usage': '工具生态使用分布',
  'Autonomous tool execution distribution, command invocations, and file operations.':
    '自主工具执行分布、终端命令调用与文件读写操作。',
  'Loading tool metrics...': '正在加载工具指标...',
  'Workspace & Project Distribution': '工作区与项目分布',
  'Token consumption and session volume across workspaces and conversations.':
    '各工作区与会话之间的 Token 消耗及会话量统计。',
  'Follow Range': '跟随时间范围',
  'All Time': '全量历史',
  'Loading workspaces...': '正在加载工作区数据...',
  'Account Token Consumption': '账号 Token 用量分布',
  'Token consumption, session volume, and timeline distribution tracked across logged-in accounts.':
    '已登录账号之间的 Token 消耗、会话量及时间线分布。',
  'Loading account metrics...': '正在加载账号指标...',

  // Analytics Metric Cards & Tooltips
  'Session Turns': '会话轮次',
  'Session Turns:': '会话轮次：',
  'User Conversation Turns:': '用户对话轮次：',
  'Avg Tokens / Turn:': '单轮平均 Token：',
  'Cache Hit Rate': '缓存命中率',
  'Total Tokens': '总 Token 用量',
  'Input Tokens': '输入 Token',
  'Output Tokens': '输出 Token',
  'Cached Tokens': '缓存读取 Token',
  'Estimated API Cost': '预估商业 API 价值',
  'Baseline Speed': '基准生成速率',
  'Peak Speed': '峰值生成速率',
  'TTFT Latency': '首字响应延迟 (TTFT)',

  // Settings Section: Appearance & Themes
  'Appearance & Themes': '外观与主题',
  'Customize color presets and composer micro-relief borders for Light and Dark modes.':
    '为浅色与深色模式自定义色彩预设及输入框微浮雕边框。',
  'Light Mode Preset': '浅色模式预设',
  'Active color scheme when the system is in light appearance.':
    '系统处于浅色外观时生效的色彩方案。',
  'Claude Light': 'Claude 浅色',
  'Pure Light': '纯白极简',
  'Native Default': '官方默认',
  'Dark Mode Preset': '深色模式预设',
  'Active color scheme when the system is in dark appearance.':
    '系统处于深色外观时生效的色彩方案。',
  'Claude Dark': 'Claude 深色',
  'Pure Dark': '纯黑极简',
  'Wax Seal Border': '输入框微浮雕边框',
  'Subtle micro-relief bottom border on composer input panel.':
    '在输入框底缘呈现微妙雅致的微浮雕边框。',
  'Collinear Compose Bar': '紧凑同行输入栏',
  'Align prompt action pills, context chips and attachments into a seamless collinear layout.':
    '将 Prompt 快捷操作、上下文标签及附件在输入框内无缝紧凑同行排列。',
  'Hide Composer Pill Arrows': '隐藏输入栏气泡箭头',
  'Hide disclosure and trigger chevron arrows inside prompt composer pills.':
    '隐藏输入栏气泡胶囊内的折叠与触发下拉小箭头。',
  'UI Localization': '界面多语言汉化',
  'Language & Localization': '语言与本地化',
  'UI Language': '界面语言',
  'Choose official English or community Chinese localization.':
    '选择官方英文原版、社区中文汉化或日语界面。',
  'English (Default)': 'English (原生英文)',
  'Chinese (Simplified)': '简体中文',
  'Japanese (日本語)': '日本語 (Japanese)',

  // Settings Section: Typography System
  'Typography System': '字体排印系统',
  'Enumerate system fonts directly with primary Latin font and CJK fallback separation.':
    '原生枚举本地系统字体，支持西文主字体与中日韩 (CJK) 回退字体独立链式配置。',
  'Primary Sans Font': '西文无衬线主字体',
  'Latin text, numbers, and primary UI headings.':
    '西文字符、数字符号以及界面主要标题字族。',
  'System Default': '系统默认',
  'Custom Font Family': '自定义字族',
  'Custom Primary Font': '自定义西文字体名',
  'CSS font-family string (e.g. "Geist", "Inter", "SF Pro Display").':
    'CSS font-family 字符串（例如 "Geist", "Inter", "SF Pro Display"）。',
  'CJK Fallback Font': '中日韩 (CJK) 回退字体',
  'Chinese, Japanese, and Korean character rendering priority.':
    '中文、日文及韩文字符的独立优先回退字族。',
  'System CJK Default': '系统默认 CJK 字族',
  'Custom CJK Font': '自定义 CJK 字体名',
  'CSS font-family string (e.g. "PingFang SC", "Hiragino Sans", "Microsoft YaHei").':
    'CSS font-family 字符串（例如 "PingFang SC", "Hiragino Sans", "Microsoft YaHei"）。',
  'Monospace Font': '等宽代码字体',
  'Code blocks, telemetry metrics, and terminal display.':
    '代码块、遥测速率指标以及终端面板字族。',
  'Custom Monospace Font': '自定义等宽字体名',
  'CSS font-family string (e.g. "JetBrains Mono", "SF Mono", "Fira Code").':
    'CSS font-family 字符串（例如 "JetBrains Mono", "SF Mono", "Fira Code"）。',
  'Conversation Font Size': '对话字体字号',
  'Adjust message typography size with proportionate line-height scaling.':
    '等比调整消息文本字号及对应行高间距。',
  'Default (13px)': '默认 (13px)',
  'Medium (14px)': '适中 (14px)',
  'Large (15px)': '偏大 (15px)',
  'Extra Large (16px)': '超大 (16px)',

  // Settings Section: Telemetry & Analytics
  'Telemetry & Analytics': '遥测与数据分析',
  'Manage background performance trackers, live telemetry capsules, and local metric persistence.':
    '管理后台性能采集器、输入栏实时胶囊及本地指标持久化。',
  'Real-time Metrics Capsule': '实时性能胶囊',
  'Display live TPS, TTFT, and context tokens badge directly inside the composer footer bar.':
    '在输入栏底栏内嵌展示实时生成速率 (TPS)、首字延迟 (TTFT) 及上下文 Token 用量胶囊。',
  'Folded Action Summaries': '折叠操作卡片行为摘要',
  'Compact redundant tool and terminal command cards in conversations with elegant folded counters.':
    '将对话中冗长繁琐的工具与终端命令卡片紧凑聚合为极简计数摘要。',
  'Token Usage Analytics': 'Token 用量智能分析',
  'Persist detailed token usage and conversation analytics to local database for the Analytics tab.':
    '将详细的 Token 用量与会话指标持久化到本地 SQLite 数据库，驱动数据分析看板。',

  // Settings Section: Host Resilience
  'Host Resilience': '宿主稳定性增强',
  'Autonomous patch stability, input deadlock prevention, and keyboard shortcut repair.':
    '补丁自主韧性维持、输入死锁防御及快捷键全局修复。',
  'Input Deadlock Healer': '输入框死锁修复器',
  'Auto-restore focus when the main input box gets stuck in non-editable or blocked state.':
    '当主输入框陷入无法编辑、丢失聚焦或被不可见图层阻挡时自动解除死锁。',
  'macOS Shortcut Repair': 'macOS 快捷键全局修复',
  'Ensure Command+Comma reliably opens system preferences under all window focus states.':
    '确保在任何聚焦状态下 Command+逗号 均能精准调起系统全局设置。',
  'Self-Healing CDP Connection': 'CDP 自愈式热重连',
  'Automatically reconnect and re-inject telemetry hooks when the Antigravity host restarts.':
    '当 Antigravity 宿主重启或崩溃恢复后，自动重建 CDP 管道并重新装载注入钩子。',

  // Settings Actions & Dialogs
  'Saving configuration...': '正在保存配置...',
  'Configuration saved': '配置已保存',
  'Failed to save configuration': '保存配置失败',
  'Reset All to Defaults': '恢复全量默认预设',
  'Reset all Aura preferences to initial settings? Custom CSS and JS will be kept.':
    '确定要将所有 Aura 偏好设置恢复为初始默认值吗？用户的 custom.css 和 custom.js 将被完好保留。',
  'Reset Preferences': '恢复默认设置',
  'Resetting preferences...': '正在恢复默认设置...',
  'Preferences reset to defaults': '已恢复默认设置',
  'CDP Connected': 'CDP 已连接',
  'CDP Disconnected': 'CDP 未连接',

  // Settings Section: Real-time Telemetry Capsule
  'Real-time Telemetry Capsule': '实时性能遥测胶囊',
  'Monitor model speed (tok/s), TTFT, and context usage directly on composer.':
    '在输入栏下方直观监控模型生成速率 (tok/s)、TTFT 延迟与上下文占用。',
  'Session Live Metrics Capsule': '会话实时指标胶囊',
  'Displays token rate pill on composer with hover detailed popup.':
    '在输入框显示速度指标胶囊，悬浮可查看完整详细弹窗。',
  'Telemetry Sampling Rate': '遥测采样频率',
  'SQLite conversation database polling interval.':
    '底层 SQLite 会话数据库的轮询采样间隔。',

  // Settings Section: Engine Status & Actions
  'CDP Engine Status': 'CDP 引擎状态',
  'Host Connection Status': '宿主连接状态',
  'Connected to Antigravity host': '已连接至 Antigravity 宿主',
  'Connected to host': '已连接至宿主',
  'Connected': '已连接',
  'window(s)': '个窗口',
  'port': '端口',
  'Searching window...': '正在寻找宿主窗口...',
  'Detecting Antigravity CDP port...': '正在检测 Antigravity CDP 调试端口...',
  'Style Hot Reload': '样式热重载',
  'Recompile active configuration and push latest styles to all windows.':
    '重新编译当前配置并向所有已连接窗口热推送最新样式。',
  'Reapply Now': '立即重新应用',
  'Host Window Reload': '宿主窗口重载',
  'Hard-reload active Antigravity window to refresh frozen architecture singletons.':
    '硬重载当前 Antigravity 窗口以刷新冻结的底层架构单例状态。',
  'Reload Window': '重载窗口',

  // Settings Section: Advanced Settings
  'Advanced Settings': '高级实验性设置',
  'Architecture changes require a host window reload to take full effect.':
    '架构级改动需要重载宿主窗口方可完全生效。',
  'Reload Window Now': '立即重载窗口',
  'Enable Labs & Developer Mode': '启用 Labs 实验室与开发者模式',
  'Unlock native Labs experimental features panel and internal developer settings.':
    '解锁官方原生 Labs 实验特性面板与内部开发者调试开关。',
  'Release Channel Track': '版本发布更新通道 (Track)',
  'Select native application update track & internal API capabilities.':
    '选择客户端原生更新轨道与内部 API 功能特性等级。',
  'Bring Your Own Account (BYOA)': '自带外部账号模式 (BYOA)',
  'Enable independent API key and custom account routing mode.':
    '启用独立 API 密钥与第三方自定义账号路由模式。',
  'Bypass Enterprise Restrictions': '绕过企业策略限制',
  'Disable enterprise policy blocks on custom plugins, MCP tools, and external models.':
    '禁用企业组织针对第三方插件、MCP 工具及外部模型的策略拦截。',
  'Cloud Workstation (CDE) Mode': '云开发环境 (CDE) 模式',
  'Activate Cloud Development Environment container and terminal integration.':
    '激活云端工作站容器化开发环境与终端集成。',
  'Host Presentation Variant': '宿主呈现形态变体',
  'Switch presentation architecture between standalone app and IDE-embedded frame.':
    '在独立桌面客户端与 IDE 内嵌窗口呈现架构之间切换。',
  'Direct Microphone Access': '直连麦克风访问权限',
  'Directly grant audio input and voice pipeline streaming privileges.':
    '直接授予本地音频输入与语音管道流式传输原生权限。',
  'Standalone Desktop (Default)': '独立桌面客户端 (Default)',
  'Antigravity IDE (Embedded)': 'Antigravity IDE 内嵌框架',

  // Toast Notifications
  'Configuration applied in real-time': '配置已实时生效',
  'Save failed': '保存配置失败',
  'Network error': '网络请求异常',
  'Styles recompiled and re-applied': '样式已重新编译并生效',
  'Reload failed': '重载失败',
  'Host window reloaded': '宿主窗口已重载',
  'Window reload failed': '窗口重载失败',
  'Request error': '请求发生错误'
};

export const PANEL_TRANSLATIONS_JA: Record<string, string> = {
  // Navigation & Page Header
  'Aura Dashboard': 'Aura ダッシュボード',
  'Analytics': 'アナリティクス',
  'Preferences': '環境設定',
  'Overview': '概要',
  'Active Session': '現在のアクティブセッション',
  'Custom Range': 'カスタム期間',
  'Comprehensive telemetry overview, session intelligence, and interface customization for Antigravity.':
    'Antigravity の包括的なテレメトリ概要、セッション分析、インターフェースのカスタマイズ。',

  // Time Range Selector
  'Session': 'セッション',
  'Today': '今日',
  'Yesterday': '昨日',
  'This Week': '今週',
  'This Month': '今月',
  'Last 7 Days': '過去 7 日間',
  'Last 30 Days': '過去 30 日間',
  'Custom': 'カスタム',
  'to': '〜',
  'Apply': '適用',

  // Toolbar & Status
  'Global Conversation Intelligence': 'グローバル会話インサイト',
  'Live': 'ライブ',
  'Refresh': '更新',
  'Auto-updates when telemetry changes': 'テレメトリ変更時に自動更新',
  'Loading telemetry data...': 'テレメトリデータを読み込み中...',

  // Analytics Section Titles & Loading
  'Rendering timeline...': 'タイムラインを描画中...',
  'Model Token Consumption': 'モデル別トークン消費量',
  'Token consumption, prompt caching, and request volume distributed by AI model.':
    'AI モデル別のトークン消費量、Prompt キャッシュ、リクエスト数。',
  'Loading model metrics...': 'モデルメトリクスを読み込み中...',
  'Rendering model speed trends...': 'モデル速度の推移を描画中...',
  'Rendering latency distribution...': 'レイテンシと TTFT 分布を描画中...',
  'Subagent Execution': 'Subagent 実行分析',
  'Token consumption, run volume, and prompt caching delegated to autonomous subagents.':
    '自律型 Subagent に委任されたトークン消費量、実行回数、Prompt キャッシュ。',
  'Tool Ecosystem Usage': 'ツールエコシステムの使用状況',
  'Autonomous tool execution distribution, command invocations, and file operations.':
    'ツールの実行分布、ターミナルコマンドの呼び出し、ファイル操作。',
  'Loading tool metrics...': 'ツールメトリクスを読み込み中...',
  'Workspace & Project Distribution': 'ワークスペースおよびプロジェクトの分布',
  'Token consumption and session volume across workspaces and conversations.':
    'ワークスペースや会話ごとのトークン消費量とセッション数。',
  'Follow Range': '期間に連動',
  'All Time': '全期間',
  'Loading workspaces...': 'ワークスペースを読み込み中...',
  'Account Token Consumption': 'アカウント別トークン消費量',
  'Token consumption, session volume, and timeline distribution tracked across logged-in accounts.':
    'ログイン中のアカウントごとのトークン消費量、セッション数、タイムライン分布。',
  'Loading account metrics...': 'アカウントメトリクスを読み込み中...',

  // Analytics Metric Cards & Tooltips
  'Session Turns': 'セッションターン数',
  'Session Turns:': 'セッションターン数：',
  'User Conversation Turns:': 'ユーザー会話ターン数：',
  'Avg Tokens / Turn:': 'ターン平均トークン：',
  'Cache Hit Rate': 'キャッシュヒット率',
  'Total Tokens': '合計トークン',
  'Input Tokens': '入力トークン',
  'Output Tokens': '出力トークン',
  'Cached Tokens': 'キャッシュ読み取りトークン',
  'Estimated API Cost': '推定 API コスト',
  'Baseline Speed': '基準生成速度',
  'Peak Speed': 'ピーク生成速度',
  'TTFT Latency': '初回応答レイテンシ (TTFT)',

  // Settings Section: Appearance & Themes
  'Appearance & Themes': '外観とテーマ',
  'Customize color presets and composer micro-relief borders for Light and Dark modes.':
    'ライトモードとダークモードのカラープリセットおよびコンポーザーの境界線をカスタマイズします。',
  'Light Mode Preset': 'ライトモードプリセット',
  'Active color scheme when the system is in light appearance.':
    'システムがライト外観のときに適用されるカラースキーム。',
  'Claude Light': 'Claude ライト',
  'Pure Light': 'ピュアライト',
  'Native Default': '公式デフォルト',
  'Dark Mode Preset': 'ダークモードプリセット',
  'Active color scheme when the system is in dark appearance.':
    'システムがダーク外観のときに適用されるカラースキーム。',
  'Claude Dark': 'Claude ダーク',
  'Pure Dark': 'ピュアダーク',
  'Wax Seal Border': 'マイクロレリーフ境界線',
  'Subtle micro-relief bottom border on composer input panel.':
    'コンポーザー入力パネルに繊細なマイクロレリーフ下部境界線を表示します。',
  'Collinear Compose Bar': 'フラットコンポーザーバー',
  'Align prompt action pills, context chips and attachments into a seamless collinear layout.':
    'Prompt アクションピル、コンテキストチップ、添付ファイルを一列に揃えたシームレスなレイアウトにします。',
  'Hide Composer Pill Arrows': 'ピル矢印アイコンを非表示',
  'Hide disclosure and trigger chevron arrows inside prompt composer pills.':
    'Prompt コンポーザー内のピルにある展開・トリガー用矢印アイコンを非表示にします。',
  'UI Localization': 'UI ローカライズ',
  'Language & Localization': '言語とローカライズ',
  'UI Language': 'UI 言語',
  'Choose official English or community Chinese localization.':
    '公式英語または多言語ローカライズを選択します。',
  'English (Default)': 'English (公式英語)',
  'Chinese (Simplified)': '中国語 (簡体字)',
  'Japanese (日本語)': '日本語 (Japanese)',

  // Settings Section: Typography System
  'Typography System': 'タイポグラフィ',
  'Enumerate system fonts directly with primary Latin font and CJK fallback separation.':
    '欧文プライマリフォントと CJK フォールバックを個別に指定してシステムフォントを設定します。',
  'Primary Sans Font': '欧文プライマリフォント',
  'Latin text, numbers, and primary UI headings.':
    '欧文テキスト、数字、および主要な UI 見出しに適用されます。',
  'System Default': 'システムデフォルト',
  'Custom Font Family': 'カスタムフォントファミリ',
  'Custom Primary Font': 'カスタムプライマリフォント',
  'CSS font-family string (e.g. "Geist", "Inter", "SF Pro Display").':
    'CSS font-family 文字列（例: "Geist", "Inter", "SF Pro Display"）。',
  'CJK Fallback Font': 'CJK フォールバックフォント',
  'Chinese, Japanese, and Korean character rendering priority.':
    '中国語、日本語、韓国語の文字レンダリング優先順位。',
  'System CJK Default': 'システム CJK デフォルト',
  'Custom CJK Font': 'カスタム CJK フォント',
  'CSS font-family string (e.g. "PingFang SC", "Hiragino Sans", "Microsoft YaHei").':
    'CSS font-family 文字列（例: "Hiragino Sans", "PingFang SC", "Noto Sans JP"）。',
  'Monospace Font': '等幅フォント',
  'Code blocks, telemetry metrics, and terminal display.':
    'コードブロック、テレメトリメトリクス、ターミナル表示に適用されます。',
  'Custom Monospace Font': 'カスタム等幅フォント',
  'CSS font-family string (e.g. "JetBrains Mono", "SF Mono", "Fira Code").':
    'CSS font-family 文字列（例: "JetBrains Mono", "SF Mono", "Fira Code"）。',
  'Conversation Font Size': '会話フォントサイズ',
  'Adjust message typography size with proportionate line-height scaling.':
    '行の高さと比例した適切なスケーリングでメッセージのフォントサイズを調整します。',
  'Default (13px)': 'デフォルト (13px)',
  'Medium (14px)': '中 (14px)',
  'Large (15px)': '大 (15px)',
  'Extra Large (16px)': '特大 (16px)',

  // Settings Section: Telemetry & Analytics
  'Telemetry & Analytics': 'テレメトリと分析',
  'Manage background performance trackers, live telemetry capsules, and local metric persistence.':
    'バックグラウンドのパフォーマンストラッカー、ライブテレメトリカプセル、ローカルメトリクスの永続化を管理します。',
  'Real-time Metrics Capsule': 'リアルタイムメトリクスカプセル',
  'Display live TPS, TTFT, and context tokens badge directly inside the composer footer bar.':
    'コンポーザーのフッターバー内にリアルタイム TPS、TTFT、コンテキストトークンバッジを表示します。',
  'Folded Action Summaries': '折りたたみアクションサマリー',
  'Compact redundant tool and terminal command cards in conversations with elegant folded counters.':
    '会話内の冗長なツールやターミナルコマンドカードをエレガントな折りたたみカウンターにまとめます。',
  'Token Usage Analytics': 'トークン使用量分析',
  'Persist detailed token usage and conversation analytics to local database for the Analytics tab.':
    '「アナリティクス」タブ用に、詳細なトークン消費量と会話分析をローカルデータベースに永続化します。',

  // Settings Section: Host Resilience
  'Host Resilience': 'ホスト安定性向上',
  'Autonomous patch stability, input deadlock prevention, and keyboard shortcut repair.':
    'パッチの自己修復、入力デッドロック防止、キーボードショートカット修復。',
  'Input Deadlock Healer': '入力デッドロック修復',
  'Auto-restore focus when the main input box gets stuck in non-editable or blocked state.':
    'メイン入力ボックスが編集不可またはブロック状態になった場合にフォーカスを自動復元します。',
  'macOS Shortcut Repair': 'macOS ショートカット修復',
  'Ensure Command+Comma reliably opens system preferences under all window focus states.':
    'すべてのウィンドウフォーカス状態において、Command+カンマで確実にシステム設定が開くようにします。',
  'Self-Healing CDP Connection': 'CDP 自動修復接続',
  'Automatically reconnect and re-inject telemetry hooks when the Antigravity host restarts.':
    'Antigravity ホストが再起動した際に、テレメトリフックの再接続と再注入を自動実行します。',

  // Settings Actions & Dialogs
  'Saving configuration...': '設定を保存中...',
  'Configuration saved': '設定を保存しました',
  'Failed to save configuration': '設定の保存に失敗しました',
  'Reset All to Defaults': 'すべての設定をデフォルトに戻す',
  'Reset all Aura preferences to initial settings? Custom CSS and JS will be kept.':
    'すべての Aura 設定を初期状態にリセットしますか？カスタム CSS と JS は保持されます。',
  'Reset Preferences': '設定をリセット',
  'Resetting preferences...': '設定をリセット中...',
  'Preferences reset to defaults': '設定をデフォルトにリセットしました',
  'CDP Connected': 'CDP 接続済み',
  'CDP Disconnected': 'CDP 未接続',

  // Settings Section: Real-time Telemetry Capsule
  'Real-time Telemetry Capsule': 'リアルタイム性能テレメトリカプセル',
  'Monitor model speed (tok/s), TTFT, and context usage directly on composer.':
    '入力欄の下でモデル生成速度 (tok/s)、TTFT、コンテキスト使用量を直感的に監視します。',
  'Session Live Metrics Capsule': 'セッションリアルタイムメトリクスカプセル',
  'Displays token rate pill on composer with hover detailed popup.':
    '入力ボックスに速度メトリクスバッジを表示し、ホバーで詳細ポップアップを確認できます。',
  'Telemetry Sampling Rate': 'テレメトリサンプリング間隔',
  'SQLite conversation database polling interval.':
    '基底の SQLite 会話データベースのポーリング間隔。',

  // Settings Section: Engine Status & Actions
  'CDP Engine Status': 'CDP エンジンステータス',
  'Host Connection Status': 'ホスト接続ステータス',
  'Connected to Antigravity host': 'Antigravity ホストに接続済み',
  'Connected to host': 'ホストに接続済み',
  'Connected': '接続済み',
  'window(s)': '個のウィンドウ',
  'port': 'ポート',
  'Searching window...': 'ホストウィンドウを検索中...',
  'Detecting Antigravity CDP port...': 'Antigravity CDP デバッグポートを検出中...',
  'Style Hot Reload': 'スタイルホットリロード',
  'Recompile active configuration and push latest styles to all windows.':
    '現在の設定を再コンパイルし、接続中の全ウィンドウに最新スタイルをホット反映します。',
  'Reapply Now': '今すぐ再適用',
  'Host Window Reload': 'ホストウィンドウの再読み込み',
  'Hard-reload active Antigravity window to refresh frozen architecture singletons.':
    '現在の Antigravity ウィンドウを強制リロードし、停止した内部シングルトンを再初期化します。',
  'Reload Window': 'ウィンドウを再読み込み',

  // Settings Section: Advanced Settings
  'Advanced Settings': '高度な実験的設定',
  'Architecture changes require a host window reload to take full effect.':
    'アーキテクチャの変更を完全に反映するにはホストウィンドウの再読み込みが必要です。',
  'Reload Window Now': '今すぐウィンドウを再読み込み',
  'Enable Labs & Developer Mode': 'Labs および開発者モードを有効化',
  'Unlock native Labs experimental features panel and internal developer settings.':
    '公式の Labs 実験的機能パネルと内部開発者向け設定のロックを解除します。',
  'Release Channel Track': 'リリース更新トラック (Track)',
  'Select native application update track & internal API capabilities.':
    'クライアントの更新トラックと内部 API 機能のレベルを選択します。',
  'Bring Your Own Account (BYOA)': 'BYOA モード (自前アカウント)',
  'Enable independent API key and custom account routing mode.':
    '独立した API キーとカスタムアカウントルーティングモードを有効にします。',
  'Bypass Enterprise Restrictions': '企業ポリシー制限をバイパス',
  'Disable enterprise policy blocks on custom plugins, MCP tools, and external models.':
    'カスタムプラグイン、MCP ツール、外部モデルに対する企業ポリシーのブロックを無効化します。',
  'Cloud Workstation (CDE) Mode': 'クラウドワークステーション (CDE) モード',
  'Activate Cloud Development Environment container and terminal integration.':
    'クラウド開発環境のコンテナおよびターミナル統合を有効化します。',
  'Host Presentation Variant': 'ホスト表示バリアント',
  'Switch presentation architecture between standalone app and IDE-embedded frame.':
    'スタンドアロンデスクトップアプリと IDE 組み込みフレームの間で表示アーキテクチャを切り替えます。',
  'Direct Microphone Access': 'マイク直接アクセス権限',
  'Directly grant audio input and voice pipeline streaming privileges.':
    'ローカル音声入力とストリーミングパイプラインの権限を直接付与します。',
  'Standalone Desktop (Default)': 'スタンドアロンデスクトップ (デフォルト)',
  'Antigravity IDE (Embedded)': 'Antigravity IDE (組み込み)',

  // Toast Notifications
  'Configuration applied in real-time': '設定がリアルタイムに適用されました',
  'Save failed': '設定の保存に失敗しました',
  'Network error': 'ネットワークリクエストエラー',
  'Styles recompiled and re-applied': 'スタイルが再コンパイルされ再適用されました',
  'Reload failed': '再読み込みに失敗しました',
  'Host window reloaded': 'ホストウィンドウが再読み込みされました',
  'Window reload failed': 'ウィンドウの再読み込みに失敗しました',
  'Request error': 'リクエストエラーが発生しました'
};

export const PANEL_TRANSLATIONS_KO: Record<string, string> = {
  // Navigation & Page Header
  'Aura Dashboard': 'Aura 대시보드',
  'Analytics': '애널리틱스',
  'Preferences': '환경설정',
  'Overview': '개요',
  'Active Session': '현재 활성 세션',
  'Custom Range': '사용자 지정 기간',
  'Comprehensive telemetry overview, session intelligence, and interface customization for Antigravity.':
    'Antigravity의 포괄적인 텔레메트리 개요, 세션 인텔리전스 및 인터페이스 맞춤 설정.',

  // Time Range Selector
  'Session': '세션',
  'Today': '오늘',
  'Yesterday': '어제',
  'This Week': '이번 주',
  'This Month': '이번 달',
  'Last 7 Days': '최근 7일',
  'Last 30 Days': '최근 30일',
  'Custom': '사용자 지정',
  'to': '~',
  'Apply': '적용',

  // Toolbar & Status
  'Global Conversation Intelligence': '글로벌 대화 인사이트',
  'Live': '실시간',
  'Refresh': '새로고침',
  'Auto-updates when telemetry changes': '텔레메트리 변경 시 자동 업데이트',
  'Loading telemetry data...': '텔레메트리 데이터 불러오는 중...',

  // Analytics Section Titles & Loading
  'Rendering timeline...': '타임라인 렌더링 중...',
  'Model Token Consumption': '모델별 토큰 소비량',
  'Token consumption, prompt caching, and request volume distributed by AI model.':
    'AI 모델별 토큰 소비량, Prompt 캐싱 및 요청 호출 수.',
  'Loading model metrics...': '모델 지표 불러오는 중...',
  'Rendering model speed trends...': '모델 속도 추이 렌더링 중...',
  'Rendering latency distribution...': '지연시간 및 TTFT 분포 렌더링 중...',
  'Subagent Execution': 'Subagent 실행 분석',
  'Token consumption, run volume, and prompt caching delegated to autonomous subagents.':
    '자율 Subagent에 위임된 토큰 소비량, 실행 횟수 및 Prompt 캐싱.',
  'Tool Ecosystem Usage': '도구 생태계 사용 분포',
  'Autonomous tool execution distribution, command invocations, and file operations.':
    '자율 도구 실행 분포, 터미널 명령 호출 및 파일 작업.',
  'Loading tool metrics...': '도구 지표 불러오는 중...',
  'Workspace & Project Distribution': '워크스페이스 및 프로젝트 분포',
  'Token consumption and session volume across workspaces and conversations.':
    '워크스페이스 및 대화 간 토큰 소비량과 세션 수.',
  'Follow Range': '기간 연동',
  'All Time': '전체 기간',
  'Loading workspaces...': '워크스페이스 불러오는 중...',
  'Account Token Consumption': '계정별 토큰 소비량',
  'Token consumption, session volume, and timeline distribution tracked across logged-in accounts.':
    '로그인된 계정 간 토큰 소비량, 세션 수 및 타임라인 분포.',
  'Loading account metrics...': '계정 지표 불러오는 중...',

  // Analytics Metric Cards & Tooltips
  'Session Turns': '세션 턴 수',
  'Session Turns:': '세션 턴 수:',
  'User Conversation Turns:': '사용자 대화 턴 수:',
  'Avg Tokens / Turn:': '턴당 평균 토큰:',
  'Cache Hit Rate': '캐시 적중률',
  'Total Tokens': '총 토큰',
  'Input Tokens': '입력 토큰',
  'Output Tokens': '출력 토큰',
  'Cached Tokens': '캐시 읽기 토큰',
  'Estimated API Cost': '예상 API 비용',
  'Baseline Speed': '기준 생성 속도',
  'Peak Speed': '최고 생성 속도',
  'TTFT Latency': '첫 글자 응답 지연 (TTFT)',

  // Settings Section: Appearance & Themes
  'Appearance & Themes': '모양 및 테마',
  'Customize color presets and composer micro-relief borders for Light and Dark modes.':
    '라이트 및 다크 모드의 색상 프리셋과 입력창 마이크로 릴리프 테두리를 맞춤 설정합니다.',
  'Light Mode Preset': '라이트 모드 프리셋',
  'Active color scheme when the system is in light appearance.':
    '시스템이 라이트 모드일 때 적용되는 색상 구성표.',
  'Claude Light': 'Claude 라이트',
  'Pure Light': '퓨어 라이트',
  'Native Default': '공식 기본값',
  'Dark Mode Preset': '다크 모드 프리셋',
  'Active color scheme when the system is in dark appearance.':
    '시스템이 다크 모드일 때 적용되는 색상 구성표.',
  'Claude Dark': 'Claude 다크',
  'Pure Dark': '퓨어 다크',
  'Wax Seal Border': '마이크로 릴리프 테두리',
  'Subtle micro-relief bottom border on composer input panel.':
    '입력창 패널 하단에 은은한 마이크로 릴리프 테두리를 표시합니다.',
  'Collinear Compose Bar': '단일 행 컴포저 바',
  'Align prompt action pills, context chips and attachments into a seamless collinear layout.':
    'Prompt 작업 캡슐, 컨텍스트 칩, 첨부파일을 깔끔한 단일 행으로 정렬합니다.',
  'Hide Composer Pill Arrows': '컴포저 캡슐 화살표 숨기기',
  'Hide disclosure and trigger chevron arrows inside prompt composer pills.':
    'Prompt 컴포저 내부 캡슐의 펼치기 및 트리거 화살표 아이콘을 숨깁니다.',
  'UI Localization': 'UI 로컬라이제이션',
  'Language & Localization': '언어 및 로컬라이제이션',
  'UI Language': 'UI 언어',
  'Choose official English or community Chinese localization.':
    '공식 영어 또는 다국어 로컬라이제이션을 선택합니다.',
  'English (Default)': 'English (기본값)',
  'Chinese (Simplified)': '중국어 (간체)',
  'Japanese (日本語)': '일본어 (日本語)',
  'Korean (한국어)': '한국어 (Korean)',

  // Settings Section: Typography System
  'Typography System': '타이포그래피 시스템',
  'Enumerate system fonts directly with primary Latin font and CJK fallback separation.':
    '영문 기본 폰트와 CJK 대체 폰트를 개별 지정하여 시스템 폰트를 설정합니다.',
  'Primary Sans Font': '기본 산세리프 폰트',
  'Latin text, numbers, and primary UI headings.':
    '영문 텍스트, 숫자 및 기본 UI 제목에 적용됩니다.',
  'System Default': '시스템 기본값',
  'Custom Font Family': '사용자 지정 폰트 패밀리',
  'Custom Primary Font': '사용자 지정 기본 폰트',
  'CSS font-family string (e.g. "Geist", "Inter", "SF Pro Display").':
    'CSS font-family 문자열 (예: "Geist", "Inter", "SF Pro Display").',
  'CJK Fallback Font': 'CJK 대체 폰트',
  'Chinese, Japanese, and Korean character rendering priority.':
    '한글, 한자, 일본어 문자 렌더링 우선순위.',
  'System CJK Default': '시스템 CJK 기본값',
  'Custom CJK Font': '사용자 지정 CJK 폰트',
  'CSS font-family string (e.g. "PingFang SC", "Hiragino Sans", "Microsoft YaHei").':
    'CSS font-family 문자열 (예: "Pretendard", "Noto Sans KR", "Malgun Gothic").',
  'Monospace Font': '고정폭 폰트',
  'Code blocks, telemetry metrics, and terminal display.':
    '코드 블록, 텔레메트리 지표 및 터미널 표시에 적용됩니다.',
  'Custom Monospace Font': '사용자 지정 고정폭 폰트',
  'CSS font-family string (e.g. "JetBrains Mono", "SF Mono", "Fira Code").':
    'CSS font-family 문자열 (예: "JetBrains Mono", "SF Mono", "D2Coding").',
  'Conversation Font Size': '대화 폰트 크기',
  'Adjust message typography size with proportionate line-height scaling.':
    '메시지 폰트 크기와 줄 간격을 비례 조정합니다.',
  'Default (13px)': '기본 (13px)',
  'Medium (14px)': '보통 (14px)',
  'Large (15px)': '크게 (15px)',
  'Extra Large (16px)': '매우 크게 (16px)',

  // Settings Section: Telemetry & Analytics
  'Telemetry & Analytics': '텔레메트리 및 분석',
  'Manage background performance trackers, live telemetry capsules, and local metric persistence.':
    '백그라운드 성능 추적기, 실시간 텔레메트리 캡슐 및 로컬 지표 저장을 관리합니다.',
  'Real-time Metrics Capsule': '실시간 성능 캡슐',
  'Display live TPS, TTFT, and context tokens badge directly inside the composer footer bar.':
    '입력창 하단 표시줄에 실시간 TPS, TTFT 및 컨텍스트 토큰 배지를 직접 표시합니다.',
  'Folded Action Summaries': '접힌 작업 요약',
  'Compact redundant tool and terminal command cards in conversations with elegant folded counters.':
    '대화창의 반복적인 도구 및 터미널 명령 카드를 깔끔한 접힘 카운터로 요약합니다.',
  'Token Usage Analytics': '토큰 사용량 분석',
  'Persist detailed token usage and conversation analytics to local database for the Analytics tab.':
    '애널리틱스 탭을 위해 상세 토큰 소비량 및 대화 분석을 로컬 SQLite 데이터베이스에 저장합니다.',

  // Settings Section: Host Resilience
  'Host Resilience': '호스트 안정성 향상',
  'Autonomous patch stability, input deadlock prevention, and keyboard shortcut repair.':
    '패치 자체 복구, 입력 교착 상태 방지 및 키보드 단축키 복구.',
  'Input Deadlock Healer': '입력 교착 상태 복구',
  'Auto-restore focus when the main input box gets stuck in non-editable or blocked state.':
    '메인 입력창이 편집 불가 또는 차단 상태에 빠졌을 때 포커스를 자동 복구합니다.',
  'macOS Shortcut Repair': 'macOS 단축키 복구',
  'Ensure Command+Comma reliably opens system preferences under all window focus states.':
    '모든 창 포커스 상태에서 Command+쉼표로 시스템 환경설정이 안정적으로 열리도록 보장합니다.',
  'Self-Healing CDP Connection': 'CDP 자동 복구 연결',
  'Automatically reconnect and re-inject telemetry hooks when the Antigravity host restarts.':
    'Antigravity 호스트 재시작 시 텔레메트리 훅을 자동으로 다시 연결하고 주입합니다.',

  // Settings Actions & Dialogs
  'Saving configuration...': '설정 저장 중...',
  'Configuration saved': '설정이 저장되었습니다',
  'Failed to save configuration': '설정 저장 실패',
  'Reset All to Defaults': '모두 기본값으로 복원',
  'Reset all Aura preferences to initial settings? Custom CSS and JS will be kept.':
    '모든 Aura 환경설정을 초기 설정으로 재설정하시겠습니까? 사용자 지정 CSS와 JS는 유지됩니다.',
  'Reset Preferences': '설정 재설정',
  'Resetting preferences...': '설정 재설정 중...',
  'Preferences reset to defaults': '환경설정이 기본값으로 복원되었습니다',
  'CDP Connected': 'CDP 연결됨',
  'CDP Disconnected': 'CDP 연결 끊김',

  // Settings Section: Real-time Telemetry Capsule
  'Real-time Telemetry Capsule': '실시간 성능 텔레메트리 캡슐',
  'Monitor model speed (tok/s), TTFT, and context usage directly on composer.':
    '입력창 아래에서 모델 생성 속도(tok/s), TTFT 및 컨텍스트 사용량을 직관적으로 모니터링합니다.',
  'Session Live Metrics Capsule': '세션 실시간 지표 캡슐',
  'Displays token rate pill on composer with hover detailed popup.':
    '입력창에 속도 지표 캡슐을 표시하고 호버 시 세부 팝업을 확인할 수 있습니다.',
  'Telemetry Sampling Rate': '텔레메트리 샘플링 간격',
  'SQLite conversation database polling interval.':
    '기저 SQLite 대화 데이터베이스의 폴링 간격.',

  // Settings Section: Engine Status & Actions
  'CDP Engine Status': 'CDP 엔진 상태',
  'Host Connection Status': '호스트 연결 상태',
  'Connected to Antigravity host': 'Antigravity 호스트에 연결됨',
  'Connected to host': '호스트에 연결됨',
  'Connected': '연결됨',
  'window(s)': '개 창',
  'port': '포트',
  'Searching window...': '호스트 창 검색 중...',
  'Detecting Antigravity CDP port...': 'Antigravity CDP 디버깅 포트 감지 중...',
  'Style Hot Reload': '스타일 핫 리로드',
  'Recompile active configuration and push latest styles to all windows.':
    '현재 설정을 다시 컴파일하고 연결된 모든 창에 최신 스타일을 즉시 반영합니다.',
  'Reapply Now': '지금 다시 적용',
  'Host Window Reload': '호스트 창 새로고침',
  'Hard-reload active Antigravity window to refresh frozen architecture singletons.':
    '현재 Antigravity 창을 강제 새로고침하여 정지된 내부 싱글톤을 초기화합니다.',
  'Reload Window': '창 새로고침',

  // Settings Section: Advanced Settings
  'Advanced Settings': '고급 실험 설정',
  'Architecture changes require a host window reload to take full effect.':
    '아키텍처 변경 사항을 완전히 적용하려면 호스트 창을 새로고침해야 합니다.',
  'Reload Window Now': '지금 창 새로고침',
  'Enable Labs & Developer Mode': 'Labs 및 개발자 모드 활성화',
  'Unlock native Labs experimental features panel and internal developer settings.':
    '공식 Labs 실험 기능 패널 및 내부 개발자 디버깅 설정을 잠금 해제합니다.',
  'Release Channel Track': '릴리스 업데이트 트랙 (Track)',
  'Select native application update track & internal API capabilities.':
    '클라이언트 업데이트 트랙 및 내부 API 기능 수준을 선택합니다.',
  'Bring Your Own Account (BYOA)': 'BYOA 모드 (자체 계정 사용)',
  'Enable independent API key and custom account routing mode.':
    '독립 API 키 및 사용자 지정 계정 라우팅 모드를 활성화합니다.',
  'Bypass Enterprise Restrictions': '엔터프라이즈 정책 제한 우회',
  'Disable enterprise policy blocks on custom plugins, MCP tools, and external models.':
    '사용자 지정 플러그인, MCP 도구 및 외부 모델에 대한 기업 정책 차단을 비활성화합니다.',
  'Cloud Workstation (CDE) Mode': '클라우드 워크스테이션 (CDE) 모드',
  'Activate Cloud Development Environment container and terminal integration.':
    '클라우드 개발 환경 컨테이너 및 터미널 통합을 활성화합니다.',
  'Host Presentation Variant': '호스트 표시 형태',
  'Switch presentation architecture between standalone app and IDE-embedded frame.':
    '독립 데스크톱 앱과 IDE 임베디드 프레임 간의 표시 아키텍처를 전환합니다.',
  'Direct Microphone Access': '마이크 직접 접근 권한',
  'Directly grant audio input and voice pipeline streaming privileges.':
    '로컬 오디오 입력 및 음성 스트리밍 파이프라인 권한을 직접 부여합니다.',
  'Standalone Desktop (Default)': '독립 데스크톱 (기본값)',
  'Antigravity IDE (Embedded)': 'Antigravity IDE (임베디드)',

  // Toast Notifications
  'Configuration applied in real-time': '설정이 실시간으로 적용되었습니다',
  'Save failed': '저장 실패',
  'Network error': '네트워크 오류',
  'Styles recompiled and re-applied': '스타일이 다시 컴파일되고 적용되었습니다',
  'Reload failed': '새로고침 실패',
  'Host window reloaded': '호스트 창이 새로고침되었습니다',
  'Window reload failed': '창 새로고침 실패',
  'Request error': '요청 오류가 발생했습니다'
};

/**
 * 向后兼容别名，默认指向中文词条
 */
export const PANEL_TRANSLATIONS = PANEL_TRANSLATIONS_ZH;

/**
 * 根据语言代码获取对应的 Panel 字典
 */
export function getPanelDictionary(lang: AuraConfig['language']): Record<string, string> | null {
  if (lang === 'zh-CN') return PANEL_TRANSLATIONS_ZH;
  if (lang === 'ja-JP') return PANEL_TRANSLATIONS_JA;
  if (lang === 'ko-KR') return PANEL_TRANSLATIONS_KO;
  return null;
}

/**
 * 翻译单个动态字符串
 */
export function t(key: string, lang?: AuraConfig['language']): string {
  const targetLang = lang || currentLang;
  const dict = getPanelDictionary(targetLang);
  if (!dict) return key;

  const trimmed = key.trim();
  const found = dict[trimmed];
  if (!found) return key;
  return key.replace(trimmed, found);
}

/**
 * 获取当前 Panel 生效语言
 */
export function getPanelLanguage(): AuraConfig['language'] {
  return currentLang;
}

/**
 * 对 Panel DOM 节点树执行双向可逆翻译
 */
export function applyPanelTranslations(language?: AuraConfig['language']): void {
  if (language) {
    currentLang =
      language === 'zh-CN' || language === 'ja-JP' || language === 'ko-KR' ? language : 'default';
    try {
      window.localStorage?.setItem('aura.panel.language', currentLang);
    } catch {}
  }

  if (typeof document === 'undefined') return;

  const dict = getPanelDictionary(currentLang);
  const root = document.querySelector('.settings-container');
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (
            el.tagName === 'SCRIPT' ||
            el.tagName === 'STYLE' ||
            el.id === 'select-language' ||
            el.id === 'select-font-sans-primary' ||
            el.id === 'select-font-sans-fallback' ||
            el.id === 'select-font-mono' ||
            el.id === 'input-custom-sans-primary' ||
            el.id === 'input-custom-sans-fallback' ||
            el.id === 'input-custom-mono'
          ) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const curVal = textNode.nodeValue || '';
      const trimmed = curVal.trim();
      if (!trimmed) continue;

      let orig = origTextMap.get(textNode);
      if (orig === undefined) {
        orig = curVal;
        origTextMap.set(textNode, orig);
      }

      if (dict) {
        const origTrimmed = orig.trim();
        const translation = dict[origTrimmed];
        if (translation) {
          const nextVal = orig.replace(origTrimmed, translation);
          if (textNode.nodeValue !== nextVal) {
            textNode.nodeValue = nextVal;
          }
        }
      } else {
        if (textNode.nodeValue !== orig) {
          textNode.nodeValue = orig;
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      for (const attr of ['title', 'placeholder']) {
        const val = el.getAttribute(attr);
        if (!val) continue;

        let origAttrs = origAttrMap.get(el);
        if (!origAttrs) {
          origAttrs = {};
          origAttrMap.set(el, origAttrs);
        }
        if (origAttrs[attr] === undefined) {
          origAttrs[attr] = val;
        }

        const origVal = origAttrs[attr];
        if (dict) {
          const translation = dict[origVal.trim()];
          if (translation) {
            el.setAttribute(attr, translation);
          }
        } else {
          el.setAttribute(attr, origVal);
        }
      }
    }
  }

  // 标题与语言下拉框自适应
  document.documentElement.lang =
    currentLang === 'zh-CN' ? 'zh-CN' : currentLang === 'ja-JP' ? 'ja' : currentLang === 'ko-KR' ? 'ko' : 'en';
}
