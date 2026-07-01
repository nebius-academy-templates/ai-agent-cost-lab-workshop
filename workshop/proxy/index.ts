/**
 * MCP compact proxy — REFERENCE SOLUTION (эталон) for the Run 3 "proxy" lever.
 *
 * The default scaffold (servers/proxy/src/index.ts) is a PURE passthrough. This file is the answer:
 * the same proxy with the optimizations turned on. Apply it with `npm run proxy:solution`
 * (copies this over servers/proxy/src/index.ts) then `npm run proxy:rebuild`.
 *
 * Three optimizations — all SAFE (they never hide data the agent needs):
 *   1. Field filtering — strip the metadataBloat fields from tool RESULTS (the agent never uses them).
 *   2. Schema compaction — strip only the FILLER tail from tool DESCRIPTIONS (re-sent every turn);
 *      the real description + parameters stay. (A blind truncate would drop real params → the agent
 *      misreads the tool → over-engineers. So we strip the known boilerplate, not by length.)
 *   3. Dedup cache — STATEFUL (a per-call hook can't): an identical (target, tool, args) call returns
 *      the REAL cached (already-compacted) result, not a "{_unchanged}" marker. Returning a marker
 *      hides the data → the agent loops/over-reasons (that mistake tripled Run 3's output tokens).
 *      Transparent caching avoids the upstream round-trip without confusing the model.
 */
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createHash } from "node:crypto";

const UPSTREAM: Record<string, number> = { jira: 9001, github: 9002, confluence: 9003, sentry: 9004, testrail: 9005 };
const PORT = Number(process.env.PORT ?? 9100);
// In docker-compose each MCP service is reachable by its name (jira:9001, …); on the host it's localhost.
const IN_DOCKER = process.env.IN_DOCKER === "1";

type CallResult = Awaited<ReturnType<Client["callTool"]>>;

// Dedup cache (STATEFUL): identical (target, tool, args) seen this session → return the cached result.
const cache = new Map<string, CallResult>();

// ── Optimization 1: field filtering — drop the metadataBloat fields the agent never uses ────────
const STRIP_KEYS = new Set([
  "metadata", "createdBy", "createdAt", "lastReviewedBy", "lastReviewedAt", "reviewIntervalDays",
  "ownerTeam", "stakeholderTeams", "correlationId", "auditTrailUrl", "viewCount", "uniqueViewers",
]);
const STRIP_ARRAYS = new Set(["contributors", "watchers", "searchMetadata"]);

function stripBloat(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripBloat);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (STRIP_KEYS.has(k) || STRIP_ARRAYS.has(k)) continue;
    out[k] = stripBloat(v);
  }
  return out;
}

/** Compact a tool result: strip bloat from each text block's JSON payload. Generic identity keeps
 * the SDK's CallToolResult union type intact for the request handler. */
function compactResult<T>(result: T): T {
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return result;
  const compacted = content.map((block) => {
    const b = block as { type?: unknown; text?: unknown };
    if (b.type !== "text" || typeof b.text !== "string") return block;
    try {
      return { ...(block as object), text: JSON.stringify(stripBloat(JSON.parse(b.text))) };
    } catch {
      return block;
    }
  });
  return { ...result, content: compacted } as T;
}

// ── Optimization 2: schema compaction — strip ONLY the FILLER tail from tool descriptions ───────
// The mock appends a fixed marketing/compliance boilerplate (servers/mcp/src/bloat.ts FILLER) to
// every description. Remove it; keep the real description + parameter hints. (Length-based truncation
// would cut real content — that broke Run 3.)
const FILLER_RE = /\s*This endpoint is part of the enterprise integration suite[\s\S]*$/;
function compactToolList<T extends { tools?: unknown }>(list: T): T {
  if (!Array.isArray(list.tools)) return list;
  const tools = list.tools.map((t) => {
    if (!t || typeof t !== "object") return t;
    const tool = t as { description?: unknown };
    if (typeof tool.description === "string") {
      return { ...tool, description: tool.description.replace(FILLER_RE, "").trim() };
    }
    return t;
  });
  return { ...list, tools };
}

// ── Upstream clients (lazy, cached per target across requests) ──────────
const clients = new Map<string, Promise<Client>>();
function upstream(target: string): Promise<Client> {
  let c = clients.get(target);
  if (!c) {
    const client = new Client({ name: "compact-proxy", version: "1.0.0" });
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
app.get("/health", (_req, res) => res.json({ status: "ok", mode: "compact" }));

app.post("/mcp", async (req, res) => {
  const target = String(req.query.target ?? "");
  if (!UPSTREAM[target]) {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32602, message: `unknown target: ${target}` }, id: null });
    return;
  }

  const server = new Server({ name: `proxy:${target}`, version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return compactToolList(await (await upstream(target)).listTools()); // schema compaction
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const key = createHash("sha256").update(`${target}|${JSON.stringify(request.params)}`).digest("hex");
    const hit = cache.get(key);
    if (hit !== undefined) return hit; // dedup: return the REAL cached (compacted) result — no marker
    const result = compactResult(await (await upstream(target)).callTool(request.params)); // field filtering
    cache.set(key, result);
    return result;
  });

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

app.listen(PORT, () => console.log(`[proxy] streamable-http on :${PORT} (COMPACT эталон) → ${Object.keys(UPSTREAM).join(", ")}`));
