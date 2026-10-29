# 00 — Setup

## Prerequisites

- **Node ≥ 20.11**, npm, and **Docker** (for the REST mock + MCP servers).
- **One coding agent**, authenticated with **your own** key (you pay for your own usage — that's
  the point: you see and control it):
  - **Claude Code** (`ANTHROPIC_API_KEY`) — launch with the `--session-id <id>` printed by
    `workshop:run*`; usage is read from that one session's transcript (isolated from other windows).
  - **Codex** — usage parsed from its session rollout (`~/.codex/sessions/`). Launch `codex` from
    `apps/angular-demo/`; the harness picks up the newest session started there. Model: Sol 6.1
    (`gpt-6.1-sol`, set in `.codex/config.toml` by `npm run proxy:direct`); cost uses OpenAI API prices.
  - **agent** (Cursor CLI) — quality gate auto; record tokens from
    [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage) using the `runStart` timestamp
    printed by `npm run workshop:run*`. Baseline: `npm run proxy:direct && npm run hooks:reset`.
    Cursor reads project config from the repo-root `.cursor/` (MCP, hooks, allowlists in `cli.json` and
    `permissions.json`), not from the app folder. Headless runs (`agent -p --output-format stream-json`)
    report token usage in the final `result` event.
  - **agy** (Antigravity CLI, Google) — sign in once with `agy`. Launch `agy` from `apps/angular-demo/`;
    MCP servers come from `.agents/mcp_config.json`. Usage + cost (Gemini API prices) are read from
    agy's conversation store.
    Hooks lever (`hooks:*`) is not set up for agy — use the proxy for Run 3.
- `npx` available (used to run `ccusage`; nothing to install).

The agent is **auto-detected**. To force one (or when several are installed), pick it once —
`npm run setup -- codex` (or `npm run task -- cursor`) — and every later `proxy:*` / `hooks:*` /
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

## Get the task

```bash
npm run task             # catalog pagination (JIRA-0321)
```

This writes `TASK.md` (ticket number + how to run/verify). Open the app at `/catalog` to see the
bug.

## The quality gate

The runner grades every measured run with a quality gate (tests + typecheck + lint) — it runs
automatically inside `workshop:run*`, you don't invoke it yourself. On the shipped (buggy) code the
gate FAILs; your job is to make it PASS, for as few tokens as you can.

Next: [`01-baseline.md`](./01-baseline.md).
