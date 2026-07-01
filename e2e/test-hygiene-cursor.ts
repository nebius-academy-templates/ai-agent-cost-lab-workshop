/**
 * E2E Test: AGENTS.md Hygiene — Cursor Agent version.
 */
import { resetScenario, writeText, readText, backup, restore, runCursor, printDelta, printCompare, activeScenario, gitUser, type RunResult } from "./_lib.js";
import { sendWorkshopMetric } from "./grafana.js";

const AGENT = "cursor";

const OPTIMIZED_AGENTS = `# Agent Instructions — Plata Burrito CRM
Angular app. Fix bugs per TASK.md. Read TASK.md for ticket number → pull from jira MCP.
Edit only src/app/ matching your variant. Report done when the fix is complete.
Keep API contracts, no new dependencies.`;

const TASK_PROMPT = `Read TASK.md and apply all fixes described in the acceptance criteria. Do not change the public API contract or add runtime dependencies. Report done when the fix is complete.`;

/** Push one run to Grafana (bloated → run 1, optimized → run 2), same shape as workshop:run*. */
function pushMetric(run: number, r: RunResult): void {
  sendWorkshopMetric({
    run, agent: AGENT, user: gitUser(), task: activeScenario(),
    inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens,
    cacheReadTokens: r.usage.cacheReadTokens, cacheWriteTokens: r.usage.cacheCreationTokens,
    totalTokens: r.usage.totalTokens, totalCost: r.usage.totalCost, gatePassed: r.gatePassed,
  });
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  E2E: AGENTS.md Hygiene — Cursor Agent");
  console.log("═══════════════════════════════════════════\n");

  const agPath = "apps/angular-demo/AGENTS.md";
  const BLOATED_AGENTS = readText(agPath); // use the actual bloated AGENTS.md as baseline

  console.log("━━━ Run A: Bloated AGENTS.md ━━━");
  resetScenario();
  backup(agPath);
  console.log(`  AGENTS.md: ${BLOATED_AGENTS.length} chars (actual bloated version)`);
  const runA = await runCursor(TASK_PROMPT);
  printDelta("Run A (bloated)", runA.usage);
  pushMetric(1, runA);
  if (!runA.gatePassed) { console.error("❌ Gate FAILED Run A"); restore(agPath); process.exit(1); }
  restore(agPath);

  console.log("\n━━━ Run B: Optimized AGENTS.md ━━━");
  resetScenario();
  backup(agPath);
  writeText(agPath, OPTIMIZED_AGENTS);
  const runB = await runCursor(TASK_PROMPT);
  printDelta("Run B (optimized)", runB.usage);
  pushMetric(2, runB);
  if (!runB.gatePassed) { console.error("❌ Gate FAILED Run B"); restore(agPath); process.exit(1); }
  restore(agPath);

  console.log("\n━━━ COMPARISON ━━━");
  printCompare("Run A (bloated)", runA.usage, "Run B (optimized)", runB.usage);
  const reduction = runA.usage.totalTokens > 0 ? (1 - runB.usage.totalTokens / runA.usage.totalTokens) * 100 : 0;
  console.log(`\n  Gate A: ${runA.gatePassed ? "✅" : "❌"} | B: ${runB.gatePassed ? "✅" : "❌"}`);
  console.log(`  Thesis: AGENTS.md hygiene ↓${reduction.toFixed(1)}% total tokens via Cursor`);
  process.exit(reduction > 0 ? 0 : 1);
}

main();
