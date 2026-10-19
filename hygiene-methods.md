# Hygiene levers (Run 2)

What a participant can change **without touching the agent loop**: the model, the reasoning depth,
`AGENTS.md`, the prompt, the config. These are the Run 2 levers. Apply them to the bloated
`AGENTS.md` and the agent settings, then measure the change against Run 1.

> **As of:** October 2026 — Claude Code 2.1.289, Codex CLI 0.160, Cursor 2.4+.
> **Related:** [tool-layer-matrix.md](./tool-layer-matrix.md) — methods for tool responses (Run 3);
> [measurements-2026-10.md](./measurements-2026-10.md) — measured runs of four agents;
> [charter.md](./charter.md) — workshop design.

---

## What changed since July 2026

- **Measured on four agents (2026-10-07).** The reference `AGENTS.md` alone cut tokens by 28–44%
  for Claude Code, Codex and Cursor. See [Measured Run 2](#measured-run-2-2026-10-07).
- **Lazy Tool Loading is no longer a lever.** All three agents now load MCP tool schemas on
  demand (see [Dropped](#dropped)).
- **Hooks moved** to [tool-layer-matrix.md](./tool-layer-matrix.md): they work on tool responses,
  like the proxy.
- **New lever — Effort** (reasoning depth): thinking was 60% of the output tokens in Run 1.
- **Prices:** Opus 5.5 costs $4 / $20 per 1M input / output tokens (Opus 4 cost $15 / $75).
- **Cache:** on a subscription, Claude Code writes the cache for 1 hour (write costs ×2). Editing
  `CLAUDE.md` mid-session no longer resets the cache.

---

## Where the tokens go — Run 1 measurement

Run 1 of 2026-10-05: Claude Code 2.1.289, Opus 5.5, task JIRA-0321 (catalog), bloated `AGENTS.md`,
prompt from `workshop/facilitator/PROMPT.md`. 25 model requests, 4 min 19 s, gate PASS.

| Item | Tokens | Cost | Share |
|---|---|---|---|
| Cache writes (1 h, ×2 the input price) | 75.7K | $0.61 | 41% |
| Model output — thinking | 16.0K | $0.32 | 22% |
| Model output — text and tool calls | 10.8K | $0.22 | 15% |
| Cache reads (×0.05) | 1,596.5K | $0.32 | 22% |
| Uncached input | 0.05K | ~$0 | 0% |
| **Total** | **1,699K** | **$1.46** | |

What the context is made of:

| Part of the context | Size | Cost in the run |
|---|---|---|
| Fixed prefix: system prompt, built-in tools, global and project config, list of skills and agents | 28.7K tokens, read on each of 25 requests | ~20% |
| — of which the project `AGENTS.md` (6.6K characters) | ~1.6K tokens | ~1.4% |
| Tool results: file reads 41%, commands 21%, MCP 36% | 57.7K characters | — |
| Context at the end of the run | 86K tokens | — |

**What follows from it:**

1. The biggest costs are what **the model writes itself** (thinking + text = 37%) and what enters
   the context for the first time (cache writes = 41%). Re-reading the context is cheap (22%).
2. The size of `AGENTS.md` costs almost nothing by itself (~1.4%). A bloated `AGENTS.md` is
   expensive because of **where it sends the agent**: extra reads, extra checks, long reports.
3. Extra agent steps are the largest cost you control: 8 requests spent looking for a browser and
   starting a dev server cost 16% of the run (see L5).

This breakdown is for Claude Code on Opus 5.5. In the 2026-10-07 matrix the shape held for every
agent: cache reads were 84–92% of all tokens.

---

## Prices and cache

Per 1M tokens, Anthropic API:

| Model | Input | Output | Cache read | Cache write, 5 min | Cache write, 1 h |
|---|---|---|---|---|---|
| Opus 5.5 | $4 | $20 | $0.20 (×0.05) | $5 (×1.25) | $8 (×2) |
| Sonnet 5.5 | $2 | $10 | $0.20 (×0.1) | $2.50 | $4 |
| Haiku 4.5 | $1 | $5 | $0.10 (×0.1) | $1.25 | $2 |

- Output still costs **5×** input.
- **Cache lifetime in Claude Code:** 1 hour on a subscription, 5 minutes with an API key. Set it
  explicitly with `"promptCacheTtl": "5m" | "1h"` in `settings.json` or
  `CLAUDE_CODE_PROMPT_CACHE_TTL`.

A piece of size S that enters the context and is then read N more times costs, in input prices:

```
Opus 5.5, 1 h cache:    S × (2 + N × 0.05)      — one write costs as much as 40 re-reads
Opus 5.5, 5 min cache:  S × (1.25 + N × 0.05)
```

So savings come first from **what enters the context at all**, not from the number of turns.

---

## How to read the percentages

Each lever has two numbers:

- **Per component** — how much the thing the lever changes shrinks (output, reads, price per token).
- **Per run** — the effect on the cost of Run 1 ($1.46).

Every number is labelled with its source:

- **measured** — counted from the Run 1 log;
- **calculated** — Run 1 tokens × prices;
- **estimate** — not measured; a guide to check at the workshop.

---

## L0 — Model choice

### Why it works

The most direct lever: the same work at a lower price per token. The risk: a weaker model takes
more steps or fails the gate.

### What to do

| Agent | How |
|---|---|
| Claude Code | `/model sonnet`; in `.claude/settings.json`: `{ "model": "sonnet" }`; flag `claude --model sonnet`. Aliases: `opus`, `sonnet`, `haiku` |
| Codex | `/model` in the TUI |
| Cursor | `/model`; in the CLI `agent --model <model>` |

A cheap model for part of the work only — through a subagent (L8):

```yaml
# .claude/agents/test-runner.md
---
name: test-runner
description: Runs tests and reports pass/fail only
model: haiku
---
```

### Saving (calculated: Run 1 tokens × prices)

| Model | Run 1 cost | Change |
|---|---|---|
| Opus 5.5 (as run) | $1.46 | — |
| Sonnet 5.5 | $0.89 | **−39%** |
| Haiku 4.5 | $0.45 | **−70%** |

Why Sonnet gives −39% and not −50%: a cache read costs the same on Opus 5.5 and Sonnet 5.5 ($0.20),
and cache reads were 22% of the run.

### Risk

The calculation assumes the same tokens. A weaker model may take more steps, and retries eat the
saving. **Check the gate after switching models.**

---

## L1 — Effort (reasoning depth) — new

### Why it works

On Opus 5.5 and Fable 5.1 thinking cannot be turned off, but its depth can be set. Lower effort
means less thinking, fewer tool calls and shorter text in between. In Run 1 thinking was **60% of
output tokens and 22% of cost** (measured).

### What to do

| Agent | How |
|---|---|
| Claude Code | `/effort low`; `"effortLevel": "low"` in `settings.json`; `claude --effort low`; `CLAUDE_CODE_EFFORT_LEVEL=low`. Levels: `low`, `medium`, `high`, `xhigh`, `max`. Default for Opus 5.5: `medium` |
| Codex | `model_reasoning_effort = "low"` in `.codex/config.toml`; once: `codex -c model_reasoning_effort='"low"'`; `/reasoning` in the TUI |
| Cursor | Model parameters in `/model`; for a subagent: `model: <model>[effort=low]` in the frontmatter of `.cursor/agents/*.md` |

### Saving

| | Component | Run |
|---|---|---|
| `medium` → `low` | thinking −30–50% (estimate) | **−10–20% (estimate)** |
| `medium` → `high` / `xhigh` | thinking ↑ | cost ↑ |

### Risk

On a hard task low effort may fail the gate. Check at the workshop: `low` vs `medium` on the same
task.

---

## L2 — Context scoping

### Why it works

Every file the agent reads is written to the cache once at ×2 and stays in the context until the
end. Broad instructions ("explore the repository") mean more reads. In Run 1 file reads were 41% of
tool results. The agent also read another feature (`orders.controller.ts`).

### What to do

In `AGENTS.md` (the task's real files):

```
❌ "Explore the codebase, look at all related components, services and tests."

✅ "Edit ONLY the feature dir named in the ticket (src/app/<feature>/).
    Don't read other features. The fix goes in *.controller.ts; types in *.types.ts
    already exist — don't edit them."
```

Reference: `workshop/reference/AGENTS.optimized.md` (section "Scope").

### Saving

| | Component | Run |
|---|---|---|
| Drop reads outside the feature | reads −20–40% (estimate) | **−5–10% (estimate)** |

The effect is larger on a big repository (>100 files): without a scope the agent reads dozens of
files.

---

## L3 — File hints

### Why it works

Name the files up front, so the agent does not search for them with `grep` / `find`.

### What to do

```
Files: src/app/catalog/catalog.controller.ts (the bug),
       catalog.types.ts (types, don't change),
       catalog.controller.spec.ts (tests)
```

### Saving

| | Component | Run |
|---|---|---|
| This task | ~0 searches: the ticket and the Sentry error already name `catalog.controller.ts` | **0–5% (estimate)** |
| A ticket that names no files | 2–4 fewer search steps | −5–10% (estimate) |

---

## L4 — Output discipline

### Why it works

Output costs 5× input and is then written to the cache as well. Without limits the agent writes
preambles, recaps and long final reports. In Run 1 visible output (without thinking) was 10.8K
tokens, **15% of cost** (measured). The final report alone was a 2.5K-character table.

### What to do

- In `AGENTS.md`: `"No preamble. Report what changed in 1–2 lines and stop."`
- Claude Code: output style `/output-style Concise` or `"outputStyle": "Concise"` in
  `settings.json` (since 2.1.237).

### Saving

| | Component | Run |
|---|---|---|
| Short reports, no preambles | visible output −20–50% (estimate) | **−3–8% (estimate)** |

---

## L5 — One clear up-front prompt

### Why it works

A vague instruction creates extra work. In Run 1 the phrase "Verify the changes" sent the agent on
a detour: it started the dev server, checked the page with `curl`, looked for Playwright and Chrome,
and left `apps/angular-demo` three times.

**Measured:** 8 of 25 requests, **$0.23 — 16% of the run cost**.

### What to do

```
❌ "... Verify the changes. Report when done."

✅ "... Verify with `npm run test` and `npm run lint` only — do not start the dev
    server or a browser. Report what changed in 1–2 lines and stop."
```

### Saving

| | Component | Run |
|---|---|---|
| Say how to verify | 8 fewer requests | **−16% (measured cost of the extra steps)** |
| Vague task → precise task (criteria and files) | fewer exploration steps | −10–30% (estimate) |

---

## L6 — Cache discipline

### Why it works

In Run 1 **95.5% of input tokens came from the cache** (measured). While the cache holds, the full
context costs very little; one miss rewrites the whole context.

| Event | What happens | Cost at 86K context (Opus 5.5) |
|---|---|---|
| Normal turn | Cache read | $0.017 |
| `/model` mid-session | The new model has its own cache — the whole context is written again | **+$0.69 (≈ +47% of Run 1)** |
| Pause longer than the cache lifetime (API key, 5 min) | The whole context is written again | **+$0.41 (≈ +28%)** |
| `/clear` | The prefix (system prompt, config) stays cached; the gathered context is lost and the agent re-reads the files it needs | the cost of those re-reads |
| Editing `CLAUDE.md` / `AGENTS.md` mid-session | The cache is not reset; changes apply after `/clear` or a restart | 0 |

### What to do

- Pick the model and effort **before** the session starts; do not switch along the way.
- On an API key with pauses of 5–60 minutes: `"promptCacheTtl": "1h"`. Writes become ×2, but pauses
  no longer reset the cache.
- Change `AGENTS.md` between runs, not during a session.

### Saving

| | Component | Run |
|---|---|---|
| No model switches and no long pauses | 0 rewrites | **prevents +28–47% per reset (calculated)** |

---

## L7 — Minimal config

### Why it works

The fixed prefix is read on every request. In Run 1 it was 28.7K tokens and **~20% of cost**
(measured). The project `AGENTS.md` is only ~1.6K tokens of it. The rest is the agent's system
prompt, built-in tools, the user's **global** config (`~/.claude/CLAUDE.md`), plugins, skills and
MCP connections.

**Claude Code** reads `AGENTS.md` by itself (since 2.1.277) when there is no `CLAUDE.md` next to
it. If `CLAUDE.md` exists, `AGENTS.md` is included with `@AGENTS.md`, as in
`apps/angular-demo/CLAUDE.md`. The file loads once — do not duplicate its content.

### What to do

- `AGENTS.md` holds only what **every** task needs (the reference is 1.9K characters instead of
  6.6K). Everything else goes into skills (L9).
- Globally: turn off unused MCP connections, plugins and skills; keep `~/.claude/CLAUDE.md` short —
  it rides along in **every** session.

### Saving

| | Component | Run |
|---|---|---|
| Shrink the project `AGENTS.md` 6.6K → 1.9K | file −70% | **~1% (calculated)** — the main effect comes through L2–L5 |
| Trim the global config | smaller prefix | −5–10% (estimate) |

---

## L8 — Subagents

### Why it works

A subagent works in its own context and returns **only its final text** to the parent. Use it to
isolate large output (test logs, documentation searches) and to hand routine work to a cheap
model.

A subagent has its own start-up context (system prompt, tools). Isolation pays off only when the
isolated output is clearly larger than that cost. A guide: the main agent's prefix in Run 1 was
28.7K tokens.

### What to do

| Agent | How |
|---|---|
| Claude Code | `.claude/agents/<name>.md`, frontmatter `model: haiku` (or `sonnet`, `inherit`) |
| Cursor | `.cursor/agents/<name>.md`, frontmatter `model: <model>[effort=low]` |

```yaml
# .claude/agents/test-runner.md
---
name: test-runner
description: Runs npm test and lint, returns only pass/fail counts and failing test names
model: haiku
---
Run `npm run test` and `npm run lint`. Return only: passed/failed counts and the names of
failing tests. No logs.
```

### Saving

| | Component | Run |
|---|---|---|
| Run 1: command output only ~3K tokens | less than the subagent's start-up cost | **≈ 0 or negative** |
| Big logs / documentation search (>30K tokens per chunk) | −85–99% on that chunk | −10–30% (estimate) |

---

## L9 — Skills

### Why it works

Only the skill's **description** (up to 1,536 characters) enters the context up front. The body
and files of the skill load when the skill is needed. This keeps `AGENTS.md` short without losing
instructions for rare cases.

### What to do

```
.claude/skills/angular-rxjs/SKILL.md
---
name: angular-rxjs
description: RxJS patterns for this repo (switchMap cancellation, caching, URL state).
             Use when a task touches controllers with BehaviorSubject state.
---
- Cancel stale requests with switchMap; never manual subscribe chains.
- URL is the source of truth: read queryParamMap on init, write with router.navigate.
- ...
```

A skill can pin its model with the `model:` key in the frontmatter.

### Saving

| | Component | Run |
|---|---|---|
| Move 3K characters of rare instructions out of `AGENTS.md` | prefix −0.7K tokens | **~1% (calculated)** |

Like L7, this lever keeps the config in order: the direct saving is small.

---

## Dropped

### Lazy tool loading — now built in

Tool schemas of all MCP servers used to go into every request, and this lever split `.mcp.json`
by phase by hand. Now the agents keep only tool names in the context and load a schema when the
tool is needed:

| Agent | How it works |
|---|---|
| Claude Code | `ENABLE_TOOL_SEARCH=auto` by default: schemas load on demand when they do not fit in 10% of the context. `false` loads everything at once. **Do not turn it off** |
| Codex | Since 0.142.2, MCP tools load through `tool_search` when the model supports tool search |
| Cursor | Since 2.4, MCP tools load when needed |

**Run 1 measurement:** the agent loaded the schemas of 6 of 10 MCP tools; 4 were never loaded.

### Hooks — moved

Hooks work on tool responses, like the proxy → [tool-layer-matrix.md](./tool-layer-matrix.md).

---

## Summary table

| # | Lever | What to do | Effect on the Run 1 cost | Source |
|---|---|---|---|---|
| **L0** | Model choice | `/model sonnet` before the start | −39% (Sonnet 5.5) · −70% (Haiku 4.5) | calculated |
| **L1** | Effort | `/effort low` | −10–20% | estimate |
| **L2** | Context scoping | "only the feature folder named in the ticket" | −5–10% | estimate |
| **L3** | File hints | list the files | 0–5% (the ticket already names the files) | estimate |
| **L4** | Output discipline | "1–2 lines, no preamble"; Concise output style | −3–8% | estimate |
| **L5** | Up-front prompt | say how to verify: `npm run test`, `npm run lint` | −16% | measured |
| **L6** | Cache discipline | no model switch mid-session; 1 h TTL across pauses | prevents +28–47% per reset | calculated |
| **L7** | Minimal config | short `AGENTS.md`; clean global config | ~1% (project) · −5–10% (global) | calculated / estimate |
| **L8** | Subagents | a `haiku` subagent for big logs | ≈ 0 in Run 1; −10–30% with big logs | estimate |
| **L9** | Skills | rare instructions → `SKILL.md` | ~1% per 3K characters | calculated |

### Recommended set for Run 2

Levers act on different cost items, so they multiply rather than add up:

```
L0 Sonnet 5.5 (−39%) × L5 precise prompt (−16%) × L1 effort low (−10%)
  = 0.61 × 0.84 × 0.90 ≈ 0.46  →  about −50% of cost (estimate)
```

The reference `workshop/reference/AGENTS.optimized.md` (`npm run agents:solution`) covers L2–L4 and
L7.

### Measured Run 2 (2026-10-07)

Only the reference `AGENTS.md` against the bloated one. Same model, same prompt, one attempt per
agent. Report: [measurements-2026-10.md](./measurements-2026-10.md).

| Agent | Tokens | Cost | What changed |
|---|---|---|---|
| Claude Code (Sonnet 5.5) | **−44%** | **−38%** | 1 MCP call instead of 3 |
| Codex (Sol 6.1) | **−28%** | −15% | 24 s shorter |
| Cursor (GLM 5.2 High) | **−30%** | no price | MCP output −24% |
| agy (Gemini 3.8 Flash) | −48% ⚠️ | −34% ⚠️ | baseline inflated: Run 1 read the hidden tests |

- The reference `AGENTS.md` without a model change already cut cost by 15–38%.
- The measured effect is larger than the per-lever estimates for L2–L4 and L7 added up (about
  10–25%). Each step the agent skips also skips every later re-read of what that step would have
  added to the context. Claude's single MCP call instead of three is an example: 37K instead of 108K
  characters of MCP output.
- Model choice (L0) was not part of the measurement: Claude ran on Sonnet 5.5 throughout.

---

## The ceiling of hygiene

Hygiene does not change **what** the tools return. Bloated MCP responses, logs and large files are
still written to the cache once at ×2. Run 3 deals with that — methods at the proxy and hook level:
[tool-layer-matrix.md](./tool-layer-matrix.md).

---

## Using this document at the workshop

- **Before Run 2** — show "Where the tokens go": the model writes more than it reads; `AGENTS.md`
  is expensive through behaviour, not size.
- **During Run 2** — at least L0 + L5 + the reference `AGENTS.md`; L1 optionally.
- **After Run 2** — compare with Run 1; discuss which lever moved what and why the estimates
  differ from the measurement.
- **After the workshop** — the catalog stays as a reference for PlataCard.
