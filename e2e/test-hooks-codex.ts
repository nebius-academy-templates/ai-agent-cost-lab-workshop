/**
 * E2E Test: PostToolUse Hooks A/B — Codex
 *
 * Thesis: A PostToolUse command hook that compacts bloated MCP responses
 * before they enter the agent's context significantly reduces token
 * consumption vs running without hooks.
 *
 * Run A: hooks.json disabled → bloated MCP in context
 * Run B: hooks.json enabled  → post-tool-use.ts compacts before context
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runCodex, printDelta, printCompare, resetScenario,
  activeScenario, gitUser, type RunResult,
} from "./_lib.js";
import { sendWorkshopMetric } from "./grafana.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const HOOKS_JSON = join(REPO_ROOT, "apps", "angular-demo", ".codex", "hooks.json");

const AGENT = "codex";

// ── Prompt: force agent to use all 5 bloated MCP servers ──────────────

const TASK_PROMPT = `Read TASK.md and apply all fixes described in the acceptance criteria. Do not change the public API contract or add runtime dependencies. Report what changed when done.`;

// ── hooks toggling ─────────────────────────────────────────────────────
// Run A writes an empty (disabled) config; Run B wires the reference solution. The committed
// .codex/hooks.json ships disabled ({}), so the participant baseline is never contaminated.

const SOLUTION = join(REPO_ROOT, "workshop", "hooks", "post-tool-use.codex.ts");

function disableHooks() {
  writeFileSync(HOOKS_JSON, "{}\n");
  console.log("  🔒 Hooks disabled (empty hooks.json)");
}

function enableHooks() {
  const config = {
    hooks: {
      PostToolUse: [
        {
          matcher: "mcp__.*",
          hooks: [
            {
              type: "command",
              command: `npx tsx ${SOLUTION}`,
              timeout: 30,
              statusMessage: "Compacting MCP output",
            },
          ],
        },
      ],
    },
  };
  writeFileSync(HOOKS_JSON, JSON.stringify(config, null, 2) + "\n");
  console.log("  ✅ Hooks enabled (compaction solution wired)");
}

// ── grafana push ──────────────────────────────────────────────────────

function pushMetric(run: number, r: RunResult): void {
  sendWorkshopMetric({
    run, agent: AGENT, user: gitUser(), task: activeScenario(),
    inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens,
    cacheReadTokens: r.usage.cacheReadTokens, cacheWriteTokens: r.usage.cacheCreationTokens,
    totalTokens: r.usage.totalTokens, totalCost: r.usage.totalCost, gatePassed: r.gatePassed,
  });
}

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  E2E: PostToolUse Hooks A/B — Codex");
  console.log("  Thesis: hooks compact MCP responses →");
  console.log("  fewer tokens in agent context");
  console.log("═══════════════════════════════════════════\n");

  // Verify the reference solution exists
  if (!existsSync(SOLUTION)) {
    console.error("  ❌ solution hook missing: workshop/hooks/post-tool-use.codex.ts");
    process.exit(1);
  }

  // ── Run A: No hooks ─────────────────────────────────────────────────
  console.log("\n━━━ Run A: NO hooks (bloated MCP in context) ━━━");
  resetScenario();
  disableHooks();

  const runA = await runCodex(TASK_PROMPT);
  if (runA.usage.totalTokens === 0) {
    console.error("  ❌ Run A produced no token data — codex may have failed.");
    disableHooks();
    process.exit(1);
  }
  printDelta("Run A (no hooks)", runA.usage);
  pushMetric(1, runA);

  // ── Run B: With hooks ───────────────────────────────────────────────
  console.log("\n━━━ Run B: WITH hooks (compact MCP in context) ━━━");
  resetScenario();
  enableHooks();

  const runB = await runCodex(TASK_PROMPT);
  if (runB.usage.totalTokens === 0) {
    console.error("  ❌ Run B produced no token data — codex may have failed.");
    process.exit(1);
  }
  printDelta("Run B (hooks)", runB.usage);
  pushMetric(2, runB);

  // ── Cleanup: leave hooks disabled (clean baseline) ──────────────────
  disableHooks();

  // ── Compare ─────────────────────────────────────────────────────────
  console.log("\n━━━ COMPARISON ━━━");
  printCompare("Run A (no hooks)", runA.usage, "Run B (hooks)", runB.usage);

  const reduction =
    runA.usage.totalTokens > 0
      ? (1 - runB.usage.totalTokens / runA.usage.totalTokens) * 100
      : 0;

  console.log(`\n  Thesis: PostToolUse hooks reduce total tokens by ${reduction.toFixed(1)}%`);

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
