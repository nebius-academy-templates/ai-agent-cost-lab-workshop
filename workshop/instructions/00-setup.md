# 00 — Setup

## Prerequisites

- **Node ≥ 20.11**, npm, and **Docker** (for the REST mock + MCP servers).
- **One coding agent**, authenticated with **your own** key (you pay for your own usage — that's
  the point: you see and control it):
  - **Claude Code** (`ANTHROPIC_API_KEY`) — launch with the `--session-id <id>` printed by
    `workshop:run*`; usage is read from that one session's transcript (isolated from other windows).
  - **Codex** — usage parsed from its session rollout (`~/.codex/sessions/`). Launch `codex` from
    `apps/angular-demo/`; the harness picks up the newest session automatically.
  - **cursor-agent** — quality gate auto; record tokens from
    [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage) using the `runStart` timestamp
    printed by `npm run workshop:run*`. Baseline: `npm run proxy:direct && npm run hooks:reset`.
    Allowlists are committed in `.cursor/cli.json` and `.cursor/permissions.json` (same MCP tools as Claude).
- `npx` available (used to run `ccusage`; nothing to install).

The agent is **auto-detected**. To force one (or when several are installed), pick it once —
`npm run setup -- codex` (or `npm run variant -- 1 cursor`) — and every later `proxy:*` / `hooks:*` /
`workshop:run*` command targets it.

## Install and check

```bash
npm install
npm run workshop:doctor
```

`workshop:doctor` should print `PASS`. It checks Node, git, the runnable product, the scenarios +
quality gate, the agent `.md` config, and that `ccusage` resolves. A missing `ANTHROPIC_API_KEY` is
a skip, not a failure.

## Start the backends and the app

```bash
docker compose up -d     # REST mock + 5 MCP servers (jira/confluence/sentry/testrail/github)
npm run start            # http://localhost:4200
```

`docker compose ps` should show six healthy services. The Angular app is **not** containerised —
it runs from `npm run start` and talks to the dockerized REST mock through a dev proxy.

## Pick a variant

```bash
npm run variant -- 1     # 1 catalog pagination · 2 orders search · 3 edit card (validation/XSS)
```

This writes `TASK.md` (ticket number + how to run/verify) and sets the active scenario. Open the
app and click into your feature to see the bug.

## The quality gate

The runner grades every measured run with a quality gate (tests + typecheck + lint) — it runs
automatically inside `workshop:run*`, you don't invoke it yourself. On the shipped (buggy) code the
gate FAILs; your job is to make it PASS, for as few tokens as you can.

Next: [`01-baseline.md`](./01-baseline.md).
