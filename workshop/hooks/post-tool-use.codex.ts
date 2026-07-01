/**
 * Codex PostToolUse hook reference solution.
 *
 * Goal: compact deliberately bloated MCP tool results before the next model turn.
 *
 * Codex currently has no transparent "rewrite the tool result" channel in this workshop setup.
 * Returning `{ decision: "block", reason: "<compacted result>" }` is the Codex-specific
 * substitution path used by the e2e benchmark. The hook only emits that response when the
 * compacted payload is smaller; otherwise it stays silent and lets the original result through.
 *
 * Expected stdin shape, with small variations supported:
 *   { tool_name, tool_input, tool_response, ... }
 *   { tool_name, tool_input, tool_result, ... }
 *   { tool_name, tool_input, response/result, ... }
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

type JsonRecord = Record<string, unknown>;

interface HookEvent {
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  tool_result?: unknown;
  response?: unknown;
  result?: unknown;
  session_id?: string;
}

const STRIP_KEYS = new Set([
  "metadata",
  "createdBy",
  "createdAt",
  "lastReviewedBy",
  "lastReviewedAt",
  "reviewIntervalDays",
  "ownerTeam",
  "stakeholderTeams",
  "correlationId",
  "auditTrailUrl",
  "viewCount",
  "uniqueViewers",
  "searchMetadata",
  "self",
  "iconUrl",
  "accountId",
  "emailAddress",
  "html_url",
  "node_id",
]);

const STRIP_ARRAYS = new Set(["contributors", "watchers"]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

function stripKnownFiller(value: string): string {
  return value
    .replace(/\n*\bThis endpoint is part of the enterprise integration suite[\s\S]*$/g, "")
    .trim();
}

function truncate(value: string, max = 6000): string {
  return value.length > max ? `${value.slice(0, max)}\n\n... [truncated by codex hook]` : value;
}

function stripBloat(value: unknown): unknown {
  if (typeof value === "string") return truncate(stripKnownFiller(value));
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripBloat);

  const out: JsonRecord = {};
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (STRIP_KEYS.has(key) || STRIP_ARRAYS.has(key)) continue;
    out[key] = stripBloat(child);
  }
  return out;
}

function compactIssue(issue: unknown): unknown {
  if (!isRecord(issue) || !isRecord(issue.fields)) return stripBloat(issue);

  const fields = issue.fields;
  const comment = isRecord(fields.comment) && Array.isArray(fields.comment.comments)
    ? fields.comment.comments.map((c) => isRecord(c) ? { body: c.body } : c)
    : undefined;

  return {
    key: issue.key,
    summary: fields.summary,
    description: fields.description,
    definitionOfDone: fields.definitionOfDone,
    relatedResources: fields.relatedResources,
    labels: fields.labels,
    status: isRecord(fields.status) ? fields.status.name : fields.status,
    comments: comment,
  };
}

function compactJira(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if (Array.isArray(payload.issues)) {
    return {
      jql: payload.jql,
      total: payload.total,
      issues: payload.issues.map(compactIssue),
    };
  }
  if (isRecord(payload.fields)) return compactIssue(payload);
  return stripBloat(payload);
}

function compactConfluence(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  if (Array.isArray(payload.results)) {
    const results = payload.results.filter((item) => {
      if (!isRecord(item)) return false;
      const labels = Array.isArray(item.labels) ? item.labels : [];
      return labels.includes("frontend-contract") || String(item.id ?? "").startsWith("ENG-");
    });
    const selected = (results.length ? results : payload.results).slice(0, 5);
    return {
      query: payload.query,
      totalCount: payload.totalCount,
      returnedCount: selected.length,
      results: selected.map((item) => isRecord(item)
        ? { id: item.id, title: item.title, excerpt: item.excerpt, url: item.url, labels: item.labels }
        : item),
    };
  }

  if (typeof payload.body === "string") {
    return {
      id: payload.id,
      title: payload.title,
      space: payload.space,
      body: truncate(stripKnownFiller(payload.body), 5000),
    };
  }

  return stripBloat(payload);
}

function compactSentry(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  if (Array.isArray(payload.issues)) {
    return {
      query: payload.query,
      total: payload.total,
      issues: payload.issues.map((issue) => isRecord(issue)
        ? {
            id: issue.id,
            shortId: issue.shortId,
            title: issue.title,
            culprit: issue.culprit,
            level: issue.level,
            status: issue.status,
            count: issue.count,
            userCount: issue.userCount,
            lastSeen: issue.lastSeen,
          }
        : issue),
    };
  }

  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const exception = entries
    .map((entry) => isRecord(entry) && isRecord(entry.data) && Array.isArray(entry.data.values)
      ? entry.data.values[0]
      : undefined)
    .find(isRecord);
  const stacktrace = isRecord(exception?.stacktrace) && Array.isArray(exception.stacktrace.frames)
    ? exception.stacktrace.frames
    : undefined;
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};

  return {
    id: payload.id,
    title: payload.title,
    culprit: payload.culprit,
    message: payload.message,
    type: metadata.type,
    value: metadata.value,
    tags: Array.isArray(payload.tags)
      ? payload.tags.filter((tag) => isRecord(tag) && ["endpoint", "http.status_code", "release"].includes(String(tag.key)))
      : undefined,
    frames: Array.isArray(stacktrace)
      ? stacktrace
          .filter((frame) => !isRecord(frame) || frame.inApp !== false)
          .slice(0, 5)
          .map(stripBloat)
      : undefined,
  };
}

function compactTestrail(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  if (Array.isArray(payload.cases)) {
    return {
      suiteId: payload.suiteId,
      scenario: payload.scenario,
      size: payload.size,
      cases: payload.cases.map((testCase) => isRecord(testCase)
        ? { id: testCase.id, title: testCase.title, refs: testCase.refs, priority: testCase.priority }
        : testCase),
    };
  }

  if (Array.isArray(payload.results)) {
    return {
      runId: payload.runId,
      scenario: payload.scenario,
      summary: payload.summary,
      results: payload.results.map((result) => isRecord(result)
        ? {
            test_id: result.test_id,
            case_id: result.case_id,
            title: result.title,
            status: result.status,
            comment: result.comment,
          }
        : result),
    };
  }

  return stripBloat(payload);
}

function compactGithub(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  if (Array.isArray(payload.statuses)) {
    return {
      ref: payload.ref,
      sha: payload.sha,
      state: payload.state,
      statuses: payload.statuses.map((status) => isRecord(status)
        ? { context: status.context, state: status.state, description: status.description }
        : status),
      note: payload._note,
    };
  }

  if (payload.sha && payload.checks_required) {
    return {
      sha: payload.sha,
      accepted: payload.accepted,
      mergeable: payload.mergeable,
      merge_blocked_reason: payload.merge_blocked_reason,
      checks_required: payload.checks_required,
    };
  }

  return stripBloat(payload);
}

function compactPayload(toolName: string, payload: unknown): unknown {
  const name = toolName.toLowerCase();
  if (name.includes("jira")) return compactJira(payload);
  if (name.includes("confluence")) return compactConfluence(payload);
  if (name.includes("sentry")) return compactSentry(payload);
  if (name.includes("testrail")) return compactTestrail(payload);
  if (name.includes("github")) return compactGithub(payload);
  if (name.includes("mcp")) return stripBloat(payload);
  return payload;
}

function compactContentBlock(toolName: string, block: unknown): unknown {
  if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") return block;

  const stripped = stripKnownFiller(block.text);
  const parsed = parseJson(block.text) ?? (stripped !== block.text ? parseJson(stripped) : undefined);
  if (parsed === undefined) {
    const text = truncate(stripped);
    return text.length < block.text.length ? { ...block, text } : block;
  }

  const compacted = compactPayload(toolName, parsed);
  return { ...block, text: compactJson(compacted) };
}

function compactToolResult(toolName: string, result: unknown): unknown | undefined {
  if (typeof result === "string") {
    const stripped = stripKnownFiller(result);
    const parsed = parseJson(result) ?? (stripped !== result ? parseJson(stripped) : undefined);
    if (parsed === undefined) return truncate(stripped);
    return compactJson(compactPayload(toolName, parsed));
  }

  if (Array.isArray(result)) {
    return result.map((block) => compactContentBlock(toolName, block));
  }

  if (isRecord(result) && Array.isArray(result.content)) {
    return {
      ...result,
      content: result.content.map((block) => compactContentBlock(toolName, block)),
    };
  }

  if (result !== undefined) return compactPayload(toolName, result);
  return undefined;
}

function toolResultFrom(event: HookEvent): unknown {
  if (event.tool_response !== undefined) return event.tool_response;
  if (event.tool_result !== undefined) return event.tool_result;
  if (event.response !== undefined) return event.response;
  return event.result;
}

function duplicateMarker(toolName: string, toolInput: unknown, sessionId?: string): string | undefined {
  if (!sessionId) return undefined;

  const file = join(tmpdir(), `codex-hook-dedup-${sessionId}.json`);
  const key = createHash("sha256").update(`${toolName}|${JSON.stringify(toolInput)}`).digest("hex");
  let seen: string[] = [];
  try {
    if (existsSync(file)) seen = JSON.parse(readFileSync(file, "utf8")) as string[];
  } catch {
    seen = [];
  }

  if (seen.includes(key)) {
    return compactJson({
      _unchanged: true,
      _note: "identical MCP call result omitted; use the earlier result from this Codex session",
    });
  }

  try {
    seen.push(key);
    writeFileSync(file, JSON.stringify(seen), "utf8");
  } catch {
    // Best-effort cache only; failing to write should not affect the tool result.
  }

  return undefined;
}

function maybeEmitCompacted(event: HookEvent): void {
  const toolName = event.tool_name ?? "";
  if (!toolName.startsWith("mcp__")) return;

  const duplicate = duplicateMarker(toolName, event.tool_input, event.session_id);
  if (duplicate !== undefined) {
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason: duplicate,
    }));
    return;
  }

  const original = toolResultFrom(event);
  if (original === undefined) return;

  const compacted = compactToolResult(toolName, original);
  if (compacted === undefined) return;

  const before = compactJson(original);
  const after = compactJson(compacted);
  if (after.length >= before.length) return;

  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: after,
  }));
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    maybeEmitCompacted(JSON.parse(input) as HookEvent);
  } catch {
    // Malformed hook input: stay silent and let Codex keep the original tool result.
  }
});
