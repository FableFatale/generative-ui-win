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
| `kanban_claim_task` | Claim next available or specific task for this session |
| `kanban_batch_add` | Create multiple tasks at once (for dispatch) |
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

## Worker Mode: `/kanban claim`

When the user says `/kanban claim`, this session becomes a **worker**:

1. Call `kanban_show` to open the board for visibility.
2. Call `kanban_claim_task` (no task_id) to claim the next unclaimed pending task.
3. If no task is available, tell the user: "No unclaimed tasks available. All tasks have been claimed or completed."
4. If a task is claimed, tell the user what you are working on (title + description).
5. **Execute the task.** Use the description as your instructions. Write code, run tests, etc.
6. When finished, call `kanban_move_task` with status="completed".
7. Automatically call `kanban_claim_task` again to get the next task.
8. Repeat until no more tasks remain.
9. Tell the user: "All tasks completed."

**Key rules for worker mode:**
- Send `kanban_heartbeat` every 2-3 minutes to stay visible on the board.
- If you get stuck on a task, tell the user rather than silently blocking.
- One task at a time. Finish or unclaim before taking another.

**User says:** "/kanban claim"
→ Call `kanban_show`, then `kanban_claim_task`, then start working.

**User says:** "/kanban claim abc123"
→ Call `kanban_claim_task` with task_id="abc123" to claim a specific task.

## Parsing user arguments

The user may pass arguments after `/kanban`. Parse them as follows:

- No args → call `kanban_show`
- `add <title>` → call `kanban_add_task`. Look for keywords like "high"/"low" for priority, "tag:xxx" for tags
- `move <task_id> to <pending|doing|done>` → call `kanban_move_task` (map "doing" → "in_progress", "todo" → "pending", "done" → "completed")
- `claim` → enter worker mode (see above)
- `claim <task_id>` → claim specific task
- `version <name>` → call `kanban_add_version`
- `status` → call `kanban_get_status` and present the summary
- `delete <task_id>` → inform user deletion is not exposed via MCP, but they can move tasks to done
