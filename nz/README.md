# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**Language** · [English](../en/README.md) · [中文](../zh/README.md) · [Français](../fr/README.md) · [日本語](../ja/README.md) · [English (NZ)](#) · [Italiano](../it/README.md) · [Español](../es/README.md)

---

## What's generative-ui-win, eh?

**Cross-platform generative UI — from live widgets to team Kanban boards, sweet as**

Ask an LLM to visualise something and get a **live interactive widget** — sliders, charts, animations, dashboards — rendered in an Electron window or browser tab. Not a screenshot. Not a code block. **A bloody ripper HTML application streaming live as the LLM generates it.**

Started as a Windows port of [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui), this project's grown into a proper development toolkit that goes way beyond the original — with MCP server integration, persistent Kanban boards, task dispatch, and cross-session collaboration. Choice.

---

##  Core Features

###  Live Widget Rendering
- **Streaming HTML** — morphdom DOM diffing delivers smooth, flicker-free updates
- **Full browser capabilities** — Canvas, WebGL, Chart.js, D3, Three.js via CDN
- **Bidirectional communication** — widgets send data back to Node.js via WebSocket (~1ms latency)
- **Dual mode** — Electron window or browser tab
- **Design guidelines** — 5 on-demand modules (art, mockup, interactive, chart, diagram)

###  Visual Kanban Board
- **Cross-session monitoring** — tasks from all Claude Code windows on one board
- **4-column workflow** — TODO → DOING → DONE → MILESTONES
- **Daily reports** — auto-organise by completion date with expandable history
- **Milestone tracking** — version grouping with progress bars
- **Task dispatch** — break requirements into scoped tasks with priorities
- **Auto-sync** — hooks into Claude Code's TaskCreate/TaskUpdate lifecycle
- **Persistent state** — survives server restarts and browser refresh

###  MCP Server
- **Drop-in MCP server** — install globally, connect via stdio
- **Rich tool suite** — widget tools + full Kanban CLI toolset
- **3 CLI binaries** — `generative-ui-win` (MCP), `generative-ui-kanban` (Kanban), `generative-ui-sync` (sync util)

---

##  Installation

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

### From source

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Requires Node.js 18+. Electron's optional — browser mode works without it, no worries.

---

##  Quick Start

```typescript
import { showWidget, shutdown } from "generative-ui-win";

const handle = await showWidget("<h1>Kia ora, world!</h1>");
handle.setContent("<h1>Updated!</h1>");
handle.runScripts();
handle.on("message", (data) => console.log("Widget says:", data));
```

---

##  How It Works

### Widget Streaming Architecture

```
showWidget(html)
  → WidgetServer registers widget ID
  → Electron loads http://127.0.0.1:{port}/widget/{id}
  → Shell HTML connects WebSocket to ws://127.0.0.1:{port}/ws/{id}
  → setContent(html) sends JSON via WebSocket
  → morphdom diffs <div id="widget-root"> with new HTML
  → runScripts() re-executes <script> tags
```

### Widget Communication

```
Node.js                          Browser/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom patches DOM
  │──── runScripts() ───────────────▶│  re-executes <script>
  │                                    │
  │◀──── window.widget.send(data) ───│  user interaction
  │                                    │
  │──── close() ────────────────────▶│  window closes
```

Inside the widget: `<button onclick="window.widget.send({ picked: 'red' })">Red</button>`

---

##  API Reference

| Export | Description |
|--------|-------------|
| `showWidget(html, options?)` | Opens a widget, returns `WindowHandle` |
| `WindowManager` | Full control: `.open()`, `.closeAll()`, mode switching |
| `WindowHandle` | Per-widget: `.setContent()`, `.flush()`, `.runScripts()`, `.close()` |
| `getGuidelines(modules?)` | Load design guidelines: `art`, `mockup`, `interactive`, `chart`, `diagram` |

---

##  Project Structure

```
generative-ui-win/
├── src/
│   ├── index.ts             # Library exports + CLI entry
│   ├── mcp-server.ts        # MCP server (stdio transport)
│   ├── server.ts            # Express + WebSocket server (singleton)
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # Persistent Kanban HTTP server
│   ├── kanban-store.ts      # Kanban data persistence
│   ├── kanban-renderer.ts   # Kanban board HTML generator
│   ├── kanban-task-sync.ts  # PostToolUse sync hook
│   ├── kanban-cli.ts        # Standalone Kanban CLI
│   ├── electron-launcher.ts # Electron spawner
│   ├── electron-main.js     # Electron main process
│   ├── shell.ts             # Shell HTML (morphdom + WS client)
│   ├── guidelines.ts        # Design guidelines (5 modules)
│   ├── svg-styles.ts        # SVG CSS classes
│   └── utils.ts             # Utilities (escapeJS, findAvailablePort, etc.)
├── examples/demo.ts
├── i18n/                     # Multi-language docs
│   ├── en/README.md         # English
│   ├── zh/README.md         # 中文
│   ├── fr/README.md         # Français
│   ├── ja/README.md         # 日本語
│   ├── nz/README.md         # English (NZ)
│   ├── it/README.md         # Italiano
│   └── es/README.md         # Español
├── SKILL.md
├── DISPATCH.md
├── package.json
└── tsconfig.json
```

Three CLI binaries ship with the package:
- `generative-ui-win` — MCP server
- `generative-ui-kanban` — Standalone Kanban CLI
- `generative-ui-sync` — Task sync utility

---

##  How It Stacks Up Against the Original

| Area | Original (macOS) | This Version |
|------|-----------------|-------------|
| **Platform** | macOS only | Windows / macOS / Linux |
| **Runtime** | Swift native app | Pure Node.js + Electron (optional) |
| **Rendering** | WKWebView (~50ms) | Electron + morphdom (~1ms) |
| **Communication** | `window.send(js)` injection | WebSocket JSON messages |
| **Widget Callback** | `window.glimpse.send()` | `window.widget.send(data)` |
| **Browser fallback** | None | `mode: "browser"` |
| **MCP Server** | No | Full MCP server |
| **Kanban Board** | No | Visual Kanban with cross-session monitoring |
| **Task Dispatch** | No | LLM-driven task breakdown + dispatch |
| **Daily Reports** | No | Auto-organise completed tasks by date |
| **Milestone Tracking** | No | Version grouping with progress bars |
| **Task Sync** | No | Auto-sync via hooks |
| **CLI Binaries** | 1 (native tool) | 3 (MCP, Kanban, sync) |
| **Design Guidelines** | No | 5 on-demand modules for LLM context |

---

##  Credits

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — original macOS implementation
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM diffing engine
- [Electron](https://www.electronjs.org/) — cross-platform windowing

##  License

MIT
