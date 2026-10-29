# Agent hooks: how to build the methods (Run 3)

A hook is a handler the agent runs **before** or **after** a tool call. After the call it can
rewrite the result before it reaches the model's context. Before the call it can rewrite the call's
parameters.

**Which methods** exist and how much they save: [tool-layer-matrix.md](./tool-layer-matrix.md).
This document is about **how** to build them in each agent.

> **As of:** October 2026 — Claude Code 2.1.289, Codex CLI 0.160, Cursor 2.4+.
> **Alternative:** [mcp-proxy-methods.md](./mcp-proxy-methods.md) — the same at the proxy level.

---

## Workshop commands

```bash
npm run hooks:setup      # install the hook scaffold (passes everything through) and register it
npm run hooks:solution   # install the reference hook
npm run hooks:reset      # remove the hook, restore the direct MCP connection
```

| Agent | Scaffold | Reference | Registration |
|---|---|---|---|
| Claude Code | `apps/angular-demo/.claude/hooks/post-tool-use.ts` | `workshop/hooks/post-tool-use.solution.ts` | `.claude/settings.json` |
| Codex | `workshop/hooks/post-tool-use.codex.scaffold.ts` | `workshop/hooks/post-tool-use.codex.ts` | `.codex/hooks.json` |
| Cursor | `.cursor/hooks/compact-mcp.ts` (repo root) | `workshop/hooks/compact-mcp.cursor.ts` | `.cursor/hooks.json` (repo root) |

> **Antigravity (`agy`, Google):** hooks are not wired up in the workshop — `npm run hooks:*`
> says so. Its Run 3 goes through the proxy. (`agy` has workspace hooks in `.agents/hooks.json`,
> but there is no reference hook for them yet.)

> **Fixed in October 2026** (checked with live runs):
> - **Cursor** reads the project config (`mcp.json`, `hooks.json`) only from `.cursor/` at the
>   **git root**, not from the app folder — the config moved there. The reference moved from
>   `afterMCPExecution` (cannot replace) to `postToolUse`; the model gets the compact response. A
>   project `mcp.json` overrides servers of the same name in the global `~/.cursor/mcp.json`.
> - **Codex:** the reference replaces the result with `continue: false`, so the model sees a
>   normal result, not a failed call.

> **Codex with Sol 6.1 — the hook never fires** (measured 2026-10-07). The model calls MCP tools
> from inside its `exec` tool (code mode). The hook only sees `exec`, so the matcher `mcp__.*`
> never matches and the model gets the full response. Turning code mode off
> (`--disable code_mode_host`) breaks MCP calls ("code-mode host is disabled"). For Codex in Run 3,
> use the proxy.

---

## API per agent

| | Claude Code | Codex | Cursor |
|---|---|---|---|
| **Rewrite the result** | `PostToolUse`, matcher `mcp__.*` → `hookSpecificOutput.updatedToolOutput` (string) | `PostToolUse`, matcher `mcp__.*` → `{"continue": false, "reason": "<text>"}` | `postToolUse`, matcher `MCP:.*` → `{"updated_mcp_tool_output": {…}}` (object) |
| **Rewrite the parameters** | `PreToolUse` → `hookSpecificOutput.updatedInput` | `PreToolUse` → `updatedInput` + `permissionDecision: "allow"` (since 0.131) | `preToolUse` → `updated_input`; not confirmed for MCP |
| **Hook input** | `tool_name`, `tool_input`, `tool_response`, `session_id`, … | `tool_name`, `tool_input`, `tool_response`, `session_id`, `turn_id`, … | `tool_name`, `tool_input`, `tool_output` (JSON string), `tool_use_id`, … |
| **Handler types** | `command`, `http`, `mcp_tool`, `prompt`, `agent` | `command` (no others found in the docs) | `command` (no others found in the docs) |
| **State between calls** | `http` hook → a server with memory; `command` → a file | file | file |
| **Doesn't work** | — | `updatedMCPToolOutput` (read but not applied; the hook is marked failed). With Sol 6.1, MCP hooks never fire (code mode) | `afterMCPExecution` — observe only, no replacement |
| **To make it work** | A trusted project folder (`npm run setup:trust`) | A trusted project + approve **each** hook in `/hooks` (approval is by hash — again after every edit) or `--dangerously-bypass-hook-trust` | `.cursor/hooks.json` at the git root; headless runs used `agent -p … --trust --approve-mcps`, with shell commands from the `.cursor/cli.json` allow-list |
| **Measured, median run tokens** | −22%, cost **−46%** | never fires (2026-10-07) | **−60%** |

---

## Configuration examples

### Claude Code — replace the result (command hook)

```json
// apps/angular-demo/.claude/settings.json  (this is how npm run hooks:setup registers it)
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [{ "type": "command", "command": "npx tsx ${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.ts", "timeout": 30 }]
      }
    ]
  }
}
```

The hook prints to stdout (`hookEventName` is required):

```json
{ "hookSpecificOutput": { "hookEventName": "PostToolUse", "updatedToolOutput": "<compact result>" } }
```

### Claude Code — state in memory (HTTP hook for Dedup / Diff)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [{ "type": "http", "url": "http://localhost:9300/hooks/tool-result", "timeout": 30 }]
      }
    ]
  }
}
```

The server receives a POST with the same JSON as a command hook and answers with the same
`hookSpecificOutput.updatedToolOutput`. The server lives for the whole session — the cache is a
plain `Map`, with no races and no files.

### Claude Code — pagination before the call

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "updatedInput": { "query": "<as before>", "limit": 5 } } }
```

`updatedInput` replaces the call's parameters. The field names are the specific tool's parameters.

### Codex — replace the result

```json
// .codex/hooks.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [{ "type": "command", "command": "npx tsx \"$(git rev-parse --show-toplevel)/apps/angular-demo/.codex/hooks/post-tool-use.ts\"", "timeout": 30 }]
      }
    ]
  }
}
```

The hook prints to stdout and exits with code 0:

```json
{ "continue": false, "stopReason": "MCP result compacted", "reason": "<compact result>" }
```

- The model sees `reason` as a normal call result, and the work goes on.
- The UI marks the hook as "Stopped".
- `{"decision": "block", "reason": …}` also replaces the result, but the model gets it as an error.
- With Sol 6.1 none of this runs for MCP tools — see the note at the top.

### Codex — pagination before the call

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": { "query": "<as before>", "limit": 5 } } }
```

For MCP, `updatedInput` is a **full** replacement of the parameters, not a merge.

### Cursor — replace the result

```json
// .cursor/hooks.json — at the REPO ROOT: Cursor does not read .cursor/ from the app folder
{
  "version": 1,
  "hooks": {
    "postToolUse": [
      { "command": "npx tsx .cursor/hooks/compact-mcp.ts", "matcher": "MCP:.*", "timeout": 30 }
    ]
  }
}
```

```json
{ "updated_mcp_tool_output": { "content": [{ "type": "text", "text": "<compact result>" }] } }
```

- `tool_name` arrives as `MCP:<tool>`, for example `MCP:jira_get_issue`.
- `tool_output` is a JSON string with the MCP result `{"content":[{"type":"text","text":…}]}`: parse
  it before compacting. A response in the same format reaches the model instead of the original
  (checked: the model sees fields the hook added).

---

## Compactor skeleton

The common part is the same for all agents. Only the output format differs (table above).

```ts
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const raw = extractText(event);          // Claude/Codex: tool_response; Cursor: JSON.parse(tool_output)
    const compact = compactByTool(event.tool_name, raw);
    if (compact.length >= raw.length) return; // not shorter — stay silent, the agent gets the original
    process.stdout.write(JSON.stringify(formatForAgent(compact)));
  } catch {
    // any failure → print nothing, exit 0 → the original passes through unchanged
  }
});
```

**Safety rule:** replace the result only if it got shorter. On any error, print nothing.

---

## What the reference hook does

One compactor per MCP server; the Codex and Cursor references use the same logic with their own
output format. It keeps an allow-list of the fields this task needs.

| Server | What it keeps | Example | Cut |
|---|---|---|---|
| Jira | key, summary, description, Definition of Done, links, labels, status, the bodies of the first 3 comments + their total | `jira_get_issue` 37,040 → 3,426 | 91% |
| Confluence | page: id, title, space, body cut to 5,000 characters; search: the first 5 results (id, title, excerpt, url) + the total | `confluence_get_page` 34,729 → 1,727 | 95% |
| Sentry | event: id, title, culprit, message, exception type and value, the first 5 stack frames; breadcrumbs and request context are dropped | `sentry_get_event` 33,650 → 3,943 | 88% |
| TestRail | per case: id, title, priority; per result: test id, title, status | `testrail_get_cases` 36,614 → 935 | 97% |
| GitHub | ref, overall state, and each status as context / state / description; check runs are dropped | `github_get_commit_status` 25,791 → 522 | 98% |

An allow-list cuts deeper than the proxy's deny-list (90% vs 70% over the nine mock tools). Its risk:
a field the agent needs may be dropped.

---

## State: Dedup and Diff

| Way | Where | Pros | Cons |
|---|---|---|---|
| A tmp file per `session_id` | `command` hook in every agent | No extra processes | Races on parallel calls; the file stays after the session; the whole file is parsed on every call |
| An HTTP server | `http` hook, Claude Code only | Memory, atomic, no leftovers | One more process to start |
| The proxy | any agent | Memory, one implementation for all | A separate service, MCP config through the proxy |

---

## Reference measurement

The reference hook shrinks the mock responses by **90%** (over 9 tools, from 74% to 98%). Per-tool
table: [tool-layer-matrix.md](./tool-layer-matrix.md#reference-measurement-on-the-workshop-mocks).

**Measured runs 2026-10-27** (Run 3 with the hook against Run 1; medians of 5 attempts for
Claude Code, 3 passing attempts for Cursor; report: [measurements-2026-10.md](./measurements-2026-10.md)):

| Agent | MCP output, K characters | Tokens | Cost |
|---|---|---|---|
| Claude Code (Sonnet 5.5) | 108 → 10 | −22% | **−46%** |
| Cursor (GLM 5.2 High) | 142 → 10 | **−60%** | no price |
| Codex (Sol 6.1), 2026-10-07 | 142 → 142 | +14% | +2% |

- Tokens: the hook and the proxy cut the same amount (proxy: Claude −23%, Cursor −60%).
- Cost: the hook was cheaper for Claude (proxy: −35%). Less MCP output means fewer tokens written to
  the cache, and a cache write costs 40× a cache read.
- Codex: the hook never fired (code mode, see the note at the top).
- **Cursor drops a slow hook silently.** In one Cursor run the hook took 19–39 s per call, three
  calls exceeded the 30-second `timeout`, and the model got the full responses. Check the MCP
  output size after a hook run.

---

## What a hook can't do

| Task | Why |
|---|---|
| Shrink tool schemas | No agent gives a hook the tool list. Barely relevant now: schemas load on demand |
| Merge several calls into one | A hook sees one call. Only the proxy can do it |
| Pagination before the call in Cursor | `preToolUse` → `updated_input` exists, but the docs do not confirm it for MCP |
| Catch MCP calls made from code (Codex `exec` with Sol 6.1) | The hook sees only the outer `exec` call |
