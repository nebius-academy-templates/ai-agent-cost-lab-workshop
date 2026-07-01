/**
 * Agent selection — single source of truth for which coding agent (claude|codex|cursor) the workshop
 * targets. The choice is picked once (`npm run setup -- <agent>`), persisted to .workshop/active-agent,
 * and read by every proxy:* / hooks:* / workshop:run* command — so no per-command WORKSHOP_AGENT
 * prefix is needed across the two-terminal flow.
 *
 * Resolution precedence: WORKSHOP_AGENT env  →  .workshop/active-agent file  →  auto-detect  →  claude.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './_lib';

export const AGENT_NAMES = ['claude', 'codex', 'cursor'] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

function isAgentName(value: string): value is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(value);
}

const STATE_FILE = join(REPO_ROOT, '.workshop', 'active-agent');
const APP = 'apps/angular-demo';

/**
 * Per-agent MCP/proxy config — the only place the three agents differ for the proxy lever.
 * Paths are REPO_ROOT-relative. `directSrc: null` means the bloated baseline lives in a git-tracked
 * file (restore via `git checkout`); otherwise it's a workshop template copied over.
 */
export const AGENTS = {
  claude: {
    proxy: {
      mcpDest: `${APP}/.mcp.json`,
      proxySrc: `${APP}/.mcp-proxy.json`,
      directSrc: null,
      indexSrc: 'workshop/proxy/index.ts',
    },
  },
  codex: {
    proxy: {
      mcpDest: `${APP}/.codex/config.toml`,
      proxySrc: 'workshop/proxy/codex.proxy.config.toml',
      directSrc: 'workshop/proxy/codex.direct.config.toml',
      indexSrc: 'workshop/proxy/index.codex.ts',
    },
  },
  cursor: {
    proxy: {
      mcpDest: `${APP}/.cursor/mcp.json`,
      proxySrc: 'workshop/proxy/cursor.proxy.mcp.json',
      directSrc: 'workshop/proxy/cursor.direct.mcp.json',
      indexSrc: 'workshop/proxy/index.codex.ts',
    },
  },
} as const satisfies Record<AgentName, unknown>;

/** Probe installed agent binaries in priority order. */
export function detectAgent(): AgentName {
  for (const [bin, name] of [['claude', 'claude'], ['codex', 'codex'], ['cursor-agent', 'cursor']] as const) {
    try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return name; } catch { /* not installed */ }
  }
  return 'claude';
}

/** Validate + normalize a user-supplied agent token (CLI arg / env), or undefined if it isn't one. */
export function parseAgentArg(token: string | undefined): AgentName | undefined {
  if (token === undefined) return undefined;
  const value = token.trim().toLowerCase();
  return isAgentName(value) ? value : undefined;
}

/** Persist the chosen agent so every later command targets it. */
export function setAgent(name: AgentName): void {
  mkdirSync(join(REPO_ROOT, '.workshop'), { recursive: true });
  writeFileSync(STATE_FILE, `${name}\n`);
}

function readState(): AgentName | undefined {
  try {
    return parseAgentArg(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return undefined; // no state file yet
  }
}

/** Resolve the target agent: WORKSHOP_AGENT env → persisted state → auto-detect → claude. */
export function resolveAgent(): AgentName {
  const forced = process.env.WORKSHOP_AGENT?.trim().toLowerCase();
  if (forced) {
    if (isAgentName(forced)) return forced;
    console.warn(`  ⚠️  WORKSHOP_AGENT="${forced}" not one of ${AGENT_NAMES.join('|')} — ignoring.`);
  }
  return readState() ?? detectAgent();
}
