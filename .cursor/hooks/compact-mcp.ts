/**
 * Cursor postToolUse hook — scaffold (passthrough by default).
 *
 * Cursor runs project hooks from the git root's .cursor/hooks.json. For MCP tools the event on stdin
 * carries `tool_name` ("MCP:<tool>") and `tool_output` — the MCP result as a JSON string,
 * {"content":[{"type":"text","text":"<json>"}]}. To replace what the model sees, print
 *   { "updated_mcp_tool_output": { "content": [{ "type": "text", "text": "<compacted>" }] } }
 * and exit 0. Printing nothing keeps the original result.
 *
 * Run 3 exercise: fill in `compactText` to strip bloat / truncate per tool before the result reaches
 * the agent's context. Reference answer: workshop/hooks/compact-mcp.cursor.ts.
 */
interface HookEvent {
  tool_name?: string;
  tool_output?: string;
}

function compactText(_toolName: string, text: string): string {
  // TODO (Run 3): compact based on the tool (MCP:jira_get_issue / MCP:confluence_get_page / …).
  return text;
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk.toString(); });
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input) as HookEvent;
    const result = JSON.parse(event.tool_output ?? "{}") as { content?: { type?: string; text?: string }[] };
    if (!Array.isArray(result.content)) return;
    const content = result.content.map((block) =>
      block.type === "text" && typeof block.text === "string" ? { ...block, text: compactText(event.tool_name ?? "", block.text) } : block);
    const before = JSON.stringify(result.content).length;
    const after = JSON.stringify(content).length;
    if (after < before) process.stdout.write(JSON.stringify({ updated_mcp_tool_output: { ...result, content } }));
  } catch {
    // Malformed event: print nothing, Cursor keeps the original result.
  }
});
