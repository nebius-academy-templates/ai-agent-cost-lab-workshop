# Token-Efficient Coding Agents — Workshop

A runnable Angular product (Plata Burrito CRM) with deliberately buggy features, a dockerized backend
+ five mock MCP servers that feed your agent the task, and per-run token measurement read from each
run's own session transcript. You fix a feature with the agent, measure what it cost, apply the
optimizations we teach, re-run, and **prove you spent fewer tokens for the same correct result.**

> A token reduction that breaks the solution does not count. Correctness is decided by a quality gate
> (tests + typecheck + lint) that `workshop:run*` runs automatically after your agent finishes.

## Prerequisites

- Node ≥ 20.11, npm, and **Docker**.
- **One coding agent** installed and authenticated — `claude`, `codex`, or `cursor-agent`.

## Quick start

```bash
npm install
npm run setup                 # Docker + MCP; auto-detects your agent
#   npm run setup -- codex    # …or pick one explicitly (claude | codex | cursor)
npm run workshop:doctor       # verify everything is ready
```

**You pick the agent once.** `setup` persists it (to `.workshop/active-agent`), and every later
command — `proxy:*`, `hooks:*`, `workshop:run*` — targets it. No per-command flags. Switch any time
with `npm run setup -- <agent>` or `npm run variant -- <n> <agent>`.

## Workshop flow (two terminals)
### Run 1. Initial measurment for default agent

A measured run is a **bracket**: `workshop:run*` resets the baseline, waits while you work in your
agent, then reads **only your run's** tokens. So you start the agent **after** the run begins.

**Terminal A — prep & measure:**

```bash
npm run variant -- 1|2|3      # pick your bug vector (writes TASK.md, sets the scenario)
npm run workshop:run1         # resets, prints the exact launch command, then waits
```

**Terminal B — the agent** (only once Run 1 is already waiting) — run the command Run 1 printed:

```bash
cd apps/angular-demo
claude --session-id <id>      # Claude — <id> printed by workshop:run1
codex                         # Codex  — usage parsed from its session rollout
cursor-agent                  # Cursor — tokens from the dashboard; gate auto
```

Start it **fresh** here — config + MCP warm-up must happen *inside* the measured window. The agent
reads `TASK.md`, pulls the task from the **jira** MCP server (→ confluence, sentry, testrail), fixes
the feature, then you **close** it.

**Back in Terminal A:** press Enter → the gate runs and tokens are measured (Cursor: read your run's
tokens from the dashboard link the runner prints, matched by `runStart`).

Then optimize **in place on the same branch** (no branch switching) and re-measure:

### Run 2. Hygiene optimizations for AGENTS.md

Optimize AGENTS.md file (located in apps/angular-demo folder) using the information from the theory section

Note:
> you can use command `npm run agents:solution` to setup the solution from the workshop right away


**Terminal A — prep & measure:**
```bash
npm run workshop:run2         # resets, prints the exact launch command, then waits
```

**Terminal B — the agent** (only once Run 1 is already waiting) — run the command Run 1 printed:

```bash
cd apps/angular-demo OR nothing if you inside the apps demo folder
claude --session-id <id>      # Claude — <id> printed by workshop:run1
codex                         # Codex  — usage parsed from its session rollout
cursor-agent                  # Cursor — tokens from the dashboard; gate auto
```

Start it **fresh** here — config + MCP warm-up must happen *inside* the measured window. The agent
reads `TASK.md`, pulls the task from the **jira** MCP server (→ confluence, sentry, testrail), fixes
the feature, then you **close** it.

**Back in Terminal A:** press Enter → the gate runs and tokens are measured (Cursor: read your run's
tokens from the dashboard link the runner prints, matched by `runStart`).

Run prints your delta vs Run 1. The second optimization are measured **independently** against
the same baseline from Run 1.

### Run 3. Optimization for MCP or Agent Hooks

Optimize AGENTS.md file (located in apps/angular-demo folder) using the information from the theory section

Note:
> you can use command `npm run proxy:solution` to setup the solution for MCP-proxy from the workshop
> OR `npm run hooks:solution` to setup the solution for Agent Hooks

**Terminal A — prep & measure:**
```bash
npm run workshop:run3         # resets, prints the exact launch command, then waits
```

**Terminal B — the agent** (only once Run 1 is already waiting) — run the command Run 1 printed:

```bash
cd apps/angular-demo OR nothing if you inside the apps demo folder
claude --session-id <id>      # Claude — <id> printed by workshop:run1
codex                         # Codex  — usage parsed from its session rollout
cursor-agent                  # Cursor — tokens from the dashboard; gate auto
```

Start it **fresh** here — config + MCP warm-up must happen *inside* the measured window. The agent
reads `TASK.md`, pulls the task from the **jira** MCP server (→ confluence, sentry, testrail), fixes
the feature, then you **close** it.

**Back in Terminal A:** press Enter → the gate runs and tokens are measured (Cursor: read your run's
tokens from the dashboard link the runner prints, matched by `runStart`).

Run prints your delta vs Run 1. The third optimization are measured **independently** against
the same baseline from Run 1.

## Three bug variants

| Variant | Page | Ticket | Type |
|---|---|---|---|
| 1 | `/catalog` | JIRA-0321 | Data grid: URL sync, cache, SWR, cancellation |
| 2 | `/orders` | JIRA-0410 | Data grid: URL sync, debounce, cache, SWR |
| 3 | `/edit/:id` | JIRA-0455 | Forms: validation, 400-mapping, XSS, dirty state |

## Commands

```bash
npm run setup [-- <agent>]    # Docker + MCP; pick/auto-detect the agent
npm run cleanup               # stop everything
npm run variant -- 1|2|3      # pick task (optional trailing agent to switch)
npm run workshop:doctor       # preflight check
npm run workshop:run1|2|3     # measured runs (gate runs automatically inside)

# Run 2 — AGENTS.md hygiene
npm run agents:solution       # apply optimized AGENTS.md   /  agents:reset to restore

# Run 3 — tool layer (pick one), all driven by your selected agent:
npm run proxy:setup           # MCP config → compact proxy (:9100); edit servers/proxy/src/index.ts
npm run proxy:solution        # drop in the reference proxy + rebuild   /  proxy:reset, proxy:direct
npm run hooks:setup           # install the passthrough hook scaffold
npm run hooks:solution        # drop in the reference compaction hook   /  hooks:reset
```

## Agent working directory

The participant agent runs from **`apps/angular-demo/`** and sees only `AGENTS.md` (bloated — you
optimize it in Run 2), `TASK.md`, and its MCP config (`.mcp.json` / `.codex/config.toml` /
`.cursor/mcp.json`). **Information-hiding** keeps it in scope: nothing it reads mentions the workshop
infrastructure above it (`workshop/` grader, `e2e/`, `servers/`), and it never sees the quality gate —
the facilitator grades each run out-of-band.

## Docs

- [`docs/hygiene-methods.md`](./docs/hygiene-methods.md) — 10 optimization levers
- [`docs/mcp-proxy-methods.md`](./docs/mcp-proxy-methods.md) — 8 proxy methods

## Cleanup

```bash
npm run cleanup               # stop Docker + remove MCP configs
```
