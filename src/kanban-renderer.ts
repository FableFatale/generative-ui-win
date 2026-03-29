import {
  KanbanData,
  KanbanTask,
  Milestone,
  DailyReport,
  SessionInfo,
  CompletionStats,
  getBoard,
  getCompletionStats,
  getTokenUsage,
  checkDailyArchive,
} from "./kanban-store";

// ── Helpers ──

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ff6b6b",
  medium: "#ffa94d",
  low: "#6bcb77",
};

const SESSION_PALETTE = [
  "#7c6fe0", "#4ecdc4", "#ff6b6b", "#ffa94d", "#6bcb77",
  "#e06f9f", "#6fa8e0", "#e0c46f", "#9f6fe0", "#e08f6f",
];

function sessionColor(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return SESSION_PALETTE[Math.abs(hash) % SESSION_PALETTE.length];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "TODO",
  in_progress: "DOING",
  completed: "DONE",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard(task: KanbanTask, currentSession?: string, currentLabel?: string): string {
  const pColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium;
  const tags = task.tags
    .map((t) => `<span class="kb-tag">${esc(t)}</span>`)
    .join("");
  const sColor = task.session ? sessionColor(task.session) : "#555";
  const sLabel = task.session
    ? `<span class="kb-session-badge" style="color:${sColor}"><span class="kb-session-dot" style="background:${sColor}"></span>${esc(task.session)}${task.session === currentLabel ? " (this)" : ""}</span>`
    : "";
  const claimColor = task.claimedBy ? sessionColor(task.claimedBy) : "";
  const claimLabel = task.claimedBy
    ? `<span class="kb-claimed-badge" style="border-color:${claimColor}"><span class="kb-session-dot" style="background:${claimColor}"></span>${esc(task.claimedBy)}${task.claimedBy === currentLabel ? " (this)" : ""}</span>`
    : "";
  const unclaimedClass = (task.status === "pending" && !task.claimedBy) ? " kb-unclaimed" : "";
  return `
    <div class="kb-card${unclaimedClass}" data-id="${esc(task.id)}">
      <div class="kb-card-priority" style="background:${pColor}"></div>
      <div class="kb-card-body">
        <div class="kb-card-title">${esc(task.title)}</div>
        ${task.description ? `<div class="kb-card-desc">${esc(task.description)}</div>` : ""}
        <div class="kb-card-meta">
          <span class="kb-priority-badge" style="color:${pColor}">${task.priority.toUpperCase()}</span>
          ${tags ? `<span class="kb-tags">${tags}</span>` : ""}
          ${sLabel}
          ${claimLabel}
        </div>
        <div class="kb-card-id">${esc(task.id)}</div>
      </div>
    </div>`;
}

function renderMilestoneCard(
  milestone: Milestone,
  allTasks: KanbanTask[],
): string {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const progress = milestone.taskIds.length;
  const target = milestone.targetTasks;

  const progressHtml = target
    ? `<div class="kb-progress-bar"><div class="kb-progress-fill" style="width:${Math.min(100, (progress / target) * 100)}%"></div></div><div class="kb-progress-text">${progress}/${target} tasks</div>`
    : `<div class="kb-progress-text">${progress} tasks</div>`;

  const statusColor = milestone.status === "released" ? "#6bcb77" : milestone.status === "in_progress" ? "#4ecdc4" : "#ffa94d";

  const taskList = milestone.taskIds.slice(0, 5).map(id => {
    const t = taskMap.get(id);
    return t ? `<li><span class="kb-task-date">${t.completedDate || ""}</span> ${esc(t.title)}</li>` : "";
  }).join("");

  // 状态切换按钮
  const statusOptions = ["planning", "in_progress", "released"];
  const statusButtons = statusOptions.map(s => {
    const isActive = milestone.status === s;
    const color = s === "released" ? "#6bcb77" : s === "in_progress" ? "#4ecdc4" : "#ffa94d";
    const label = s === "planning" ? "Planning" : s === "in_progress" ? "In Progress" : "Released";
    return `<button class="kb-status-btn${isActive ? ' kb-status-active' : ''}" data-milestone="${milestone.id}" data-status="${s}" style="background:${isActive ? color : 'transparent'};border-color:${color};color:${isActive ? '#1a1a1a' : color}">${label}</button>`;
  }).join("");

  // 打标按钮 - 所有里程碑都可添加任务
  const tagBtn = `<button class="kb-tag-btn" data-milestone="${milestone.id}">+ 添加任务</button>`;

  return `
    <div class="kb-card kb-milestone-card" data-milestone-id="${milestone.id}">
      <div class="kb-card-priority" style="background:${statusColor}"></div>
      <div class="kb-card-body">
        <div class="kb-milestone-header">
          <span class="kb-milestone-version">${esc(milestone.version)}</span>
        </div>
        <div class="kb-milestone-status-bar">${statusButtons}</div>
        <div class="kb-card-title">${esc(milestone.name)}</div>
        ${milestone.description ? `<div class="kb-card-desc">${esc(milestone.description)}</div>` : ""}
        ${progressHtml}
        ${taskList ? `<ul class="kb-milestone-tasks">${taskList}</ul>` : ""}
        ${tagBtn}
        <div class="kb-card-id">${esc(milestone.id)}</div>
      </div>
      <div class="kb-tag-panel" id="tag-panel-${milestone.id}" style="display:none">
        <div class="kb-tag-panel-header">
          <span>勾选已完成任务</span>
          <button class="kb-tag-close" data-milestone="${milestone.id}">✕</button>
        </div>
        <div class="kb-tag-task-list" id="tag-tasks-${milestone.id}"></div>
        <button class="kb-tag-save" data-milestone="${milestone.id}" onclick="saveMilestoneTasks('${milestone.id}')">保存</button>
      </div>
    </div>`;
}

// 渲染日报卡片
function renderDailyReportCard(
  report: DailyReport,
  allTasks: KanbanTask[],
  isToday: boolean,
): string {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const tasks = report.taskIds.map(id => taskMap.get(id)).filter(Boolean) as KanbanTask[];

  const headerLabel = isToday ? `${report.date}（今天）` : report.date;
  // 所有日报默认折叠
  const expandClass = "";

  const taskListHtml = tasks.map(t => `
    <li class="kb-report-task">
      <span class="kb-task-check">✅</span>
      <span class="kb-task-title">${esc(t.title)}</span>
    </li>
  `).join("");

  const summaryHtml = isToday
    ? `<input type="text" class="kb-summary-input" placeholder="写一句总结..." data-date="${report.date}" value="${esc(report.summary || '')}" data-preserve="true">`
    : report.summary
      ? `<div class="kb-report-summary">${esc(report.summary)}</div>`
      : "";

  return `
    <div class="kb-report-card ${expandClass}" data-date="${report.date}">
      <div class="kb-report-header">
        <span class="kb-report-icon">▶</span>
        <span class="kb-report-date">${esc(headerLabel)}</span>
        <span class="kb-report-count">${tasks.length} tasks</span>
      </div>
      <div class="kb-report-body">
        ${summaryHtml}
        <ul class="kb-report-tasks">${taskListHtml}</ul>
      </div>
    </div>`;
}

// 折叠卡片：显示里程碑概览（纯 CSS 实现）
function renderMilestoneFold(stats: CompletionStats): string {
  const milestoneList = Object.entries(stats.byMilestone)
    .map(([version, count]) => `<span class="kb-fold-version">${esc(version)}: ${count}</span>`)
    .join("");

  if (stats.archivedCount === 0) return "";

  return `
    <div class="kb-archived-container">
      <input type="checkbox" id="kb-archived-toggle" class="kb-fold-checkbox">
      <label for="kb-archived-toggle" class="kb-archived-fold">
        <div class="kb-fold-header">
          <span class="kb-fold-icon">▶</span>
          <span class="kb-fold-title">Milestones (${stats.archivedCount})</span>
        </div>
      </label>
      <div class="kb-fold-body">
        ${milestoneList}
      </div>
    </div>`;
}

// ── Session Panel ──

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function renderSessionPanel(sessions: SessionInfo[], currentSession?: string): string {
  if (sessions.length === 0) {
    return `<div class="kb-sessions"><div class="kb-sessions-header">Active Sessions <span class="kb-column-count">0</span></div><div class="kb-empty">No active sessions</div></div>`;
  }
  const items = sessions.map((s) => {
    const color = sessionColor(s.id);
    const isSelf = s.id === currentSession;
    return `<div class="kb-session-item${isSelf ? " kb-session-self" : ""}">
      <span class="kb-session-dot" style="background:${color}"></span>
      <span class="kb-session-label">${esc(s.label)}${isSelf ? " (this)" : ""}</span>
      <span class="kb-session-time">${timeAgo(s.lastSeen)}</span>
    </div>`;
  }).join("");
  return `<div class="kb-sessions">
    <div class="kb-sessions-header">Active Sessions <span class="kb-column-count">${sessions.length}</span></div>
    ${items}
  </div>`;
}

// 总结弹窗组件
function renderSummaryModal(report: DailyReport, tasks: KanbanTask[]): string {
  const taskList = report.taskIds.map(id => {
    const t = tasks.find(task => task.id === id);
    return t ? `<li>✅ ${esc(t.title)}</li>` : "";
  }).join("");

  return `
  <div class="kb-modal-overlay" id="summary-modal">
    <div class="kb-modal">
      <div class="kb-modal-header">
        <span class="kb-modal-title">📝 为昨天写一句总结？</span>
        <span class="kb-modal-date">${report.date}</span>
      </div>
      <div class="kb-modal-body">
        <ul class="kb-modal-tasks">${taskList}</ul>
        <textarea class="kb-modal-input" id="summary-input" placeholder="昨天做了什么？有什么进展？"></textarea>
      </div>
      <div class="kb-modal-footer">
        <button class="kb-modal-btn kb-btn-skip" onclick="document.getElementById('summary-modal').style.display='none'">跳过</button>
        <button class="kb-modal-btn kb-btn-save" onclick="saveSummary('${report.date}')">保存</button>
      </div>
    </div>
  </div>
  <script>
    function saveSummary(date) {
      var input = document.getElementById('summary-input');
      var summary = input ? input.value : '';
      fetch('http://127.0.0.1:18700/api/report/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date, summary: summary })
      }).then(function() {
        document.getElementById('summary-modal').style.display = 'none';
        location.reload();
      });
    }
  </script>`;
}

// ── Main Renderer ──

export function renderKanbanHTML(data: KanbanData, currentSession?: string, currentLabel?: string): string {
  const board = getBoard(data);
  const stats = getCompletionStats(data);
  const tokens = getTokenUsage();

  const today = new Date().toISOString().split("T")[0];

  // 检查是否需要提示总结
  const archiveCheck = checkDailyArchive(data);
  const summaryModal = (archiveCheck.archived && archiveCheck.promptSummary && archiveCheck.report)
    ? renderSummaryModal(archiveCheck.report, data.tasks)
    : "";

  const todoCards = board.todo.map((t) => renderCard(t, currentSession, currentLabel)).join("");
  const doingCards = board.doing.map((t) => renderCard(t, currentSession, currentLabel)).join("");

  // Done 列：显示今日完成的任务
  const todayTasks = board.todayCompleted;
  const todayCards = todayTasks.map(t => renderCard(t, currentSession, currentLabel)).join("");

  // 日报卡片
  const reportCards = board.reports
    .map(r => renderDailyReportCard(r, data.tasks, r.date === today))
    .join("");

  // 里程碑卡片 - 按版本号倒序
  const milestoneCards = board.milestones
    .slice()
    .sort((a, b) => b.version.localeCompare(a.version))
    .map(m => renderMilestoneCard(m, data.tasks))
    .join("");

  const tokensDisplay = tokens
    ? `${tokens.total.toLocaleString()}`
    : "N/A";

  return `
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'SF Pro Display','Segoe UI',system-ui,sans-serif; background: #1a1a1a; color: #e0e0e0; }
  .kb-board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 24px;
    min-height: 100vh;
    align-content: start;
  }
  .kb-column {
    background: #212121;
    border-radius: 12px;
    padding: 16px;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .kb-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 2px solid #333;
    margin-bottom: 4px;
  }
  .kb-column-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #aaa;
  }
  .kb-column-count {
    background: #333;
    color: #ccc;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .kb-col-todo .kb-column-header { border-color: #ffa94d; }
  .kb-col-doing .kb-column-header { border-color: #4ecdc4; }
  .kb-col-done .kb-column-header { border-color: #6bcb77; }
  .kb-col-version .kb-column-header { border-color: #7c6fe0; }

  .kb-card {
    background: #2a2a2a;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .kb-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  .kb-card-priority {
    width: 4px;
    flex-shrink: 0;
  }
  .kb-card-body {
    padding: 12px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .kb-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
    line-height: 1.3;
  }
  .kb-card-desc {
    font-size: 12px;
    color: #999;
    line-height: 1.4;
  }
  .kb-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .kb-priority-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .kb-tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .kb-tag {
    background: #363636;
    color: #bbb;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .kb-card-id {
    font-size: 10px;
    color: #555;
    font-family: monospace;
    margin-top: 2px;
  }

  .kb-version-card { border: 1px solid #7c6fe033; }
  .kb-version-count {
    font-size: 11px;
    color: #7c6fe0;
    font-weight: 600;
  }
  .kb-version-tasks {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .kb-version-tasks li {
    font-size: 11px;
    color: #888;
    padding: 2px 0;
    border-bottom: 1px solid #333;
  }
  .kb-version-tasks li:last-child { border-bottom: none; }

  .kb-empty {
    font-size: 12px;
    color: #555;
    text-align: center;
    padding: 20px 0;
    font-style: italic;
  }

  .kb-header {
    padding: 24px 24px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kb-title {
    font-size: 20px;
    font-weight: 700;
    color: #e0e0e0;
  }
  .kb-title span { color: #7c6fe0; }
  .kb-stats {
    font-size: 12px;
    color: #888;
    display: flex;
    gap: 16px;
  }
  .kb-stats strong { color: #ccc; }
  .kb-token-stat { color: #7c6fe0; }
  .kb-token-stat strong { color: #7c6fe0; font-weight: 700; }

  /* Summary Modal */
  .kb-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  .kb-modal {
    background: #2a2a2a;
    border-radius: 12px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .kb-modal-header {
    padding: 16px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kb-modal-title { font-size: 16px; font-weight: 600; color: #e0e0e0; }
  .kb-modal-date { font-size: 12px; color: #888; }
  .kb-modal-body { padding: 16px; }
  .kb-modal-tasks {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
    max-height: 150px;
    overflow-y: auto;
  }
  .kb-modal-tasks li { font-size: 12px; color: #aaa; padding: 4px 0; }
  .kb-modal-input {
    width: 100%;
    height: 80px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px;
    color: #e0e0e0;
    font-size: 14px;
    resize: none;
  }
  .kb-modal-input:focus { outline: none; border-color: #7c6fe0; }
  .kb-modal-footer {
    padding: 12px 16px;
    border-top: 1px solid #333;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .kb-modal-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .kb-btn-skip { background: #333; color: #888; }
  .kb-btn-skip:hover { background: #444; }
  .kb-btn-save { background: #7c6fe0; color: #fff; }
  .kb-btn-save:hover { background: #8b7fe8; }

  /* Session badges on cards */
  .kb-session-badge {
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .kb-session-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  /* Session panel */
  .kb-sessions {
    background: #212121;
    border-radius: 12px;
    padding: 12px 16px;
    margin: 0 24px 0;
  }
  .kb-sessions-header {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #aaa;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .kb-session-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    color: #bbb;
  }
  .kb-session-self { color: #e0e0e0; font-weight: 600; }
  .kb-session-label { flex: 1; }
  .kb-session-time { color: #666; font-size: 11px; }

  /* Claim badges on cards */
  .kb-claimed-badge {
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid;
    border-radius: 4px;
    padding: 1px 6px;
    background: rgba(255,255,255,0.05);
  }
  .kb-unclaimed {
    border-left: 2px dashed #555;
    opacity: 0.85;
  }

  /* Archived Fold Card - Pure CSS */
  .kb-archived-container {
    margin-bottom: 12px;
  }
  .kb-fold-checkbox {
    display: none;
  }
  .kb-archived-fold {
    display: block;
    background: #2a2a2a;
    border-radius: 8px;
    border: 1px solid #3a3a3a;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .kb-archived-fold:hover {
    background: #333;
    border-color: #4a4a4a;
  }
  .kb-fold-header {
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #888;
    font-size: 13px;
    font-weight: 600;
  }
  .kb-fold-icon {
    font-size: 12px;
    transition: transform 0.2s;
    color: #6bcb77;
  }
  .kb-fold-title {
    color: #6bcb77;
  }
  .kb-fold-body {
    display: none;
    padding: 12px;
    border-top: 1px solid #3a3a3a;
    flex-wrap: wrap;
    gap: 6px;
    background: #252525;
    border-radius: 0 0 8px 8px;
  }
  .kb-fold-checkbox:checked + .kb-archived-fold {
    background: #333;
    border-color: #4a4a4a;
  }
  .kb-fold-checkbox:checked + .kb-archived-fold .kb-fold-icon {
    transform: rotate(90deg);
  }
  .kb-fold-checkbox:checked + .kb-archived-fold + .kb-fold-body {
    display: flex;
  }
  .kb-fold-version {
    background: #363636;
    color: #7c6fe0;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 500;
  }

  /* Milestone Card */
  .kb-milestone-card { border-left: 3px solid #7c6fe0; position: relative; }
  .kb-milestone-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .kb-milestone-version {
    font-size: 12px;
    font-weight: 700;
    color: #7c6fe0;
  }
  .kb-milestone-status-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }
  .kb-status-btn {
    font-size: 10px;
    padding: 3px 8px;
    border: 1px solid;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }
  .kb-status-btn:hover { opacity: 0.8; }
  .kb-status-active { font-weight: 600; }
  .kb-tag-btn {
    font-size: 11px;
    padding: 4px 10px;
    background: transparent;
    border: 1px solid #7c6fe0;
    color: #7c6fe0;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 8px;
  }
  .kb-tag-btn:hover { background: #7c6fe0; color: #1a1a1a; }
  .kb-tag-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 320px;
    max-height: 80vh;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 16px;
    z-index: 1001;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .kb-tag-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
  }
  .kb-tag-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
  }
  .kb-tag-close {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
  }
  .kb-tag-close:hover { color: #ff6b6b; }
  .kb-tag-task-list {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 10px;
  }
  .kb-tag-task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    font-size: 12px;
    border-radius: 4px;
  }
  .kb-tag-task-item:hover { background: #333; }
  .kb-tag-checkbox {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  .kb-tag-save {
    width: 100%;
    padding: 8px;
    background: #7c6fe0;
    border: none;
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
  }
  .kb-tag-save:hover { background: #8b7ff0; }
  .kb-milestone-status {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .kb-progress-bar {
    height: 6px;
    background: #333;
    border-radius: 3px;
    overflow: hidden;
    margin: 8px 0 4px;
  }
  .kb-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c6fe0, #4ecdc4);
    border-radius: 3px;
    transition: width 0.3s;
  }
  .kb-progress-text {
    font-size: 11px;
    color: #888;
  }
  .kb-milestone-tasks {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    border-top: 1px solid #333;
    padding-top: 8px;
  }
  .kb-milestone-tasks li {
    font-size: 11px;
    color: #888;
    padding: 2px 0;
  }
  .kb-task-date {
    color: #555;
    font-size: 10px;
    margin-right: 6px;
  }

  /* Daily Report Card */
  .kb-report-card {
    background: #2a2a2a;
    border-radius: 8px;
    margin-top: 8px;
    overflow: hidden;
  }
  .kb-report-header {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    background: #252525;
    border-bottom: 1px solid #333;
  }
  .kb-report-header:hover { background: #2a2a2a; }
  .kb-report-icon { color: #6bcb77; font-size: 10px; }
  .kb-report-date { font-size: 12px; font-weight: 600; color: #e0e0e0; flex: 1; }
  .kb-report-count { font-size: 11px; color: #888; }
  .kb-report-body {
    display: none;
    padding: 10px 12px;
  }
  .kb-fold-expanded .kb-report-body { display: block; }
  .kb-fold-expanded .kb-report-icon { transform: rotate(90deg); }
  .kb-report-summary {
    font-size: 12px;
    color: #888;
    font-style: italic;
    margin-bottom: 8px;
    padding: 6px 8px;
    background: #1a1a1a;
    border-radius: 4px;
  }
  .kb-summary-placeholder {
    color: #555;
    cursor: text;
  }
  .kb-report-tasks {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .kb-report-task {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    color: #bbb;
  }
  .kb-task-check { color: #6bcb77; font-size: 12px; }
  .kb-summary-input {
    width: 100%;
    padding: 8px 10px;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .kb-summary-input:focus {
    outline: none;
    border-color: #7c6fe0;
  }
  .kb-summary-input::placeholder { color: #666; }
</style>

<script>
// 里程碑打标保存函数
function saveMilestoneTasks(milestoneId) {
  var checkboxes = document.querySelectorAll('.kb-tag-checkbox:checked');
  var taskIds = Array.from(checkboxes).map(function(cb) { return cb.getAttribute('data-task'); });
  fetch('http://127.0.0.1:18700/api/milestone/set-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ milestoneId: milestoneId, taskIds: taskIds })
  }).then(function(res) { return res.json(); })
  .then(function(data) {
    console.log('Tasks updated:', data);
    var panel = document.getElementById('tag-panel-' + milestoneId);
    if (panel) panel.style.display = 'none';
    var overlay = document.getElementById('tag-overlay');
    if (overlay) overlay.remove();
    location.reload();
  }).catch(function(err) {
    console.error('Task update failed:', err);
  });
}

// 点击事件委托
document.addEventListener('click', function(e) {
  var el = e.target;
  // 日报卡片展开/折叠
  if (el.closest && el.closest('.kb-report-header')) {
    var card = el.closest('.kb-report-card');
    if (card) {
      var icon = card.querySelector('.kb-report-icon');
      if (card.classList.contains('kb-fold-expanded')) {
        card.classList.remove('kb-fold-expanded');
        if (icon) icon.textContent = '▶';
      } else {
        card.classList.add('kb-fold-expanded');
        if (icon) icon.textContent = '▼';
      }
    }
  }
  // 状态按钮
  if (el.classList && el.classList.contains('kb-status-btn')) {
    var milestoneId = el.getAttribute('data-milestone');
    var status = el.getAttribute('data-status');
    if (milestoneId && status) {
      fetch('http://127.0.0.1:18700/api/milestone/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId: milestoneId, status: status })
      }).then(function() { location.reload(); });
    }
  }
  // 打标按钮
  if (el.classList && el.classList.contains('kb-tag-btn')) {
    var milestoneId = el.getAttribute('data-milestone');
    if (milestoneId) {
      var overlay = document.createElement('div');
      overlay.className = 'kb-tag-overlay';
      overlay.id = 'tag-overlay';
      document.body.appendChild(overlay);
      var panel = document.getElementById('tag-panel-' + milestoneId);
      if (panel) {
        panel.style.display = 'block';
        document.body.appendChild(panel);
        fetch('http://127.0.0.1:18700/api/status')
          .then(function(res) { return res.json(); })
          .then(function(data) {
            var tasks = data.tasks.filter(function(t) { return t.status === 'completed'; });
            var listHtml = tasks.slice(0, 30).map(function(t) {
              var checked = t.milestoneIds && t.milestoneIds.indexOf(milestoneId) >= 0;
              return '<div class="kb-tag-task-item"><input type="checkbox" class="kb-tag-checkbox" data-task="' + t.id + '"' + (checked ? ' checked' : '') + '><span>' + t.title + '</span></div>';
            }).join('');
            document.getElementById('tag-tasks-' + milestoneId).innerHTML = listHtml;
          });
      }
    }
  }
  // 关闭面板
  if (el.classList && el.classList.contains('kb-tag-close')) {
    var milestoneId = el.getAttribute('data-milestone');
    if (milestoneId) {
      document.getElementById('tag-panel-' + milestoneId).style.display = 'none';
      var overlay = document.getElementById('tag-overlay');
      if (overlay) overlay.remove();
    }
  }
  // 点击遮罩关闭
  if (el.id === 'tag-overlay') {
    el.remove();
    document.querySelectorAll('.kb-tag-panel').forEach(function(p) { p.style.display = 'none'; });
  }
});

// 日报总结输入
document.addEventListener('input', function(e) {
  var el = e.target;
  if (el.classList && el.classList.contains('kb-summary-input')) {
    var date = el.getAttribute('data-date');
    var summary = el.value;
    if (date) {
      fetch('http://127.0.0.1:18700/api/report/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date, summary: summary })
      });
    }
  }
});
</script>

${summaryModal}

<div class="kb-header">
  <div class="kb-title"><span>Kanban</span> Task Monitor</div>
  <div class="kb-stats">
    <span>TODO <strong>${board.todo.length}</strong></span>
    <span>DOING <strong>${board.doing.length}</strong></span>
    <span>DAY <strong>${stats.todayCompleted}</strong></span>
    <span>TOTAL <strong>${stats.totalCompleted}</strong></span>
    <span class="kb-token-stat">TOKENS <strong>${tokensDisplay}</strong></span>
    <span>SESSIONS <strong>${data.sessions.length}</strong></span>
  </div>
</div>

${renderSessionPanel(data.sessions, currentSession)}

<div class="kb-board">
  <div class="kb-column kb-col-todo">
    <div class="kb-column-header">
      <span class="kb-column-title">Todo</span>
      <span class="kb-column-count">${board.todo.length}</span>
    </div>
    ${todoCards || '<div class="kb-empty">No tasks</div>'}
  </div>

  <div class="kb-column kb-col-doing">
    <div class="kb-column-header">
      <span class="kb-column-title">Doing</span>
      <span class="kb-column-count">${board.doing.length}</span>
    </div>
    ${doingCards || '<div class="kb-empty">No tasks</div>'}
  </div>

  <div class="kb-column kb-col-done">
    <div class="kb-column-header">
      <span class="kb-column-title">Done</span>
      <span class="kb-column-count">${stats.totalCompleted}</span>
    </div>
    ${reportCards || '<div class="kb-empty">No completed tasks</div>'}
  </div>

  <div class="kb-column kb-col-version">
    <div class="kb-column-header">
      <span class="kb-column-title">Milestones</span>
      <span class="kb-column-count">${board.milestones.length}</span>
    </div>
    ${milestoneCards || '<div class="kb-empty">No milestones</div>'}
  </div>
</div>`;
}
