/**
 * workshop:verify-cursor — smoke-check that Cursor workshop config scripts apply correctly.
 *
 * Does NOT run cursor-agent. Verifies filesystem state after each npm script.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const APP = join(REPO_ROOT, "apps", "angular-demo");
const MCP = join(APP, ".cursor", "mcp.json");
const CLI = join(APP, ".cursor", "cli.json");
const PERMS = join(APP, ".cursor", "permissions.json");
const HOOKS = join(APP, ".cursor", "hooks.json");
const HOOK_TS = join(APP, ".cursor", "hooks", "compact-mcp.ts");
const AGENTS = join(APP, "AGENTS.md");

function sh(cmd: string): void {
  execFileSync(cmd, { cwd: REPO_ROOT, stdio: "inherit", shell: true });
}

function read(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

function main(): void {
  console.log("workshop:verify-cursor\n");

  // ── 1. Baseline ──
  // WORKSHOP_AGENT=cursor forces the agent-driven scripts to target cursor regardless of the persisted choice.
  console.log("━━━ 1. Baseline (direct MCP, hooks disabled) ━━━");
  sh("WORKSHOP_AGENT=cursor npm run proxy:direct");
  sh("WORKSHOP_AGENT=cursor npm run hooks:reset");
  assert(read(MCP).includes(":9001"), ".cursor/mcp.json → direct (:9001)");
  assert(!read(MCP).includes("9100"), ".cursor/mcp.json has no proxy port");
  assert(read(CLI).includes("Mcp(jira:jira_get_issue)"), "cli.json allowlists MCP tools");
  assert(read(PERMS).includes("jira:jira_get_issue"), "permissions.json mcpAllowlist present");
  assert(read(PERMS).includes("npx:tsx .cursor/hooks/compact-mcp.ts"), "permissions.json allowlists hook command");
  assert(!read(HOOKS).includes("afterMCPExecution"), "hooks.json has no afterMCPExecution (baseline)");

  // ── 2. AGENTS.md hygiene ──
  console.log("\n━━━ 2. agents:solution (Run 2 hygiene) ━━━");
  const bloatedLen = read(AGENTS).length;
  sh("npm run agents:solution");
  const optimizedLen = read(AGENTS).length;
  assert(optimizedLen < bloatedLen / 2, `AGENTS.md shrunk (${bloatedLen} → ${optimizedLen} chars)`);
  assert(read(AGENTS).includes("Edit ONLY"), "AGENTS.md is the optimized reference");

  // ── 3. Proxy solution (Run 3a) ──
  console.log("\n━━━ 3. proxy:solution [cursor] (Run 3 proxy) ━━━");
  sh("WORKSHOP_AGENT=cursor npm run proxy:solution");
  assert(read(MCP).includes("9100"), ".cursor/mcp.json → proxy (:9100)");

  // ── 4. Hooks solution (Run 3b) ──
  console.log("\n━━━ 4. hooks:solution [cursor] (Run 3 hooks) ━━━");
  sh("WORKSHOP_AGENT=cursor npm run proxy:reset");
  sh("WORKSHOP_AGENT=cursor npm run hooks:solution");
  assert(read(MCP).includes(":9001"), ".cursor/mcp.json → direct for hooks path");
  assert(!read(MCP).includes("9100"), ".cursor/mcp.json has no proxy port (hooks lever)");
  assert(read(HOOKS).includes("afterMCPExecution"), "hooks.json registers afterMCPExecution");
  assert(read(HOOK_TS).includes("compactJira"), "compact-mcp.ts is the reference solution");

  // ── Cleanup ──
  console.log("\n━━━ Cleanup ━━━");
  sh("npm run agents:reset");
  sh("WORKSHOP_AGENT=cursor npm run proxy:reset");
  sh("WORKSHOP_AGENT=cursor npm run hooks:reset");
  assert(read(AGENTS).length > optimizedLen, "AGENTS.md restored to bloated baseline");

  console.log("\n✅ workshop:verify-cursor PASS — Cursor config scripts apply correctly.");
}

main();
