/**
 * Codex MCP compact proxy reference solution.
 *
 * Runtime behavior is intentionally the same as the Claude reference proxy: it sits between the
 * agent and the five bloated MCP servers and compacts schemas/results before Codex sees them.
 * This file is separate so Codex workshop setup can copy/apply it without mutating the Claude
 * reference answer in workshop/proxy/index.ts.
 *
 * Use with a Codex project config like workshop/proxy/codex.proxy.config.toml:
 *   [mcp_servers.jira]
 *   url = "http://localhost:9100/mcp?target=jira"
 *
 * Three optimizations:
 *   1. Field filtering: strip mock metadata bloat from tool results.
 *   2. Schema compaction: strip only the known filler tail from tool descriptions.
 *   3. Stateful dedup cache: identical upstream calls return the cached compacted result.
 */
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createHash } from "node:crypto";

const UPSTREAM: Record<string, number> = {
  jira: 9001,
  github: 9002,
  confluence: 9003,
  sentry: 9004,
  testrail: 9005,
};

const PORT = Number(process.env.PORT ?? 9100);
const IN_DOCKER = process.env.IN_DOCKER === "1";

type CallResult = Awaited<ReturnType<Client["callTool"]>>;

const cache = new Map<string, CallResult>();

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
  "self",
  "iconUrl",
  "accountId",
  "emailAddress",
  "html_url",
  "node_id",
]);

const STRIP_ARRAYS = new Set(["contributors", "watchers", "searchMetadata"]);

function stripFiller(value: string): string {
  return value.replace(/\s*This endpoint is part of the enterprise integration suite[\s\S]*$/g, "").trim();
}

function stripBloat(value: unknown): unknown {
  if (typeof value === "string") return stripFiller(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripBloat);

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (STRIP_KEYS.has(key) || STRIP_ARRAYS.has(key)) continue;
    out[key] = stripBloat(child);
  }
  return out;
}

function compactResult<T>(result: T): T {
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return result;

  const compacted = content.map((block) => {
    const b = block as { type?: unknown; text?: unknown };
    if (b.type !== "text" || typeof b.text !== "string") return block;

    try {
      return { ...(block as object), text: JSON.stringify(stripBloat(JSON.parse(b.text))) };
    } catch {
      const text = stripFiller(b.text);
      return text.length < b.text.length ? { ...(block as object), text } : block;
    }
  });

  return { ...result, content: compacted } as T;
}

function compactToolList<T extends { tools?: unknown }>(list: T): T {
  if (!Array.isArray(list.tools)) return list;

  const tools = list.tools.map((item) => {
    if (!item || typeof item !== "object") return item;
    const tool = item as { description?: unknown };
    if (typeof tool.description === "string") {
      return { ...tool, description: stripFiller(tool.description) };
    }
    return item;
  });

  return { ...list, tools };
}

const clients = new Map<string, Promise<Client>>();

function upstream(target: string): Promise<Client> {
  let clientPromise = clients.get(target);
  if (!clientPromise) {
    const client = new Client({ name: "codex-compact-proxy", version: "1.0.0" });
    const host = IN_DOCKER ? target : "localhost";
    const transport = new StreamableHTTPClientTransport(new URL(`http://${host}:${UPSTREAM[target]}/mcp`));
    clientPromise = client.connect(transport).then(() => client);
    clients.set(target, clientPromise);
  }
  return clientPromise;
}

const app = express();
app.use(express.json({ limit: "8mb" }));
app.get("/health", (_req, res) => res.json({ status: "ok", mode: "codex-compact" }));

app.post("/mcp", async (req, res) => {
  const target = String(req.query.target ?? "");
  if (!UPSTREAM[target]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32602, message: `unknown target: ${target}` },
      id: null,
    });
    return;
  }

  const server = new Server({ name: `codex-proxy:${target}`, version: "1.0.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return compactToolList(await (await upstream(target)).listTools());
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const key = createHash("sha256").update(`${target}|${JSON.stringify(request.params)}`).digest("hex");
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const result = compactResult(await (await upstream(target)).callTool(request.params));
    cache.set(key, result);
    return result;
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

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

app.listen(PORT, () => {
  console.log(`[codex-proxy] streamable-http on :${PORT} (compact) -> ${Object.keys(UPSTREAM).join(", ")}`);
});
