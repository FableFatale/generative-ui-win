# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**Language** · [English](#) · [中文](../zh/README.md) · [Français](../fr/README.md) · [日本語](../ja/README.md) · **Español** · [Español](../es/README.md)

---

## ✨ What is generative-ui-win?

**Cross-platform generative UI — from live widgets to team Kanban boards**

Ask an LLM to visualize something and get a **live interactive widget** — sliders, charts, animations, dashboards — rendered in an Electron window or browser tab. Not a screenshot. Not a code block. **A real HTML application streaming live as the LLM generates it.**

Born as a Windows port of [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui), this project has evolved into a comprehensive development toolkit that goes far beyond the original — with MCP server integration, persistent Kanban boards, task dispatch, and cross-session collaboration.

---

## 🎯 Core Features

### 🎨 Live Widget Rendering
- **Streaming HTML** — morphdom DOM diffing delivers smooth, flicker-free updates
- **Full browser capabilities** — Canvas, WebGL, Chart.js, D3, Three.js via CDN
- **Bidirectional communication** — widgets send data back to Node.js via WebSocket (~1ms latency)
- **Dual mode** — Electron window or browser tab
- **Design guidelines** — 5 on-demand modules (art, mockup, interactive, chart, diagram)

### 📋 Visual Kanban Board
- **Cross-session monitoring** — tasks from all Claude Code windows on one board
- **4-column workflow** — TODO → DOING → DONE → MILESTONES
- **Daily reports** — auto-organize by completion date with expandable history
- **Milestone tracking** — version grouping with progress bars
- **Task dispatch** — break requirements into scoped tasks with priorities
- **Auto-sync** — hooks into Claude Code's TaskCreate/TaskUpdate lifecycle
- **Persistent state** — survives server restarts and browser refresh

### 🔌 MCP Server
- **Drop-in MCP server** — install globally, connect via stdio
- **Rich tool suite** — widget tools + full Kanban CLI toolset
- **3 CLI binaries** — `generative-ui-win` (MCP), `generative-ui-kanban` (CLI), `generative-ui-sync` (sync util)

---

## 🚀 Install

### As an MCP server (recommended)

```bash
npm install -g generative-ui-win
```

Then add to your Claude Code settings (`~/.claude/settings.json`):

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

Restart Claude Code, and the `show_widget` / `update_widget` / `run_scripts` / `close_widget` / `get_guidelines` tools become available. Kanban tools (`kanban_show`, `kanban_add_task`, `kanban_batch_add`, `kanban_move_task`, `kanban_claim_task`, `kanban_add_version`, `kanban_heartbeat`, `kanban_get_status`) are also included.

### From source

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Requires Node.js 18+. Electron is an optional dependency for window mode — browser mode works without it.

---

## 🏁 Quick Start

### Library API

```typescript
import { showWidget, shutdown } from "generative-ui-win";

// Open a widget in an Electron window (default)
const handle = await showWidget("<h1>Hello World</h1>");

// Stream content — morphdom patches the DOM efficiently
handle.setContent("<h1>Hello World</h1><p>Loading...</>");
handle.setContent("<h1>Hello World</h1><p>Done!</>");

// Execute scripts after streaming completes
handle.setContent(`
  <canvas id="chart"></canvas>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    new Chart(document.getElementById('chart'), { /* ... */ });
  </script>
`);
handle.runScripts();

// Receive messages from the widget
handle.on("message", (data) => {
  console.log("Widget says:", data);
});

// Clean up
handle.close();
await shutdown();
```

### Open in browser instead

```typescript
const handle = await showWidget("<h1>Hello</h1>", { mode: "browser" });
```

### Kanban CLI

```bash
/kanban              # Open the board
/kanban add "title"  # Add a task
```

### Task Dispatch

```
/dispatch Add user authentication with JWT tokens
```

This creates 3-8 scoped tasks with priorities and tags, then opens the board.

---

## 🛠 How It Works

### Widget Streaming Architecture

```
showWidget(html)
  → WidgetServer registers widget ID
  → Electron loads http://127.0.0.1:{port}/widget/{id}
  → Shell HTML connects WebSocket to ws://127.0.0.1:{port}/ws/{id}
  → setContent(html) sends JSON via WebSocket
  → morphdom diffs <div id="widget-root"> with new HTML
  → New nodes get fadeIn animation (0.3s)
  → runScripts() re-executes <script> tags
```

Content updates are debounced at 150ms — rapid `setContent()` calls merge into the latest HTML.

### Widget Communication

```
Node.js                          Browser/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom patches DOM
  │──── runScripts() ───────────────▶│  re-executes <script> tags
  │                                    │
  │◀──── window.widget.send(data) ───│  user interaction
  │                                    │
  │──── close() ────────────────────▶│  window closes
```

Inside the widget, use `window.widget.send(data)` to send JSON data back:

```html
<button onclick="window.widget.send({ picked: 'red' })">Red</button>
```

---

## 📚 API Reference

### `showWidget(html, options?)`
Open a widget and display HTML. Returns `WindowHandle`.

### `WindowManager`
- `new WindowManager({ mode? })` — `"electron"` (default) or `"browser"`
- `.open(options?)` → `Promise<WindowHandle>`
- `.closeAll()` — close everything and shut down server

### `WindowHandle` (extends EventEmitter)
- `.setContent(html)` — morphdom update (150ms debounce)
- `.flush()` — send pending content immediately
- `.runScripts()` — re-execute `<script>` tags
- `.close()` — close the window
- `.waitForReady()` → `Promise<void>`
- `.waitForResult()` → `Promise<any>`
- Events: `ready`, `message`, `closed`

### `getGuidelines(modules?)`
Load design guidelines. Modules: `art`, `mockup`, `interactive`, `chart`, `diagram`.

---

## 📐 Kanban Task Monitor

Built-in visual Kanban board for tracking tasks across multiple Claude Code sessions.

### Core Features
- **Cross-session monitoring** — tasks from all Claude Code windows appear on one board
- **Auto-refresh** — file watching detects changes from other sessions instantly
- **Session tracking** — each session gets a unique color-coded label
- **4-column workflow** — TODO → DOING → DONE
- **Browser refresh safe** — widget content persists across page reloads

### DONE Column — Daily Reports
Tasks automatically organize by completion date:
- **Today's tasks** — editable summary input, always expanded
- **Historical reports** — collapsed by date, click to expand
- **Auto-archive** — yesterday's tasks auto-collapse on next-day open
- **Summary prompt** — modal appears to write a one-line summary

### MILESTONES Column — Version Tracking
Group completed tasks into milestones:
- **Three states** — Planning → In Progress → Released
- **Progress bars** — visual progress toward target task count
- **Tagging system** — click "+ Add Tasks" to associate completed tasks
- **Version ordering** — milestones sorted newest to oldest (v1.5 → v1.1)

### Auto-sync with Claude Code tasks

Sync Claude Code's built-in TaskCreate/TaskUpdate to the Kanban board via a PostToolUse hook:

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

## 🗂 Project Structure

```
generative-ui-win/
├── src/
│   ├── index.ts             # Library exports + CLI entry
│   ├── mcp-server.ts        # MCP server (stdio transport)
│   ├── server.ts            # Express + WebSocket server (singleton)
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # Persistent Kanban HTTP server
│   ├── kanban-store.ts      # Kanban data persistence
│   ├── kanban-enderer.ts    # Kanban board HTML renderer
│   ├── kanban-renderer.ts   # Kanban board HTML generator
│   ├── kanban-task-sync.ts  # PostToolUse sync hook
│   ├── kanban-cli.ts        # Standalone Kanban CLI
│   ├── electron-launcher.ts # Electron spawner
│   ├── electron-main.js     # Electron main process
│   ├── shell.ts             # Shell HTML (morphdom + WS client)
│   ├── guidelines.ts        # Design guidelines (5 modules)
│   ├── svg-styles.ts        # SVG CSS classes (colors, text, animation)
│   └── utils.ts             # escapeJS, findAvailablePort, generateId
├── examples/
│   └── demo.ts              # Three demo widgets
├── i18n/                    # Multi-language docs
│   ├── en/README.md         # English
│   ├── zh/README.md         # 中文
│   ├── fr/README.md         # Français
│   ├── ja/README.md         # 日本語
│   ├── nz/README.md         # English (NZ)
│   ├── it/README.md         # Italiano
│   └── es/README.md         # Español
├── SKILL.md                 # /kanban slash command spec
├── DISPATCH.md              # /dispatch slash command spec
├── package.json
└── tsconfig.json
```

Three CLI binaries ship with the package:
- `generative-ui-win` — MCP server
- `generative-ui-kanban` — Standalone Kanban CLI
- `generative-ui-sync` — Task sync utility

---

## 📊 How Far Beyond the Original?

The original pi-generative-ui was a macOS-only tool that renders HTML in a WKWebView with JavaScript injection. This version has grown into a full-featured development platform:

| Area | Original (macOS) | This Version |
|------|-----------------|-------------|
| **Platform** | macOS only | Windows / macOS / Linux
| **Runtime** | Swift native app | Pure Node.js + Electron (optional) |
| **Rendering** | WKWebView (~50ms) | Electron BrowserWindow + morphdom (~1ms) |
| **Communication** | `window.send(js)` injection | WebSocket JSON messages |
| **Widget Callback** | `window.glimpse.send()` | `window.widget.send(data)` |
| **Browser fallback** | None | `mode: "browser"` opens default browser |
| **MCP Server** | No | Full MCP server with stdio transport |
| **Kanban Board** | No | Visual Kanban with cross-session monitoring |
| **Task Dispatch** | No | LLM-driven task breakdown + dispatch |
| **Daily Reports** | No | Auto-organize completed tasks by date |
| **Milestone Tracking** | No | Version grouping with progress bars |
| **Task Sync** | No | Auto-sync with Claude Code tasks via hooks |
| **CLI Binaries** | 1 (native tool) | 3 (MCP server, Kanban CLI, sync utility) |
| **Design Guidelines** | No | 5 on-demand modules for LLM context |

---

## 🙏 Credits

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — original macOS implementation
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM diffing engine
- [Electron](https://www.electronjs.org/) — cross-platform windowing

## 📜 License

MIT
