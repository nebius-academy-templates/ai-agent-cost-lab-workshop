# 01 — Baseline run

Establish the cost of solving the task "naively" so later optimizations have something to beat.
Do **not** optimize anything yet — just solve it and measure.

## Run it

```bash
npm run workshop:run1
```

The runner resets your variant to the buggy baseline, prints the exact agent command, then waits.
While it waits, in a **second terminal**:

1. Open your agent **FRESH** — config + MCP warm-up only happen on startup and must land *inside* the
   measured window (`/clear` is not enough). Use the command the runner printed:
   ```bash
   cd apps/angular-demo
   claude --session-id <id>      # ← the id from workshop:run1   (or codex / cursor-agent)
   ```
2. Give it a **simple, unoptimized** prompt, e.g.:
   > Read TASK.md and fix the task. It references a JIRA ticket.
3. The agent pulls the ticket from the **jira** MCP (bug + Definition of Done + links), follows
   them into **confluence** / **sentry** / **testrail**, and writes the fix, then reports done.
4. When it's done, **close the agent** and press **Enter** back in the first terminal.

The runner reads **only your session's** usage, runs the quality gate, and prints your delta. The
gate **must PASS** — if not, the run doesn't count; the runner resets the baseline each time, so just
re-run it.

## Record the baseline

From the output, write down:

- **total tokens** and **cost**,
- the split: **input / output / cache-write / cache-read**,
- that the **quality gate passed**.

> Why cache matters: `cache read` bills at ~10% of input. A large cache-read share is usually good
> — it means a stable prompt prefix was reused. Watch how it changes when you optimize.

> Agent notes — **Claude**: launch with the printed `--session-id <id>`. **Codex**: launch `codex`
> from `apps/angular-demo/`. **Cursor**: launch `cursor-agent` from `apps/angular-demo/`; record
> tokens from [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage) for the printed
> `runStart` time (runner does not auto-measure Cursor tokens).

Next: [`02-optimize.md`](./02-optimize.md).
