import {
  KanbanData,
  KanbanTask,
  KanbanVersion,
  SessionInfo,
  getBoard,
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

function renderCard(task: KanbanTask, currentSession?: string): string {
  const pColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium;
  const tags = task.tags
    .map((t) => `<span class="kb-tag">${esc(t)}</span>`)
    .join("");
  const sColor = task.session ? sessionColor(task.session) : "#555";
  const sLabel = task.session
    ? `<span class="kb-session-badge" style="color:${sColor}"><span class="kb-session-dot" style="background:${sColor}"></span>${esc(task.session)}${task.session === currentSession ? " (this)" : ""}</span>`
    : "";
  return `
    <div class="kb-card" data-id="${esc(task.id)}">
      <div class="kb-card-priority" style="background:${pColor}"></div>
      <div class="kb-card-body">
        <div class="kb-card-title">${esc(task.title)}</div>
        ${task.description ? `<div class="kb-card-desc">${esc(task.description)}</div>` : ""}
        <div class="kb-card-meta">
          <span class="kb-priority-badge" style="color:${pColor}">${task.priority.toUpperCase()}</span>
          ${tags ? `<span class="kb-tags">${tags}</span>` : ""}
          ${sLabel}
        </div>
        <div class="kb-card-id">${esc(task.id)}</div>
      </div>
    </div>`;
}

function renderVersionCard(
  version: KanbanVersion,
  allTasks: KanbanTask[],
): string {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const taskList = version.taskIds
    .map((id) => {
      const t = taskMap.get(id);
      return t ? `<li>${esc(t.title)}</li>` : "";
    })
    .filter(Boolean)
    .join("");
  return `
    <div class="kb-card kb-version-card">
      <div class="kb-card-priority" style="background:#7c6fe0"></div>
      <div class="kb-card-body">
        <div class="kb-card-title">${esc(version.name)}</div>
        ${version.description ? `<div class="kb-card-desc">${esc(version.description)}</div>` : ""}
        <div class="kb-version-count">${version.taskIds.length} task${version.taskIds.length === 1 ? "" : "s"}</div>
        ${taskList ? `<ul class="kb-version-tasks">${taskList}</ul>` : ""}
        <div class="kb-card-id">${esc(version.id)}</div>
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

// ── Main Renderer ──

export function renderKanbanHTML(data: KanbanData, currentSession?: string): string {
  const board = getBoard(data);

  const todoCards = board.todo.map((t) => renderCard(t, currentSession)).join("");
  const doingCards = board.doing.map((t) => renderCard(t, currentSession)).join("");
  const doneCards = board.done.map((t) => renderCard(t, currentSession)).join("");
  const versionCards = board.versions
    .map((v) => renderVersionCard(v, data.tasks))
    .join("");

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
</style>

<div class="kb-header">
  <div class="kb-title"><span>Kanban</span> Task Monitor</div>
  <div class="kb-stats">
    <span>TODO <strong>${board.todo.length}</strong></span>
    <span>DOING <strong>${board.doing.length}</strong></span>
    <span>DONE <strong>${board.done.length}</strong></span>
    <span>VER <strong>${board.versions.length}</strong></span>
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
      <span class="kb-column-count">${board.done.length}</span>
    </div>
    ${doneCards || '<div class="kb-empty">No tasks</div>'}
  </div>

  <div class="kb-column kb-col-version">
    <div class="kb-column-header">
      <span class="kb-column-title">Versions</span>
      <span class="kb-column-count">${board.versions.length}</span>
    </div>
    ${versionCards || '<div class="kb-empty">No versions</div>'}
  </div>
</div>`;
}
