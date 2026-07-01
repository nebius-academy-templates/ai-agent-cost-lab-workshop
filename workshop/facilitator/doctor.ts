/**
 * workshop:doctor — preflight check for the workshop environment.
 *
 * Verifies: toolchain, product, scenarios, MCP servers, agent configs in apps/angular-demo/,
 * Docker containers, ccusage. Exit code 0 unless any check is `fail`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCENARIOS } from '../cli/scenarios';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_DIR = resolve(REPO_ROOT, 'apps', 'angular-demo');

type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';
interface CheckResult { readonly name: string; readonly status: CheckStatus; readonly detail: string; }
type Check = () => CheckResult;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}
function present(...rel: string[]): boolean {
  return rel.every((p) => existsSync(resolve(REPO_ROOT, p)));
}
function presentApp(...rel: string[]): boolean {
  return rel.every((p) => existsSync(resolve(APP_DIR, p)));
}

const checks: readonly Check[] = [
  function nodeVersion(): CheckResult {
    const v = process.versions.node;
    return Number(v.split('.')[0]) >= 20
      ? { name: 'node version', status: 'ok', detail: `v${v} (>= 20)` }
      : { name: 'node version', status: 'fail', detail: `v${v} < required v20` };
  },
  function gitRepo(): CheckResult {
    try { git(['rev-parse', '--is-inside-work-tree']); return { name: 'git repository', status: 'ok', detail: `branch ${git(['branch', '--show-current']) || '(detached)'}` }; }
    catch { return { name: 'git repository', status: 'fail', detail: 'not a git repository' }; }
  },
  function product(): CheckResult {
    return presentApp('package.json', 'src/main.ts', 'angular.json')
      ? { name: 'angular product', status: 'ok', detail: 'apps/angular-demo runnable' }
      : { name: 'angular product', status: 'fail', detail: 'apps/angular-demo incomplete' };
  },
  function scenarioAssets(): CheckResult {
    const scenarios = Object.values(SCENARIOS);
    const missing = scenarios.flatMap((s) =>
      [s.baselineDir, s.taskFile, s.referenceJestConfig].filter((p) => !existsSync(p)),
    );
    return missing.length === 0
      ? { name: 'scenario + quality gate', status: 'ok', detail: `${scenarios.length} scenarios ready` }
      : { name: 'scenario + quality gate', status: 'fail', detail: `missing ${missing.length} assets` };
  },
  function backends(): CheckResult {
    return present('docker-compose.yml', 'apps/angular-demo/mock-server/package.json', 'servers/mcp/package.json')
      ? { name: 'backends (docker)', status: 'ok', detail: 'docker-compose + servers present' }
      : { name: 'backends (docker)', status: 'warn', detail: 'missing docker files' };
  },
  function dockerRunning(): CheckResult {
    try {
      const out = execFileSync('docker', ['compose', 'ps', '--format', 'json'], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10000 });
      const containers = out.trim().split('\n').filter(Boolean).length;
      return containers >= 5
        ? { name: 'docker containers', status: 'ok', detail: `${containers} running (run npm run setup:docker if not)` }
        : { name: 'docker containers', status: 'warn', detail: `${containers} running, expected 6` };
    } catch {
      return { name: 'docker containers', status: 'warn', detail: 'not running — npm run setup:docker' };
    }
  },
  function appMCP(): CheckResult {
    return presentApp('.mcp.json')
      ? { name: 'MCP config (app)', status: 'ok', detail: 'apps/angular-demo/.mcp.json present' }
      : { name: 'MCP config (app)', status: 'fail', detail: 'missing apps/angular-demo/.mcp.json' };
  },
  function appClaude(): CheckResult {
    return presentApp('.claude/settings.json')
      ? { name: 'Claude config (app)', status: 'ok', detail: 'permissions + model configured' }
      : { name: 'Claude config (app)', status: 'warn', detail: 'no .claude/settings.json in app dir' };
  },
  function agentsAGENTS(): CheckResult {
    return presentApp('AGENTS.md')
      ? { name: 'AGENTS.md (app)', status: 'ok', detail: 'participant agent config present' }
      : { name: 'AGENTS.md (app)', status: 'fail', detail: 'missing apps/angular-demo/AGENTS.md' };
  },
  function activeTask(): CheckResult {
    return presentApp('TASK.md')
      ? { name: 'active task', status: 'ok', detail: 'TASK.md present (npm run variant -- N to pick)' }
      : { name: 'active task', status: 'warn', detail: 'no TASK.md — npm run variant -- 1' };
  },
  function cursorConfig(): CheckResult {
    const hasMcp = presentApp('.cursor/mcp.json');
    const hasHook = presentApp('.cursor/hooks/compact-mcp.ts');
    const hasCli = presentApp('.cursor/cli.json');
    const hasPerms = presentApp('.cursor/permissions.json');
    if (hasMcp && hasHook && hasCli && hasPerms) {
      return { name: 'Cursor config (app)', status: 'ok', detail: '.cursor/mcp + cli.json + permissions.json + hooks' };
    }
    if (!hasMcp && !hasHook && !hasCli && !hasPerms) {
      return { name: 'Cursor config (app)', status: 'warn', detail: 'run WORKSHOP_AGENT=cursor npm run proxy:direct' };
    }
    return { name: 'Cursor config (app)', status: 'warn', detail: 'incomplete .cursor/ — WORKSHOP_AGENT=cursor npm run proxy:direct' };
  },
  function tracker(): CheckResult {
    try {
      const v = execFileSync('npx', ['--yes', 'ccusage@latest', '--version'], { encoding: 'utf8', timeout: 60000 }).trim();
      return { name: 'ccusage', status: 'ok', detail: `ccusage ${v}` };
    } catch { return { name: 'ccusage', status: 'warn', detail: 'not resolvable (npx will fetch)' }; }
  },
  function installedAgents(): CheckResult {
    const found: string[] = [];
    try { execFileSync('claude', ['--version'], { stdio: 'ignore' }); found.push('claude'); } catch {}
    try { execFileSync('codex', ['--version'], { stdio: 'ignore' }); found.push('codex'); } catch {}
    try { execFileSync('cursor-agent', ['--version'], { stdio: 'ignore' }); found.push('cursor'); } catch {}
    return found.length > 0
      ? { name: 'agents installed', status: 'ok', detail: found.join(', ') }
      : { name: 'agents installed', status: 'fail', detail: 'none — install Claude Code, Codex, or cursor-agent' };
  },
];

const GLYPH: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗', skip: '–' };

function main(): void {
  const results = checks.map((check) => check());
  const width = Math.max(...results.map((r) => r.name.length));
  process.stdout.write('workshop:doctor\n');
  for (const r of results) process.stdout.write(`  ${GLYPH[r.status]} ${r.name.padEnd(width)}  ${r.detail}\n`);
  const failed = results.filter((r) => r.status === 'fail');
  const warned = results.filter((r) => r.status === 'warn');
  process.stdout.write(`\n${failed.length === 0 ? 'PASS' : 'FAIL'} — ${results.length} checks, ${failed.length} failed, ${warned.length} warning(s)\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
