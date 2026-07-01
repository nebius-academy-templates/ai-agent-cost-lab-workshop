/**
 * Cursor afterMCPExecution hook — reference SOLUTION. Compacts bloated MCP tool responses before
 * they enter the agent's context. Cursor's hook does a clean rewrite (exit 0 → use the output JSON),
 * so — unlike codex — no block-hack is needed.
 *
 * Stdin: a JSON event with `response` (string) or `result` (object). Rewrite it and print to stdout.
 * Exit codes: 0 → use output JSON; 2 → block; other → pass through.
 *
 * (The committed .cursor/hooks/compact-mcp.ts is a passthrough scaffold; this is the filled-in answer.)
 */
interface HookEvent {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  response?: string;
  result?: unknown;
}

// ── Compactors ────────────────────────────────────────────────────────

function compactJira(response: string): string {
  try {
    const data = JSON.parse(response);
    if (data?.fields) {
      const { summary, description, definitionOfDone, relatedResources } = data.fields;
      return JSON.stringify({ summary, description, definitionOfDone, relatedResources });
    }
  } catch {}
  return response;
}

function compactConfluence(response: string): string {
  try {
    const data = JSON.parse(response);
    if (data?.body) {
      return JSON.stringify({ title: data.title, body: String(data.body).substring(0, 2000), space: data.space });
    }
  } catch {}
  return response;
}

function compactSentry(response: string): string {
  try {
    const data = JSON.parse(response);
    return JSON.stringify({
      title: data.title,
      culprit: data.culprit,
      message: data.message,
      // deep access into an external (deserialized) MCP payload — cast at the boundary
      frames: (data.entries as any)?.[0]?.data?.values?.[0]?.stacktrace?.frames?.slice(0, 3),
    });
  } catch {}
  return response;
}

function compactTestrail(response: string): string {
  try {
    const data = JSON.parse(response);
    if (data?.cases) {
      return JSON.stringify({
        suiteId: data.suiteId,
        size: data.size,
        cases: (data.cases as Array<Record<string, unknown>>).map((c) => ({ id: c.id, title: c.title, priority: c.priority })),
      });
    }
    if (data?.results) {
      return JSON.stringify({
        runId: data.runId,
        summary: data.summary,
        results: (data.results as Array<Record<string, unknown>>).map((r) => ({
          test_id: r.test_id, title: r.title, status: r.status,
        })),
      });
    }
  } catch {}
  return response;
}

function compactGeneric(response: string): string {
  if (response.length > 5000) {
    return response.substring(0, 5000) + "\n\n... [truncated by cursor hook]";
  }
  return response;
}

function compactResponse(event: HookEvent): string {
  const rawResponse = event.response || (event.result ? JSON.stringify(event.result) : "");
  if (!rawResponse) return "";

  const name = event.tool_name || "";

  if (name.startsWith("mcp__jira")) return compactJira(rawResponse);
  if (name.startsWith("mcp__confluence")) return compactConfluence(rawResponse);
  if (name.startsWith("mcp__sentry")) return compactSentry(rawResponse);
  if (name.startsWith("mcp__testrail")) return compactTestrail(rawResponse);
  if (name.startsWith("mcp__")) return compactGeneric(rawResponse);

  return rawResponse;
}

// ── Main ──────────────────────────────────────────────────────────────

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    const event: HookEvent = JSON.parse(input);

    if (event.response !== undefined) {
      event.response = compactResponse(event);
    } else if (event.result !== undefined) {
      event.result = JSON.parse(compactResponse(event));
    }

    process.stdout.write(JSON.stringify(event));
    process.exit(0);
  } catch {
    process.stdout.write(input);
    process.exit(0);
  }
});
