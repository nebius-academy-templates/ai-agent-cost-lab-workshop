# MCP proxy: how to build the methods (Run 3)

The proxy is a service between the agent and the MCP servers. It sees both the request and the
response: it can change parameters before the call, shrink the response, keep a cache in memory and
merge calls. One implementation works for every agent.

**Which methods** exist and how much they save: [tool-layer-matrix.md](./tool-layer-matrix.md).
This document is about **how** to build them in the workshop proxy.

> **As of:** October 2026.
> **Alternative:** [hooks-methods.md](./hooks-methods.md) — the same at the agent-hook level.

---

## How the workshop proxy works

```
agent ──▶ http://localhost:9100/mcp?target=<server> ──▶ MCP server (jira:9001 … testrail:9005)
              │
              └─ servers/proxy/src/index.ts — two handlers:
                   ListTools  → the tool list (schemas)
                   CallTool   → a tool call (parameters → response)
```

Server and tool names stay the same: the agent still sees `jira`, `jira_get_issue`. Only the
address in the agent's MCP config changes.

### Commands

```bash
npm run proxy:setup      # active agent's MCP config → the proxy (localhost:9100)
npm run proxy:rebuild    # rebuild and restart the proxy container after a code change
npm run proxy:direct     # MCP config → straight to the servers (9001–9005)
npm run proxy:solution   # proxy:setup + install the reference + rebuild
npm run proxy:reset      # direct connection + restore the scaffold
```

| File | What it is |
|---|---|
| `servers/proxy/src/index.ts` | Scaffold: passes everything through unchanged. The participant writes here |
| `workshop/proxy/index.ts` | Reference for Claude Code and agy |
| `workshop/proxy/index.codex.ts` | Reference for Codex and Cursor (same behaviour, separate file) |

> After editing `index.ts`, always run `npm run proxy:rebuild` — otherwise the container keeps
> running the old code.

| Agent | Where its MCP config points |
|---|---|
| Claude Code | `apps/angular-demo/.mcp.json` |
| Codex | `apps/angular-demo/.codex/config.toml` |
| Cursor | `.cursor/mcp.json` at the repo root (Cursor ignores `.cursor/` in the app folder) |
| agy | `apps/angular-demo/.agents/mcp_config.json` |

---

## Where each method goes in the code

```ts
// A sketch, not the reference code: where the methods go in servers/proxy/src/index.ts
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = paginate(request.params);              // 4. Pagination — before the call
  const key = cacheKey(target, args);
  if (cache.has(key)) return cache.get(key);          // 5. Dedup / Cache
  const result = await (await upstream(target)).callTool(args);
  const compact = compactResult(target, result);      // 1–3. Field Filtering, Truncation, Summary
  cache.set(key, compact);
  return compact;
});

server.setRequestHandler(ListToolsRequestSchema, async () =>
  (await upstream(target)).listTools());              // schemas — leave as they are (see below)
```

| Method | Handler | What to do | Per response |
|---|---|---|---|
| 1. Field Filtering | `CallTool`, after the call | Remove metadata fields (`metadata`, `self`, `*_url`, `watchers`, …) and boilerplate text | −49–97% on the mocks (reference proxy, measured) |
| 2. Truncation | `CallTool`, after the call | Cut long bodies, add a marker and a way to get the rest | −80–99% on big bodies |
| 3. Structured Summary | `CallTool`, after the call | For known schemas (TestRail, Sentry), return a digest | −88–97% (reference hook; the reference proxy has none) |
| 4. Pagination | `CallTool`, **before** the call | Set the page size, if the tool has such a parameter | not in the reference proxy; the reference hook cuts `confluence_search` by 91% after the call |
| 5. Dedup / Cache | `CallTool` | A `Map` keyed by (server, tool, parameters) | 0% tokens, saves the server call |
| 6. Diff-based | `CallTool` | Keep the last response, return the difference on a repeat | −94–97% on a repeat (estimate) |
| 7. Aggregation | `CallTool` | Accept a batch and fan out N calls to the server | −0–5% per run (estimate) |

What the reference proxy removes: `changelog`, `renderedFields`, `names`, `schema`, `attachment`,
`worklog`, `updateAuthor`, `avatarUrls`, `bodyStorage`, `ancestors`, `children`, `history`,
`status_history`, `check_runs`, `breadcrumbs`, `contexts`, `request`, `sdk`, `preContext`,
`postContext`, `vars`, and every `customfield_*`. It keeps comments and builds no digests.

### Dedup: what to return on a repeat

| Variant | Tokens | Server call | Note |
|---|---|---|---|
| The saved compact response (what the reference does) | no saving | saved | The agent gets the data and is not confused |
| A `{"_unchanged": true}` marker | −98% on a repeat | saved | In earlier workshop runs the agent started re-checking without data: Run 3 output tokens tripled |

### Tool schemas: don't spend time on them

The reference strips the boilerplate tail from descriptions (−39–47% of their length). But agents
load schemas on demand, and in Run 1 that would give **< 1% of the run**. Leave the `ListTools`
handler unchanged — see [tool-layer-matrix.md](./tool-layer-matrix.md#dropped).

---

## Reference measurement

The reference proxy shrinks the mock responses by **70%** (over 9 tools, from 49% to 97%). That is
less than the reference hook (90%): the proxy removes known metadata and noise fields (history,
changelog, framework stack frames) but keeps comments and builds no digests. Table:
[tool-layer-matrix.md](./tool-layer-matrix.md#reference-measurement-on-the-workshop-mocks).

**Measured runs 2026-10-27** (Run 3 with the proxy against Run 1; medians of 5 attempts for
Claude Code, 3 passing attempts for Codex and Cursor; report:
[measurements-2026-10.md](./measurements-2026-10.md)):

| Agent | MCP output, K characters | Tokens | Cost |
|---|---|---|---|
| Claude Code (Sonnet 5.5) | 108 → 48 | −23% | **−35%** |
| Cursor (GLM 5.2 High) | 142 → 35 | **−60%** | no price |
| Codex (Sol 6.1) | 109 → 55 | −26% | −26% |
| agy (Gemini 3.8 Flash), 2026-10-07 | — | −33% ⚠️ | −9% ⚠️ |

- The proxy is the only Run 3 lever that worked for all four agents.
- Where a hook works (Claude Code, Cursor), it cuts tokens by the same amount as the proxy. For
  Claude Code the hook is cheaper (cost −46%).
- Codex: the proxy cut uncached input from 47K to 31K tokens, so cost fell as much as tokens. The
  single run of 2026-10-07 showed +12% cost; it did not repeat.
- ⚠️ agy's Run 1 baseline is inflated: it read the hidden tests.

---

## Proxy or hook

| | Proxy | Hook |
|---|---|---|
| One implementation for all agents | ✅ | ❌ — each agent has its own format |
| Works for Codex on Sol 6.1 and for agy | ✅ | ❌ — Codex hook never fires; no agy reference hook |
| State (Dedup, Diff) | ✅ in memory | Claude: HTTP hook; others: a file |
| Merging calls | ✅ | ❌ |
| Pagination before the call | ✅ | Claude, Codex — ✅; Cursor — not confirmed |
| Depth of compaction in the reference | −70% (deny-list of noise fields) | −90% (allow-list of task fields) |
| To deploy | A separate service (Docker), MCP config through the proxy | One file + an entry in the agent config |
| The agent's built-in limits (`MAX_MCP_OUTPUT_TOKENS`, `output_token_limit`) | Still apply on top of the proxy | Still apply on top of the hook |
