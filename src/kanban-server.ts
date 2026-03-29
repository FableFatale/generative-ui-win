#!/usr/bin/env node
/**
 * kanban-server.ts
 * 持久运行的 Kanban HTTP Server。
 * CLI 通过 HTTP API 发送命令，server 管理看板数据和浏览器窗口。
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { WindowManager } from "./window-manager";
import * as store from "./kanban-store";
import { renderKanbanHTML } from "./kanban-renderer";

const DATA_DIR = path.join(os.homedir(), ".generative-ui-win");
const PID_FILE = path.join(DATA_DIR, "kanban-server.pid");
const PORT_FILE = path.join(DATA_DIR, "kanban-server.port");
const DEFAULT_PORT = 18700;
const REFRESH_INTERVAL = 5000; // 5秒自动刷新

let manager: WindowManager | null = null;
let currentHandle: any = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// 更新看板内容
async function refreshBoard() {
  if (!manager || !currentHandle || currentHandle.isClosed) {
    manager = new WindowManager({ mode: "browser" });
    const data = store.load();
    const html = renderKanbanHTML(data);
    currentHandle = await manager.open({
      html,
      title: "Kanban Board",
      width: 1200,
      height: 800,
    });
    // 启动自动刷新定时器
    startAutoRefresh();
    // 执行脚本
    currentHandle.runScripts();
    return { opened: true, widgetId: currentHandle.id };
  } else {
    const data = store.load();
    const html = renderKanbanHTML(data);
    currentHandle.setContent(html);
    currentHandle.runScripts();
    return { updated: true };
  }
}

// 自动刷新 Token 和看板
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    try {
      if (currentHandle && !currentHandle.isClosed) {
        const data = store.load();
        const html = renderKanbanHTML(data);
        currentHandle.setContent(html);
      }
    } catch (err) {
      console.error("Auto refresh error:", err);
    }
  }, REFRESH_INTERVAL);
}

// HTTP 请求处理
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost`);
  const pathname = url.pathname;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // 根路径直接显示看板
    if (pathname === "/" || pathname === "/index.html") {
      const data = store.load();
      const html = renderKanbanHTML(data);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // API 路由
    if (pathname === "/api/status") {
      const data = store.load();
      const summary = store.getStatusSummary(data);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(summary));
      return;
    }

    if (pathname === "/api/show") {
      const result = await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, ...result }));
      return;
    }

    if (pathname === "/api/add" && req.method === "POST") {
      const body = await readBody(req);
      const { title, priority = "medium", tags = [] } = JSON.parse(body);
      if (!title) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "title required" }));
        return;
      }
      const data = store.load();
      const task = store.addTask(data, title, "", priority, tags);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, task }));
      return;
    }

    if (pathname === "/api/move" && req.method === "POST") {
      const body = await readBody(req);
      const { taskId, status } = JSON.parse(body);
      if (!taskId || !status) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "taskId and status required" }));
        return;
      }
      const statusMap: Record<string, store.TaskStatus> = {
        pending: "pending",
        todo: "pending",
        doing: "in_progress",
        done: "completed",
      };
      const newStatus = statusMap[status];
      if (!newStatus) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid status" }));
        return;
      }
      const data = store.load();
      const result = store.moveTask(data, taskId, newStatus);
      if (!result) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "task not found" }));
        return;
      }
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, task: result }));
      return;
    }

    if (pathname === "/api/archive-all" && req.method === "POST") {
      // 已废弃：新的日报系统会自动归档
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Use daily report system instead" }));
      return;
    }

    if (pathname === "/api/milestone" && req.method === "POST") {
      const body = await readBody(req);
      const { name, version, description, targetTasks } = JSON.parse(body);
      if (!name || !version) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "name and version required" }));
        return;
      }
      const data = store.load();
      const milestone = store.createMilestone(data, name, version, description, targetTasks);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, milestone }));
      return;
    }

    if (pathname === "/api/milestone/add-task" && req.method === "POST") {
      const body = await readBody(req);
      const { taskId, milestoneId } = JSON.parse(body);
      if (!taskId || !milestoneId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "taskId and milestoneId required" }));
        return;
      }
      const data = store.load();
      const result = store.addTaskToMilestone(data, taskId, milestoneId);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: result }));
      return;
    }

    if (pathname === "/api/report/summary" && req.method === "POST") {
      const body = await readBody(req);
      const { date, summary } = JSON.parse(body);
      if (!date) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "date required" }));
        return;
      }
      const data = store.load();
      const result = store.updateReportSummary(data, date, summary || "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: result }));
      return;
    }

    if (pathname === "/api/milestone/status" && req.method === "POST") {
      const body = await readBody(req);
      const { milestoneId, status } = JSON.parse(body);
      if (!milestoneId || !status) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "milestoneId and status required" }));
        return;
      }
      const data = store.load();
      const result = store.updateMilestoneStatus(data, milestoneId, status);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: !!result, milestone: result }));
      return;
    }

    if (pathname === "/api/milestone/target" && req.method === "POST") {
      const body = await readBody(req);
      const { milestoneId, targetTasks } = JSON.parse(body);
      if (!milestoneId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "milestoneId required" }));
        return;
      }
      const data = store.load();
      const milestone = data.milestones.find(m => m.id === milestoneId);
      if (!milestone) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "milestone not found" }));
        return;
      }
      milestone.targetTasks = targetTasks;
      store.save(data);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, milestone }));
      return;
    }

    if (pathname === "/api/reload") {
      // 强制关闭窗口并重新打开，以加载新的 shell HTML
      if (currentHandle) currentHandle.close();
      currentHandle = null;
      const result = await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, ...result }));
      return;
    }

    // 修正里程碑版本号：v0.x -> v1.x
    if (pathname === "/api/fix-versions" && req.method === "POST") {
      const data = store.load();
      for (const m of data.milestones) {
        if (m.version.startsWith("v0.")) {
          m.version = "v1." + m.version.slice(3);
        }
      }
      store.save(data);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, milestones: data.milestones }));
      return;
    }

    // 修复历史日报：为已完成任务按 completedDate 分组生成历史日报
    if (pathname === "/api/fix-reports" && req.method === "POST") {
      const data = store.load();
      const today = new Date().toISOString().split("T")[0];
      const { generateId } = require("./utils");

      // 收集所有已完成任务的 completedDate
      const completedByDate: Record<string, string[]> = {};
      for (const t of data.tasks) {
        if (t.status === "completed" && t.completedDate) {
          if (!completedByDate[t.completedDate]) {
            completedByDate[t.completedDate] = [];
          }
          completedByDate[t.completedDate].push(t.id);
        }
      }

      // 为每个日期创建或更新日报
      for (const [date, taskIds] of Object.entries(completedByDate)) {
        let report = data.reports.find(r => r.date === date);
        if (!report) {
          report = {
            id: generateId(),
            date,
            taskIds: [],
            isArchived: date !== today,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          data.reports.push(report);
        }
        // 合并任务（避免重复）
        for (const taskId of taskIds) {
          if (!report.taskIds.includes(taskId)) {
            report.taskIds.push(taskId);
          }
        }
        // 设置归档状态
        report.isArchived = date !== today;
        report.updatedAt = new Date().toISOString();
      }

      // 按日期排序
      data.reports.sort((a, b) => b.date.localeCompare(a.date));

      store.save(data);
      await refreshBoard();
      const stats = { dates: Object.keys(completedByDate).length, tasks: Object.values(completedByDate).flat().length };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, reports: data.reports.map(r => ({ date: r.date, tasks: r.taskIds.length, isArchived: r.isArchived })), stats }));
      return;
    }

    // 修复历史日报：为已完成任务按 completedDate 分组生成历史日报
    if (pathname === "/api/fix-reports" && req.method === "POST") {
      const data = store.load();
      const today = new Date().toISOString().split("T")[0];

      // 收集所有已完成任务的 completedDate
      const completedByDate: Record<string, string[]> = {};
      for (const t of data.tasks) {
        if (t.status === "completed" && t.completedDate) {
          if (!completedByDate[t.completedDate]) {
            completedByDate[t.completedDate] = [];
          }
          completedByDate[t.completedDate].push(t.id);
        }
      }

      // 为每个日期创建或更新日报
      for (const [date, taskIds] of Object.entries(completedByDate)) {
        let report = data.reports.find(r => r.date === date);
        if (!report) {
          report = {
            id: require("./utils").generateId(),
            date,
            taskIds: [],
            isArchived: date !== today,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          data.reports.push(report);
        }
        // 合合任务（避免重复）
        for (const taskId of taskIds) {
          if (!report.taskIds.includes(taskId)) {
            report.taskIds.push(taskId);
          }
        }
        // 设置归档状态
        report.isArchived = date !== today;
        report.updatedAt = new Date().toISOString();
      }

      // 按日期排序
      data.reports.sort((a, b) => b.date.localeCompare(a.date));

      store.save(data);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, reports: data.reports, stats: { dates: Object.keys(completedByDate).length, tasks: Object.values(completedByDate).flat().length } }));
      return;
    }

    // 批量设置里程碑任务
    if (pathname === "/api/milestone/set-tasks" && req.method === "POST") {
      const body = await readBody(req);
      const { milestoneId, taskIds } = JSON.parse(body);
      if (!milestoneId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "milestoneId required" }));
        return;
      }
      const data = store.load();
      const milestone = data.milestones.find(m => m.id === milestoneId);
      if (!milestone) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "milestone not found" }));
        return;
      }
      // 更新里程碑的任务列表
      milestone.taskIds = taskIds || [];
      milestone.updatedAt = new Date().toISOString();
      // 更新任务的 milestoneIds
      for (const t of data.tasks) {
        if (!t.milestoneIds) t.milestoneIds = [];
        const idx = t.milestoneIds.indexOf(milestoneId);
        if (taskIds && taskIds.includes(t.id)) {
          if (idx === -1) t.milestoneIds.push(milestoneId);
        } else {
          if (idx >= 0) t.milestoneIds.splice(idx, 1);
        }
      }
      store.save(data);
      await refreshBoard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, milestone }));
      return;
    }

    if (pathname === "/api/shutdown") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "shutting down" }));
      if (currentHandle) currentHandle.close();
      if (manager) await manager.closeAll();
      fs.unlinkSync(PID_FILE);
      fs.unlinkSync(PORT_FILE);
      process.exit(0);
      return;
    }

    // 未知路由
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err) {
    console.error("Error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal error" }));
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function getRunningServer(): { pid: number; port: number } | null {
  try {
    if (fs.existsSync(PID_FILE) && fs.existsSync(PORT_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
      const port = parseInt(fs.readFileSync(PORT_FILE, "utf-8"), 10);
      // 检查进程是否还在运行
      try {
        process.kill(pid, 0); // 信号 0 只是检查进程是否存在
        return { pid, port };
      } catch {
        // 进程不存在，清理文件
        fs.unlinkSync(PID_FILE);
        fs.unlinkSync(PORT_FILE);
      }
    }
  } catch {}
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "start";

  // 检查已有 server
  const existing = getRunningServer();

  if (cmd === "stop") {
    if (existing) {
      try {
        process.kill(existing.pid, "SIGTERM");
        fs.unlinkSync(PID_FILE);
        fs.unlinkSync(PORT_FILE);
        console.log(`Stopped server (pid: ${existing.pid})`);
      } catch {
        console.log("Server already stopped");
      }
    } else {
      console.log("No running server");
    }
    return;
  }

  if (cmd === "status") {
    if (existing) {
      console.log(`Server running on port ${existing.port} (pid: ${existing.pid})`);
    } else {
      console.log("No running server");
    }
    return;
  }

  // start 命令
  if (existing) {
    console.log(`Server already running on port ${existing.port} (pid: ${existing.pid})`);
    console.log(`Use: node dist/src/kanban-cli.js <command>`);
    return;
  }

  // 启动新 server
  const port = DEFAULT_PORT;
  const server = http.createServer(handleRequest);

  // 初始化目录
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 写入 PID 和端口
  fs.writeFileSync(PID_FILE, String(process.pid));
  fs.writeFileSync(PORT_FILE, String(port));

  server.listen(port, () => {
    console.log(`Kanban server started on port ${port} (pid: ${process.pid})`);
    console.log(`API endpoints:`);
    console.log(`  GET  /api/status   - get board status`);
    console.log(`  GET  /api/show     - open/refresh board`);
    console.log(`  POST /api/add      - add task`);
    console.log(`  POST /api/move     - move task`);
    console.log(`  GET  /api/shutdown - stop server`);
  });

  // 初始打开看板
  refreshBoard().catch(console.error);

  // 优雅关闭
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    if (currentHandle) currentHandle.close();
    if (manager) await manager.closeAll();
    fs.unlinkSync(PID_FILE);
    fs.unlinkSync(PORT_FILE);
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    if (currentHandle) currentHandle.close();
    if (manager) await manager.closeAll();
    fs.unlinkSync(PID_FILE);
    fs.unlinkSync(PORT_FILE);
    process.exit(0);
  });
}

main().catch(console.error);