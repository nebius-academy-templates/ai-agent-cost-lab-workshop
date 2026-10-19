# Workshop measurements — October 2026

Full run matrix: 4 coding agents, up to 4 runs each, one attempt per cell, 15 runs in total. Every
run used the participant commands (`npm run task`, `agents:*`, `proxy:*`, `hooks:*`,
`workshop:run*`). The agent ran headless, with no human input, in `apps/angular-demo`.

> **Related:** [hygiene-methods.md](./hygiene-methods.md) — Run 2 levers;
> [tool-layer-matrix.md](./tool-layer-matrix.md) — Run 3 methods;
> [mcp-proxy-methods.md](./mcp-proxy-methods.md), [hooks-methods.md](./hooks-methods.md) — how
> the Run 3 levers are built.

---

## Summary

| Lever | Claude Code | Codex | Cursor | agy |
|---|---|---|---|---|
| Run 2 — reference `AGENTS.md` | tokens **−44%**, cost **−38%** | tokens **−28%**, cost −15% | tokens **−30%** | tokens −48% ⚠️ |
| Run 3 — reference proxy | tokens **−54%**, cost **−36%** | tokens −5%, cost +12% | tokens −12% | tokens −33%, cost −9% ⚠️ |
| Run 3 — reference hook | tokens **−60%**, cost **−46%** | hook never fired | tokens **−70%** | no reference hook |

- All 15 runs passed the quality gate.
- Hygiene helped every agent. Where a hook can replace MCP results, it beat the proxy.
- Codex with Sol 6.1 calls MCP tools from inside its `exec` tool, so MCP hooks never fire.
- Fewer tokens did not always mean lower cost: the saved tokens were mostly cheap cache reads.
- ⚠️ agy Run 1 read the hidden reference tests, so its baseline is inflated
  ([Integrity check](#integrity-check)).

---

## Setup

| | |
|---|---|
| Date | 2026-10-07, commit `c69f1f5` |
| Task | JIRA-0321 — catalog page: state in the URL, response cache, cancel stale requests |
| Prompt | identical for all agents: `workshop/facilitator/PROMPT.md` |
| MCP mocks | enlarged responses, ~25–37K characters per call (`servers/mcp/src/noise.ts`, deterministic) |
| Run 1 | baseline: bloated `AGENTS.md` (6.6K characters), MCP servers connected directly |
| Run 2 | hygiene: reference `AGENTS.md` (1.9K characters, `npm run agents:solution`) |
| Run 3 — proxy | reference MCP proxy (`npm run proxy:solution`), bloated `AGENTS.md` |
| Run 3 — hooks | reference result-rewriting hook (`npm run hooks:solution`), bloated `AGENTS.md` |
| Quality gate | hidden reference tests + typecheck + lint |

| Agent | Model | Where usage comes from |
|---|---|---|
| Claude Code | Sonnet 5.5 | session log `~/.claude/projects/…/<session-id>.jsonl`; cost equals Claude's own `total_cost_usd` |
| Codex CLI 0.160 | Sol 6.1 (`gpt-6.1-sol`) | session log `~/.codex/sessions/…`; cost at OpenAI API list prices |
| Cursor CLI (`agent`) | GLM 5.2 High | `result` event of `--output-format stream-json`; no price available |
| Antigravity CLI (`agy`) 1.3.1 | Gemini 3.8 Flash | conversation database `~/.gemini/antigravity-cli`; equals `--output-format json` to the token |

"Tokens" below means everything the agent sent and received: uncached input + output + cache
reads + cache writes.

---

## How the runs were made

For each agent, in this order: Claude Code, Codex, Cursor, agy.

1. `npm run task -- <agent>` — write `TASK.md` into the app and make that agent the active one
   for the `proxy:*`, `hooks:*` and `workshop:run*` commands.
2. Reset every lever: `agents:reset`, `proxy:reset` + `proxy:rebuild`, `hooks:reset`.
3. For each cell:
   1. Set the lever: `agents:solution` (Run 2), `proxy:solution` (Run 3 proxy) or
      `hooks:solution` (Run 3 hooks).
   2. Start `npm run workshop:run1|2|3`. It waits for Enter.
   3. Run the agent headless in `apps/angular-demo` with the prompt (table below), time limit 20 min.
   4. Press Enter. The runner runs the gate, reads the agent's usage, appends the result to
      `.measurements/metrics.jsonl`, and resets the app code.
   5. Reset the lever.

| Agent | Headless command |
|---|---|
| Claude Code | `claude -p "<prompt>" --session-id <id> --model claude-sonnet-5-5 --permission-mode acceptEdits --strict-mcp-config --mcp-config .mcp.json --output-format json` |
| Codex | `codex exec -s workspace-write --json "<prompt>"`; Run 3 hooks adds `--dangerously-bypass-hook-trust` |
| Cursor | `agent -p "<prompt>" --output-format stream-json --trust --approve-mcps --force` |
| agy | `agy -p "<prompt>" --output-format json --dangerously-skip-permissions` |

- The user's own global MCP servers were switched off for the Codex and Cursor runs, so only the
  five workshop servers loaded. They were switched back on afterwards.
- A driver script ran these steps in sequence. It is not part of the repository.

---

## Tokens

| Agent | Run 1 — baseline | Run 2 — hygiene | Run 3 — proxy | Run 3 — hooks |
|---|---|---|---|---|
| Claude | 835K | 470K (**−44%**) | 382K (**−54%**) | 331K (**−60%**) |
| Codex | 508K | 365K (**−28%**) | 484K (−5%) | 578K (+14%, hook never fired) |
| Cursor | 815K | 574K (**−30%**) | 721K (−12%) | 247K (**−70%**) |
| agy | 5,548K ⚠️ | 2,907K (−48%) | 3,697K (−33%) | — (no reference hook) |

## Cost per run

| Agent | Run 1 | Run 2 | Run 3 — proxy | Run 3 — hooks |
|---|---|---|---|---|
| Claude | $0.52 | $0.32 (**−38%**) | $0.33 (**−36%**) | $0.28 (**−46%**) |
| Codex (API prices) | $0.20 | $0.17 (−15%) | $0.23 (+12%) | $0.20 (+2%) |
| agy | $0.99 ⚠️ | $0.66 (−34%) | $0.90 (−9%) | — |
| Cursor | no price | | | |

## MCP output the model actually saw

Confirms whether a lever took effect. Thousands of characters, summed over all MCP calls in the run.
Not available for agy.

| Agent | Run 1 | Run 2 | Run 3 — proxy | Run 3 — hooks |
|---|---|---|---|---|
| Claude | 108 (3 calls) | 37 (1 call) | 49 | 10 |
| Codex | 142 | 142 | 53 (5 calls) | 142 |
| Cursor | 154 | 117 | 37 | 11 |

## Agent wall time

| Agent | Run 1 | Run 2 | Run 3 — proxy | Run 3 — hooks |
|---|---|---|---|---|
| Claude | 54 s | 48 s | 47 s | 49 s |
| Codex | 2 min 18 s | 1 min 54 s | 2 min 53 s | 2 min 51 s |
| Cursor | 1 min 22 s | 1 min 23 s | 1 min 33 s | 1 min 21 s |
| agy | 11 min 2 s ⚠️ | 8 min 4 s | 12 min 49 s | — |

## Full data per run

| Agent | Run | Uncached input | Output | Cache reads | Cache writes | Total | Cost | Gate |
|---|---|---|---|---|---|---|---|---|
| Claude | 1 | 24 | 6,091 | 752,181 | 77,031 | 835,327 | $0.520 | PASS |
| Claude | 2 | 20 | 6,533 | 421,163 | 42,515 | 470,231 | $0.320 | PASS |
| Claude | 3 proxy | 16 | 6,725 | 325,365 | 50,367 | 382,473 | $0.334 | PASS |
| Claude | 3 hooks | 16 | 6,782 | 285,246 | 39,224 | 331,268 | $0.282 | PASS |
| Codex | 1 | 55,212 | 4,632 | 448,256 | — | 508,100 | $0.202 | PASS |
| Codex | 2 | 52,144 | 3,705 | 309,248 | — | 365,097 | $0.172 | PASS |
| Codex | 3 proxy | 65,416 | 5,308 | 413,568 | — | 484,292 | $0.225 | PASS |
| Codex | 3 hooks | 47,817 | 5,681 | 524,672 | — | 578,170 | $0.205 | PASS |
| Cursor | 1 | 58,849 | 2,972 | 753,312 | — | 815,133 | — | PASS |
| Cursor | 2 | 46,535 | 2,394 | 525,056 | — | 573,985 | — | PASS |
| Cursor | 3 proxy | 35,930 | 3,974 | 681,120 | — | 721,024 | — | PASS |
| Cursor | 3 hooks | 19,595 | 2,752 | 225,152 | — | 247,499 | — | PASS |
| agy | 1 ⚠️ | 501,662 | 63,461 | 4,983,243 | — | 5,548,366 | $0.988 | PASS ⚠️ |
| agy | 2 | 400,989 | 45,787 | 2,460,367 | — | 2,907,143 | $0.657 | PASS |
| agy | 3 proxy | 500,625 | 76,197 | 3,120,078 | — | 3,696,900 | $0.895 | PASS |

- Cache reads are 84–92% of all tokens for every agent.
- Codex, Cursor and agy report no cache writes (—).
- agy output includes thinking tokens (51,293 of 63,461 in Run 1).

---

## Findings

1. **Hygiene (Run 2) works for every agent:** tokens −28…−44% for Claude, Codex and Cursor. With
   the reference `AGENTS.md` the agents take fewer steps; Claude made **one** MCP call instead of
   three. It is the most reliable lever.
2. **Where a hook applies, it beats the proxy:** Claude −60% tokens / −46% cost, Cursor −70% tokens.
   The reference hook cuts MCP output to 10–11K characters, the reference proxy to 37–53K. The hook
   keeps only the fields the task needs; the proxy removes known noise fields and keeps the rest.
3. **Small MCP savings grow over the run.** An MCP response is written into the context once and
   then re-read on every later request. Cursor: MCP output 37K (proxy) vs 11K (hook) characters
   gave −12% vs −70% tokens for the whole run.
4. **Codex with Sol 6.1 bypasses MCP hooks.** The model calls MCP tools from inside its `exec` tool
   (code mode). A `PostToolUse` hook with matcher `mcp__.*` never fires, so the model sees the full
   response. Turning code mode off (`--disable code_mode_host`) breaks MCP calls ("code-mode host
   is disabled"). In Run 3 only the proxy works for Codex.
5. **Fewer tokens is not the same as lower cost.**
   - agy with the proxy: −33% tokens, −9% cost. It skipped 1.86M cache reads, worth $0.14, but
     wrote 13K more output tokens, which cost $0.05 back.
   - Codex with the proxy: −5% tokens, +12% cost. 10K more uncached input outweighed 34K fewer
     cache reads.
   - Compare levers by cost, or by output and uncached input, not by the token total.
6. **Agents differ a lot on the same task.** Clean runs (Run 2): agy uses 5–8× more tokens and
   4–10× more time than the other three. Claude and Cursor finish in 1–1.5 minutes.

---

## Integrity check

The hidden reference tests live in the same repository (`workshop/checkpoints/`). No agent is
technically blocked from reading them. Every run was checked for reads of the reference tests and
for runs of the gate script.

| Agent | Runs checked | Source | Result |
|---|---|---|---|
| Claude | 4 | session logs | clean |
| Codex | 4 | `--json` event stream | clean |
| Cursor | 4 | `stream-json` event stream | clean |
| agy | 3 | conversation databases | **Run 1 not clean**; Run 2 and Run 3 clean |

**agy Run 1 left the app folder.** It ran `find ../.. -name "*reference.spec.ts"`, read
`workshop/checkpoints/catalog-pagination/catalog-pagination.reference.spec.ts` and its jest
config, then ran the reference tests and `workshop/cli/scenario-verify.ts` from the repo root.
Consequences:

- its Run 1 PASS does not prove the agent solved the task on its own;
- its Run 1 tokens, cost and time include this extra work, so agy's Run 2 and Run 3 savings are
  overstated.

To prevent it: keep the reference tests outside the repository, or copy them in only while the gate
runs.

---

## Fixes needed for an honest measurement

| Problem | Before | Fix |
|---|---|---|
| Claude tokens counted twice | each part of one response (thinking, text, tool call) is a separate log line carrying the same usage: 2.2× overcount | count each response once (`e2e/_lib.ts`) |
| Wrong Codex session | the newest session on the machine was picked | only sessions started in `apps/angular-demo` |
| Codex MCP calls blocked | `codex exec` never asks for approval, so MCP calls were refused | `default_tools_approval_mode = "approve"` per server in `.codex/config.toml` |
| Cursor ignored the workshop config | Cursor reads `.cursor/` only at the git root, so the app-folder proxy and hook configs never loaded | config moved to the repo root |
| Cursor hook could not rewrite | `afterMCPExecution` has no output | `postToolUse` → `updated_mcp_tool_output` |
| Hidden test paths visible | with uncommitted files, `git status` showed the agent the paths of the hidden tests | measure only on a clean, committed tree |

---

## Limitations

- One attempt per cell. Differences under ~20% may be noise.
- Codex cost uses API list prices. Cursor has no price.
- agy Run 1 is contaminated (see [Integrity check](#integrity-check)).
- That agy Run 3 went through the proxy is confirmed by configuration only: it has no other MCP
  source, and the proxy keeps no request log.
- The mocks pad every response to 25–37K characters. Real MCP servers vary, and so does the
  share of MCP output in a run.

---

## Reproducing one cell

```bash
npm run task -- claude          # or codex, cursor, agy
npm run agents:solution         # Run 2 only; proxy:solution or hooks:solution for Run 3
npm run workshop:run2           # waits for Enter
# in another terminal, in apps/angular-demo: run the agent's headless command from the table above
# (Claude Code: use the --session-id the runner prints, so it reads the right session log)
# back in the first terminal: press Enter → gate + measurement
npm run agents:reset            # or proxy:reset / hooks:reset
```

Results are appended to `.measurements/metrics.jsonl`. Commit the tree first: an uncommitted tree
shows the agent the hidden test paths.
