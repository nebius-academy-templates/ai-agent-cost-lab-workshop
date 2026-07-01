/**
 * MCP proxy — SCAFFOLD (болванка): a pure passthrough between the agent and the 5 bloated MCP servers.
 *
 * One Express process on :9100. Each upstream is reached via `POST /mcp?target=<server>`, so server/tool
 * NAMES are preserved (the agent still sees `jira`, `jira_get_issue`, …) — `.mcp-proxy.json` just points
 * each of the 5 entries at this port. By default it forwards listTools/callTool UNCHANGED.
 *
 * Run 3 exercise: add compaction in the two request handlers below (strip bloat from results, the
 * FILLER tail from tool descriptions, dedup-cache repeats). Reference answer: workshop/proxy/index.ts
 * (or `npm run proxy:solution` to drop it in), then `npm run proxy:rebuild`.
 *
 *   npm start   # passthrough on :9100
 */
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const UPSTREAM: Record<string, number> = { jira: 9001, github: 9002, confluence: 9003, sentry: 9004, testrail: 9005 };
const PORT = Number(process.env.PORT ?? 9100);
// In docker-compose each MCP service is reachable by its name (jira:9001, …); on the host it's localhost.
const IN_DOCKER = process.env.IN_DOCKER === "1";

// ── Upstream clients (lazy, cached per target across requests) ──────────
const clients = new Map<string, Promise<Client>>();
function upstream(target: string): Promise<Client> {
  let c = clients.get(target);
  if (!c) {
    const client = new Client({ name: "proxy", version: "1.0.0" });
    const host = IN_DOCKER ? target : "localhost";
    const transport = new StreamableHTTPClientTransport(new URL(`http://${host}:${UPSTREAM[target]}/mcp`));
    c = client.connect(transport).then(() => client);
    clients.set(target, c);
  }
  return c;
}

// ── Agent-facing HTTP (stateless server per request, like the mocks) ────
const app = express();
app.use(express.json({ limit: "8mb" }));
app.get("/health", (_req, res) => res.json({ status: "ok", mode: "passthrough" }));

app.post("/mcp", async (req, res) => {
  const target = String(req.query.target ?? "");
  if (!UPSTREAM[target]) {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32602, message: `unknown target: ${target}` }, id: null });
    return;
  }

  const server = new Server({ name: `proxy:${target}`, version: "1.0.0" }, { capabilities: { tools: {} } });
  // Passthrough: forward to the upstream unchanged. Run 3 = compact here (see workshop/proxy/index.ts).
  server.setRequestHandler(ListToolsRequestSchema, async () => (await upstream(target)).listTools());
  server.setRequestHandler(CallToolRequestSchema, async (request) => (await upstream(target)).callTool(request.params));

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "proxy error" }, id: null });
    }
  }
});

app.get("/mcp", (_req, res) => res.status(405).json({ error: "method_not_allowed" }));

app.listen(PORT, () => console.log(`[proxy] streamable-http on :${PORT} (passthrough) → ${Object.keys(UPSTREAM).join(", ")}`));
