# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**Lingua** · [English](../en/README.md) · [中文](../zh/README.md) · [Français](../fr/README.md) · [日本語](../ja/README.md) · [English (NZ)](../nz/README.md) · [Italiano](#) · [Español](../es/README.md)

---

## Cos'è generative-ui-win?

**UI generativa cross-platform — dai widget live alle board Kanban di team**

Chiedi a un LLM di visualizzare qualcosa e ottieni un **widget interattivo live** — slider, grafici, animazioni, dashboard — renderizzato in una finestra Electron o in una scheda del browser. Non un'istantanea. Non un blocco di codice. **Un'applicazione HTML reale in streaming live mentre il LLM la genera.**

Nato come port per Windows di [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui), questo progetto è diventato una piattaforma di sviluppo completa con server MCP, board Kanban persistente, sistema di dispatch dei task e collaborazione multi-sessione.

---

## Funzionalità principali

### Rendering widget live
- **HTML in streaming** — morphDOM DOM diffing, aggiornamenti fluidi e senza sfarfallio
- **Complete capacità del browser** — Canvas, WebGL, Chart.js, D3, Three.js via CDN
- **Comunicazione bidirezionale** — i widget inviano dati a Node.js tramite WebSocket (~1ms)
- **Doppia modalità** — finestra Electron o scheda del browser
- **Linee guida di design** — 5 moduli on-demand (art, mockup, interactive, chart, diagram)

###  Board Kanban visuale
- **Monitoraggio multi-sessione** — task da tutte le finestre di Claude Code su una sola board
- **Flusso a 4 colonne** — TODO → DOING → DONE → MILESTONES
- **Report giornalieri** — organizzazione per data di completamento con cronologia espandibile
- **Tracciamento milestone** — raggruppamento per versione con barre di progresso
- **Dispatch dei task** — scomposizione dei requisiti in task con priorità
- **Sync automatico** — hook sul ciclo TaskCreate/TaskUpdate di Claude Code
- **Stato persistente** — sopravvive a riavvii del server e refresh del browser

###  Server MCP
- **Server MCP plug-and-play** — installazione globale, connessione via stdio
- **Suite di tool ricca** — widget + tool CLI Kanban completi
- **3 binari CLI** — `generative-ui-win` (MCP), `generative-ui-kanban` (Kanban), `generative-ui-sync` (sync)

---

## Installazione

### Come server MCP (raccomandato)

```bash
npm install -g generative-ui-win
```

Aggiungi alle impostazioni di Claude Code (`~/.claude/settings.json`):

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

### Dai sorgenti

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Richiede Node.js 18+. Electron è opzionale — la modalità browser funziona senza.

---

##  Avvio rapido

```typescript
import { showWidget, shutdown } from "generative-ui-win";

const handle = await showWidget("<h1>Ciao Mondo</h1>");
handle.setContent("<h1>Aggiornato!</h1>");
handle.runScripts();
handle.on("message", (data) => console.log("Widget:", data));
```

---

## Come funziona

### Architettura di streaming dei widget

```
showWidget(html)
  → WidgetServer registra l'ID del widget
  → Electron carica http://127.0.0.1:{port}/widget/{id}
  → Shell HTML connette WebSocket a ws://127.0.0.1:{port}/ws/{id}
  → setContent(html) invia JSON via WebSocket
  → morphdom differenzia <div id="widget-root"> con il nuovo HTML
  → runScripts() ri-esegue i tag <script>
```

### Comunicazione dei widget

```
Node.js                          Browser/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom patcha il DOM
  │──── runScripts() ───────────────▶│  ri-esegue <script>
  │                                    │
  │◀──── window.widget.send(data) ───│  interazione utente
  │                                    │
  │──── close() ────────────────────▶│  chiusura della finestra
```

---

## Riferimento API

| Export | Descrizione |
|--------|-------------|
| `showWidget(html, options?)` | Apre un widget, ritorna `WindowHandle` |
| `WindowManager` | Controllo completo: `.open()`, `.closeAll()`, cambio modalità |
| `WindowHandle` | Per widget: `.setContent()`, `.flush()`, `.runScripts()`, `.close()` |
| `getGuidelines(modules?)` | Carica linee guida: `art`, `mockup`, `interactive`, `chart`, `diagram` |

---

## Struttura del progetto

```
generative-ui-win/
├── src/
│   ├── index.ts             # Export libreria + entry CLI
│   ├── mcp-server.ts        # Server MCP (transport stdio)
│   ├── server.ts            # Server Express + WebSocket (singleton)
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # Server HTTP Kanban persistente
│   ├── kanban-store.ts      # Persistenza dati Kanban
│   ├── kanban-renderer.ts   # Generatore HTML board Kanban
│   ├── kanban-task-sync.ts  # Hook di sync PostToolUse
│   ├── kanban-cli.ts        # CLI Kanban autonomo
│   ├── electron-launcher.ts # Launcher Electron
│   ├── electron-main.js     # Processo principale Electron
│   ├── shell.ts             # Shell HTML (morphdom + client WS)
│   ├── guidelines.ts        # Linee guida di design (5 moduli)
│   ├── svg-styles.ts        # Classi SVG CSS
│   └── utils.ts             # Utility (escapeJS, findAvailablePort, ecc.)
├── examples/demo.ts
├── i18n/                     # Documentazione multilingua
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

---

## Confronto con l'originale

| Aspetto | Originale | Questa versione |
|---------|-----------|----------------|
| **Piattaforma** | Solo macOS | Windows / macOS / Linux |
| **Runtime** | App Swift nativa | Node.js puro + Electron (opzionale) |
| **Rendering** | WKWebView (~50ms) | Electron + morphdom (~1ms) |
| **Comunicazione** | Iniezione `window.send(js)` | Messaggi JSON WebSocket |
| **Callback Widget** | `window.glimpse.send()` | `window.widget.send(data)` |
| **Fallback browser** | No | `mode: "browser"` |
| **Server MCP** | No | Server MCP completo |
| **Board Kanban** | No | Kanban visuale multi-sessione |
| **Dispatch Task** | No | Scomposizione LLM + dispatch |
| **Report giornalieri** | No | Organizzazione auto per data |
| **Tracciamento milestone** | No | Raggruppamento per versione |
| **Sync task** | No | Auto-sync tramite hook |
| **Binari CLI** | 1 | 3 (MCP, Kanban, sync) |
| **Linee guida di design** | No | 5 moduli on-demand |

---

## Crediti

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — implementazione macOS originale
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — motore di differenziazione DOM
- [Electron](https://www.electronjs.org/) — finestre cross-platform

## Licenza

MIT
