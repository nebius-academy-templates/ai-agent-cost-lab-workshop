/**
 * E2E Test: PostToolUse Hooks A/B
 *
 * Thesis: A PostToolUse hook that compacts bloated MCP responses before
 * they enter the agent's context significantly reduces token consumption
 * vs running without hooks (raw bloated responses in every turn).
 *
 * Run A: hooks disabled → bloated MCP responses go straight to context
 * Run B: hooks enabled  → post-tool-use.ts compacts before context
 */
import { existsSync, mkdirSync, rmSync, cpSync, renameSync } from "node:fs";
import { join } from "node:path";
import { runClaude, printDelta, printCompare, resetScenario } from "./_lib.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const HOOKS_SRC = join(REPO_ROOT, "e2e", "hooks");
const HOOKS_DST = join(REPO_ROOT, "apps", "angular-demo", ".claude", "hooks");
const HOOKS_DISABLED = join(REPO_ROOT, "apps", "angular-demo", ".claude", "hooks.disabled");

// ── Cache-bust seed: unique per test run so Anthropic prompt cache is
// cold. Same seed for Run A + Run B → B reuses schema cache from A,
// making the hook's compaction effect measurable.

const SEED = Math.random().toString(36).slice(2, 8);

// ── Prompt: force agent to use all 5 bloated MCP servers ──────────────

const TASK_PROMPT = `[${SEED}] Read TASK.md and apply all fixes described in the acceptance criteria. Do not change the public API contract or add runtime dependencies. Report what changed when done.`;

// No tool restrictions — agent needs full access to fix code.

// ── hooks toggling ─────────────────────────────────────────────────────

/** Enable hooks: copy post-tool-use.ts to REPO_ROOT/.claude/hooks/ */
function enableHooks() {
  // Remove any previous artifacts
  if (existsSync(HOOKS_DST)) rmSync(HOOKS_DST, { recursive: true });
  if (existsSync(HOOKS_DISABLED)) rmSync(HOOKS_DISABLED, { recursive: true });

  if (!existsSync(HOOKS_SRC)) {
    console.error("  ❌ Hooks source not found:", HOOKS_SRC);
    process.exit(1);
  }

  mkdirSync(join(REPO_ROOT, ".claude"), { recursive: true });
  cpSync(HOOKS_SRC, HOOKS_DST, { recursive: true });
  console.log("  ✅ Hooks enabled (.claude/hooks/post-tool-use.ts active)");
}

/** Disable hooks: rename directory so Claude Code doesn't see it */
function disableHooks() {
  if (existsSync(HOOKS_DST)) {
    if (existsSync(HOOKS_DISABLED)) rmSync(HOOKS_DISABLED, { recursive: true });
    renameSync(HOOKS_DST, HOOKS_DISABLED);
    console.log("  🔒 Hooks disabled (directory renamed)");
  } else {
    console.log("  🔒 Hooks already disabled");
  }
}

/** Restore state: if hooks.disabled exists, rename back */
function restoreHooks() {
  if (existsSync(HOOKS_DST)) rmSync(HOOKS_DST, { recursive: true });
  if (existsSync(HOOKS_DISABLED)) {
    renameSync(HOOKS_DISABLED, HOOKS_DST);
    console.log("  ✅ Hooks restored");
  }
}

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  E2E: PostToolUse Hooks A/B");
  console.log("  Thesis: hooks compact MCP responses →");
  console.log("  fewer tokens in agent context");
  console.log("═══════════════════════════════════════════\n");

  // Verify hooks source exists
  if (!existsSync(HOOKS_SRC)) {
    console.error(`  ❌ Hooks scaffold not found at: ${HOOKS_SRC}`);
    console.error("     Run: npm run setup");
    process.exit(1);
  }

  const hookFiles = existsSync(join(HOOKS_SRC, "post-tool-use.ts"))
    ? "post-tool-use.ts"
    : "none";
  console.log(`  Hook file: ${hookFiles}`);

  // ── Run A: No hooks (bloated MCP → raw context) ─────────────────────
  console.log("\n━━━ Run A: NO hooks (bloated MCP in context) ━━━");
  resetScenario();
  disableHooks();

  const runA = await runClaude(TASK_PROMPT, { model: "opus",
    systemPrompt: `[cache-bust:${SEED}]`,
  });
  if (runA.usage.totalTokens === 0) {
    console.error("  ❌ Run A produced no token data — claude may have failed.");
    restoreHooks();
    process.exit(1);
  }
  printDelta("Run A (no hooks)", runA.usage);

  // ── Run B: With hooks (compact MCP → lean context) ──────────────────
  console.log("\n━━━ Run B: WITH hooks (compact MCP in context) ━━━");
  resetScenario();
  enableHooks();

  const runB = await runClaude(TASK_PROMPT, { model: "opus",
    systemPrompt: `[cache-bust:${SEED}]`,
  });
  if (runB.usage.totalTokens === 0) {
    console.error("  ❌ Run B produced no token data — claude may have failed.");
    restoreHooks();
    process.exit(1);
  }
  printDelta("Run B (hooks)", runB.usage);

  // ── Cleanup ─────────────────────────────────────────────────────────
  restoreHooks();

  // ── Compare ─────────────────────────────────────────────────────────
  console.log("\n━━━ COMPARISON ━━━");
  printCompare("Run A (no hooks)", runA.usage, "Run B (hooks)", runB.usage);

  const reduction =
    runA.usage.totalTokens > 0
      ? (1 - runB.usage.totalTokens / runA.usage.totalTokens) * 100
      : 0;

  console.log(`\n  Thesis: PostToolUse hooks reduce total tokens by ${reduction.toFixed(1)}%`);

  // Also compare per-category for insight
  if (runA.usage.inputTokens > 0 && runB.usage.inputTokens > 0) {
    const inputReduction =
      (1 - runB.usage.inputTokens / runA.usage.inputTokens) * 100;
    console.log(`    Input tokens:  ↓${inputReduction.toFixed(1)}%`);
  }
  if (runA.usage.outputTokens > 0 && runB.usage.outputTokens > 0) {
    const outputReduction =
      (1 - runB.usage.outputTokens / runA.usage.outputTokens) * 100;
    console.log(`    Output tokens: ↓${outputReduction.toFixed(1)}%`);
  }

  console.log(
    `\n  Gate Run A: ${runA.gatePassed ? "✅" : "❌"} | Run B: ${
      runB.gatePassed ? "✅" : "❌"
    }`
  );

  // Exit code: 0 if thesis holds (≥10% reduction), 1 otherwise
  process.exit(reduction >= 10 ? 0 : 1);
}

main();
