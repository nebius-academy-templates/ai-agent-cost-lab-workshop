/**
 * Cursor afterMCPExecution hook — scaffold (passthrough by default).
 *
 * Cursor passes a JSON event on stdin with the MCP tool result in `response` (string) or `result`
 * (object). Rewrite it and print to stdout; exit 0 → cursor uses your output. The default below
 * returns the response unchanged (passthrough).
 *
 * Run 3 exercise: fill in `compactResponse` to strip bloat / truncate per tool before the result
 * reaches the agent's context. Reference answer: workshop/hooks/compact-mcp.cursor.ts.
 */
interface HookEvent {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  response?: string;
  result?: unknown;
}

function compactResponse(event: HookEvent): string {
  // TODO (Run 3): compact based on event.tool_name (mcp__jira / mcp__confluence / …).
  // Passthrough for now — returns the raw response unchanged.
  return event.response ?? (event.result !== undefined ? JSON.stringify(event.result) : "");
}

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
