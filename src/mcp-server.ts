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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { WindowManager, WindowHandle } from "./window-manager";
import { getGuidelines, getAvailableModules, GuidelineModule } from "./guidelines";

// ── State ──

const manager = new WindowManager({ mode: "browser" });
const handles: Map<string, WindowHandle> = new Map();

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

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  // Keep the process alive
  process.on("SIGINT", async () => {
    await manager.closeAll();
    await mcp.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
