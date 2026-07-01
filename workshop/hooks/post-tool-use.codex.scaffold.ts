/**
 * Codex PostToolUse hook scaffold.
 *
 * Passthrough by default: it reads the hook event, does nothing, and emits no output.
 * Run 3 exercise: compact `tool_response` for MCP tools and emit:
 *   { "decision": "block", "reason": "<compacted replacement>" }
 */

interface HookEvent {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    const event: HookEvent = JSON.parse(input);
    void event;
    // Passthrough: emit nothing, so Codex keeps the original tool result.
  } catch {
    // Malformed hook input: passthrough.
  }
});
