# Task Management

## Overview

- **Uncompleted tasks** are in `tasks-todo/`
  - Named `task-[number]-[name].md` where number indicates priority order
  - The lowest number is the current task
  - If [number] is an `x`, the task has not been prioritized yet
- **Completed tasks** are in `tasks-done/`
  - Named `task-YYYY-MM-DD-[name].md` with completion date

## Completing Tasks

When you finish a task, use the completion script:

```bash
# Complete a task (move from todo to done with today's date)
pnpm task:complete <task-name>

# Examples:
pnpm task:complete frontend-performance
pnpm task:complete 2
pnpm task:complete awesome-feature
```

The script will:
1. Find the matching task in `tasks-todo/`
2. Strip the `task-[number]-` prefix
3. Add today's date prefix: `task-YYYY-MM-DD-`
4. Move it to `tasks-done/`

**Example:**
```
tasks-todo/task-2-frontend-performance-optimization.md
→ tasks-done/task-2025-11-01-frontend-performance-optimization.md
```

## Task Scratchpad

The area below may be used as a scratch pad for tasks which do not fit elsewhere.
