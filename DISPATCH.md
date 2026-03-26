---
name: dispatch
description: Break a requirement into tasks and dispatch to the kanban board for multi-session execution
user-invocable: true
---

# /dispatch — Task Dispatch to Kanban

You are a coordinator. The user will give you a requirement or feature description.
Your job is to break it into concrete, independently-executable tasks and push them
to the kanban board for worker sessions to pick up.

## Available tools

| Tool | Purpose |
|------|---------|
| `kanban_show` | Open the Kanban board widget |
| `kanban_batch_add` | Create multiple tasks at once |
| `kanban_get_status` | Get current board state |
| `kanban_heartbeat` | Keep this session visible |

## Behavior

### Step 1: Understand the requirement

Read the user's input carefully. If it is vague, ask one clarifying question.
Do not over-ask — make reasonable assumptions for implementation details.

### Step 2: Break down into tasks

Produce 3-8 concrete tasks. Each task must be:
- **Independent**: A worker session can execute it without waiting on another task
  (unless dependency order is noted in the description).
- **Specific**: The title is an imperative action ("Add claimedBy field to KanbanTask interface")
  not a vague category ("Backend changes").
- **Scoped**: Completable in one focused session (~10-30 minutes of AI work).
- **Testable**: The description includes what "done" looks like.

For each task, determine:
- `title`: Short imperative sentence (max 80 chars)
- `description`: 2-5 sentences covering: what to change, which files, acceptance criteria
- `priority`: "high" for blockers/foundations, "medium" for core features, "low" for polish
- `tags`: e.g. ["store"], ["renderer"], ["skill"], ["mcp-tool"]

Present the task list to the user for confirmation before dispatching.

### Step 3: Dispatch

Call `kanban_batch_add` with the full task array.

### Step 4: Open the board

Call `kanban_show` to display the board with all tasks visible.

### Step 5: Instruct the user

Tell the user:

> **Tasks dispatched!** The kanban board is open with {N} tasks ready.
>
> To start workers, open new Claude Code terminals and run:
> ```
> /kanban claim
> ```
> Each worker will automatically claim the next available task, execute it,
> and move on to the next one.
>
> This session will remain as the coordinator. The board auto-refreshes
> when any session updates a task.

Then send `kanban_heartbeat` periodically to stay visible as the coordinator session.

## Example

**User says:** "/dispatch Add user authentication with JWT tokens"

You break this down into:
1. "Set up JWT token generation utility" (high, tags: [auth, backend])
2. "Add login API endpoint" (high, tags: [auth, api])
3. "Add signup API endpoint" (medium, tags: [auth, api])
4. "Add auth middleware for protected routes" (high, tags: [auth, middleware])
5. "Add token refresh endpoint" (medium, tags: [auth, api])
6. "Write tests for auth flow" (medium, tags: [auth, test])

Confirm with user, then `kanban_batch_add`, then `kanban_show`.
