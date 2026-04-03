# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**Idioma** · [English](../en/README.md) · [中文](../zh/README.md) · [Français](../fr/README.md) · [日本語](../ja/README.md) · [English (NZ)](../nz/README.md) · [Italiano](../it/README.md) · [Español](#)

---

## ✨ ¿Qué es generative-ui-win?

**UI generativa multi-plataforma — de widgets en vivo a tableros Kanban de equipo**

Pídele a un LLM que visualice algo y obtén un **widget interactivo en vivo** — deslizadores, gráficos, animaciones, dashboards — renderizado en una ventana Electron o pestaña del navegador. No una captura. No un bloque de código. **Una aplicación HTML real en streaming live mientras el LLM la genera.**

Comenzó como un port para Windows de [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui), pero se ha convertido en una plataforma de desarrollo completa con servidor MCP, tablero Kanban persistente, sistema de dispatch de tareas y colaboración multi-sesión.

---

## 🎯 Características principales

### 🎨 Renderizado de widgets en vivo
- **HTML en streaming** — morphDOM DOM diffing, actualizaciones fluidas sin parpadeo
- **Capacidades completas del navegador** — Canvas, WebGL, Chart.js, D3, Three.js vía CDN
- **Comunicación bidireccional** — los widgets envían datos a Node.js vía WebSocket (~1ms)
- **Modo dual** — ventana Electron o pestaña del navegador
- **Guías de diseño** — 5 módulos bajo demanda (art, mockup, interactive, chart, diagram)

### 📋 Tablero Kanban visual
- **Monitoreo multi-sesión** — tareas de todas las ventanas de Claude Code en un solo tablero
- **Flujo de 4 columnas** — TODO → DOING → DONE → MILESTONES
- **Reportes diarios** — organización por fecha de completado con historial expandible
- **Seguimiento de hitos** — agrupamiento por versión con barras de progreso
- **Dispatch de tareas** — descomposición de requisitos en tareas con prioridades
- **Sincronización auto** — hooks en el ciclo TaskCreate/TaskUpdate de Claude Code
- **Estado persistente** — sobrevive a reinicios del servidor y refresco del navegador

### 🔌 Servidor MCP
- **Servidor MCP plug-and-play** — instalación global, conexión vía stdio
- **Suite de herramientas rica** — widgets + herramientas CLI Kanban completas
- **3 binarios CLI** — `generative-ui-win` (MCP), `generative-ui-kanban` (Kanban), `generative-ui-sync` (sync)

---

## 🚀 Instalación

### Como servidor MCP (recomendado)

```bash
npm install -g generative-ui-win
```

Agrega a tu configuración de Claude Code (`~/.claude/settings.json`):

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

### Desde código fuente

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Requiere Node.js 18+. Electron es opcional — el modo navegador funciona sin él.

---

## 🏁 Inicio rápido

```typescript
import { showWidget, shutdown } from "generative-ui-win";

const handle = await showWidget("<h1>Hola Mundo</h1>");
handle.setContent("<h1>¡Actualizado!</h1>");
handle.runScripts();
handle.on("message", (data) => console.log("Widget dice:", data));
```

---

## 🛠 Cómo funciona

### Arquitectura de streaming de widgets

```
showWidget(html)
  → WidgetServer registra el ID del widget
  → Electron carga http://127.0.0.1:{port}/widget/{id}
  → Shell HTML conecta WebSocket a ws://127.0.0.1:{port}/ws/{id}
  → setContent(html) envía JSON vía WebSocket
  → morphDOM diferencia <div id="widget-root"> con el nuevo HTML
  → runScripts() re-ejecuta las etiquetas <script>
```

### Comunicación de widgets

```
Node.js                          Browser/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphDOM parchea el DOM
  │──── runScripts() ───────────────▶│  re-ejecuta <script>
  │                                    │
  │◀──── window.widget.send(data) ───│  interacción del usuario
  │                                    │
  │──── close() ────────────────────▶│  cierre de la ventana
```

Dentro del widget: `<button onclick="window.widget.send({ picked: 'red' })">Rojo</button>`

---

## 📚 Referencia de la API

| Export | Descripción |
|--------|-------------|
| `showWidget(html, options?)` | Abre un widget, devuelve `WindowHandle` |
| `WindowManager` | Control total: `.open()`, `.closeAll()`, cambio de modo |
| `WindowHandle` | Por widget: `.setContent()`, `.flush()`, `.runScripts()`, `.close()` |
| `getGuidelines(modules?)` | Carga guías: `art`, `mockup`, `interactive`, `chart`, `diagram` |

---

## 🗂 Estructura del proyecto

```
generative-ui-win/
├── src/
│   ├── index.ts             # Exportaciones de la biblioteca + entrada CLI
│   ├── mcp-server.ts        # Servidor MCP (transporte stdio)
│   ├── server.ts            # Servidor Express + WebSocket (singleton)
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # Servidor HTTP Kanban persistente
│   ├── kanban-store.ts      # Persistencia de datos Kanban
│   ├── kanban-renderer.ts   # Generador HTML del tablero Kanban
│   ├── kanban-task-sync.ts  # Hook de sincronización PostToolUse
│   ├── kanban-cli.ts        # CLI Kanban autónomo
│   ├── electron-launcher.ts # Lanzador de Electron
│   ├── electron-main.js     # Proceso principal de Electron
│   ├── shell.ts             # Shell HTML (morphDOM + cliente WS)
│   ├── guidelines.ts        # Guías de diseño (5 módulos)
│   ├── svg-styles.ts        # Clases SVG CSS
│   └── utils.ts             # Utilidades (escapeJS, findAvailablePort, etc.)
├── examples/demo.ts
├── i18n/                     # Documentación multiidioma
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

Tres binarios CLI se incluyen en el paquete:
- `generative-ui-win` — servidor MCP
- `generative-ui-kanban` — CLI Kanban autónomo
- `generative-ui-sync` — Utilidad de sincronización

---

## 📊 Comparación con el original

| Aspecto | Original (macOS) | Esta versión |
|---------|-----------------|-------------|
| **Plataforma** | Solo macOS | Windows / macOS / Linux |
| **Runtime** | App Swift nativa | Node.js puro + Electron (opcional) |
| **Renderizado** | WKWebView (~50ms) | Electron + morphDOM (~1ms) |
| **Comunicación** | Inyección `window.send(js)` | Mensajes JSON WebSocket |
| **Callback Widget** | `window.glimpse.send()` | `window.widget.send(data)` |
| **Fallback navegador** | No | `mode: "browser"` |
| **Servidor MCP** | No | Servidor MCP completo |
| **Tablero Kanban** | No | Kanban visual multi-sesión |
| **Dispatch de tareas** | No | Descomposición LLM + dispatch |
| **Reportes diarios** | No | Organización auto por fecha |
| **Seguimiento de hitos** | No | Agrupamiento por versión |
| **Sincronización de tareas** | No | Auto-sync vía hooks |
| **Binarios CLI** | 1 | 3 (MCP, Kanban, sync) |
| **Guías de diseño** | No | 5 módulos bajo demanda |

---

## 🙏 Créditos

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — implementación macOS original
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — motor de diferenciación DOM
- [Electron](https://www.electronjs.org/) — ventaneo multi-plataforma

## 📜 Licencia

MIT
