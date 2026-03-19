import * as net from "net";
import * as crypto from "crypto";

/**
 * Escape a string for safe embedding inside a JS string literal (single-quoted).
 */
export function escapeJS(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/<\/script>/gi, "<\\/script>");
}

/**
 * Find an available TCP port, preferring the 18600–18699 range.
 */
export async function findAvailablePort(preferred = 18600): Promise<number> {
  for (let port = preferred; port < preferred + 100; port++) {
    if (await isPortAvailable(port)) return port;
  }
  // Fallback: let the OS pick
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => {
      srv.close(() => resolve(true));
    });
  });
}

/**
 * Generate an 8-character random hex ID.
 */
export function generateId(): string {
  return crypto.randomBytes(4).toString("hex");
}
