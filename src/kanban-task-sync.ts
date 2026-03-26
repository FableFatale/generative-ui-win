#!/usr/bin/env node
/**
 * kanban-task-sync.ts
 * Claude Code PostToolUse hook script.
 * Reads hook JSON from stdin and syncs TaskCreate/TaskUpdate to the kanban board.
 */
import { load, save, addTask, moveTask, deleteTask } from "./kanban-store";
import type { KanbanData, TaskStatus } from "./kanban-store";

interface HookPayload {
  session_id?: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: { text?: string };
}

function findTaskByClaudeId(data: KanbanData, claudeId: string) {
  return data.tasks.find((t) => t.tags.includes(`claude:${claudeId}`));
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return;

  let payload: HookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return; // not valid JSON, ignore
  }

  const { tool_name, tool_input } = payload;

  if (tool_name === "TaskCreate") {
    const subject = (tool_input.subject as string) || "Untitled";
    const description = (tool_input.description as string) || "";
    const data = load();

    // Extract task ID from tool_response if available
    let claudeTaskId: string | undefined;
    try {
      const respText = payload.tool_response?.text;
      if (respText) {
        const resp = JSON.parse(respText);
        claudeTaskId = resp.id ?? resp.taskId;
      }
    } catch {}

    // Dedup: skip if already synced
    if (claudeTaskId && findTaskByClaudeId(data, claudeTaskId)) return;

    const tags: string[] = [];
    if (claudeTaskId) tags.push(`claude:${claudeTaskId}`);

    addTask(data, subject, description, "medium", tags, payload.session_id);
  } else if (tool_name === "TaskUpdate") {
    const taskId = tool_input.taskId as string;
    if (!taskId) return;

    const data = load();
    const kanbanTask = findTaskByClaudeId(data, taskId);
    if (!kanbanTask) return; // task not tracked on kanban

    const newStatus = tool_input.status as string | undefined;

    if (newStatus === "deleted") {
      deleteTask(data, kanbanTask.id);
      return;
    }

    if (newStatus && (newStatus === "pending" || newStatus === "in_progress" || newStatus === "completed")) {
      if (kanbanTask.status !== newStatus) {
        moveTask(data, kanbanTask.id, newStatus as TaskStatus);
      }
    }
  }
}

main().catch(() => {});
