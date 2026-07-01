/**
 * proxy:<mode> — point the active agent's MCP config at the bloated direct servers or the compact
 * proxy, and (solution) swap in the reference proxy implementation. The agent is resolved from the
 * persisted choice (`npm run setup -- <agent>`), so one command serves claude|codex|cursor.
 *
 *   npm run proxy:setup      # MCP config → proxy (localhost:9100)
 *   npm run proxy:direct     # MCP config → direct bloated MCP (localhost:9001..9005)
 *   npm run proxy:solution   # proxy setup + reference proxy impl + rebuild
 *   npm run proxy:reset      # back to direct + passthrough proxy stub
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, die } from './_lib';
import { AGENTS, resolveAgent, type AgentName } from './agent';

const PROXY_INDEX = 'servers/proxy/src/index.ts';
const PROXY_SRC = 'servers/proxy/src';

const abs = (rel: string): string => join(REPO_ROOT, rel);

/** Copy a REPO_ROOT-relative file, creating the destination directory if needed. */
export function cp(srcRel: string, destRel: string): void {
  mkdirSync(dirname(abs(destRel)), { recursive: true });
  copyFileSync(abs(srcRel), abs(destRel));
}

/** Restore a tracked path to its committed state. */
export function gitCheckout(rel: string): void {
  execFileSync('git', ['checkout', '--', rel], { cwd: REPO_ROOT, stdio: 'inherit' });
}

/** Drop untracked files under a path (e.g. helper modules an agent added). Leaves gitignored files. */
function gitClean(rel: string): void {
  execFileSync('git', ['clean', '-fdq', '--', rel], { cwd: REPO_ROOT, stdio: 'inherit' });
}

function rebuild(): void {
  execFileSync('docker', ['compose', 'up', '-d', '--build', 'proxy'], { cwd: REPO_ROOT, stdio: 'inherit' });
}

/** MCP config → compact proxy (localhost:9100). */
export function proxySetup(agent: AgentName): void {
  const { proxySrc, mcpDest } = AGENTS[agent].proxy;
  cp(proxySrc, mcpDest);
}

/** MCP config → bloated baseline. claude restores its tracked file; codex/cursor copy a template. */
export function proxyDirect(agent: AgentName): void {
  const { directSrc, mcpDest } = AGENTS[agent].proxy;
  if (directSrc === null) gitCheckout(mcpDest);
  else cp(directSrc, mcpDest);
}

const MODES: Record<string, (agent: AgentName) => void> = {
  setup(agent) {
    proxySetup(agent);
    console.log(`✅ ${agent} MCP config → proxy (localhost:9100). Edit servers/proxy/src/index.ts, then: npm run proxy:rebuild`);
  },
  direct(agent) {
    proxyDirect(agent);
    console.log(`✅ ${agent} MCP config → direct bloated MCP (localhost:9001..9005)`);
  },
  solution(agent) {
    proxySetup(agent);
    cp(AGENTS[agent].proxy.indexSrc, PROXY_INDEX);
    rebuild();
    console.log(`✅ ${agent} proxy reference applied + proxy rebuilt (compact). Now: npm run workshop:run3`);
  },
  reset(agent) {
    proxyDirect(agent);
    // Revert tracked files AND drop untracked ones an agent may have added (mirrors the runner's
    // cleanApp) — a git checkout of index.ts alone leaves new helper files behind.
    gitCheckout(PROXY_SRC);
    gitClean(PROXY_SRC);
    console.log(`✅ ${agent} MCP config → direct + proxy → passthrough baseline (run: npm run proxy:rebuild)`);
  },
};

// Only dispatch when run directly — hooks.ts imports the helpers above without triggering the CLI.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  const run = mode ? MODES[mode] : undefined;
  if (!run) die('usage: proxy.ts <setup|direct|solution|reset>');
  else run(resolveAgent());
}
