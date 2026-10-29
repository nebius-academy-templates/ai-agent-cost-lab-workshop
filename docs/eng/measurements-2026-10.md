# Workshop measurements — October 2026

Run matrix of 2026-10-27: 3 coding agents, 4 conditions, 3–5 attempts per cell, 43 runs in total.
Every run used the participant commands (`npm run task`, `agents:*`, `proxy:*`, `hooks:*`,
`workshop:run*`). The agent ran headless, with no human input, in `apps/angular-demo`.

> **Related:** [hygiene-methods.md](./hygiene-methods.md) — Run 2 levers;
> [tool-layer-matrix.md](./tool-layer-matrix.md) — Run 3 methods;
> [mcp-proxy-methods.md](./mcp-proxy-methods.md), [hooks-methods.md](./hooks-methods.md) — how
> the Run 3 levers are built.

---

## Summary

Median change against the Run 1 median of the same agent:

| Lever | Claude Code | Codex | Cursor |
|---|---|---|---|
| Run 2 — reference `AGENTS.md` | cost **−61%**, tokens −28% | cost −19%, tokens **−36%** | tokens **−41%** |
| Run 3 — reference proxy | cost **−35%**, tokens −23% | cost −26%, tokens −26% | tokens **−60%** |
| Run 3 — reference hook | cost **−46%**, tokens −22% | hook never fires (2026-10-07) | tokens **−60%** |

- 42 of 43 runs passed the quality gate. One Cursor Run 2 attempt failed typecheck.
- Every lever lowered the median tokens and, where a price exists, the median cost.
- Hygiene saves Claude Code the most money. Claude made one MCP call instead of 2–4 in all five
  Run 2 attempts.
- Token and cost changes differ. Compare levers by cost where a price exists.
- The same configuration varies a lot between runs: Claude Run 1 used 318K–776K tokens. Compare
  medians of several runs, not single runs.
- Claude Code's cost also depends on whether the prompt cache is still warm from an earlier run
  ([Cache warmth](#cache-warmth-claude-code)).

---

## Setup

| | |
|---|---|
| Date | 2026-10-27 |
| Code | identical to commit `8d14b35` of this repository |
| Task | JIRA-0321 — catalog page: state in the URL, response cache, cancel stale requests |
| Prompt | identical for all agents: `workshop/facilitator/PROMPT.md` |
| MCP mocks | enlarged responses, ~25–37K characters per call (`servers/mcp/src/noise.ts`, deterministic) |
| Run 1 | baseline: bloated `AGENTS.md` (6.6K characters), MCP servers connected directly |
| Run 2 | hygiene: reference `AGENTS.md` (1.9K characters, `npm run agents:solution`) |
| Run 3 — proxy | reference MCP proxy (`npm run proxy:solution`), bloated `AGENTS.md` |
| Run 3 — hook | reference result-rewriting hook (`npm run hooks:solution`), bloated `AGENTS.md` |
| Quality gate | hidden reference tests + typecheck + lint |

| Agent | Model | Attempts per cell | Where usage comes from |
|---|---|---|---|
| Claude Code 2.1.311 | Sonnet 5.5 (`claude-sonnet-5-5`) | 5 | session log `~/.claude/projects/…/<session-id>.jsonl` |
| Codex CLI 0.164.0 | Sol 6.1 (`gpt-6.1-sol`), reasoning effort `medium` | 3 | session log `~/.codex/sessions/…` |
| Cursor CLI 2026.10.22 | GLM 5.2 High | 3 passing | `result` event of `--output-format stream-json` |

"Tokens" means everything the agent sent and received: uncached input + output + cache reads +
cache writes.

Prices per 1M tokens (list prices, checked 2026-10-27):

| Model | Input | Cached input / cache read | Cache write | Output |
|---|---|---|---|---|
| Sonnet 5.5 | $2 | $0.10 | $2.50 (5 min) / $4 (1 h) | $10 |
| Sol 6.1, requests up to 272K tokens | $2 | $0.10 | — | $10 |
| GLM 5.2 High in Cursor | no per-token price | | | |

Claude Code wrote every cache entry in these runs with the 1-hour lifetime ($4). The Codex cost is
what the same tokens cost at OpenAI API prices.

---

## How the runs were made

1. `npm run task -- <agent>` — write `TASK.md` into the app and make that agent the active one
   for the `proxy:*`, `hooks:*` and `workshop:run*` commands.
2. For each cell:
   1. Reset every lever: `agents:reset`, `hooks:reset`, `proxy:reset`.
   2. Set the lever: `agents:solution` (Run 2), `proxy:solution` (Run 3 proxy) or
      `hooks:solution` (Run 3 hook).
   3. Start `npm run workshop:run1|2|3`. It waits for Enter.
   4. Run the agent headless in `apps/angular-demo` with the prompt (table below), time limit 20 min.
   5. Press Enter. The runner runs the gate, reads the agent's usage, appends the result to
      `.measurements/metrics.jsonl`, and resets the app code.
   6. Reset every lever; after a proxy cell also `proxy:rebuild`.
3. Order: attempt 1 of every condition, then attempt 2 of every condition, and so on. Claude Code
   first, then Codex, then Cursor.

| Agent | Headless command |
|---|---|
| Claude Code | `claude -p "<prompt>" --session-id <id> --model claude-sonnet-5-5 --permission-mode acceptEdits --strict-mcp-config --mcp-config .mcp.json --output-format json` |
| Codex | `codex exec -s workspace-write --json -m gpt-6.1-sol -c model_reasoning_effort="medium" "<prompt>"` |
| Cursor | `agent -p "<prompt>" --output-format stream-json --trust --approve-mcps` |

- Cursor ran without `--force`. Its shell commands were limited to the allow-list in
  `.cursor/cli.json`; all 53 shell calls in the 14 runs were allowed.
- The user's own global MCP servers were switched off for the Codex and Cursor runs, so only the
  five workshop servers loaded. Codex: `-c mcp_servers.<name>.enabled=false`; Cursor:
  `agent mcp disable <name>`. They were switched back on afterwards.
- Codex Run 3 hook was not run again: on 2026-10-07 the hook never fired (see
  [Findings](#findings)).
- A driver script ran these steps in sequence. It is not part of the repository.

---

## Tokens

Median, change against the Run 1 median, and the range over the passing runs:

| Agent | Run 1 — baseline | Run 2 — hygiene | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|---|
| Claude Code | 530K<br>318–776K | 383K (−28%)<br>271–442K | 407K (−23%)<br>407–460K | 412K (−22%)<br>397–491K |
| Codex | 689K<br>619–710K | 438K (−36%)<br>417–474K | 507K (−26%)<br>472–593K | — |
| Cursor | 934K<br>554–1,177K | 550K (−41%)<br>521–650K | 370K (−60%)<br>227–510K | 372K (−60%)<br>211–553K |

## Cost per run

| Agent | Run 1 — baseline | Run 2 — hygiene | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|---|
| Claude Code | $0.34<br>$0.17–0.42 | $0.14 (−61%)<br>$0.08–0.24 | $0.22 (−35%)<br>$0.20–0.32 | $0.19 (−46%)<br>$0.17–0.26 |
| Codex (API prices) | $0.21<br>$0.19–0.22 | $0.17 (−19%)<br>$0.16–0.18 | $0.16 (−26%)<br>$0.15–0.16 | — |
| Cursor | no price | | | |

Where Claude's money went, Run 1 median: cache writes $0.22, output $0.07, cache reads $0.05.

## Cache warmth (Claude Code)

Claude Code keeps the prompt cache for 1 hour. A run that starts within the hour after a run of the
same condition finds much of its context already cached. It then writes less to the cache, and
cache writes cost 40× a cache read.

| | Run 1 — baseline | Run 2 — hygiene | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|---|
| Attempt 1 (nothing cached) | $0.41 | $0.24 (−42%) | $0.32 (−21%) | $0.26 (−37%) |
| Attempts 2–5 (cache warm), median | $0.32 | $0.12 (−62%) | $0.22 (−32%) | $0.19 (−42%) |

- Example: Run 2 attempt 1 wrote 43.8K tokens to the cache, attempts 2–5 wrote 4.7–9.2K.
- The ranking does not change: hygiene, then the hook, then the proxy.
- A participant's first run of a condition matches attempt 1. A repeat within the hour matches
  attempts 2–5.
- Token totals do not depend on cache warmth: a token counts once, as a read or as a write.

## MCP output the model actually saw

Confirms whether a lever took effect. Median of the thousands of characters summed over all MCP
calls in a run; the number of MCP calls in brackets.

| Agent | Run 1 | Run 2 | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|---|
| Claude Code | 108 (2–4 calls) | 37 (1 call) | 48 (4 calls) | 10 (4 calls) |
| Codex | 109 (4–5 calls) | 80 (4–6 calls) | 55 (4 calls) | — |
| Cursor | 142 (3–5 calls) | 108 (3–5 calls) | 35 (5–6 calls) | 10 (4–6 calls) |

## Model requests

Median and range. Every request re-reads the whole context, so the request count drives the token
total.

| Agent | Run 1 | Run 2 | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|---|
| Claude Code | 8 (6–10) | 8 (6–9) | 8 (8–9) | 9 (9–11) |
| Codex | 14 (13–15) | 10 (10) | 13 (12–15) | — |
| Cursor | 7 (6–10) | 5 (3–5) | 5 (4–5) | 6 (3–6) |

## Agent wall time

Median.

| Agent | Run 1 | Run 2 | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|---|
| Claude Code | 58 s | 47 s | 1 min 0 s | 52 s |
| Codex | 2 min 7 s | 1 min 58 s | 1 min 58 s | — |
| Cursor | 1 min 47 s | 1 min 48 s | 1 min 30 s | 1 min 21 s |

## Full data per run

| Agent | Run | # | Uncached input | Output | Cache reads | Cache writes | Total | Cost | Requests | MCP calls / K chars | Wall | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Claude Code | baseline | 1 | 14 | 6,562 | 348,427 | 77,077 | 432,080 | $0.409 | 7 | 3 / 108 | 51 s | PASS |
| Claude Code | baseline | 2 | 20 | 7,298 | 698,358 | 70,155 | 775,831 | $0.423 | 10 | 4 / 142 | 58 s | PASS |
| Claude Code | baseline | 3 | 16 | 8,298 | 478,973 | 42,448 | 529,735 | $0.301 | 8 | 3 / 108 | 60 s | PASS |
| Claude Code | baseline | 4 | 12 | 4,415 | 288,104 | 25,157 | 317,688 | $0.174 | 6 | 2 / 72 | 41 s | PASS |
| Claude Code | baseline | 5 | 16 | 7,508 | 516,941 | 54,492 | 578,957 | $0.345 | 8 | 4 / 142 | 72 s | PASS |
| Claude Code | hygiene | 1 | 12 | 4,053 | 224,043 | 43,821 | 271,929 | $0.238 | 6 | 1 / 37 | 37 s | PASS |
| Claude Code | hygiene | 2 | 16 | 4,562 | 372,125 | 6,556 | 383,259 | $0.109 | 8 | 1 / 37 | 68 s | PASS |
| Claude Code | hygiene | 3 | 12 | 3,685 | 262,962 | 4,732 | 271,391 | $0.082 | 6 | 1 / 37 | 34 s | PASS |
| Claude Code | hygiene | 4 | 16 | 6,221 | 373,866 | 9,239 | 389,342 | $0.137 | 8 | 1 / 37 | 47 s | PASS |
| Claude Code | hygiene | 5 | 18 | 6,181 | 428,242 | 7,795 | 442,236 | $0.136 | 9 | 1 / 37 | 72 s | PASS |
| Claude Code | proxy | 1 | 16 | 7,376 | 345,948 | 53,393 | 406,733 | $0.322 | 8 | 4 / 48 | 60 s | PASS |
| Claude Code | proxy | 2 | 18 | 5,498 | 428,220 | 26,540 | 460,276 | $0.204 | 9 | 4 / 48 | 65 s | PASS |
| Claude Code | proxy | 3 | 16 | 7,077 | 372,365 | 27,578 | 407,036 | $0.218 | 8 | 4 / 48 | 53 s | PASS |
| Claude Code | proxy | 4 | 16 | 7,280 | 370,942 | 28,328 | 406,566 | $0.223 | 8 | 4 / 48 | 55 s | PASS |
| Claude Code | proxy | 5 | 16 | 7,691 | 371,783 | 29,042 | 408,532 | $0.230 | 8 | 4 / 48 | 66 s | PASS |
| Claude Code | hook | 1 | 20 | 5,675 | 405,532 | 39,579 | 450,806 | $0.256 | 10 | 4 / 10 | 48 s | PASS |
| Claude Code | hook | 2 | 18 | 7,283 | 383,186 | 18,805 | 409,292 | $0.186 | 9 | 4 / 10 | 83 s | PASS |
| Claude Code | hook | 3 | 18 | 6,690 | 373,719 | 17,021 | 397,448 | $0.172 | 9 | 4 / 10 | 52 s | PASS |
| Claude Code | hook | 4 | 18 | 6,956 | 385,233 | 20,058 | 412,265 | $0.188 | 9 | 4 / 10 | 52 s | PASS |
| Claude Code | hook | 5 | 22 | 7,048 | 466,846 | 17,504 | 491,420 | $0.187 | 11 | 4 / 10 | 66 s | PASS |
| Codex | baseline | 1 | 47,271 | 5,229 | 636,800 | — | 689,300 | $0.211 | 14 | 5 / 109 | 111 s | PASS |
| Codex | baseline | 2 | 49,511 | 6,327 | 562,816 | — | 618,654 | $0.219 | 13 | 5 / 109 | 132 s | PASS |
| Codex | baseline | 3 | 39,392 | 4,950 | 665,216 | — | 709,558 | $0.195 | 15 | 4 / 80 | 127 s | PASS |
| Codex | hygiene | 1 | 50,370 | 4,497 | 383,232 | — | 438,099 | $0.184 | 10 | 4 / 80 | 118 s | PASS |
| Codex | hygiene | 2 | 37,511 | 4,293 | 432,384 | — | 474,188 | $0.161 | 10 | 6 / 104 | 124 s | PASS |
| Codex | hygiene | 3 | 47,861 | 3,780 | 365,312 | — | 416,953 | $0.170 | 10 | 4 / 80 | 80 s | PASS |
| Codex | proxy | 1 | 31,923 | 4,940 | 435,200 | — | 472,063 | $0.157 | 12 | 4 / 55 | 126 s | PASS |
| Codex | proxy | 2 | 30,277 | 4,311 | 472,192 | — | 506,780 | $0.151 | 13 | 4 / 56 | 110 s | PASS |
| Codex | proxy | 3 | 31,012 | 4,665 | 557,568 | — | 593,245 | $0.164 | 15 | 4 / 45 | 118 s | PASS |
| Cursor | baseline | 1 | 55,047 | 2,627 | 496,544 | — | 554,218 | — | 6 | 5 / 142 | 74 s | PASS |
| Cursor | baseline | 2 | 50,801 | 3,781 | 1,122,496 | — | 1,177,078 | — | 10 | 5 / 142 | 126 s | PASS |
| Cursor | baseline | 3 | 42,340 | 4,647 | 886,976 | — | 933,963 | — | 7 | 3 / 108 | 108 s | PASS |
| Cursor | hygiene | 1 | 46,026 | 2,538 | 601,856 | — | 650,420 | — | 3 | 5 / 142 | 110 s | PASS |
| Cursor | hygiene | 2 | 20,355 | 2,304 | 438,944 | — | 461,603 | — | 4 | 4 / 108 | 78 s | **FAIL** (typecheck) |
| Cursor | hygiene | 3 | 29,168 | 2,299 | 489,568 | — | 521,035 | — | 5 | 4 / 108 | 83 s | PASS |
| Cursor | hygiene | 4 | 33,753 | 2,607 | 513,984 | — | 550,344 | — | 5 | 3 / 108 | 109 s | PASS |
| Cursor | proxy | 1 | 23,467 | 2,623 | 200,832 | — | 226,922 | — | 4 | 6 / 35 | 103 s | PASS |
| Cursor | proxy | 2 | 20,015 | 3,402 | 486,656 | — | 510,073 | — | 5 | 5 / 35 | 78 s | PASS |
| Cursor | proxy | 3 | 16,466 | 5,172 | 348,320 | — | 369,958 | — | 5 | 5 / 35 | 90 s | PASS |
| Cursor | hook | 1 | 48,480 | 3,284 | 914,624 | — | 966,388 | — | 8 | 4 / 108 | 268 s | PASS, excluded ⚠️ |
| Cursor | hook | 2 | 16,518 | 3,557 | 352,000 | — | 372,075 | — | 6 | 4 / 10 | 78 s | PASS |
| Cursor | hook | 3 | 10,369 | 2,443 | 198,176 | — | 210,988 | — | 3 | 6 / 10 | 82 s | PASS |
| Cursor | hook | 4 | 10,129 | 2,834 | 539,808 | — | 552,771 | — | 6 | 5 / 10 | 88 s | PASS |

- Cache reads are 81–98% of all tokens for every agent.
- Codex and Cursor report no cache writes (—).
- The failed Cursor run and the excluded Cursor hook run are left out of the medians and ranges. Both
  cells got a fourth attempt instead.
- ⚠️ Cursor hook attempt 1: the hook took 19–39 s per call. Three of four calls exceeded the hook's
  30-second timeout, and Cursor then passed the full responses to the model (108K characters instead
  of 10K). The cause was not found. In the other three runs each MCP call with the hook took
  0.8–4.4 s.

---

## Findings

1. **Hygiene (Run 2) works for every agent:** tokens −28% (Claude), −36% (Codex), −41% (Cursor).
   For Claude it is the cheapest run: cost −61%. With the reference `AGENTS.md` Claude made exactly
   one MCP call in every attempt (37K characters instead of 72–142K).
2. **The proxy and the hook cut tokens by about the same amount:** Claude −23% vs −22%, Cursor −60%
   vs −60%. The hook leaves 4–5× less MCP output (10K vs 35–48K characters), but the Claude hook runs
   made one more model request (median 9 vs 8). The single runs of 2026-10-07 showed a large gap
   (Cursor −12% vs −70%); it did not repeat.
3. **For Claude the hook is cheaper than the proxy:** cost −46% vs −35%. Less MCP output means fewer
   tokens written to the cache (median 18.8K vs 28.3K), and a cache write costs 40× a cache read.
4. **Fewer tokens is not the same as lower cost.**
   - Claude: tokens −22…−28%, cost −35…−61%. The levers cut cache writes, the most expensive item
     (median $0.22 of $0.34 in Run 1).
   - Codex hygiene: tokens −36%, cost only −19%. The saved tokens were cached input at $0.10 per
     million; uncached input stayed at ~48K tokens.
   - Codex proxy: tokens −26%, cost −26%. Here uncached input fell too, from 47K to 31K tokens.
   - Compare levers by cost, or by output and uncached input, not by the token total.
5. **The same configuration varies a lot between runs.** Claude Run 1: 318K–776K tokens, with 6–10
   model requests and 2–4 MCP calls. Cursor Run 1: 554K–1,177K. The single Claude Run 1 of
   2026-10-07 (835K tokens, 12 requests) sits at the top of this range; the 405K run in the
   workshop video sits near the bottom.
6. **Codex with Sol 6.1 bypasses MCP hooks** (measured 2026-10-07, Codex CLI 0.160). The model calls
   MCP tools from inside its `exec` tool (code mode). A `PostToolUse` hook with matcher `mcp__.*`
   never fires, so the model sees the full response. Turning code mode off
   (`--disable code_mode_host`) breaks MCP calls ("code-mode host is disabled"). In Run 3 only the
   proxy works for Codex.
7. **A slow hook fails silently in Cursor.** If the hook does not answer within its timeout (30 s in
   the reference), Cursor gives the model the original response. Check the MCP output size after a
   hook run.
8. **Agents differ in speed on the same task:** Claude Code about 1 minute, Cursor about 1.5,
   Codex about 2.

---

## Integrity check

The hidden reference tests live in the same repository (`workshop/checkpoints/`). No agent is
technically blocked from reading them. Every run was checked for reads of the reference tests and
for runs of the gate script.

| Agent | Runs checked | Source | Result |
|---|---|---|---|
| Claude Code | 20 | session logs | clean |
| Codex | 9 | session logs | clean |
| Cursor | 14 | `stream-json` event stream | clean |

The run tree had three uncommitted files (`TASK.md`, `e2e/_lib.ts`, one facilitator document).
Claude Code shows `git status` to the model; none of these paths points to the hidden tests.

---

## Antigravity (agy) — 2026-10-07, not measured again

One attempt per cell, Antigravity CLI 1.3.1, Gemini 3.8 Flash. Usage from the conversation database
`~/.gemini/antigravity-cli`.

| | Run 1 — baseline | Run 2 — hygiene | Run 3 — proxy |
|---|---|---|---|
| Tokens | 5,548K ⚠️ | 2,907K (−48%) | 3,697K (−33%) |
| Cost | $0.99 ⚠️ | $0.66 (−34%) | $0.90 (−9%) |
| Wall time | 11 min 2 s ⚠️ | 8 min 4 s | 12 min 49 s |

- agy has no reference hook.
- agy output includes thinking tokens (51,293 of 63,461 in Run 1).
- With the proxy, agy skipped 1.86M cache reads worth $0.14 but wrote 13K more output tokens, which
  cost $0.05 back. So tokens fell 33% and cost only 9%.
- That agy Run 3 went through the proxy is confirmed by configuration only: it has no other MCP
  source, and the proxy keeps no request log.
- ⚠️ **agy Run 1 left the app folder.** It ran `find ../.. -name "*reference.spec.ts"`, read
  `workshop/checkpoints/catalog-pagination/catalog-pagination.reference.spec.ts` and its jest
  config, then ran the reference tests and `workshop/cli/scenario-verify.ts` from the repo root.
  Its Run 1 PASS does not prove the agent solved the task on its own, and its Run 1 tokens, cost
  and time include this extra work, so its Run 2 and Run 3 savings are overstated.

To prevent it: keep the reference tests outside the repository, or copy them in only while the gate
runs.

---

## Changes since the 2026-10-07 report

| What | 2026-10-07 | 2026-10-27 |
|---|---|---|
| Attempts per cell | 1 | 5 (Claude Code), 3 passing (Codex, Cursor) |
| Sonnet 5.5 cache read price in the runner | $0.20 per million | $0.10 per million (list price). Old Claude costs were 11–17% too high |
| Cursor | `--force` | no `--force`; shell commands from the `.cursor/cli.json` allow-list |
| Codex | default model and effort | `-m gpt-6.1-sol`, effort `medium`, set explicitly |
| Cursor MCP output | length of the JSON, with escaping (154K) | length of the text only (142K) |
| Versions | Claude Code 2.1.289, Codex 0.160 | Claude Code 2.1.311, Codex 0.164.0, Cursor 2026.10.22 |

---

## Fixes needed for an honest measurement

| Problem | Before | Fix |
|---|---|---|
| Claude tokens counted twice | each part of one response (thinking, text, tool call) is a separate log line carrying the same usage: 2.2× overcount | count each response once (`e2e/_lib.ts`) |
| Claude cost too high | Sonnet 5.5 cache reads priced at $0.20 per million | $0.10 per million (`e2e/_lib.ts`) |
| Wrong Codex session | the newest session on the machine was picked | only sessions started in `apps/angular-demo` |
| Codex MCP calls blocked | `codex exec` never asks for approval, so MCP calls were refused | `default_tools_approval_mode = "approve"` per server in `.codex/config.toml` |
| Cursor ignored the workshop config | Cursor reads `.cursor/` only at the git root, so the app-folder proxy and hook configs never loaded | config moved to the repo root |
| Cursor hook could not rewrite | `afterMCPExecution` has no output | `postToolUse` → `updated_mcp_tool_output` |
| Hidden test paths visible | with uncommitted files, `git status` showed the agent the paths of the hidden tests | measure only on a tree where no uncommitted path points to the tests |
| A repeat run looks cheaper (Claude) | a warm prompt cache from the previous run lowers cache writes | compare attempt 1 with attempt 1, or medians over the same number of attempts |

---

## Limitations

- 3–5 attempts per cell. Cursor's ranges overlap strongly (Run 1 554K–1,177K), so its −60% for
  both Run 3 levers rests on three runs each.
- The runs used the facilitator's machine. Claude Code also loaded that user's global instructions,
  skill list and output style (about 46K characters per request); Codex loaded the user's global
  `AGENTS.md` and skill list (about 28K characters). This part is the same in every condition. It
  raises the absolute numbers and makes the percentages somewhat smaller than on a clean setup.
- Codex cost uses API list prices. Cursor has no price.
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

Results are appended to `.measurements/metrics.jsonl`. Repeat each cell at least three times and
compare medians.
