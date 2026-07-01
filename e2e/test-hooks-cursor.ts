/**
 * E2E Test: afterMCPExecution Hooks A/B — Cursor
 *
 * Thesis: An afterMCPExecution hook that compacts bloated MCP responses
 * before they enter the agent's context significantly reduces token
 * consumption vs running without hooks.
 *
 * Run A: hooks.json disabled → bloated MCP in context
 * Run B: hooks.json enabled  → compact-mcp.ts compacts before context
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCursor, printDelta, printCompare, type RunResult } from "./_lib.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const HOOKS_JSON = join(REPO_ROOT, "apps", "angular-demo", ".cursor", "hooks.json");
const SOLUTION = join(REPO_ROOT, "workshop", "hooks", "compact-mcp.cursor.ts");
const SCAFFOLD_CMD = "npx tsx .cursor/hooks/compact-mcp.ts"; // committed passthrough болванка

// ── Prompt: force agent to use all 5 bloated MCP servers ──────────────

const TASK_PROMPT = `Use the available MCP tools to gather all information about the task:
1. Read the Jira issue JIRA-0321 (jira_get_issue)
2. Read the Confluence page ENG-CATALOG-PAGINATION (confluence_get_page)
3. Get the Sentry error PLATA-WEB-1F2A (sentry_get_event)
4. Get the TestRail cases for suite S-CATALOG-PAGINATION (testrail_get_cases)
5. Get the TestRail results for run R-LATEST (testrail_get_results)

After collecting all data, summarize in ONE paragraph what needs to be fixed.`;

// ── hooks toggling ─────────────────────────────────────────────────────
// Run A = no hook; Run B = the reference solution; cleanup = the committed passthrough scaffold.

function writeHooks(command: string | null) {
  const hooks = command ? { afterMCPExecution: [{ command, timeout: 30 }] } : {};
  writeFileSync(HOOKS_JSON, JSON.stringify({ version: 1, hooks }, null, 2) + "\n");
}

function disableHooks() { writeHooks(null); console.log("  🔒 Hooks disabled"); }
function enableHooks() { writeHooks(`npx tsx ${SOLUTION}`); console.log("  ✅ Hooks enabled (solution wired)"); }
function restoreScaffold() { writeHooks(SCAFFOLD_CMD); console.log("  ↩︎  Hooks restored to passthrough scaffold"); }

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  E2E: afterMCPExecution Hooks A/B — Cursor");
  console.log("  Thesis: hooks compact MCP responses →");
  console.log("  fewer tokens in agent context");
  console.log("═══════════════════════════════════════════\n");

  // Verify the reference solution exists
  if (!existsSync(SOLUTION)) {
    console.error("  ❌ solution hook missing: workshop/hooks/compact-mcp.cursor.ts");
    process.exit(1);
  }

  // ── Run A: No hooks ─────────────────────────────────────────────────
  console.log("\n━━━ Run A: NO hooks (bloated MCP in context) ━━━");
  disableHooks();

  const runA = await runCursor(TASK_PROMPT);
  if (runA.usage.totalTokens === 0) {
    console.error("  ❌ Run A produced no token data — cursor may have failed.");
    restoreScaffold();
    process.exit(1);
  }
  printDelta("Run A (no hooks)", runA.usage);

  // ── Run B: With hooks ───────────────────────────────────────────────
  console.log("\n━━━ Run B: WITH hooks (compact MCP in context) ━━━");
  enableHooks();

  const runB = await runCursor(TASK_PROMPT);
  if (runB.usage.totalTokens === 0) {
    console.error("  ❌ Run B produced no token data — cursor may have failed.");
    process.exit(1);
  }
  printDelta("Run B (hooks)", runB.usage);

  // ── Cleanup: restore the passthrough scaffold (committed state) ──────
  restoreScaffold();

  // ── Compare ─────────────────────────────────────────────────────────
  console.log("\n━━━ COMPARISON ━━━");
  printCompare("Run A (no hooks)", runA.usage, "Run B (hooks)", runB.usage);

  const reduction =
    runA.usage.totalTokens > 0
      ? (1 - runB.usage.totalTokens / runA.usage.totalTokens) * 100
      : 0;

  console.log(`\n  Thesis: afterMCPExecution hooks reduce total tokens by ${reduction.toFixed(1)}%`);

  if (runA.usage.inputTokens > 0 && runB.usage.inputTokens > 0) {
    const inputReduction = (1 - runB.usage.inputTokens / runA.usage.inputTokens) * 100;
    console.log(`    Input tokens:  ↓${inputReduction.toFixed(1)}%`);
  }
  if (runA.usage.outputTokens > 0 && runB.usage.outputTokens > 0) {
    const outputReduction = (1 - runB.usage.outputTokens / runA.usage.outputTokens) * 100;
    console.log(`    Output tokens: ↓${outputReduction.toFixed(1)}%`);
  }

  console.log(
    `\n  Gate Run A: ${runA.gatePassed ? "✅" : "❌"} | Run B: ${runB.gatePassed ? "✅" : "❌"}`
  );

  process.exit(reduction >= 10 ? 0 : 1);
}

main();
