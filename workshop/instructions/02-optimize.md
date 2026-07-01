# 02 — Optimize, then prove it

Two layers of optimization, each its own measured run. After every run the quality gate **must still
PASS** — a cheaper run that breaks the solution does not count.

You stay on the **same git branch** throughout — there is **no branch switching**. Edit `AGENTS.md` /
build the proxy **in place**; `workshop:run*` resets the buggy baseline itself before each run. Each
run uses the same launch pattern as Run 1 (fresh agent in a second terminal, the printed
`--session-id` for Claude).

## Run 2 — AGENTS.md hygiene

Edit `AGENTS.md` / `CLAUDE.md` (and `.claude/settings.json`) **between** runs — this editing is not
measured. Then:

```bash
npm run workshop:run2     # resets baseline, waits while you run the agent fresh, measures, compares to Run 1
# Facilitator reference (optimized AGENTS.md): npm run agents:solution
```

| Lever | What to try | What it targets |
|---|---|---|
| **Scope the context** | Name the exact feature dir for your variant instead of letting the agent explore. | Fewer / smaller file reads. |
| **Tighten the config** | Trim `AGENTS.md`/`CLAUDE.md` to essentials. | The instruction prefix is sent every turn. |
| **One clear prompt** | Give the full task + constraints up front instead of discovering them over many turns. | Fewer turns → less re-sent history. |
| **Model choice** | Set a cheaper model in `.claude/settings.json` for this mechanical fix. | Per-token price. |
| **Keep the cache warm** | Don't reorder/rewrite the stable prefix mid-task. | Shifts input → cache-read. |

**The ceiling:** AGENTS.md hygiene can't shrink the **bloated MCP responses** (jira/confluence/
sentry/testrail) — those raw payloads still fill the context every turn. That's what Run 3 fixes.

## Run 3 — tool layer (proxy or hooks)

Build a thin layer that compacts the bloated MCP responses **before** they reach the agent. Pick one
(this build is not measured):

- **Option A — MCP proxy** (`servers/proxy/`): a 6th service already running on `:9100` as a
  **passthrough stub** between the agent and the 5 MCP servers. Point the agent at it, then add
  truncation / field-filtering / summary in the `callTool` forward:
  ```bash
  npm run proxy:setup      # swaps your agent's MCP config → the proxy (localhost:9100)
  #   → edit servers/proxy/src/index.ts (field-filter results / strip the FILLER tail off tool
  #     descriptions / dedup-cache repeats). Reference answer: workshop/proxy/index.ts
  #     (or `npm run proxy:solution` to drop it in).
  npm run proxy:rebuild    # rebuild the proxy container with your changes
  #   npm run proxy:reset   → MCP config → direct + proxy code → passthrough stub
  ```
- **Option B — agent hooks**: a passthrough hook scaffold ships per agent — fill in the compactor
  (reference answers in `workshop/hooks/`):
  - **Claude** — `workshop/hooks/post-tool-use.ts`, activated via `.claude/hooks/`.
  - **Codex** — `apps/angular-demo/.codex/hooks/post-tool-use.ts`, enabled in `.codex/hooks.json`
    (codex can only *replace* a result via `decision:"block"`, not transparently rewrite it).
  - **Cursor** — `apps/angular-demo/.cursor/hooks/compact-mcp.ts`, wired in `.cursor/hooks.json`
    (`afterMCPExecution`; MCP stays direct via `.cursor/mcp.json`). Allowlists in
    `.cursor/cli.json` + `.cursor/permissions.json` (hook command: `npx:tsx .cursor/hooks/compact-mcp.ts`).
    ```bash
    npm run hooks:setup      # passthrough scaffold + register hook
    #   → edit .cursor/hooks/compact-mcp.ts (reference: workshop/hooks/compact-mcp.cursor.ts)
    #   npm run hooks:solution   → reference (facilitator)
    #   npm run hooks:reset      → disable hooks
    ```
  - **Cursor proxy** — point `.cursor/mcp.json` at `:9100`:
    ```bash
    npm run proxy:setup      # .cursor/mcp.json → proxy
    #   npm run proxy:solution → reference + rebuild
    #   npm run proxy:reset    → direct MCP
    ```

Then:

```bash
npm run workshop:run3     # resets baseline, waits while you run the agent fresh, measures, compares to Run 2 (and Run 1)
```

This is the biggest delta of the workshop — you're now controlling not just the prompt but the data
that enters context.

## What good looks like

- `quality gate: PASS` on every counted run.
- Lower **total cost** for each optimized run, *and* you can explain **which lever moved which
  number** (e.g. "scoping cut input 40%"; "the proxy cut tool-result input 60%").
- One optimization that **didn't** help — and why. The goal is the **minimum cost of a correct,
  verified result**, not the minimum tokens.

Raw per-session detail any time: `npx ccusage session` (or `npx ccusage blocks` for live).
