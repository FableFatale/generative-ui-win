import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateId } from "./utils";

// ── Types ──

export type TaskStatus = "pending" | "in_progress" | "completed";
export type Priority = "high" | "medium" | "low";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  session?: string; // session ID that created this task
  claimedBy?: string; // session LABEL of the worker that claimed this task
  claimedAt?: string; // ISO timestamp of the claim
  createdAt: string;
  updatedAt: string;
}

export interface KanbanVersion {
  id: string;
  name: string;
  description: string;
  taskIds: string[];
  createdAt: string;
}

export interface LogEntry {
  action: string;
  details: string;
  timestamp: string;
}

export interface SessionInfo {
  id: string;
  label: string;
  startedAt: string;
  lastSeen: string;
}

export interface KanbanData {
  tasks: KanbanTask[];
  versions: KanbanVersion[];
  log: LogEntry[];
  sessions: SessionInfo[];
}

// ── Store ──

const DATA_DIR = path.join(os.homedir(), ".generative-ui-win");
const DATA_FILE = path.join(DATA_DIR, "kanban.json");
const MAX_LOG = 100;

function emptyData(): KanbanData {
  return { tasks: [], versions: [], log: [], sessions: [] };
}

// Ensure older data files get the sessions array
function migrateData(data: KanbanData): KanbanData {
  if (!data.sessions) data.sessions = [];
  return data;
}

export function load(): KanbanData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return migrateData(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
    }
  } catch {
    // corrupted file — start fresh
  }
  return emptyData();
}

export function save(data: KanbanData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function addLogEntry(
  data: KanbanData,
  action: string,
  details: string,
): void {
  data.log.unshift({ action, details, timestamp: new Date().toISOString() });
  if (data.log.length > MAX_LOG) data.log.length = MAX_LOG;
}

// ── Task CRUD ──

export function addTask(
  data: KanbanData,
  title: string,
  description: string = "",
  priority: Priority = "medium",
  tags: string[] = [],
  session?: string,
): KanbanTask {
  const now = new Date().toISOString();
  const task: KanbanTask = {
    id: generateId(),
    title,
    description,
    status: "pending",
    priority,
    tags,
    session,
    createdAt: now,
    updatedAt: now,
  };
  data.tasks.push(task);
  addLogEntry(data, "add_task", `Added "${title}" [${priority}]`);
  save(data);
  return task;
}

export function moveTask(
  data: KanbanData,
  taskId: string,
  newStatus: TaskStatus,
): KanbanTask | null {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const oldStatus = task.status;
  task.status = newStatus;
  task.updatedAt = new Date().toISOString();
  addLogEntry(
    data,
    "move_task",
    `"${task.title}" ${oldStatus} → ${newStatus}`,
  );
  save(data);
  return task;
}

export function deleteTask(data: KanbanData, taskId: string): boolean {
  const idx = data.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;
  const [removed] = data.tasks.splice(idx, 1);
  addLogEntry(data, "delete_task", `Deleted "${removed.title}"`);
  save(data);
  return true;
}

// ── Claim ──

export function claimTask(
  data: KanbanData,
  taskId: string,
  sessionId: string,
  sessionLabel: string,
): KanbanTask | null {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  // Already claimed by another session
  if (task.claimedBy && task.claimedBy !== sessionLabel) return null;
  const now = new Date().toISOString();
  task.claimedBy = sessionLabel;
  task.claimedAt = now;
  task.status = "in_progress";
  task.updatedAt = now;
  addLogEntry(data, "claim_task", `${sessionLabel} claimed "${task.title}"`);
  save(data);
  return task;
}

export function unclaimTask(data: KanbanData, taskId: string): boolean {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  const now = new Date().toISOString();
  const prev = task.claimedBy ?? "unknown";
  task.claimedBy = undefined;
  task.claimedAt = undefined;
  task.status = "pending";
  task.updatedAt = now;
  addLogEntry(data, "unclaim_task", `"${task.title}" unclaimed (was ${prev})`);
  save(data);
  return true;
}

export function getNextUnclaimed(data: KanbanData): KanbanTask | null {
  const candidates = data.tasks
    .filter((t) => t.status === "pending" && !t.claimedBy)
    .sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return a.createdAt.localeCompare(b.createdAt);
    });
  return candidates[0] ?? null;
}

// ── Version ──

export function addVersion(
  data: KanbanData,
  name: string,
  description: string = "",
  taskIds?: string[],
): KanbanVersion {
  // Default: all completed tasks not already in a version
  const usedIds = new Set(data.versions.flatMap((v) => v.taskIds));
  const resolvedIds =
    taskIds ??
    data.tasks
      .filter((t) => t.status === "completed" && !usedIds.has(t.id))
      .map((t) => t.id);

  const version: KanbanVersion = {
    id: generateId(),
    name,
    description,
    taskIds: resolvedIds,
    createdAt: new Date().toISOString(),
  };
  data.versions.push(version);
  addLogEntry(
    data,
    "add_version",
    `Version "${name}" with ${resolvedIds.length} tasks`,
  );
  save(data);
  return version;
}

// ── Query ──

export function getBoard(data: KanbanData) {
  return {
    todo: data.tasks.filter((t) => t.status === "pending"),
    doing: data.tasks.filter((t) => t.status === "in_progress"),
    done: data.tasks.filter((t) => t.status === "completed"),
    versions: data.versions,
  };
}

export function getStatusSummary(data: KanbanData) {
  const board = getBoard(data);
  return {
    counts: {
      todo: board.todo.length,
      doing: board.doing.length,
      done: board.done.length,
      versions: board.versions.length,
    },
    tasks: data.tasks,
    versions: data.versions,
    sessions: data.sessions,
    recentLog: data.log.slice(0, 10),
  };
}

// ── Session Management ──

export function registerSession(
  data: KanbanData,
  sessionId: string,
  label: string,
): SessionInfo {
  const now = new Date().toISOString();
  const existing = data.sessions.find((s) => s.id === sessionId);
  if (existing) {
    existing.lastSeen = now;
    existing.label = label;
    save(data);
    return existing;
  }
  const session: SessionInfo = {
    id: sessionId,
    label,
    startedAt: now,
    lastSeen: now,
  };
  data.sessions.push(session);
  addLogEntry(data, "session_join", `Session "${label}" joined`);
  save(data);
  return session;
}

export function cleanStaleSessions(
  data: KanbanData,
  maxAgeMs: number = 300_000,
): number {
  const cutoff = Date.now() - maxAgeMs;
  const before = data.sessions.length;
  data.sessions = data.sessions.filter(
    (s) => new Date(s.lastSeen).getTime() > cutoff,
  );
  const removed = before - data.sessions.length;
  if (removed > 0) save(data);
  return removed;
}

export { DATA_FILE };
