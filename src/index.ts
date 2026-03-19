export { WindowManager, WindowHandle, WindowOptions, WindowMode } from "./window-manager";
export { WidgetServer } from "./server";
export { getGuidelines, getAvailableModules, GuidelineModule } from "./guidelines";
export { SVG_STYLES } from "./svg-styles";
export { escapeJS, generateId, findAvailablePort } from "./utils";
export { generateShellHTML, wrapHTML } from "./shell";


import { WindowManager, WindowOptions, WindowMode } from "./window-manager";

// ── Convenience API ──

let defaultManager: WindowManager | null = null;

function getDefaultManager(): WindowManager {
  if (!defaultManager) {
    defaultManager = new WindowManager();
  }
  return defaultManager;
}

/**
 * Quick helper: open a widget window and display HTML content.
 */
export async function showWidget(html: string, options?: Omit<WindowOptions, "html">) {
  const manager = getDefaultManager();
  return manager.open({ ...options, html });
}

/**
 * Shut down the default manager and server.
 */
export async function shutdown() {
  if (defaultManager) {
    await defaultManager.closeAll();
    defaultManager = null;
  }
}

// ── CLI mode ──

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "show") {
    const title = args[1] || "Widget";
    const htmlIndex = args.indexOf("--html");
    const html = htmlIndex !== -1 ? args[htmlIndex + 1] : `
      <div style="text-align:center;padding:40px;">
        <h1 style="color:#7c6fe0;font-size:32px;margin-bottom:16px;">${title}</h1>
        <p style="color:#888;">generative-ui-win is running</p>
      </div>
    `;

    const mode: WindowMode = args.includes("--browser") ? "browser" : "electron";
    const handle = await showWidget(html, { title, mode });
    console.log(`Widget opened: ${handle.id} (mode: ${mode})`);

    handle.on("message", (data: any) => {
      console.log("Message from widget:", data);
    });

    handle.on("closed", () => {
      console.log("Widget closed");
      shutdown().then(() => process.exit(0));
    });
  } else {
    console.log("Usage: generative-ui-win show [title] [--html '<html>'] [--browser]");
    console.log("");
    console.log("Options:");
    console.log("  --browser    Open in default browser instead of Electron window");
    console.log("  --html       HTML content to display");
    console.log("");
    console.log("Library usage:");
    console.log("  import { showWidget, WindowManager } from 'generative-ui-win';");
    console.log("  const handle = await showWidget('<h1>Hello</h1>');                  // Electron");
    console.log("  const handle = await showWidget('<h1>Hello</h1>', {mode:'browser'}); // Browser");
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}
