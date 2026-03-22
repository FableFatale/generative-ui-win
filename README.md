# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

Cross-platform generative UI — a Windows-compatible port of [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui).

Ask an LLM to visualize something and get a live interactive widget — sliders, charts, animations — rendered in an Electron window or browser tab. Not a screenshot. Not a code block. A real HTML application with JavaScript, streaming live as the LLM generates it.

## How it works

1. LLM calls your tool with HTML as a parameter
2. Your code calls `showWidget(html)` to open an Electron window
3. morphdom diffs the DOM as HTML streams in — smooth, flicker-free updates
4. Scripts execute on completion; bidirectional communication via `window.widget.send(data)`

The widget window has full browser capabilities (Canvas, WebGL, CDN libraries like Chart.js, D3, Three.js) with ~1ms latency over WebSocket.

## Install

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

Restart Claude Code, and the `show_widget` / `update_widget` / `run_scripts` / `close_widget` / `get_guidelines` tools become available. Kanban tools (`kanban_show`, `kanban_add_task`, `kanban_move_task`, `kanban_add_version`, `kanban_heartbeat`, `kanban_get_status`) are also included.

## Kanban Task Monitor

Built-in visual Kanban board for tracking tasks across multiple Claude Code sessions.

```
/kanban              # Open the board
/kanban add "title"  # Add a task
```

Features:
- **Cross-session monitoring** — tasks from all Claude Code windows appear on one board
- **Auto-refresh** — file watching detects changes from other sessions instantly
- **Session tracking** — each session gets a unique color-coded label
- **4-column workflow** — TODO → DOING → DONE → VERSIONS

### From source

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Requires Node.js 18+. Electron is an optional dependency for window mode — browser mode works without it.

## Quick start

### Library API

```typescript
import { showWidget, shutdown } from "generative-ui-win";

// Open a widget in an Electron window (default)
const handle = await showWidget("<h1>Hello World</h1>");

// Stream content — morphdom patches the DOM efficiently
handle.setContent("<h1>Hello World</h1><p>Loading...</p>");
handle.setContent("<h1>Hello World</h1><p>Done!</p>");

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

### CLI

```bash
# Electron window (default)
node dist/src/index.js show "Dashboard" --html "<h1>Hello</h1>"

# Browser tab
node dist/src/index.js show "Dashboard" --html "<h1>Hello</h1>" --browser
```

### Run the demo

```bash
npm run demo
```

Three demos run in sequence:
1. **Streaming HTML** — progressive card grid with morphdom diffing
2. **Chart.js** — CDN-loaded bar chart in dark theme
3. **Bidirectional** — color picker buttons that send data back to Node.js

## Usage with LLM tools

The typical integration pattern:

```typescript
import { WindowManager, getGuidelines } from "generative-ui-win";

const manager = new WindowManager(); // defaults to Electron mode

// 1. Load design guidelines into LLM system prompt
const guidelines = getGuidelines(["chart", "interactive"]);
// Pass `guidelines` as context to the LLM

// 2. When the LLM generates HTML, stream it to a widget
const handle = await manager.open({ title: "Visualization" });
await handle.waitForReady();

for await (const chunk of llmStream) {
  accumulatedHtml += chunk;
  handle.setContent(accumulatedHtml); // morphdom diffs automatically
}

// 3. Execute scripts after streaming completes
handle.runScripts();

// 4. Wait for user interaction
const result = await handle.waitForResult();
console.log("User selected:", result);
```

### Design guidelines

Five guideline modules load on demand:

| Module | Content |
|--------|---------|
| `art` | SVG generative art, patterns, color layering |
| `mockup` | UI mockups, component library, dark theme |
| `interactive` | Event handling, `window.widget.send()`, CDN libs |
| `chart` | Chart.js setup, SVG charts, data formatting |
| `diagram` | Flowcharts, node/edge styles, layout algorithms |

```typescript
import { getGuidelines } from "generative-ui-win";

// Load specific modules
const guidelines = getGuidelines(["chart", "diagram"]);

// Load all modules
const allGuidelines = getGuidelines();
```

## Widget communication

```
Node.js                          Browser/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom patches DOM
  │──── runScripts() ────────────────▶│  re-executes <script> tags
  │                                    │
  │◀──── window.widget.send(data) ────│  user interaction
  │                                    │
  │──── close() ─────────────────────▶│  window closes
```

Inside the widget, use `window.widget.send(data)` to send JSON data back:

```html
<button onclick="window.widget.send({ picked: 'red' })">Red</button>
```

## Architecture

```
generative-ui-win/
├── src/
│   ├── index.ts             # Library exports + CLI
│   ├── server.ts            # Express + WebSocket server (singleton, 127.0.0.1)
│   ├── window-manager.ts    # WindowManager + WindowHandle (EventEmitter)
│   ├── mcp-server.ts        # MCP server (stdio transport, all tools)
│   ├── kanban-store.ts      # Kanban data persistence + session management
│   ├── kanban-renderer.ts   # Kanban board HTML renderer
│   ├── kanban-cli.ts        # Standalone Kanban CLI
│   ├── electron-launcher.ts # Spawns Electron with widget URL
│   ├── electron-main.js     # Electron main process (BrowserWindow)
│   ├── shell.ts             # Shell HTML (morphdom + WebSocket client)
│   ├── guidelines.ts        # Design guidelines (5 modules)
│   ├── svg-styles.ts        # SVG CSS classes (colors, text, animation)
│   └── utils.ts             # escapeJS, findAvailablePort, generateId
├── examples/
│   └── demo.ts              # Three demo widgets
├── SKILL.md                 # /kanban slash command definition
├── package.json
└── tsconfig.json
```

### Streaming architecture

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

## Differences from the original

| Aspect | Original (macOS) | This version |
|--------|-----------------|--------------|
| Window | Glimpse (WKWebView, ~50ms) | Electron BrowserWindow |
| Communication | `window.send(js)` injection | WebSocket JSON messages (~1ms) |
| Callback | `window.glimpse.send()` | `window.widget.send()` |
| Platform | macOS only | Windows / macOS / Linux |
| Dependencies | Swift toolchain | Pure Node.js + Electron |
| Window control | Native size/position/titlebar | Standard Electron window |
| Browser fallback | None | `mode: "browser"` opens default browser |

## API reference

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

## Credits

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — original macOS implementation
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM diffing
- [Electron](https://www.electronjs.org/) — cross-platform windows

## License

MIT
