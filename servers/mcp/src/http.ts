/** Streamable-HTTP host for the MCP mocks. One Express process per server (selected by env). */
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export type RegisterTools = (server: McpServer) => void;

export function startMcpHttpServer(name: string, register: RegisterTools, port: number): void {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', server: name }));

  // Stateless Streamable HTTP: a fresh server + transport per request avoids cross-request state.
  app.post('/mcp', async (req, res) => {
    const server = new McpServer({ name, version: '1.0.0' });
    register(server);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'internal error' }, id: null });
      }
    }
  });

  app.get('/mcp', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));

  app.listen(port, () => console.log(`[mcp:${name}] streamable-http on http://localhost:${port}/mcp`));
}
