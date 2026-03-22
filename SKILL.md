---
name: kanban
description: Open and manage the Kanban task-monitor board
user-invocable: true
---

# /kanban — Kanban Task Monitor

You have access to the following MCP tools from the `generative-ui` server for managing a visual Kanban board:

| Tool | Purpose |
|------|---------|
| `kanban_show` | Open or refresh the Kanban board widget |
| `kanban_add_task` | Add a new task (title, description, priority, tags) |
| `kanban_move_task` | Move a task between columns (pending / in_progress / completed) |
| `kanban_add_version` | Create a version milestone from completed tasks |
| `kanban_get_status` | Get a JSON summary of the board state |
| `kanban_heartbeat` | Send heartbeat to keep this session visible on the board |

## Cross-Session Monitoring

The Kanban board supports **multi-session monitoring**. Each Claude Code window that uses the kanban tools is automatically assigned a unique session ID. Tasks show which session created them. The board auto-refreshes when any session modifies the data (via file watching).

- Sessions appear in the "Active Sessions" panel at the top of the board
- Tasks display a colored session badge indicating their source
- Stale sessions (inactive >5min) are automatically cleaned up
- Call `kanban_heartbeat` periodically to keep a session visible

## Behavior

1. **First**, call `kanban_show` to open the board so the user can see it.
2. Then perform any requested operations (add, move, version, status).
3. The board auto-refreshes after each mutation — no need to call `kanban_show` again.

## Examples

**User says:** "/kanban"
→ Call `kanban_show` to display the board.

**User says:** "/kanban add Fix login bug, high priority, tag:auth"
→ Call `kanban_add_task` with title="Fix login bug", priority="high", tags=["auth"], then confirm.

**User says:** "/kanban move abc123 to doing"
→ Call `kanban_move_task` with task_id="abc123", status="in_progress".

**User says:** "/kanban version v1.0"
→ Call `kanban_add_version` with name="v1.0".

**User says:** "/kanban status"
→ Call `kanban_get_status` and present the summary.
