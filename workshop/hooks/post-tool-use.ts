/**
 * Claude Code PostToolUse hook — scaffold (passthrough by default).
 *
 * `npm run hooks:setup` installs this file into apps/angular-demo/.claude/hooks/post-tool-use.ts and
 * registers it in .claude/settings.json. By default it passes every result through unchanged.
 *
 * Stdin: { tool_name: "mcp__<server>__<tool>", tool_response: [{ type:"text", text:"<json>" }], ... }.
 * To compact the result the MODEL sees, emit on stdout (exit 0):
 *   { "hookSpecificOutput": { "hookEventName": "PostToolUse", "updatedToolOutput": "<compacted text>" } }
 * Emit nothing → the original (bloated) result is kept (the default below).
 *
 * Run 3 exercise: in `compact`, extract the text blocks from tool_response, strip bloat / truncate
 * each, and return the joined string. Reference answer: workshop/hooks/post-tool-use.solution.ts.
 */

function compact(toolName: string, toolResponse: unknown): string | null {
  // TODO (Run 3): parse toolResponse ([{type:"text", text:"<json>"}]), compact each text block,
  // return the joined compacted string. Return null to pass through unchanged (current behaviour).
  void toolName;
  void toolResponse;
  return null;
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    const e = JSON.parse(input) as { tool_name?: string; tool_response?: unknown };
    const name = e.tool_name ?? "";
    if (name.startsWith("mcp__")) {
      const updated = compact(name, e.tool_response);
      if (updated !== null) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: updated },
        }));
        return;
      }
    }
  } catch { /* malformed → passthrough */ }
  // emit nothing → original result is kept
});
