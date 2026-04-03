# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

Cross-platform generative UI — from live widgets to team Kanban boards.

**Languages:** 🇺🇸 [English](en/README.md) · 🇨🇳 [中文](zh/README.md) · 🇫🇷 [Français](fr/README.md) · 🇯🇵 [日本語](ja/README.md) · 🇳🇿 [English (NZ)](nz/README.md) · 🇮🇹 [Italiano](it/README.md) · 🇪🇸 [Español](es/README.md)

---

## What is generative-ui-win?

Ask an LLM to visualize something and get a **live interactive widget** — sliders, charts, animations, dashboards — rendered in an Electron window or browser tab. Not a screenshot. Not a code block. **A real HTML application streaming live as the LLM generates it.**

Born as a Windows port of [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui), this project has evolved into a comprehensive development toolkit with MCP server integration, persistent Kanban boards, task dispatch, and cross-session collaboration.

##  Core Features

- **Live widget rendering** — morphdom DOM diffing, streaming HTML, full browser capabilities (Canvas, WebGL, Chart.js, D3, Three.js)
- **Bidirectional communication** — widgets send data back via WebSocket (~1ms latency)
- **Visual Kanban board** — cross-session monitoring, daily reports, milestone tracking, task dispatch
- **MCP server** — drop-in server with 3 CLI binaries: `generative-ui-win`, `generative-ui-kanban`, `generative-ui-sync`

## 🚀Install

```bash
npm install -g generative-ui-win
```

**Claude Code MCP setup** (`~/.claude/settings.json`):
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

Requires Node.js 18+. Electron is optional — browser mode works without it.

##  Documentation

Full documentation is available in multiple languages inside `i18n/`:

| Language | File |
|----------|------|
| 🇺🇸 English | [en/README.md](en/README.md) |
| 🇨🇳 中文 | [zh/README.md](zh/README.md) |
| 🇫🇷 Français | [fr/README.md](fr/README.md) |
| 🇯🇵 日本語 | [ja/README.md](ja/README.md) |
| 🇳🇿 English (NZ) | [nz/README.md](nz/README.md) |
| 🇮🇹 Italiano | [it/README.md](it/README.md) |
| 🇪🇸 Español | [es/README.md](es/README.md) |

Each language version includes: overview, core features, install instructions, quick start, architecture, API reference, Kanban board docs, comparison with the original, and project structure.

---

## 📜 License

MIT
