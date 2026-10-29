# Tool-response methods (Run 3)

One catalog of the methods that shrink what tools (MCP servers) return to the agent. Each method
can live at one or more levels:

- the **proxy** — a service between the agent and the MCP servers;
- an agent **hook** — Claude Code, Codex, Cursor;
- a **built-in setting** of the agent.

> **As of:** October 2026 — Claude Code 2.1.289, Codex CLI 0.160, Cursor 2.4+.
> **How to build them:** [mcp-proxy-methods.md](./mcp-proxy-methods.md) — the proxy;
> [hooks-methods.md](./hooks-methods.md) — hooks per agent.
> **Hygiene (Run 2):** [hygiene-methods.md](./hygiene-methods.md).
> **Measured runs:** [measurements-2026-10.md](./measurements-2026-10.md).

---

## What changed since July 2026

- **Measured on three agents (2026-10-27, 3–5 attempts per cell).** The reference hook and the
  reference proxy cut a whole run's median tokens by about the same amount: 22–23% for Claude Code,
  60% for Cursor. For Claude Code the hook is cheaper: cost −46% vs −35%. See
  [Effect on a whole run](#effect-on-a-whole-run).
- **Codex with Sol 6.1 bypasses MCP hooks.** The model calls MCP tools from inside its `exec` tool
  (code mode), so a hook with matcher `mcp__.*` never fires. Use the proxy for Codex.
- **Schema Compaction dropped.** Agents load tool schemas on demand, so shorter descriptions save
  almost nothing (see [Dropped](#dropped)).
- **Hooks caught up with the proxy.** Claude Code and Codex rewrite the **parameters** of an MCP
  call before it runs, so pagination through a hook is real now. An HTTP hook in Claude Code can
  keep state in a server's memory.
- **Cursor:** replace the result in `postToolUse` (`updated_mcp_tool_output`), not in
  `afterMCPExecution` — the latter has no output fields. Cursor reads the hook config only from
  `.cursor/` at the git root.
- **Codex:** the result is replaced with `{"continue": false, "reason": …}` and reaches the model
  as a normal (not failed) result. Every project hook must be approved in `/hooks`.
- **Built-in truncation:** Claude Code — `MAX_MCP_OUTPUT_TOKENS`; Codex — `output_token_limit`.
- **Merged:** Filler Stripping → Field Filtering; Item Slicing → Pagination.

---

## Where the proxy sits, where the hook sits

```
   The agent decides to call a tool
              │
              ▼
   ┌──────────────────────┐
   │ PRE-hook             │  PreToolUse (Claude, Codex), preToolUse (Cursor)
   │ rewrites parameters  │  → Pagination: force a page size before the call
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ MCP PROXY            │  sees the request and the response, keeps state in memory
   │                      │  → Pagination, Aggregation, Dedup, Diff
   └──────────┬───────────┘
              ▼
     MCP server (Jira, Confluence, Sentry, TestRail, GitHub)
              │ full response
              ▼
   ┌──────────────────────┐
   │ MCP PROXY            │  → Field Filtering, Truncation, Summary, Dedup, Diff
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ POST-hook            │  PostToolUse (Claude, Codex), postToolUse (Cursor)
   │ rewrites the result  │  → Field Filtering, Truncation, Summary (+ Dedup/Diff with limits)
   └──────────┬───────────┘
              ▼
   Model context  (tool schemas load on demand — leave them alone)
```

---

## Reference measurement on the workshop mocks

2026-10-07, after the mock responses were enlarged: they now carry comment history, changelogs,
stack traces and run history (deterministic generator `servers/mcp/src/noise.ts`). Each tool's
response went through the reference hook (`workshop/hooks/post-tool-use.solution.ts`) and the
reference proxy (`workshop/proxy/index.ts`). Sizes in characters.

| Tool | Raw | Hook | Proxy | Hook cut | Proxy cut |
|---|---|---|---|---|---|
| `jira_search_issues` | 31,821 | 8,143 | 14,287 | 74% | 55% |
| `jira_get_issue` | 37,040 | 3,426 | 9,411 | 91% | 75% |
| `confluence_search` | 29,198 | 2,507 | 13,170 | 91% | 55% |
| `confluence_get_page` | 34,729 | 1,727 | 16,258 | 95% | 53% |
| `sentry_list_issues` | 25,768 | 6,734 | 7,434 | 74% | 71% |
| `sentry_get_event` | 33,650 | 3,943 | 4,156 | 88% | 88% |
| `testrail_get_cases` | 36,614 | 935 | 18,646 | 97% | 49% |
| `testrail_get_results` | 28,114 | 1,006 | 1,467 | 96% | 95% |
| `github_get_commit_status` | 25,791 | 522 | 899 | 98% | 97% |
| **Total** | **282,725** | **28,943** | **85,728** | **90%** | **70%** |

- Each response is 25–37K characters (~7–9K tokens): below the agents' built-in limits (Codex cuts
  a tool response at ~10K tokens, Claude Code at 25K), so the agents get the full responses.
- The reference implementations combine several methods (Field Filtering + Summary + Truncation),
  so the numbers are per tool, not per method.
- The hook keeps an allow-list of the fields this task needs. The proxy removes a deny-list of known
  noise fields and keeps the rest, comments included. Hence the gap.

---

## Effect on a whole run

```
run saving ≈ share of MCP responses in the run cost × how much each response shrinks
```

**Measured 2026-10-27** (medians of 5 attempts for Claude Code, 3 passing attempts for Codex and
Cursor). Run 3 against Run 1, the bloated `AGENTS.md` in both:

| Agent | MCP output: Run 1 → proxy → hook (K characters) | Proxy: tokens / cost | Hook: tokens / cost |
|---|---|---|---|
| Claude (Sonnet 5.5) | 108 → 48 → 10 | −23% / **−35%** | −22% / **−46%** |
| Cursor (GLM 5.2 High) | 142 → 35 → 10 | **−60%** / no price | **−60%** / no price |
| Codex (Sol 6.1) | 109 → 55 → — | −26% / −26% | hook never fires (2026-10-07) |
| agy (Gemini 3.8 Flash), 2026-10-07 | — | −33% / −9% ⚠️ | no reference hook |

- **Less MCP output did not mean fewer tokens.** The hook leaves 4–5× less MCP output than the
  proxy, yet both cut tokens by the same amount. The Claude hook runs made one more model request
  (median 9 vs 8), and every request re-reads the whole context. The single runs of 2026-10-07
  showed a large gap for Cursor (−12% vs −70%); it did not repeat.
- **Less MCP output did mean lower cost for Claude.** A response is written to the cache once, and
  a cache write costs 40× a cache read. The hook runs wrote a median 18.8K tokens to the cache, the
  proxy runs 28.3K.
- **Calculation and measurement.** Before the runs, the calculation gave −16% (proxy) and −22%
  (hook). Claude Code measured −23% and −22% in tokens; Cursor −60% for both.
- **Tokens are not cost.** For agy the saved tokens were mostly cheap cache reads, so cost fell much
  less than tokens. ⚠️ agy's Run 1 baseline is inflated (it read the hidden tests).

---

## Methods

Legend: ✅ works · ⚠️ with limits · ❌ not available.

### 1. Field Filtering (including boilerplate removal)

**Do:** keep the meaningful fields; drop metadata (`self`, `*_url`, `node_id`, `metadata`,
`watchers`, `changelog`, `customfield_*`…) and repeated boilerplate text (disclaimers, SLA
footers).

```
In  — jira_get_issue (37,040): { id, key, self, fields: { summary, issuetype: {…iconUrl},
      status, priority, reporter: {accountId, emailAddress}, watches, metadata: {…11 fields},
      comment: {10 comments}, attachment, worklog, customfield_…, description, definitionOfDone,
      relatedResources }, renderedFields, changelog, names, schema }
Out — (3,426): { key, summary, description, definitionOfDone, relatedResources,
      labels, status, comments: first 3, commentTotal }
```

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ | ✅ `updatedToolOutput` | ⚠️ `continue:false` + `reason`; never fires with Sol 6.1 | ✅ `updated_mcp_tool_output` | ❌ |

- **Per response:** −55–98% (measured on Jira, Sentry, GitHub; the hook cuts deeper than the proxy).
- **Why it works:** most of an API response is metadata the model never uses, yet the model pays to
  write it to the cache and re-read it on every later request.
- **Don't use:** when the agent explicitly asked for a "noise" field.

---

### 2. Truncation

**Do:** cut a long body to N characters, mark it as cut, and say how to get the rest.

```
In  — confluence_get_page (a 200K page): "...200K of text..."
Out — id, title, space and the first 5,000 characters of the body + "\n\n... [truncated by hook]"
      (reference hook; other long strings are cut at 6,000)
```

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ | ✅ | ⚠️ never fires with Sol 6.1 | ✅ | ✅ Claude: `MAX_MCP_OUTPUT_TOKENS` (default 25,000); Codex: `output_token_limit` per tool, `tool_output_token_limit` globally |

Built-in truncation is the cheapest option: one line of config, no code.

```bash
# Claude Code: in the environment or in the "env" block of .claude/settings.json
MAX_MCP_OUTPUT_TOKENS=8000
```

```toml
# Codex: .codex/config.toml
[mcp_servers.confluence.tools.confluence_get_page]
output_token_limit = 4000
```

- **Per response:** −80–99% on big bodies (calculated). The mock responses (25–37K characters) stay
  below the built-in limits on purpose, so that the methods, not the agents' limits, make the effect.
- **Why it works:** one big page can outweigh the rest of the context.
- **Don't use:** where every line matters (a diff for a patch).

---

### 3. Structured Summary

**Do:** parse a response with a known schema and return a digest of what matters.

```
In  — testrail_get_cases (36,614): 6 cases × {5 steps, preconditions, 15 custom fields, edit history, metadata}
Out — (935): { suiteId, scenario, size, cases: [{ id: "C1001", title, priority }, …] }
```

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ | ✅ | ⚠️ never fires with Sol 6.1 | ✅ | ❌ |

- **Per response:** −88–97% (measured with the reference hook: TestRail, Sentry). The reference
  proxy does not build digests.
- **Why it works:** the agent needs to know which cases exist, not their custom fields and edit
  history.
- **Don't use:** on responses with an unknown schema — fall back to Truncation.

---

### 4. Pagination

**Do:** force a small page **before** the call (the server really returns less), or, as a
fallback, cut the collection **after** the call and add the total.

```
In  — confluence_search: 1 contract + 20 "noise" pages (29,198)
After the call (reference hook): the first N + totalCount, so the agent knows there were more (2,507)
Before the call: if the tool has a size parameter, set it, for example
                 { "query": "...", "limit": 5 }. The workshop mocks have no such parameter,
                 so only the "after the call" variant works on them.
```

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ before the call | ✅ before the call: `PreToolUse` → `updatedInput` | ✅ before the call: `PreToolUse` → `updatedInput` + `permissionDecision: "allow"` (since 0.131) | ⚠️ `preToolUse` → `updated_input`; the docs do not confirm it for MCP. After the call — ✅ | ❌ |

- **Per response:** −91% on `confluence_search` (reference hook, after the call, measured). The
  reference proxy does not paginate; its −55% on that tool comes from field filtering.
- **Why it works:** a search returns a few useful hits and many noise hits. **Before the call** also
  saves server time; **after the call** saves only context.
- **Don't use:** when the full set is needed (counting, aggregating).

---

### 5. Dedup / Cache

**Do:** same tool with the same parameters → return a short marker instead of the full response,
**or** return the saved response without asking the server.

```
1st get_issue(JIRA-0321) → compact response (3,426)
2nd get_issue(JIRA-0321) → {"_unchanged":true,"_note":"identical to an earlier call this session — …"}  (103)
```

Two variants with different gains:

| Variant | Saves tokens | Saves the server call | Risk |
|---|---|---|---|
| `_unchanged` marker (reference hook) | ✅ −98% on a repeat | ❌ | The agent gets no data and starts re-checking. In earlier workshop runs this tripled the output tokens of Run 3 (comment in `workshop/proxy/index.ts`) |
| Return the saved response (reference proxy) | ❌ 0% | ✅ | — |

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ in memory | ✅ HTTP hook backed by a long-running server · ⚠️ command hook with a file | ⚠️ file | ⚠️ file | ❌ |

"File" means the state lives in a tmp file between hook runs: races on parallel calls, leftovers
after the session, and a mandatory `session_id`.

- **Per run:** Run 1 had no repeats — **0%** (measured). Pays off in long sessions that re-read the
  same tickets and pages.

---

### 6. Diff-based Response

**Do:** on a repeat poll (run status, CI), return the difference from the previous response.

```
1st get_results(R-1): { status: "running", passed: 0, failed: 0, … }        (28,114)
2nd get_results(R-1): { _diff: { status: "failed", failed: 2 } }            (~300, example)
```

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ in memory | ✅ HTTP hook · ⚠️ file | ⚠️ file | ⚠️ file | ❌ |

- **Per response:** −94–97% on a repeat (estimate from the example).
- **Why it works:** a poll resends the same large object; only the status and the counts change.
- **Per run:** Run 1 had no polling — **0%**. Needed where the agent waits for CI or a long
  operation.

---

### 7. Aggregation / Batching

**Do:** merge N similar calls into one batch call.

| Proxy | Claude hook | Codex hook | Cursor hook | Built-in |
|---|---|---|---|---|
| ✅ | ❌ | ❌ | ❌ | partly: models make parallel calls themselves |

- **Run 1 measurement:** the agent made 3 MCP calls (Confluence, Sentry, TestRail) **in one
  request** by itself. Parallel calls take most of the gain of aggregation.
- **Per run:** −0–5% (estimate). Makes sense for APIs without parallel calls (N sequential
  `get_file`).
- **Why a hook can't:** a hook sees one call at a time.

---

## Dropped

### Schema Compaction — shorter tool descriptions

Tool schemas used to go into every request. Now agents keep only tool **names** in the context and
load a schema when the tool is needed: Claude Code — `ENABLE_TOOL_SEARCH=auto` by default; Codex —
since 0.142.2; Cursor — since 2.4.

**Measured:** the reference proxy shortens descriptions by 39–47% (from 2.3–2.8K to 1.2–1.7K
characters per server). But Run 1 loaded the schemas of only 6 of 10 tools → effect **< 1% of the
run (calculated)**. No agent shows tool schemas to a hook.

---

## Summary table

| # | Method | Proxy | Claude hook | Codex hook | Cursor hook | Built-in | Per response | Per run |
|---|---|---|---|---|---|---|---|---|
| 1 | Field Filtering | ✅ | ✅ | ⚠️ | ✅ | ❌ | −55–98% (measured) | part of −22…−60% (hook, measured) |
| 2 | Truncation | ✅ | ✅ | ⚠️ | ✅ | ✅ | −80–99% on big bodies | part of −22…−60% (Confluence page) |
| 3 | Structured Summary | ✅ | ✅ | ⚠️ | ✅ | ❌ | −88–97% (measured) | part of −22…−60% (hook, measured) |
| 4 | Pagination | ✅ before | ✅ before | ✅ before | ⚠️ | ❌ | −91% (hook, measured) | 0% in Run 1 (no search call) |
| 5 | Dedup / Cache | ✅ | ✅ HTTP · ⚠️ | ⚠️ | ⚠️ | ❌ | −98% on a repeat | 0% (no repeats) |
| 6 | Diff-based | ✅ | ✅ HTTP · ⚠️ | ⚠️ | ⚠️ | ❌ | −94–97% on a repeat | 0% (no polling) |
| 7 | Aggregation | ✅ | ❌ | ❌ | ❌ | partly | fewer calls | −0–5% (estimate) |

**Methods 1–3 together on the current mocks (reference hook, measured):** MCP output −91–93% →
median run tokens −22% (Claude) and −60% (Cursor), cost −46% (Claude).

**Codex hook ⚠️:** with Sol 6.1 the model calls MCP from inside its `exec` tool (code mode), and a
hook with matcher `mcp__.*` never fires. Use the proxy for Codex.

---

## How to choose at the workshop

1. **Built-in first** — `MAX_MCP_OUTPUT_TOKENS` / `output_token_limit`: one line, no code.
2. **A hook** — for methods 1–4. One file, nothing to deploy. Works in Claude Code and Cursor; in
   Codex with Sol 6.1 it never fires — use the proxy there.
3. **The proxy** — for state (5–6), aggregation (7), one implementation for all agents at once,
   and for agents without a working hook (Codex on Sol 6.1, agy).
