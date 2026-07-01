/**
 * MCP mock entrypoint. One process per server, selected by the MCP_SERVER env var; the matching
 * tools are registered and served over Streamable HTTP on PORT.
 */
import { startMcpHttpServer, type RegisterTools } from './http.js';
import { registerConfluence } from './servers/confluence.js';
import { registerJira } from './servers/jira.js';
import { registerSentry } from './servers/sentry.js';
import { registerTestrail } from './servers/testrail.js';
import { registerGithub } from './servers/github.js';

const REGISTRARS: Record<string, RegisterTools> = {
  confluence: registerConfluence,
  jira: registerJira,
  sentry: registerSentry,
  testrail: registerTestrail,
  github: registerGithub,
};

const name = process.env.MCP_SERVER ?? '';
const port = Number(process.env.PORT ?? 9000);
const register = REGISTRARS[name];

if (!register) {
  console.error(`unknown MCP_SERVER "${name}" — expected one of: ${Object.keys(REGISTRARS).join(', ')}`);
  process.exit(1);
}

startMcpHttpServer(name, register, port);
