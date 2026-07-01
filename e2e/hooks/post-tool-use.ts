/**
 * PostToolUse hook — strips known bloat from MCP tool responses.
 * Used by e2e/test-hooks.ts for A/B measurement.
 *
 * Approach: remove only known garbage fields (metadata, contributors, watchers).
 * Everything else stays intact so the agent keeps full context.
 *
 * Claude Code passes JSON on stdin: { tool_name, tool_input, response }
 * Hook compacts the response and writes result to stdout.
 */

interface HookEvent {
  tool_name: string;
  tool_input: Record<string, unknown>;
  response: string;
}

// ── Bloat fields to strip ─────────────────────────────────────────────

const STRIP_KEYS = new Set([
  // metadataBloat — pure compliance garbage on every list item
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
]);

const STRIP_ARRAYS = new Set([
  // Confluence page bloat — lists of contributors/watchers the agent never uses
  "contributors",
  "watchers",
  // Confluence search bloat
  "searchMetadata",
]);

// ── Recursive stripper ─────────────────────────────────────────────────

function stripBloat(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripBloat);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (STRIP_KEYS.has(key)) continue;          // drop individual bloat fields
    if (STRIP_ARRAYS.has(key)) continue;         // drop known bloat arrays
    result[key] = stripBloat(value);
  }
  return result;
}

function compact(response: string): string {
  try {
    const data = JSON.parse(response);
    return JSON.stringify(stripBloat(data));
  } catch {
    return response;
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    const event: HookEvent = JSON.parse(input);
    const name = event.tool_name || "";

    if (name.startsWith("mcp__")) {
      event.response = compact(event.response);
    }

    process.stdout.write(JSON.stringify(event));
  } catch {
    process.stdout.write(input);
  }
});
