/**
 * hooks:<mode> — opt into / out of the Run 3 "hooks" lever for the active agent. Each agent registers
 * a post-MCP hook differently (Claude: settings.json PostToolUse; Codex: .codex/hooks.json PostToolUse;
 * Cursor: .cursor/hooks.json afterMCPExecution), so this dispatches on the resolved agent.
 *
 *   npm run hooks:setup      # install the passthrough hook scaffold + register it
 *   npm run hooks:solution   # install the reference compaction hook (MCP → direct)
 *   npm run hooks:reset      # remove / disable the hook (back to direct MCP)
 *
 * Reference answers: workshop/hooks/post-tool-use.solution.ts (claude), .codex.ts, compact-mcp.cursor.ts.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, die } from './_lib';
import { resolveAgent, type AgentName } from './agent';
import { cp, gitCheckout, proxyDirect } from './proxy';

type Mode = 'setup' | 'solution' | 'reset';

const abs = (rel: string): string => join(REPO_ROOT, rel);
const ensureDir = (rel: string): void => { mkdirSync(abs(rel), { recursive: true }); };

// ── Claude — registers the hook programmatically in .claude/settings.json ────────────────────────
const CLAUDE_SETTINGS = 'apps/angular-demo/.claude/settings.json';
const CLAUDE_HOOK = 'apps/angular-demo/.claude/hooks/post-tool-use.ts';

function claudeRegister(): void {
  const settings = JSON.parse(readFileSync(abs(CLAUDE_SETTINGS), 'utf8')) as Record<string, unknown>;
  settings.hooks = {
    PostToolUse: [
      {
        matcher: 'mcp__.*',
        hooks: [{ type: 'command', command: 'npx tsx ${CLAUDE_PROJECT_DIR}/.claude/hooks/post-tool-use.ts', timeout: 30 }],
      },
    ],
  };
  writeFileSync(abs(CLAUDE_SETTINGS), JSON.stringify(settings, null, 2) + '\n');
}

// ── per-agent handlers ───────────────────────────────────────────────────────────────────────────
const HANDLERS: Record<AgentName, Record<Mode, () => void>> = {
  claude: {
    setup() {
      ensureDir(dirname(CLAUDE_HOOK));
      cp('workshop/hooks/post-tool-use.ts', CLAUDE_HOOK);
      claudeRegister();
      console.log('✅ Claude hooks installed: .claude/hooks/post-tool-use.ts (passthrough) + registered in settings.json.');
      console.log('   Edit that file to compact MCP results (reference: workshop/hooks/post-tool-use.solution.ts), then re-run claude.');
    },
    solution() {
      gitCheckout('apps/angular-demo/.mcp.json');
      this.setup();
      cp('workshop/hooks/post-tool-use.solution.ts', CLAUDE_HOOK);
      console.log('✅ Claude hooks reference applied (.mcp.json=direct, hook registered). Now: npm run workshop:run3');
    },
    reset() {
      if (existsSync(abs(CLAUDE_HOOK))) rmSync(abs(CLAUDE_HOOK));
      const settings = JSON.parse(readFileSync(abs(CLAUDE_SETTINGS), 'utf8')) as Record<string, unknown>;
      delete settings.hooks;
      writeFileSync(abs(CLAUDE_SETTINGS), JSON.stringify(settings, null, 2) + '\n');
      console.log('✅ Claude hooks removed + unregistered (back to direct MCP).');
    },
  },
  codex: {
    setup() {
      ensureDir('apps/angular-demo/.codex/hooks');
      cp('workshop/hooks/post-tool-use.codex.scaffold.ts', 'apps/angular-demo/.codex/hooks/post-tool-use.ts');
      cp('workshop/hooks/hooks.codex.json', 'apps/angular-demo/.codex/hooks.json');
      console.log('✅ Codex hook scaffold installed + registered. Edit apps/angular-demo/.codex/hooks/post-tool-use.ts, then: npm run workshop:run3');
    },
    solution() {
      proxyDirect('codex');
      this.setup();
      cp('workshop/hooks/post-tool-use.codex.ts', 'apps/angular-demo/.codex/hooks/post-tool-use.ts');
      console.log('✅ Codex hooks reference applied (.codex/config.toml=direct, hook registered). Now: npm run workshop:run3');
    },
    reset() {
      ensureDir('apps/angular-demo/.codex/hooks');
      cp('workshop/hooks/post-tool-use.codex.scaffold.ts', 'apps/angular-demo/.codex/hooks/post-tool-use.ts');
      writeFileSync(abs('apps/angular-demo/.codex/hooks.json'), '{}\n');
      console.log('✅ Codex hooks disabled + scaffold restored.');
    },
  },
  cursor: {
    setup() {
      ensureDir('apps/angular-demo/.cursor/hooks');
      cp('workshop/hooks/hooks.cursor.json', 'apps/angular-demo/.cursor/hooks.json');
      console.log('✅ Cursor hook scaffold registered (.cursor/hooks/compact-mcp.ts passthrough). Edit it, then: npm run workshop:run3');
    },
    solution() {
      proxyDirect('cursor');
      cp('workshop/hooks/compact-mcp.cursor.ts', 'apps/angular-demo/.cursor/hooks/compact-mcp.ts');
      cp('workshop/hooks/hooks.cursor.json', 'apps/angular-demo/.cursor/hooks.json');
      console.log('✅ Cursor hooks reference applied (.cursor/mcp.json=direct, afterMCPExecution registered). Now: npm run workshop:run3');
    },
    reset() {
      cp('workshop/hooks/hooks.cursor.disabled.json', 'apps/angular-demo/.cursor/hooks.json');
      gitCheckout('apps/angular-demo/.cursor/hooks/compact-mcp.ts');
      console.log('✅ Cursor hooks disabled + passthrough scaffold restored.');
    },
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== 'setup' && mode !== 'solution' && mode !== 'reset') die('usage: hooks.ts <setup|solution|reset>');
  else HANDLERS[resolveAgent()][mode]();
}
