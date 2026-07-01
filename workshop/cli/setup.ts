/**
 * setup — one-time workshop bootstrap. Picks the coding agent (persisted for every later command),
 * seeds .env, and brings up Docker + MCP + trust.
 *
 *   npm run setup                 # auto-detect the agent (claude|codex|cursor)
 *   npm run setup -- codex        # pick the agent explicitly
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './_lib';
import { AGENT_NAMES, parseAgentArg, resolveAgent, setAgent } from './agent';

// 1. Seed .env from the template on first run.
const env = join(REPO_ROOT, '.env');
if (!existsSync(env)) {
  copyFileSync(join(REPO_ROOT, '.env.example'), env);
  console.log('Created .env from .env.example');
}

// 2. Resolve + persist the agent. An explicit arg wins; otherwise keep the prior choice or auto-detect.
const requested = parseAgentArg(process.argv[2]);
if (process.argv[2] && !requested) {
  console.warn(`  ⚠️  "${process.argv[2]}" not one of ${AGENT_NAMES.join('|')} — auto-detecting instead.`);
}
const agent = requested ?? resolveAgent();
setAgent(agent);

// 3. Bring up infrastructure (idempotent — safe to re-run when switching agents).
const run = (script: string): void => {
  execFileSync('npm', ['run', script], { cwd: REPO_ROOT, stdio: 'inherit' });
};
run('setup:docker');
run('setup:mcp');
run('setup:trust');

console.log(`\n✅ Workshop ready (agent: ${agent}). Pick your variant: npm run variant -- <1|2|3>`);
