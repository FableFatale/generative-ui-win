/**
 * Electron window launcher for generative-ui-win.
 * Spawns Electron with the widget URL (options encoded as query params).
 */

import { ChildProcess, spawn } from "child_process";
import path from "path";

const electronWindows: Map<string, ChildProcess> = new Map();

function getElectronPath(): string {
  return require("electron") as unknown as string;
}

function getMainScriptPath(): string {
  return path.join(__dirname, "electron-main.js");
}

/**
 * Open a URL in an Electron BrowserWindow.
 */
export async function openElectronWindow(options: {
  id: string;
  url: string;
  title?: string;
  width?: number;
  height?: number;
}): Promise<void> {
  const electronPath = getElectronPath();
  const scriptPath = getMainScriptPath();

  // Encode window options as URL query params
  const urlObj = new URL(options.url);
  if (options.title) urlObj.searchParams.set("_title", options.title);
  if (options.width) urlObj.searchParams.set("_width", String(options.width));
  if (options.height) urlObj.searchParams.set("_height", String(options.height));

  const proc = spawn(electronPath, [scriptPath, urlObj.toString()], {
    stdio: "ignore",
    detached: false,
  });

  electronWindows.set(options.id, proc);

  proc.on("exit", () => {
    electronWindows.delete(options.id);
  });

  // Give Electron time to start
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
}

/**
 * Close a specific Electron window by killing its process.
 */
export function closeElectronWindow(id: string) {
  const proc = electronWindows.get(id);
  if (proc && !proc.killed) {
    proc.kill();
  }
  electronWindows.delete(id);
}

/**
 * Quit all Electron processes.
 */
export function quitElectron() {
  for (const [, proc] of electronWindows) {
    if (!proc.killed) proc.kill();
  }
  electronWindows.clear();
}
