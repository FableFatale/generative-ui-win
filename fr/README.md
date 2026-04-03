# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**Langue** · [English](../en/README.md) · [中文](../zh/README.md) · [Français](#) · [日本語](../ja/README.md) · [English (NZ)](../nz/README.md) · [Italiano](../it/README.md) · [Español](../es/README.md)

---

##  Qu'est-ce que generative-ui-win ?

**UI générative multi-plateformes — des widgets live aux tableaux Kanban d'équipe**

Demandez à un LLM de visualiser quelque chose et obtenez un **widget interactif en direct** — curseurs, graphiques, animations, tableaux de bord — rendu dans une fenêtre Electron ou un onglet de navigateur. Pas un screenshot. Pas un bloc de code. **Une véritable application HTML diffusée en direct pendant que le LLM la génère.**

Initialement un port Windows de [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui), ce projet est devenu une plateforme de développement complète avec serveur MCP, tableau Kanban persistant, système de distribution de tâches et collaboration multi-sessions.

---

## Fonctionnalités principales

###  Rendu de widgets en direct
- **HTML en streaming** — morphDOM DOM diffing, mises à jour fluides sans scintillement
- **Capacités navigateur complètes** — Canvas, WebGL, Chart.js, D3, Three.js via CDN
- **Communication bidirectionnelle** — les widgets envoient des données à Node.js via WebSocket (~1ms)
- **Double mode** — fenêtre Electron ou onglet de navigateur
- **Directives de design** — 5 modules à la demande (art, mockup, interactive, chart, diagram)

###  Tableau Kanban visuel
- **Surveillance multi-sessions** — tâches de toutes les fenêtres Claude Code sur un seul tableau
- **Flux 4 colonnes** — TODO → DOING → DONE → MILESTONES
- **Rapports quotidiens** — organisation par date de complétion avec historique extensible
- **Suivi des jalons** — regroupement par version avec barres de progression
- **Distribution de tâches** — décomposition des exigences en tâches avec priorités
- **Sync auto** — hooks sur le cycle TaskCreate/TaskUpdate de Claude Code
- **État persistant** — survit aux redémarrages serveur et rechargements navigateur

###  Serveur MCP
- **Serveur MCP intégrable** — installation globale, connexion via stdio
- **Suite d'outils riche** — widgets + outils CLI Kanban complets
- **3 binaires CLI** — `generative-ui-win` (MCP), `generative-ui-kanban` (Kanban), `generative-ui-sync` (sync)

---

##  Installation

### En tant que serveur MCP (recommandé)

```bash
npm install -g generative-ui-win
```

Ajoutez à vos paramètres Claude Code (`~/.claude/settings.json`) :

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

### Depuis les sources

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Nécessite Node.js 18+. Electron est optionnel — le mode navigateur fonctionne sans.

---

## 🏁 Démarrage rapide

```typescript
import { showWidget, shutdown } from "generative-ui-win";

const handle = await showWidget("<h1>Hello World</h1>");
handle.setContent("<h1>Updated!</h1>");
handle.runScripts();
handle.on("message", (data) => console.log("Widget:", data));
```

---

## 🛠 Comment ça fonctionne

### Architecture de streaming

```
showWidget(html)
  → WidgetServer enregistre l'ID du widget
  → Electron charge http://127.0.0.1:{port}/widget/{id}
  → Shell HTML connecte WebSocket à ws://127.0.0.1:{port}/ws/{id}
  → setContent(html) envoie JSON via WebSocket
  → morphdom différencie <div id="widget-root"> avec le nouveau HTML
  → runScripts() ré-exécute les balises <script>
```

### Communication des widgets

```
Node.js                          Browser/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom patch le DOM
  │──── runScripts() ───────────────▶│  ré-exécute <script>
  │                                    │
  │◀──── window.widget.send(data) ───│  interaction utilisateur
  │                                    │
  │──── close() ────────────────────▶│  fermeture de la fenêtre
```

---

## 📚 API de référence

| Export | Description |
|--------|-------------|
| `showWidget(html, options?)` | Ouvre un widget, retourne `WindowHandle` |
| `WindowManager` | Contrôle complet : `.open()`, `.closeAll()`, changement de mode |
| `WindowHandle` | Par widget : `.setContent()`, `.flush()`, `.runScripts()`, `.close()` |
| `getGuidelines(modules?)` | Charge les directives : `art`, `mockup`, `interactive`, `chart`, `diagram` |

---

## 🗂 Structure du projet

```
generative-ui-win/
├── src/
│   ├── index.ts             # Exportation de la bibliothèque + entrée CLI
│   ├── mcp-server.ts        # Serveur MCP (transport stdio)
│   ├── server.ts            # Serveur Express + WebSocket (singleton)
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # Serveur HTTP Kanban persistant
│   ├── kanban-store.ts      # Persistance des données Kanban
│   ├── kanban-renderer.ts   # Générateur HTML du tableau Kanban
│   ├── kanban-task-sync.ts  # Hook de sync PostToolUse
│   ├── kanban-cli.ts        # CLI Kanban autonome
│   ├── electron-launcher.ts # Lanceur Electron
│   ├── electron-main.js     # Processus principal Electron
│   ├── shell.ts             # Shell HTML (morphdom + client WS)
│   ├── guidelines.ts        # Directives de design (5 modules)
│   ├── svg-styles.ts        # Classes SVG CSS
│   └── utils.ts             # utilitaires (escapeJS, findAvailablePort, etc.)
├── examples/demo.ts
├── i18n/                     # Documentation multilingue
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

## 📊 Comparaison avec l'original

| Domaine | Original | Cette version |
|---------|----------|---------------|
| **Plateforme** | macOS uniquement | Windows / macOS / Linux |
| **Moteur** | Application Swift native | Node.js pur + Electron (optionnel) |
| **Rendu** | WKWebView (~50ms) | Electron + morphdom (~1ms) |
| **Communication** | Injection `window.send(js)` | Messages JSON WebSocket |
| **Rappel Widget** | `window.glimpse.send()` | `window.widget.send(data)` |
| **Fallback navigateur** | Non | `mode: "browser"` |
| **Serveur MCP** | Non | Serveur MCP complet |
| **Tableau Kanban** | Non | Kanban visuel multi-sessions |
| **Distribution de tâches** | Non | Décomposition LLM + dispatch |
| **Rapports quotidiens** | Non | Organisation auto par date |
| **Suivi des jalons** | Non | Regroupement par version |
| **Sync des tâches** | Non | Auto-sync via hooks |
| **Binaires CLI** | 1 | 3 (MCP, Kanban, sync) |
| **Directives de design** | Non | 5 modules à la demande |

---

## 🙏 Crédits

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — implémentation macOS originale
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — moteur de différentiation DOM
- [Electron](https://www.electronjs.org/) — fenêtrage multi-plateformes

## 📜 License

MIT
