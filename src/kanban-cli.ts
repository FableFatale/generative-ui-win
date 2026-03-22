#!/usr/bin/env node
/**
 * Standalone CLI for the Kanban board.
 *
 * Usage:
 *   npx generative-ui-kanban              (shows the board in-browser)
 *   npx generative-ui-kanban add "title"  (quick-add a task)
 *   npx generative-ui-kanban status       (print status to stdout)
 */

import { WindowManager } from "./window-manager";
import * as store from "./kanban-store";
import { renderKanbanHTML } from "./kanban-renderer";

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "show";

  if (cmd === "status") {
    const data = store.load();
    const summary = store.getStatusSummary(data);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (cmd === "add") {
    const title = args[1];
    if (!title) {
      console.error("Usage: generative-ui-kanban add <title> [priority]");
      process.exit(1);
    }
    const priority = (args[2] as "high" | "medium" | "low") ?? "medium";
    const data = store.load();
    const task = store.addTask(data, title, "", priority);
    console.log(`Added task: ${task.title} [${task.id}]`);
    // Fall through to show
  }

  // Default: open the board in-browser
  const manager = new WindowManager({ mode: "browser" });
  const data = store.load();
  const html = renderKanbanHTML(data);
  const handle = await manager.open({
    html,
    title: "Kanban Board",
    width: 1200,
    height: 800,
  });

  console.log(`Kanban board opened (widget: ${handle.id})`);
  console.log("Press Ctrl+C to exit.");

  process.on("SIGINT", async () => {
    handle.close();
    await manager.closeAll();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
