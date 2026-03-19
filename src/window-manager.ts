import { EventEmitter } from "events";
import { WidgetServer } from "./server";
import { generateId } from "./utils";
import { wrapHTML } from "./shell";

export type WindowMode = "browser" | "electron";

export interface WindowOptions {
  title?: string;
  width?: number;
  height?: number;
  html?: string;
  /** Window mode: "electron" (frameless window) or "browser" (default browser tab) */
  mode?: WindowMode;
}

/**
 * Handle to an open widget window.
 * Emits: 'ready', 'message', 'closed'
 */
export class WindowHandle extends EventEmitter {
  readonly id: string;
  private server: WidgetServer;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHtml: string | null = null;
  private _ready = false;
  private _closed = false;
  private _mode: WindowMode;

  constructor(id: string, server: WidgetServer, mode: WindowMode = "browser") {
    super();
    this.id = id;
    this.server = server;
    this._mode = mode;
  }

  /**
   * Send HTML content to the widget (uses morphdom for diff/patch).
   * Debounced at 150ms — rapid calls merge into the latest content.
   */
  setContent(html: string): void {
    if (this._closed) return;
    this.pendingHtml = html;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.pendingHtml !== null) {
        this.server.sendToWidget(this.id, {
          type: "setContent",
          html: this.pendingHtml,
        });
        this.pendingHtml = null;
      }
    }, 150);
  }

  /**
   * Flush any pending debounced content immediately.
   */
  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingHtml !== null) {
      this.server.sendToWidget(this.id, {
        type: "setContent",
        html: this.pendingHtml,
      });
      this.pendingHtml = null;
    }
  }

  /**
   * Tell the browser to re-execute script tags.
   */
  runScripts(): void {
    if (this._closed) return;
    this.flush();
    this.server.sendToWidget(this.id, { type: "runScripts" });
  }

  /**
   * Close the widget window.
   */
  close(): void {
    if (this._closed) return;
    this._closed = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // Close Electron window if applicable
    if (this._mode === "electron") {
      import("./electron-launcher").then(({ closeElectronWindow }) => {
        closeElectronWindow(this.id);
      });
    }

    this.server.unregisterWidget(this.id);
  }

  get isReady(): boolean { return this._ready; }
  get isClosed(): boolean { return this._closed; }
  get mode(): WindowMode { return this._mode; }

  /** @internal */
  _markReady(): void {
    this._ready = true;
    this.emit("ready");
  }

  /** @internal */
  _markClosed(): void {
    this._closed = true;
    this.emit("closed");
  }

  /**
   * Returns a promise that resolves when the widget is ready.
   */
  waitForReady(): Promise<void> {
    if (this._ready) return Promise.resolve();
    return new Promise((resolve) => this.once("ready", resolve));
  }

  /**
   * Returns a promise that resolves with the first message from the widget.
   */
  waitForResult<T = any>(): Promise<T> {
    return new Promise((resolve) => {
      this.once("message", (data: T) => resolve(data));
    });
  }
}

/**
 * Manages widget windows — opening, tracking, and closing.
 */
export class WindowManager {
  private server: WidgetServer | null = null;
  private handles: Map<string, WindowHandle> = new Map();
  /** Default mode for new windows */
  defaultMode: WindowMode = "electron";

  constructor(options?: { mode?: WindowMode }) {
    if (options?.mode) {
      this.defaultMode = options.mode;
    }
  }

  /**
   * Open a new widget window.
   * Mode "electron" opens a frameless Electron window (default).
   * Mode "browser" opens in the default browser.
   */
  async open(options: WindowOptions = {}): Promise<WindowHandle> {
    if (!this.server) {
      this.server = await WidgetServer.getInstance();
    }

    const mode = options.mode ?? this.defaultMode;
    const id = generateId();
    const handle = new WindowHandle(id, this.server, mode);
    this.handles.set(id, handle);

    const url = this.server.registerWidget(id, {
      onReady: () => handle._markReady(),
      onMessage: (data) => handle.emit("message", data),
      onClosed: () => {
        handle._markClosed();
        this.handles.delete(id);
      },
    });

    // Open the window
    if (mode === "electron") {
      const { openElectronWindow } = await import("./electron-launcher");
      await openElectronWindow({
        id,
        url,
        title: options.title,
        width: options.width,
        height: options.height,
      });
    } else {
      const open = (await import("open")).default;
      await open(url);
    }

    // If initial HTML was provided, send it once ready
    if (options.html) {
      const html = options.html;
      handle.waitForReady().then(() => {
        handle.setContent(wrapHTML(html));
      });
    }

    return handle;
  }

  /**
   * Close all open widgets and shut down the server.
   */
  async closeAll(): Promise<void> {
    for (const [, handle] of this.handles) {
      handle.close();
    }
    this.handles.clear();

    // Quit Electron if running
    try {
      const { quitElectron } = await import("./electron-launcher");
      quitElectron();
    } catch {
      // Electron not loaded — fine
    }

    if (this.server) {
      await this.server.shutdown();
      this.server = null;
    }
  }

  /**
   * Get the number of active widgets.
   */
  get activeCount(): number {
    return this.handles.size;
  }
}
