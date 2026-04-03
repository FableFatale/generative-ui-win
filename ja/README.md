# generative-ui-win

[![npm version](https://img.shields.io/npm/v/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)
[![npm downloads](https://img.shields.io/npm/dm/generative-ui-win)](https://www.npmjs.com/package/generative-ui-win)

**言語** · [English](../en/README.md) · [中文](../zh/README.md) · [Français](../fr/README.md) · [日本語](#) · [English (NZ)](../nz/README.md) · [Italiano](../it/README.md) · [Español](../es/README.md)

---

## ✨ generative-ui-win とは？

**クロスプラットフォーム生成UI — リアルタイムウィジェットからチームカンバンボードまで**

LLM に何かを可視化させると、**リアルタイムのインタラクティブウィジェット**が Electron ウィンドウやブラウザタブに直接レンダリングされます。スクリーンショットでもコードブロックでもなく、**LLM が生成しているその瞬間にストリーミングされる本物の HTML アプリケーション**です。

元は [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) の Windows ポートでしたが、MCP サーバー統合、永続化カンバン、タスクディスパッチ、クロスセッションコラボレーションを備えた包括的な開発プラットフォームへと進化しました。

---

## 🎯 主な機能

### 🎨 リアルタイムウィジェットレンダリング
- **ストリーミング HTML** — morphdom DOM diffing によるスムーズでちらつきのない更新
- **フルブラウザ機能** — Canvas, WebGL, Chart.js, D3, Three.js（CDN経由）
- **双方向通信** — ウィジェットから Node.js へ WebSocket でデータ送信（~1ms 遅延）
- **デュアルモード** — Electron ウィンドウまたはブラウザタブ
- **デザインガイドライン** — 5つのオンデマンドモジュール（art, mockup, interactive, chart, diagram）

### 📋 ビジュアルカンバンボード
- **クロスセッション監視** — すべての Claude Code ウィンドウのタスクを1つのボードに集約
- **4列ワークフロー** — TODO → DOING → DONE → MILESTONES
- **日報** — 完了日ごとに自動整理、履歴展開可能
- **マイルストーン追跡** — バージョングループ化 + 進捗バー
- **タスクディスパッチ** — 要件を優先度・タグ付きのサブタスクに分解
- **自動同期** — Claude Code の TaskCreate/TaskUpdate をフックで同期
- **永続状態** — サーバー再起動・ブラウザリフレッシュ後も維持

### 🔌 MCP サーバー
- **ドロップインMCPサーバー** — グローバルインストール、stdio 接続
- **豊富なツールセット** — ウィジェットツール + カンバンCLIツール一式
- **3つのCLIバイナリ** — `generative-ui-win`（MCP）、`generative-ui-kanban`（Kanban）、`generative-ui-sync`（同期）

---

## 🚀 インストール

### MCP サーバーとして（推奨）

```bash
npm install -g generative-ui-win
```

Claude Code 設定に追加（`~/.claude/settings.json`）：

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

### ソースから

```bash
git clone https://github.com/FableFatale/generative-ui-win.git
cd generative-ui-win
npm install
npm run build
```

Node.js 18+ が必要です。Electron は任意 — ブラウザモードは Electron なしで動作します。

---

## 🏁 クイックスタート

```typescript
import { showWidget, shutdown } from "generative-ui-win";

const handle = await showWidget("<h1>Hello World</h1>");
handle.setContent("<h1>Updated!</h1>");
handle.runScripts();
handle.on("message", (data) => console.log("ウィジェット:", data));
```

---

## 🛠 仕組み

### ウィジェットストリーミングアーキテクチャ

```
showWidget(html)
  → WidgetServer がウィジェットIDを登録
  → Electron が http://127.0.0.1:{port}/widget/{id} を読み込む
  → Shell HTML が WebSocket を ws://127.0.0.1:{port}/ws/{id} に接続
  → setContent(html) が WebSocket 経由で JSON を送信
  → morphdom が <div id="widget-root"> を新HTMLと差分更新
  → runScripts() が <script> タグを再実行
```

### ウィジェット通信

```
Node.js                          ブラウザ/Electron
  │                                    │
  │──── setContent(html) ────────────▶│  morphdom が DOM をパッチ
  │──── runScripts() ───────────────▶│  <script> を再実行
  │                                    │
  │◀──── window.widget.send(data) ───│  ユーザー操作
  │                                    │
  │──── close() ────────────────────▶│  ウィンドウを閉じる
```

---

## 📚 API リファレンス

| エクスポート | 説明 |
|-------------|------|
| `showWidget(html, options?)` | ウィジェットを開く、`WindowHandle` を返す |
| `WindowManager` | 完全制御：`.open()`、`.closeAll()`、モード切替 |
| `WindowHandle` | ウィジェットごと：`.setContent()`、`.flush()`、`.runScripts()`、`.close()` |
| `getGuidelines(modules?)` | デザインガイドラインをロード：`art`、`mockup`、`interactive`、`chart`、`diagram` |

---

## 🗂 プロジェクト構造

```
generative-ui-win/
├── src/
│   ├── index.ts             # ライブラリ エクスポート + CLI エントリ
│   ├── mcp-server.ts        # MCP サーバー（stdio トランスポート）
│   ├── server.ts            # Express + WebSocket サーバー（シングルトン）
│   ├── window-manager.ts    # WindowManager + WindowHandle
│   ├── kanban-server.ts     # 永続化 カンバン HTTP サーバー
│   ├── kanban-store.ts      # カンバン データの永続化
│   ├── kanban-renderer.ts   # カンバンボード HTML ジェネレーター
│   ├── kanban-task-sync.ts  # PostToolUse 同期フック
│   ├── kanban-cli.ts        # 独立 カンバン CLI
│   ├── electron-launcher.ts # Electron 起動
│   ├── electron-main.js     # Electron メインプロセス
│   ├── shell.ts             # Shell HTML（morphdom + WS クライアント）
│   ├── guidelines.ts        # デザインガイドライン（5 モジュール）
│   ├── svg-styles.ts        # SVG CSS クラス
│   └── utils.ts             # ユーティリティ（escapeJS、findAvailablePort、その他）
├── examples/demo.ts
├── i18n/                     # 多言語 ドキュメント
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

## 📊 オリジナルとの違い

| 項目 | オリジナル | このバージョン |
|------|-----------|--------------|
| **プラットフォーム** | macOS のみ | Windows / macOS / Linux |
| **ランタイム** | Swift ネイティブアプリ | 純 Node.js + Electron（オプション） |
| **レンダリング** | WKWebView (~50ms) | Electron + morphdom (~1ms) |
| **通信方式** | `window.send(js)` 注入 | WebSocket JSON メッセージ |
| **ウィジェットコールバック** | `window.glimpse.send()` | `window.widget.send(data)` |
| **ブラウザフォールバック** | なし | `mode: "browser"` |
| **MCP サーバー** | なし | 完全な MCP サーバー |
| **カンバンボード** | なし | ビジュアルカンバン（クロスセッション監視） |
| **タスクディスパッチ** | なし | LLM 駆動のタスク分解 + 派 |
| **日次レポート** | なし | 完了タスクを日付ごとに自動整理 |
| **マイルストーン追跡** | なし | バージョングループ化 |
| **タスク同期** | なし | フックで自動同期 |
| **CLI バイナリ** | 1 つ | 3 つ（MCP、カンバン、同期） |
| **デザインガイドライン** | なし | 5つのオンデマンドモジュール |

---

## 🙏 クレジット

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — オリジナル macOS 実装
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — DOM 差分エンジン
- [Electron](https://www.electronjs.org/) — クロスプラットフォームウィンドウ

## 📜 ライセンス

MIT
