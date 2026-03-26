import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { generateShellHTML } from "./shell";
import { findAvailablePort } from "./utils";

export interface WidgetConnection {
  ws: WebSocket | null;
  ready: boolean;
  messageBuffer: Array<{ type: string; [key: string]: any }>;
  lastContent?: { type: string; html: string }; // persisted for refresh recovery
  onReady?: () => void;
  onMessage?: (data: any) => void;
  onClosed?: () => void;
}

/**
 * Singleton server managing all widget HTTP routes and WebSocket connections.
 */
export class WidgetServer {
  private static instance: WidgetServer | null = null;

  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private widgets: Map<string, WidgetConnection> = new Map();
  private _port: number = 0;
  private _ready: Promise<void>;

  private constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ noServer: true });

    // ── HTTP: serve widget shell pages ──
    this.app.get("/widget/:id", (req, res) => {
      const id = req.params.id;
      if (!this.widgets.has(id)) {
        res.status(404).send("Widget not found");
        return;
      }
      res.type("html").send(generateShellHTML(id, this._port));
    });

    // ── Health check ──
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", widgets: this.widgets.size });
    });

    // ── WebSocket upgrade ──
    this.server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url || "", `http://localhost:${this._port}`);
      const match = url.pathname.match(/^\/ws\/([a-f0-9]+)$/);
      if (!match) {
        socket.destroy();
        return;
      }
      const widgetId = match[1];
      if (!this.widgets.has(widgetId)) {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.handleConnection(widgetId, ws);
      });
    });

    this._ready = this.start();
  }

  static async getInstance(): Promise<WidgetServer> {
    if (!WidgetServer.instance) {
      WidgetServer.instance = new WidgetServer();
    }
    await WidgetServer.instance._ready;
    return WidgetServer.instance;
  }

  private async start(): Promise<void> {
    this._port = await findAvailablePort();
    return new Promise((resolve) => {
      this.server.listen(this._port, "127.0.0.1", () => {
        resolve();
      });
    });
  }

  get port(): number {
    return this._port;
  }

  /**
   * Register a new widget and return its URL.
   */
  registerWidget(id: string, callbacks: {
    onReady?: () => void;
    onMessage?: (data: any) => void;
    onClosed?: () => void;
  }): string {
    this.widgets.set(id, {
      ws: null,
      ready: false,
      messageBuffer: [],
      ...callbacks,
    });
    return `http://127.0.0.1:${this._port}/widget/${id}`;
  }

  /**
   * Send a message to a specific widget.
   */
  sendToWidget(id: string, message: { type: string; [key: string]: any }): void {
    const widget = this.widgets.get(id);
    if (!widget) return;

    // Store last setContent for refresh recovery
    if (message.type === "setContent") {
      widget.lastContent = message as { type: string; html: string };
    }

    if (widget.ready && widget.ws && widget.ws.readyState === WebSocket.OPEN) {
      widget.ws.send(JSON.stringify(message));
    } else {
      widget.messageBuffer.push(message);
    }
  }

  /**
   * Unregister a widget and close its connection.
   */
  unregisterWidget(id: string): void {
    const widget = this.widgets.get(id);
    if (widget?.ws && widget.ws.readyState === WebSocket.OPEN) {
      widget.ws.send(JSON.stringify({ type: "close" }));
      widget.ws.close();
    }
    this.widgets.delete(id);
  }

  private handleConnection(widgetId: string, ws: WebSocket): void {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      ws.close();
      return;
    }

    widget.ws = ws;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case "ready":
            widget.ready = true;
            // Resend last content on refresh/reconnect
            if (widget.lastContent) {
              ws.send(JSON.stringify(widget.lastContent));
            }
            // Flush buffered messages
            for (const buffered of widget.messageBuffer) {
              ws.send(JSON.stringify(buffered));
            }
            widget.messageBuffer = [];
            widget.onReady?.();
            break;

          case "message":
            widget.onMessage?.(msg.data);
            break;

          case "closed":
            widget.onClosed?.();
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      if (widget.ws === ws) {
        widget.ws = null;
        widget.ready = false;
        // Don't call onClosed — browser may just be refreshing.
        // onClosed is triggered by the explicit "closed" message from the client.
      }
    });
  }

  /**
   * Shut down the server and all connections.
   */
  async shutdown(): Promise<void> {
    for (const [id] of this.widgets) {
      this.unregisterWidget(id);
    }
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          WidgetServer.instance = null;
          resolve();
        });
      });
    });
  }
}
