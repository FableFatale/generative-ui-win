#!/usr/bin/env node
/**
 * MCP Server for generative-ui-win.
 *
 * Exposes tools so that an LLM (e.g. Claude in Claude Code) can open
 * widget windows and render HTML/SVG/Chart.js content on the fly.
 *
 * Usage:
 *   node dist/src/mcp-server.js          (stdio transport)
 */

import * as fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { WindowManager, WindowHandle } from "./window-manager";
import { getGuidelines, getAvailableModules, GuidelineModule } from "./guidelines";
import * as kanbanStore from "./kanban-store";
import { renderKanbanHTML } from "./kanban-renderer";
import { generateId } from "./utils";

// ── State ──

const manager = new WindowManager({ mode: "browser" });
const handles: Map<string, WindowHandle> = new Map();
let kanbanWidgetId: string | null = null;

// Session ID for this MCP server instance
const SESSION_ID = `S-${generateId()}`;
const SESSION_LABEL = `Session-${SESSION_ID.slice(2, 6).toUpperCase()}`;

// File watcher state
let fileWatcher: fs.FSWatcher | null = null;
let fileWatchDebounce: ReturnType<typeof setTimeout> | null = null;

// ── MCP Server ──

const mcp = new McpServer(
  { name: "generative-ui", version: "1.0.0" },
  {
    capabilities: { tools: {} },
    instructions: [
      "This server renders live HTML/SVG widgets in a browser window.",
      "Use `show_widget` to open a window and display content.",
      "Use `update_widget` to stream incremental updates (morphdom diffs the DOM).",
      "Use `run_scripts` after the final update when the HTML contains <script> tags.",
      "Use `close_widget` when done.",
      "Use `get_guidelines` to retrieve design-system documentation for high-quality output.",
    ].join("\n"),
  },
);

// ── Tool: show_widget ──

mcp.tool(
  "show_widget",
  "Open a new widget window and display HTML/SVG content. Returns the widget ID for subsequent updates. The content is rendered in a dark-themed browser tab with morphdom for efficient DOM diffing.",
  {
    html: z
      .string()
      .describe(
        "The HTML or SVG content to render. Can include <script> and <style> tags. CDN libraries (Chart.js, D3, Three.js) are supported via <script src>. Use dark theme: bg #1a1a1a, text #e0e0e0, accent #7c6fe0.",
      ),
    title: z
      .string()
      .optional()
      .describe("Window title (default: 'Widget')"),
    width: z
      .number()
      .optional()
      .describe("Window width in pixels (default: 900)"),
    height: z
      .number()
      .optional()
      .describe("Window height in pixels (default: 700)"),
  },
  async ({ html, title, width, height }) => {
    try {
      const handle = await manager.open({ html, title, width, height });
      handles.set(handle.id, handle);

      handle.on("closed", () => {
        handles.delete(handle.id);
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              widget_id: handle.id,
              status: "opened",
              message: `Widget opened. Use widget_id "${handle.id}" to update or close it.`,
            }),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: update_widget ──

mcp.tool(
  "update_widget",
  "Update the HTML content of an existing widget. morphdom diffs the DOM so only changed elements are patched — smooth, flicker-free updates. Call this repeatedly for streaming content.",
  {
    widget_id: z.string().describe("The widget ID returned by show_widget"),
    html: z.string().describe("New HTML/SVG content to render"),
  },
  async ({ widget_id, html }) => {
    const handle = handles.get(widget_id);
    if (!handle) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: widget "${widget_id}" not found. It may have been closed.`,
          },
        ],
        isError: true,
      };
    }

    handle.setContent(html);
    return {
      content: [
        { type: "text" as const, text: `Widget "${widget_id}" updated.` },
      ],
    };
  },
);

// ── Tool: run_scripts ──

mcp.tool(
  "run_scripts",
  "Execute <script> tags in the widget. Call this ONCE after the final update when the HTML contains <script> tags (e.g. Chart.js, D3, or custom JavaScript). This flushes pending content and re-executes all scripts.",
  {
    widget_id: z.string().describe("The widget ID returned by show_widget"),
  },
  async ({ widget_id }) => {
    const handle = handles.get(widget_id);
    if (!handle) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: widget "${widget_id}" not found.`,
          },
        ],
        isError: true,
      };
    }

    handle.runScripts();
    return {
      content: [
        {
          type: "text" as const,
          text: `Scripts executed in widget "${widget_id}".`,
        },
      ],
    };
  },
);

// ── Tool: close_widget ──

mcp.tool(
  "close_widget",
  "Close a widget window and free resources.",
  {
    widget_id: z.string().describe("The widget ID returned by show_widget"),
  },
  async ({ widget_id }) => {
    const handle = handles.get(widget_id);
    if (!handle) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Widget "${widget_id}" already closed or not found.`,
          },
        ],
      };
    }

    handle.close();
    handles.delete(widget_id);
    return {
      content: [
        { type: "text" as const, text: `Widget "${widget_id}" closed.` },
      ],
    };
  },
);

// ── Tool: get_guidelines ──

mcp.tool(
  "get_guidelines",
  `Retrieve design guidelines for generating high-quality widget content. Available modules: ${getAvailableModules().join(", ")}. Returns CSS classes, color palettes, typography scales, and best practices. Include these in your context when generating visual content.`,
  {
    modules: z
      .array(z.enum(["art", "mockup", "interactive", "chart", "diagram"]))
      .optional()
      .describe(
        "Which guideline modules to load. If omitted, returns only the base guidelines.",
      ),
  },
  async ({ modules }) => {
    const text = getGuidelines(modules as GuidelineModule[] | undefined);
    return {
      content: [{ type: "text" as const, text }],
    };
  },
);

// ── Kanban helpers ──

async function refreshKanban(): Promise<void> {
  if (!kanbanWidgetId) return;
  const handle = handles.get(kanbanWidgetId);
  if (!handle) { kanbanWidgetId = null; return; }
  const data = kanbanStore.load();
  handle.setContent(renderKanbanHTML(data, SESSION_ID, SESSION_LABEL));
}

function startFileWatch(): void {
  if (fileWatcher) return;
  const filePath = kanbanStore.DATA_FILE;
  try {
    // Ensure the file exists before watching
    if (!fs.existsSync(filePath)) return;
    fileWatcher = fs.watch(filePath, () => {
      // Debounce to avoid rapid refresh
      if (fileWatchDebounce) clearTimeout(fileWatchDebounce);
      fileWatchDebounce = setTimeout(() => {
        refreshKanban();
      }, 500);
    });
    fileWatcher.on("error", () => {
      // File might be deleted/recreated — restart watch
      stopFileWatch();
    });
  } catch {
    // Ignore watch errors
  }
}

function stopFileWatch(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  if (fileWatchDebounce) {
    clearTimeout(fileWatchDebounce);
    fileWatchDebounce = null;
  }
}

// ── Tool: kanban_show ──

mcp.tool(
  "kanban_show",
  "Open or refresh the Kanban task-monitor board. If a board is already open, it refreshes in place.",
  {},
  async () => {
    try {
      const data = kanbanStore.load();
      kanbanStore.registerSession(data, SESSION_ID, SESSION_LABEL);
      kanbanStore.cleanStaleSessions(data);
      const html = renderKanbanHTML(kanbanStore.load(), SESSION_ID, SESSION_LABEL);

      // Reuse existing widget if still open
      if (kanbanWidgetId && handles.has(kanbanWidgetId)) {
        handles.get(kanbanWidgetId)!.setContent(html);
        startFileWatch();
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ widget_id: kanbanWidgetId, status: "refreshed", session: SESSION_ID }),
          }],
        };
      }

      const handle = await manager.open({
        html,
        title: "Kanban Board",
        width: 1200,
        height: 800,
      });
      handles.set(handle.id, handle);
      kanbanWidgetId = handle.id;
      handle.on("closed", () => {
        handles.delete(handle.id);
        if (kanbanWidgetId === handle.id) {
          kanbanWidgetId = null;
          stopFileWatch();
        }
      });

      // Start watching for cross-session updates
      startFileWatch();

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ widget_id: handle.id, status: "opened", session: SESSION_ID }),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: kanban_add_task ──

mcp.tool(
  "kanban_add_task",
  "Add a new task to the Kanban board (starts in TODO). Auto-refreshes the board if open.",
  {
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("Priority level (default: medium)"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for categorization"),
  },
  async ({ title, description, priority, tags }) => {
    const data = kanbanStore.load();
    kanbanStore.registerSession(data, SESSION_ID, SESSION_LABEL);
    const task = kanbanStore.addTask(
      data,
      title,
      description ?? "",
      priority ?? "medium",
      tags ?? [],
      SESSION_LABEL,
    );
    await refreshKanban();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ task_id: task.id, title: task.title, status: "added" }),
      }],
    };
  },
);

// ── Tool: kanban_batch_add ──

mcp.tool(
  "kanban_batch_add",
  "Add multiple tasks to the Kanban board at once. Useful for dispatching a planned set of tasks. All tasks start in TODO (pending). Auto-refreshes the board.",
  {
    tasks: z.array(z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      priority: z.enum(["high", "medium", "low"]).optional().describe("Priority (default: medium)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
    })).describe("Array of tasks to add"),
  },
  async ({ tasks }) => {
    const data = kanbanStore.load();
    kanbanStore.registerSession(data, SESSION_ID, SESSION_LABEL);
    const added = tasks.map((t) =>
      kanbanStore.addTask(
        data,
        t.title,
        t.description ?? "",
        t.priority ?? "medium",
        t.tags ?? [],
        SESSION_LABEL,
      )
    );
    await refreshKanban();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "batch_added",
          count: added.length,
          tasks: added.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
        }),
      }],
    };
  },
);

// ── Tool: kanban_move_task ──

mcp.tool(
  "kanban_move_task",
  "Move a task to a different column (pending → in_progress → completed). Auto-refreshes the board.",
  {
    task_id: z.string().describe("The task ID to move"),
    status: z
      .enum(["pending", "in_progress", "completed"])
      .describe("Target status column"),
  },
  async ({ task_id, status }) => {
    const data = kanbanStore.load();
    const task = kanbanStore.moveTask(data, task_id, status);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Error: task "${task_id}" not found.` }],
        isError: true,
      };
    }
    await refreshKanban();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ task_id: task.id, title: task.title, status: task.status, moved: true }),
      }],
    };
  },
);

// ── Tool: kanban_claim_task ──

mcp.tool(
  "kanban_claim_task",
  "Claim the next available task (or a specific task by ID) for this session. Moves it to in_progress. Returns the claimed task details or an error if nothing is available.",
  {
    task_id: z.string().optional().describe(
      "Specific task ID to claim. If omitted, claims the next unclaimed task (highest priority first)."
    ),
  },
  async ({ task_id }) => {
    const data = kanbanStore.load();
    kanbanStore.registerSession(data, SESSION_ID, SESSION_LABEL);

    let targetId = task_id;
    if (!targetId) {
      const next = kanbanStore.getNextUnclaimed(data);
      if (!next) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "no_tasks", message: "No unclaimed pending tasks available." }) }],
        };
      }
      targetId = next.id;
    }

    const task = kanbanStore.claimTask(data, targetId, SESSION_ID, SESSION_LABEL);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Error: task "${targetId}" not found or already claimed by another session.` }],
        isError: true,
      };
    }
    await refreshKanban();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          task_id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          tags: task.tags,
          status: "claimed",
          claimedBy: SESSION_LABEL,
        }),
      }],
    };
  },
);

// ── Tool: kanban_add_version ──

mcp.tool(
  "kanban_add_version",
  "Create a version milestone and associate completed tasks with it. By default, all completed tasks not yet in a version are included.",
  {
    name: z.string().describe("Version name (e.g. 'v1.0.0')"),
    description: z.string().optional().describe("Version description"),
    task_ids: z
      .array(z.string())
      .optional()
      .describe("Specific task IDs to include (default: all unversioned completed tasks)"),
  },
  async ({ name, description, task_ids }) => {
    const data = kanbanStore.load();
    const version = kanbanStore.addVersion(
      data,
      name,
      description ?? "",
      task_ids,
    );
    await refreshKanban();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          version_id: version.id,
          name: version.name,
          tasks_count: version.taskIds.length,
          status: "created",
        }),
      }],
    };
  },
);

// ── Tool: kanban_heartbeat ──

mcp.tool(
  "kanban_heartbeat",
  "Send a heartbeat to indicate this session is still active. Also cleans up stale sessions. Call periodically to keep this session visible on the board.",
  {},
  async () => {
    const data = kanbanStore.load();
    kanbanStore.registerSession(data, SESSION_ID, SESSION_LABEL);
    const removed = kanbanStore.cleanStaleSessions(data);
    if (removed > 0) await refreshKanban();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          session: SESSION_ID,
          label: SESSION_LABEL,
          active_sessions: data.sessions.length,
          stale_removed: removed,
        }),
      }],
    };
  },
);

// ── Tool: kanban_get_status ──

mcp.tool(
  "kanban_get_status",
  "Get a JSON summary of the current Kanban board state — task counts, all tasks, versions, and recent log entries.",
  {},
  async () => {
    const data = kanbanStore.load();
    const summary = kanbanStore.getStatusSummary(data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(summary, null, 2),
      }],
    };
  },
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  // Keep the process alive
  process.on("SIGINT", async () => {
    stopFileWatch();
    // Remove this session from the board
    try {
      const data = kanbanStore.load();
      data.sessions = data.sessions.filter((s) => s.id !== SESSION_ID);
      kanbanStore.save(data);
    } catch { /* ignore */ }
    await manager.closeAll();
    await mcp.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
