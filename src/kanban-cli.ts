#!/usr/bin/env node
/**
 * kanban-cli.ts
 * 轻量 CLI 客户端，通过 HTTP API 与 kanban-server 通信。
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DATA_DIR = path.join(os.homedir(), ".generative-ui-win");
const PORT_FILE = path.join(DATA_DIR, "kanban-server.port");
const DEFAULT_PORT = 18700;

function getServerPort(): number {
  try {
    if (fs.existsSync(PORT_FILE)) {
      return parseInt(fs.readFileSync(PORT_FILE, "utf-8"), 10);
    }
  } catch {}
  return DEFAULT_PORT;
}

function sendRequest(method: string, path: string, body?: any): Promise<any> {
  const port = getServerPort();
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => {
        const data = Buffer.concat(chunks).toString();
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Cannot connect to server (port ${port}): ${err.message}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "show";

  try {
    if (cmd === "status") {
      const result = await sendRequest("GET", "/api/status");
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (cmd === "show") {
      const result = await sendRequest("GET", "/api/show");
      if (result.success) {
        if (result.widgetId) {
          console.log(`Board opened (widget: ${result.widgetId})`);
        } else {
          console.log("Board updated in existing window");
        }
      } else {
        console.error("Failed:", result.error);
      }
      return;
    }

    if (cmd === "add") {
      const title = args[1];
      if (!title) {
        console.error("Usage: kanban add <title> [priority] [tag:xxx]");
        process.exit(1);
      }
      const priority = (args[2] as "high" | "medium" | "low") ?? "medium";
      const tags = args.slice(3)
        .filter(a => a.startsWith("tag:"))
        .map(a => a.slice(4));

      const result = await sendRequest("POST", "/api/add", { title, priority, tags });
      if (result.success) {
        console.log(`Added: ${result.task.title} [${result.task.id}]`);
      } else {
        console.error("Failed:", result.error);
      }
      return;
    }

    if (cmd === "move") {
      const taskId = args[1];
      const toStatus = args[3]; // "to" is args[2]
      if (!taskId || !toStatus) {
        console.error("Usage: kanban move <taskId> to <pending|doing|done>");
        process.exit(1);
      }

      const result = await sendRequest("POST", "/api/move", { taskId, status: toStatus });
      if (result.success) {
        console.log(`Moved: ${result.task.title} → ${toStatus}`);
      } else {
        console.error("Failed:", result.error);
      }
      return;
    }

    if (cmd === "archive-all") {
      const result = await sendRequest("POST", "/api/archive-all");
      if (result.success) {
        console.log(`Archived ${result.archived} tasks to versions: ${result.versions.join(", ")}`);
      } else {
        console.error("Failed:", result.error);
      }
      return;
    }

    console.error(`Unknown command: ${cmd}`);
    console.error("Usage: kanban <show|status|add|move>");
    process.exit(1);
  } catch (err: any) {
    console.error(err.message);
    console.error("Server not running? Start it with: node dist/src/kanban-server.js start");
    process.exit(1);
  }
}

main().catch(console.error);