# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**语言** · [English](../en/README.md) · [中文](#) · [Français](../fr/README.md) · [日本語](../ja/README.md) · English (NZ)](../nz/README.md) · [Italiano](../it/README.md) · [Español](../es/README.md)

---

##  什么是 generative-ui-win？

**跨平台生成式 UI——从实时组件到团队看板**

让 LLM 可视化内容，直接在 Electron 窗口或浏览器标签页中渲染出**交互式组件**——滑块、图表、动画、数据面板。不是截图，不是代码块，而是 **LLM 在生成的同时，实时流式传输的真实 HTML 应用**。

本项目最初是 [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) 的 Windows 兼容版本，但已发展为包含 MCP 服务集成、持久化看板、任务派发和跨会话协作的综合性开发工具包，功能远超原版。

---

##  核心功能

###  实时组件渲染
- **流式 HTML 渲染** — morphdom DOM diffing，流畅无闪烁更新
- **完整浏览器能力** — Canvas, WebGL, Chart.js, D3 Three.js 通过 CDN
- **双向通信** — 组件通过 WebSocket 将数据回传给 Node.js（~1ms 延迟）
- **双模式** — Electron 窗口 或 浏览器标签页
- **设计指南** — 5 个模块（art, mockup, interactive, chart, diagram）

### 可视看板
- **跨会话监控** — 所有 Claude Code 窗口的任务汇集到同一个看板
- **4 列工作流** — TODO → DOING → DONE → MILESTONES
- **每日报告** — 按完成日期自动组织，可展开历史
- **里程碑追踪** — 版本分组 + 进度条可视化
- **任务派发** — 将需求拆解为带优先级和标签的子任务
- **自动同步** — 通过钩子同步 Claude Code 的 TaskCreate/TaskUpdate
- **状态持久化** — 服务重启、浏览器刷新不丢失

### MCP 服务器
- **零配置接入** — 全局安装，通过 stdio 连接
- **丰富工具集** — 组件工具 + 完整看板 CLI 工具集
- **3 个 CLI 命令** — `generative-ui-win`（MCP）、`generative-ui-kanban`（看板）、`generative-ui-sync`（同步）

---

## 安装

### 作为 MCP 服务器（推荐）

```bash
npm install -g generative-ui-win
```

然后在 Claude Code 设置中添加（`~/.claude/settings.json`）：

```json
{
  "mcpServers": {
    "generative-ui": {
      "command": "npx",
      "args": ["-y", "generative-ui-win"]
    }
  }
}
```

重启 Claude Code 后即可使用 `show_widget` / `update_widget` / `run_scripts` / `close_widget` / `get_guidelines` 等工具。看板工具（`kanban_show`, `kanban_add_task`, `kanban_batch_add`, `kanban_move_task`, `kanban_claim_task`, `kanban_add_version`, `kanban_heartbeat`, `kanban_get_status`）也已包含。

### 从源码构建

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

需要 Node.js 18+。Electron 为可选依赖，浏览器模式无需 Electron。

---

## 🏁 快速开始

### 库 API

```typescript
import { showWidget, shutdown } from "generative-ui-win";

// 在 Electron 窗口中打开组件（默认）
const handle = await showWidget("<h1>Hello World</h1>");

// 流式更新 —— morphdom 高效修补 DOM
handle.setContent("<h1>Hello World</h1><p>Loading…</p>");
handle.setContent("<h1>Hello World</h1><p>Done!</p>");

// 流结束后执行脚本
handle.setContent(`
  <canvas id="chart"></canvas>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    new Chart(document.getElementById('chart'), { });
  </script>
`);
handle.runScripts();

// 接收组件回传的数据
handle.on("message", (data) => {
  console.log("组件说：", data);
});

// 清理
handle.close();
await shutdown();
```

### 在浏览器中打开

```typescript
const handle = await showWidget("<h1>Hello</h1>", { mode: "browser" });
```

### 看板 CLI

```bash
/kanban              # 打开看板
/kanban add "title"  # 添加任务
```

### 任务派发

```
/dispatch Add user authentication with JWT tokens
```

将需求拆分为 3-8 个带优先级和标签的任务，然后打开看板。

---

## 🛠 工作原理

### 组件流式架构

```
showWidget(html)
  → WidgetServer 注册组件 ID
  → Electron 加载 http://127.0.0.1:{port}/widget/{id}
  → Shell HTML 连接 WebSocket 到 ws://127.0.0.1:{port}/ws/{id}
  → setContent(html) 通过 WebSocket 发送 JSON
  → morphdom 对 <div id="widget-root"> 进行差分更新
  → 新节点获得 fadeIn 动画（0.3s）
  → runScripts() 重新执行 <script> 标签
```

内容变更在 150ms 内防抖 —— 快速连续调用会合并为最新内容。

### 组件通信

```
Node.js                          浏览器/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom 修补 DOM
  │──── runScripts() ───────────────▶│  重新执行 <script>
  │                                    │
  │◀──── window.widget.send(data) ───│  用户交互
  │                                    │
  │──── close() ────────────────────▶│  关闭窗口
```

在组件中使用 `window.widget.send(data)` 回传 JSON 数据：

```html
<button onclick="window.widget.send({ picked: 'red' })">红色</button>
```

---

## API 参考

### `showWidget(html, options?)`
打开一个组件并显示 HTML。返回 `WindowHandle`。

### `WindowManager`
- `new WindowManager({ mode? })` — `"electron"`（默认） 或 `"browser"`
- `.open(options?)` → `Promise<WindowHandle>`
- `.closeAll()` — 关闭全部，关闭服务器

### `WindowHandle`（继承 EventEmitter）
- `.setContent(html)` — morphdom 更新（150ms 防抖）
- `.flush()` — 立即发送待处理内容
- `.runScripts()` — 重新执行 `<script>` 标签
- `.close()` — 关闭窗口
- `.waitForReady()` → `Promise<void>`
- `.waitForResult()` → `Promise<any>`
- 事件：`ready`, `message`, `closed`

### `getGuidelines(modules?)`
加载设计指南。模块：`art`, `mockup`, `interactive`, `chart`, `diagram`。

---

## 📐 看板任务监控

内置的可视化看板，可在多个 Claude Code 会话间跟踪任务。

### 核心功能
- **跨会话监控** — 所有 Claude Code 窗口的任务出现在同一个看板上
- **自动刷新** — 文件监控实时检测其他会话的变更
- **会话追踪** — 每个会话获得唯一颜色标识
- **4 列工作流** — TODO → DOING → DONE → MILESTONES
- **浏览器刷新** — 组件内容在页面刷新后依然保留

### DONE 列 — 每日报告
任务按完成日期自动组织：
- **今天的任务** — 可编辑的摘要输入框，始终展开
- **历史报告** — 按日期折叠，点击展开
- **自动归档** — 次日打开时昨天的任务自动折叠
- **摘要提示** — 弹出模态框，提示写一行摘要

### MILESTONES 列 — 版本追踪
将已完成的任务分组到里程碑
- **三种状态** — 规划中 → 进行中 → 已发布
- **进度条** — 可视化距目标完成数的进度
- **标签系统** — 点击 "+ Add Tasks" 关联已完成任务
- **版本排序** — 里程碑按最新到最旧排序（v1.5 → v1.1）

### 与 Claude Code 任务自动同步

通过 PostToolUse 钩子，将 Claude Code 内置的 TaskCreate/TaskUpdate 同步到看板：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "TaskCreate|TaskUpdate",
        "hooks": [
          {
            "type": "command",
            "command": "npx generative-ui-sync"
          }
        ]
      }
    ]
  }
}
```

---

##  项目结构

```
generative-ui-win/
├── src/
│   ├── index.ts             # 库导出 + CLI 入口
│   ├── mcp-server.ts        # MCP 服务器（stdio 传输）
│   ├── server.ts            # Express + WebSocket 服务器（单例）
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # 持久化看板 HTTP 服务器
│   ├── kanban-store.ts      # 看板数据持久化
│   ├── kanban-renderer.ts   # 看板 HTML 渲染器
│   ├── kanban-task-sync.ts  # PostToolUse 同步钩子
│   ├── kanban-cli.ts        # 独立看板 CLI
│   ├── electron-launcher.ts # Electron 启动器
│   ├── electron-main.js     # Electron 主进程
│   ├── shell.ts             # Shell HTML（morphdom + WS 客户端）
│   ├── guidelines.ts        # 设计指南（5 个模块）
│   ├── svg-styles.ts        # SVG CSS 类（颜色、文本、动画）
│   └── utils.ts             # escapeJS、findAvailablePort、generateId
├── examples/
│   └── demo.ts              # 三个演示组件
├── i18n/                     # 多语言文档
│   ├── en/README.md         # English
│   ├── zh/README.md         # 中文
│   ├── fr/README.md         # Français
│   ├── ja/README.md         # 日本語
│   ├── nz/README.md         # English (NZ)
│   ├── it/README.md         # Italiano
│   └── es/README.md         # Español
├── SKILL.md                 # /kanban 斜杠命令规范
├── DISPATCH.md              # /dispatch 斜杠命令规范
├── package.json
└── tsconfig.json
```

三个 CLI 二进制：
- `generative-ui-win` — MCP 服务器
- `generative-ui-kanban` — 独立看板 CLI
- `generative-ui-sync` — 任务同步工具

---

## 相比原版

原版 pi-generative-ui 仅仅了一个 macOS 专用工具用 WKWebView 渲染 HTML、注入 JavaScript。这个版本已经成为一全功能的开发平台：

| 维度 | 原版 (macOS) | 本版本 |
|------|-------------|-------|
| **平台** | 仅 macOS | Windows / macOS / Linux |
| **运行时** | Swift 原生应用 | 纯 Node.js + Electron（可选） |
| **渲染** | WKWebView (~50ms) | Electron BrowserWindow + morphdom (~1ms) |
| **通信** | `window.send(js)` 注入 | WebSocket JSON 消息 |
| **组件回调** | `window.glimpse.send()` | `window.widget.send(data)` |
| **浏览器回退** | 无 | `mode: "browser"` 打开默认浏览器 |
| **MCP 服务器** | 无 | 完整 MCP 服务器，stdio 传输 |
| **看板** | 无 | 可视化看板，跨会话监控 |
| **任务派发** | 无 | LLM 驱动的任务拆解 + 派发 |
| **每日报告** | 无 | 按日期自动组织已完成任务 |
| **里程碑追踪** | 无 | 版本分组 + 进度条 |
| **任务同步** | 无 | 通过钩子同步 Claude Code 任务 |
| **CLI 二进制** | 1 个（原生工具） | 3 个（MCP 服务器、看板 CLI、同步） |
| **设计指南** | 无 | 5 个按需模块为 LLM 提供上下文 |

---

##  致谢

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — 原版 macOS 实现
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM 差分引擎
- [Electron](https://www.electronjs.org/) — 跨平台窗口

##  License

MIT
