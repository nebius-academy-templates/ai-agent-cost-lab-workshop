/**
 * Cursor postToolUse hook — reference SOLUTION (the Run 3 "answer" for the hooks lever).
 *
 * Cursor runs project hooks from the git root's .cursor/hooks.json (`postToolUse`, matcher `MCP:.*`).
 * For MCP tools the event carries `tool_name` = "MCP:<tool>" and `tool_output` = the MCP result as a
 * JSON string, {"content":[{"type":"text","text":"<json>"}]}. Printing
 *   { "updated_mcp_tool_output": { "content": [{ "type": "text", "text": "<compacted>" }] } }
 * replaces what the model sees. (`afterMCPExecution` fires too but has no output fields — it cannot
 * rewrite anything.) Compaction logic is the same as the Claude reference
 * (workshop/hooks/post-tool-use.solution.ts); only the event and the output channel differ.
 *
 * `npm run hooks:setup` installs the passthrough scaffold into .cursor/hooks/compact-mcp.ts;
 * `npm run hooks:solution` copies this file over it.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

type JsonRecord = Record<string, unknown>;

const STRIP_KEYS = new Set([
  "metadata", "createdBy", "createdAt", "lastReviewedBy", "lastReviewedAt", "reviewIntervalDays",
  "ownerTeam", "stakeholderTeams", "correlationId", "auditTrailUrl", "viewCount", "uniqueViewers",
  "searchMetadata", "self", "iconUrl", "accountId", "emailAddress", "html_url", "node_id",
]);
const STRIP_ARRAYS = new Set(["contributors", "watchers"]);

function isRecord(v: unknown): v is JsonRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Strip the repeated marketing/compliance filler the mock injects into long text bodies. */
function stripFiller(s: string): string {
  return s.replace(/\n*\bThis endpoint is part of the enterprise integration suite[\s\S]*$/g, "").trim();
}

function truncate(s: string, max = 6000): string {
  return s.length > max ? `${s.slice(0, max)}\n\n... [truncated by hook]` : s;
}

/** Generic recursive bloat stripper — drops the metadata fields + bloat arrays the agent never uses. */
function stripBloat(v: unknown): unknown {
  if (typeof v === "string") return truncate(stripFiller(v));
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(stripBloat);
  const out: JsonRecord = {};
  for (const [k, child] of Object.entries(v as JsonRecord)) {
    if (STRIP_KEYS.has(k) || STRIP_ARRAYS.has(k)) continue;
    out[k] = stripBloat(child);
  }
  return out;
}

// ── Per-server compactors: keep only what a coder needs to fix the bug ──

function compactIssue(issue: unknown): unknown {
  if (!isRecord(issue) || !isRecord(issue.fields)) return stripBloat(issue);
  const f = issue.fields;
  // The first comments carry the triage; the long tail is sprint chatter.
  const comments = isRecord(f.comment) && Array.isArray(f.comment.comments)
    ? f.comment.comments.slice(0, MAX_COMMENTS).map((c) => (isRecord(c) ? { body: c.body } : c))
    : undefined;
  return {
    key: issue.key, summary: f.summary, description: f.description,
    definitionOfDone: f.definitionOfDone, relatedResources: f.relatedResources, labels: f.labels,
    status: isRecord(f.status) ? f.status.name : f.status, comments,
    commentTotal: isRecord(f.comment) ? f.comment.total : undefined,
  };
}

const MAX_COMMENTS = 3;

function compactJira(p: unknown): unknown {
  if (!isRecord(p)) return p;
  if (Array.isArray(p.issues)) return { jql: p.jql, total: p.total, issues: p.issues.map(compactIssue) };
  if (isRecord(p.fields)) return compactIssue(p);
  return stripBloat(p);
}

function compactConfluence(p: unknown): unknown {
  if (!isRecord(p)) return p;
  if (Array.isArray(p.results)) {
    const sel = p.results.slice(0, 5);
    return { query: p.query, totalCount: p.totalCount, returnedCount: sel.length,
      results: sel.map((i) => (isRecord(i) ? { id: i.id, title: i.title, excerpt: i.excerpt, url: i.url } : i)) };
  }
  if (typeof p.body === "string") return { id: p.id, title: p.title, space: p.space, body: truncate(stripFiller(p.body), 5000) };
  return stripBloat(p);
}

function compactSentry(p: unknown): unknown {
  if (!isRecord(p)) return p;
  if (Array.isArray(p.issues)) {
    return { query: p.query, total: p.total, issues: p.issues.map((i) => (isRecord(i)
      ? { id: i.id, shortId: i.shortId, title: i.title, culprit: i.culprit, level: i.level, status: i.status, count: i.count }
      : i)) };
  }
  const entries = Array.isArray(p.entries) ? p.entries : [];
  const exception = entries
    .map((e) => (isRecord(e) && isRecord(e.data) && Array.isArray(e.data.values) ? e.data.values[0] : undefined))
    .find(isRecord);
  const frames = isRecord(exception?.stacktrace) && Array.isArray(exception.stacktrace.frames)
    ? exception.stacktrace.frames.slice(0, 5).map(stripBloat) : undefined;
  const meta = isRecord(p.metadata) ? p.metadata : {};
  return { id: p.id, title: p.title, culprit: p.culprit, message: p.message, type: meta.type, value: meta.value, frames };
}

function compactTestrail(p: unknown): unknown {
  if (!isRecord(p)) return p;
  if (Array.isArray(p.cases)) {
    return { suiteId: p.suiteId, scenario: p.scenario, size: p.size,
      cases: p.cases.map((c) => (isRecord(c) ? { id: c.id, title: c.title, priority: c.priority } : c)) };
  }
  if (Array.isArray(p.results)) {
    return { runId: p.runId, scenario: p.scenario, summary: p.summary,
      results: p.results.map((r) => (isRecord(r) ? { test_id: r.test_id, title: r.title, status: r.status } : r)) };
  }
  return stripBloat(p);
}

function compactGithub(p: unknown): unknown {
  if (!isRecord(p)) return p;
  if (Array.isArray(p.statuses)) {
    return { ref: p.ref, state: p.state,
      statuses: p.statuses.map((s) => (isRecord(s) ? { context: s.context, state: s.state, description: s.description } : s)) };
  }
  return stripBloat(p);
}

function compactByServer(toolName: string, payload: unknown): unknown {
  if (toolName.startsWith("mcp__jira")) return compactJira(payload);
  if (toolName.startsWith("mcp__confluence")) return compactConfluence(payload);
  if (toolName.startsWith("mcp__sentry")) return compactSentry(payload);
  if (toolName.startsWith("mcp__testrail")) return compactTestrail(payload);
  if (toolName.startsWith("mcp__github")) return compactGithub(payload);
  return stripBloat(payload);
}

/** tool_response is the MCP content array [{type:"text", text:"<json>"}]; compact each text block. */
function compactToolResponse(toolName: string, toolResponse: unknown): string | null {
  const blocks = Array.isArray(toolResponse) ? toolResponse : [];
  const texts = blocks
    .filter((b): b is { type?: string; text?: string } => isRecord(b) && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string);
  if (!texts.length) return null;

  const before = texts.join("\n").length;
  const compacted = texts.map((t) => {
    try {
      return JSON.stringify(compactByServer(toolName, JSON.parse(t)), null, 2);
    } catch {
      return truncate(stripFiller(t));
    }
  }).join("\n");

  return compacted.length < before ? compacted : null;
}

/**
 * Dedup — the stateless workaround. A hook is a fresh process per call with NO memory, so we FAKE
 * state with a per-session file on disk: if the same (tool, input) was seen this session, return a
 * tiny "unchanged" marker instead of the payload. Caveats a proxy doesn't have: racy under parallel
 * tools, and the file lingers in tmp. (A proxy keeps this in memory — see servers/proxy.)
 */
function dedupMarker(name: string, input: unknown, sessionId?: string): string | null {
  if (!sessionId) return null;
  const file = join(tmpdir(), `cursor-hook-dedup-${sessionId}.json`);
  const key = createHash("sha256").update(`${name}|${JSON.stringify(input)}`).digest("hex");
  let seen: string[] = [];
  try { if (existsSync(file)) seen = JSON.parse(readFileSync(file, "utf8")); } catch { /* fresh */ }
  if (seen.includes(key)) {
    return JSON.stringify({ _unchanged: true, _note: "identical to an earlier call this session — result omitted to save tokens" });
  }
  try { seen.push(key); writeFileSync(file, JSON.stringify(seen)); } catch { /* best effort */ }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────

/** "MCP:jira_get_issue" → "mcp__jira__jira_get_issue", the naming the compactors key on. */
function canonicalToolName(cursorName: string): string {
  const tool = cursorName.replace(/^MCP:/, "");
  return `mcp__${tool.split("_")[0]}__${tool}`;
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    const e = JSON.parse(input) as { tool_name?: string; tool_input?: unknown; tool_output?: string; conversation_id?: string };
    if (!(e.tool_name ?? "").startsWith("MCP:") || typeof e.tool_output !== "string") return;
    const name = canonicalToolName(e.tool_name ?? "");
    const result = JSON.parse(e.tool_output) as { content?: unknown };
    // Dedup first (cheapest), then field-filter + structured-summary + truncation.
    const updated = dedupMarker(name, e.tool_input, e.conversation_id) ?? compactToolResponse(name, result.content);
    if (updated !== null) {
      process.stdout.write(JSON.stringify({ updated_mcp_tool_output: { content: [{ type: "text", text: updated }] } }));
    }
  } catch { /* malformed → passthrough */ }
  // emit nothing → original result is kept
});
