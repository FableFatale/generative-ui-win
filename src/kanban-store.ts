import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateId } from "./utils";

// ── Types ──

export type TaskStatus = "pending" | "in_progress" | "completed";
export type Priority = "high" | "medium" | "low";
export type MilestoneStatus = "planning" | "in_progress" | "released";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// ── Daily Report ──

export interface DailyReport {
  id: string;
  date: string;           // YYYY-MM-DD
  summary?: string;       // 一句话总结
  taskIds: string[];      // 当天完成的任务
  isArchived: boolean;    // 是否已归档（非当天）
  createdAt: string;
  updatedAt: string;
}

// ── Milestone ──

export interface Milestone {
  id: string;
  name: string;           // 如 "v1.0 Core Pipeline"
  version: string;        // 如 "v1.0"
  description: string;
  status: MilestoneStatus;
  targetTasks?: number;   // 目标任务数（可选）
  taskIds: string[];      // 关联的任务
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;    // 发布时间
}

// ── Completion Stats ──

export interface CompletionStats {
  totalCompleted: number;
  todayCompleted: number;
  archivedCount: number;
  unarchivedCount: number;
  unarchivedTasks: string[];
  byMilestone: Record<string, number>;
  byTag: Record<string, number>;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  session?: string;
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;   // 新增：完成时间
  completedDate?: string; // 新增：完成日期 (YYYY-MM-DD)
  milestoneIds?: string[];// 新增：关联的里程碑 ID 列表
  createdAt: string;
  updatedAt: string;
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
  reports: DailyReport[];    // 新增：日报
  milestones: Milestone[];   // 重构：里程碑（替代 versions）
  lastArchiveCheck?: string; // 新增：上次归档检查日期
  log: LogEntry[];
  sessions: SessionInfo[];
  // 兼容旧数据
  versions?: KanbanVersion[]; // 已废弃，迁移后删除
}

// 兼容旧数据的 Version 类型
export interface KanbanVersion {
  id: string;
  name: string;
  description: string;
  taskIds: string[];
  createdAt: string;
  updatedAt?: string;
}

// ── Store ──

const DATA_DIR = path.join(os.homedir(), ".generative-ui-win");
const DATA_FILE = path.join(DATA_DIR, "kanban.json");
const MAX_LOG = 100;

function emptyData(): KanbanData {
  return { tasks: [], reports: [], milestones: [], log: [], sessions: [] };
}

// 数据迁移：处理旧版本数据
function migrateData(data: KanbanData): KanbanData {
  if (!data.sessions) data.sessions = [];
  if (!data.reports) data.reports = [];
  if (!data.milestones) data.milestones = [];

  // 迁移旧的 versions 到 milestones
  if (data.versions && data.versions.length > 0) {
    for (const v of data.versions) {
      const milestone: Milestone = {
        id: v.id,
        name: v.name,
        version: v.name.startsWith("v") ? v.name : `v0.${data.milestones.length + 1}`,
        description: v.description || "",
        status: "in_progress",  // 默认设为进行中
        taskIds: v.taskIds || [],
        createdAt: v.createdAt,
        updatedAt: v.updatedAt || v.createdAt,
      };
      data.milestones.push(milestone);
    }
    // 迁移完成后删除旧数据
    delete data.versions;
    save(data);
  }

  // 为任务添加新字段
  for (const t of data.tasks) {
    if (!t.milestoneIds) t.milestoneIds = [];
    // 如果任务已完成但没有 completedDate，从 updatedAt 推断
    if (t.status === "completed" && !t.completedDate && t.updatedAt) {
      t.completedDate = t.updatedAt.split("T")[0];
    }
  }

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

  // 任务完成时归入当日日报
  if (newStatus === "completed" && oldStatus !== "completed") {
    completeTaskToDailyReport(data, task);
  }

  addLogEntry(
    data,
    "move_task",
    `"${task.title}" ${oldStatus} → ${newStatus}`,
  );
  save(data);
  return task;
}

// ── Daily Report Logic ──

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function completeTaskToDailyReport(data: KanbanData, task: KanbanTask): void {
  const today = getTodayDate();

  task.completedAt = new Date().toISOString();
  task.completedDate = today;

  // 查找或创建今日日报
  let report = data.reports.find(r => r.date === today);
  if (!report) {
    report = {
      id: generateId(),
      date: today,
      taskIds: [],
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.reports.push(report);
    addLogEntry(data, "create_report", `Created daily report for ${today}`);
  }

  // 添加任务到日报（避免重复）
  if (!report.taskIds.includes(task.id)) {
    report.taskIds.push(task.id);
    report.updatedAt = new Date().toISOString();
    addLogEntry(data, "complete_task", `"${task.title}" completed and added to ${today} report`);
  }
}

// 检查并归档昨日日报
export function checkDailyArchive(data: KanbanData): { archived: boolean; report?: DailyReport; promptSummary: boolean } {
  const today = getTodayDate();
  const lastCheck = data.lastArchiveCheck;

  // 更新检查日期
  data.lastArchiveCheck = today;

  // 如果是同一天，不触发归档
  if (lastCheck === today) {
    return { archived: false, promptSummary: false };
  }

  // 归档昨天的日报
  const yesterday = getYesterdayDate();
  const yesterdayReport = data.reports.find(r => r.date === yesterday);

  if (yesterdayReport && !yesterdayReport.isArchived) {
    yesterdayReport.isArchived = true;
    yesterdayReport.updatedAt = new Date().toISOString();
    save(data);
    addLogEntry(data, "archive_report", `Archived daily report for ${yesterday}`);

    // 提示用户写总结（如果还没有总结）
    return {
      archived: true,
      report: yesterdayReport,
      promptSummary: !yesterdayReport.summary,
    };
  }

  return { archived: false, promptSummary: false };
}

// 更新日报总结
export function updateReportSummary(data: KanbanData, date: string, summary: string): boolean {
  const report = data.reports.find(r => r.date === date);
  if (!report) return false;

  report.summary = summary;
  report.updatedAt = new Date().toISOString();
  save(data);
  addLogEntry(data, "update_summary", `Updated summary for ${date}`);
  return true;
}

// 获取日报列表（按日期倒序）
export function getDailyReports(data: KanbanData): DailyReport[] {
  return data.reports.sort((a, b) => b.date.localeCompare(a.date));
}

// 获取今日日报
export function getTodayReport(data: KanbanData): DailyReport | null {
  const today = getTodayDate();
  return data.reports.find(r => r.date === today) || null;
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

// ── Milestone ──

export function createMilestone(
  data: KanbanData,
  name: string,
  version: string,
  description: string = "",
  targetTasks?: number,
): Milestone {
  const milestone: Milestone = {
    id: generateId(),
    name,
    version,
    description,
    status: "planning",
    targetTasks,
    taskIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.milestones.push(milestone);
  addLogEntry(data, "create_milestone", `Created milestone "${version} ${name}"`);
  save(data);
  return milestone;
}

export function updateMilestoneStatus(
  data: KanbanData,
  milestoneId: string,
  status: MilestoneStatus,
): Milestone | null {
  const milestone = data.milestones.find(m => m.id === milestoneId);
  if (!milestone) return null;

  milestone.status = status;
  milestone.updatedAt = new Date().toISOString();

  if (status === "released") {
    milestone.releasedAt = new Date().toISOString();
  }

  addLogEntry(data, "update_milestone_status", `Milestone "${milestone.version}" → ${status}`);
  save(data);
  return milestone;
}

export function addTaskToMilestone(
  data: KanbanData,
  taskId: string,
  milestoneId: string,
): boolean {
  const task = data.tasks.find(t => t.id === taskId);
  const milestone = data.milestones.find(m => m.id === milestoneId);
  if (!task || !milestone) return false;

  // 添加到里程碑
  if (!milestone.taskIds.includes(taskId)) {
    milestone.taskIds.push(taskId);
    milestone.updatedAt = new Date().toISOString();
  }

  // 添加到任务
  if (!task.milestoneIds) task.milestoneIds = [];
  if (!task.milestoneIds.includes(milestoneId)) {
    task.milestoneIds.push(milestoneId);
  }

  addLogEntry(data, "add_task_to_milestone", `Task "${task.title}" → milestone "${milestone.version}"`);
  save(data);
  return true;
}

export function removeTaskFromMilestone(
  data: KanbanData,
  taskId: string,
  milestoneId: string,
): boolean {
  const task = data.tasks.find(t => t.id === taskId);
  const milestone = data.milestones.find(m => m.id === milestoneId);
  if (!task || !milestone) return false;

  // 从里程碑移除
  milestone.taskIds = milestone.taskIds.filter(id => id !== taskId);
  milestone.updatedAt = new Date().toISOString();

  // 从任务移除
  if (task.milestoneIds) {
    task.milestoneIds = task.milestoneIds.filter(id => id !== milestoneId);
  }

  addLogEntry(data, "remove_task_from_milestone", `Task "${task.title}" removed from milestone "${milestone.version}"`);
  save(data);
  return true;
}

export function deleteMilestone(data: KanbanData, milestoneId: string): boolean {
  const idx = data.milestones.findIndex(m => m.id === milestoneId);
  if (idx === -1) return false;

  const [removed] = data.milestones.splice(idx, 1);

  // 从关联任务中移除
  for (const taskId of removed.taskIds) {
    const task = data.tasks.find(t => t.id === taskId);
    if (task && task.milestoneIds) {
      task.milestoneIds = task.milestoneIds.filter(id => id !== milestoneId);
    }
  }

  addLogEntry(data, "delete_milestone", `Deleted milestone "${removed.version}"`);
  save(data);
  return true;
}

export function getMilestoneProgress(milestone: Milestone): { completed: number; target?: number; percentage?: number } {
  const completed = milestone.taskIds.length;
  if (milestone.targetTasks && milestone.targetTasks > 0) {
    return {
      completed,
      target: milestone.targetTasks,
      percentage: Math.min(100, (completed / milestone.targetTasks) * 100),
    };
  }
  return { completed };
}

// ── Query ──

export function getBoard(data: KanbanData) {
  const today = getTodayDate();
  const todayReport = data.reports.find(r => r.date === today);
  const todayTaskIds = new Set(todayReport?.taskIds || []);

  return {
    todo: data.tasks.filter(t => t.status === "pending"),
    doing: data.tasks.filter(t => t.status === "in_progress"),
    done: data.tasks.filter(t => t.status === "completed"),
    todayCompleted: data.tasks.filter(t => t.status === "completed" && t.completedDate === today),
    reports: getDailyReports(data),
    milestones: data.milestones,
  };
}

export function getCompletionStats(data: KanbanData): CompletionStats {
  const today = getTodayDate();
  const completedTasks = data.tasks.filter(t => t.status === "completed");
  const todayCompleted = completedTasks.filter(t => t.completedDate === today);

  // 统计里程碑关联
  const milestoneTaskIds = new Set(data.milestones.flatMap(m => m.taskIds));
  const archivedTasks = completedTasks.filter(t => milestoneTaskIds.has(t.id));

  // 按里程碑统计
  const byMilestone: Record<string, number> = {};
  for (const m of data.milestones) {
    byMilestone[m.version] = m.taskIds.length;
  }

  // 按标签统计
  const byTag: Record<string, number> = {};
  for (const t of completedTasks) {
    for (const tag of t.tags) {
      if (!tag.startsWith("claude:")) {
        byTag[tag] = (byTag[tag] ?? 0) + 1;
      }
    }
  }

  return {
    totalCompleted: completedTasks.length,
    todayCompleted: todayCompleted.length,
    archivedCount: archivedTasks.length,
    unarchivedCount: completedTasks.length - archivedTasks.length,
    unarchivedTasks: completedTasks.filter(t => !milestoneTaskIds.has(t.id)).map(t => t.id),
    byMilestone,
    byTag,
  };
}

export function getTokenUsage(): TokenUsage | null {
  const statsPath = path.join(os.homedir(), ".claude", "stats-cache.json");
  try {
    if (!fs.existsSync(statsPath)) return null;
    const stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
    const usage = stats.modelUsage;
    if (!usage) return null;

    let totalInput = 0;
    let totalOutput = 0;
    for (const model of Object.values(usage) as Array<{ inputTokens?: number; outputTokens?: number }>) {
      totalInput += model.inputTokens ?? 0;
      totalOutput += model.outputTokens ?? 0;
    }
    return { input: totalInput, output: totalOutput, total: totalInput + totalOutput };
  } catch {
    return null;
  }
}

export function getStatusSummary(data: KanbanData) {
  const board = getBoard(data);
  const stats = getCompletionStats(data);
  const tokens = getTokenUsage();
  const archiveCheck = checkDailyArchive(data);

  return {
    counts: {
      todo: board.todo.length,
      doing: board.doing.length,
      done: board.done.length,
      todayCompleted: stats.todayCompleted,
      milestones: data.milestones.length,
      totalCompleted: stats.totalCompleted,
    },
    tokens,
    tasks: data.tasks,
    reports: data.reports,
    milestones: data.milestones,
    sessions: data.sessions,
    recentLog: data.log.slice(0, 10),
    archiveCheck,
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
