/**
 * Workshop runner — measurement harness for Claude Code / Codex / Cursor.
 *
 * All agents: interactive (participant opens agent, works, closes) → measure.
 * Claude: parse the pinned --session-id transcript (~/.claude/projects/.../<id>.jsonl) — isolated
 * Codex:  parse newest ~/.codex/sessions rollout since run start (time-window isolated)
 * Cursor: quality gate auto; tokens recorded manually from cursor.com/dashboard/usage
 *
 * Usage:
 *   npm run workshop:run1   # Bloated baseline
 *   npm run workshop:run2   # Hygiene (after optimizing AGENTS.md)
 *   npm run workshop:run3   # Tool layer (after building proxy/hooks)
 *   Agent is picked once at `npm run setup -- <agent>` (WORKSHOP_AGENT= still overrides).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { resetScenario, verify, printDelta, fmt, parseCodexSession, parseClaudeSession, type Snapshot } from "./_lib.js";
import { sendWorkshopMetric } from "./grafana.js";
import { resolveAgent } from "../workshop/cli/agent.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const APP_DIR = join(REPO_ROOT, "apps", "angular-demo");
const RUN = process.argv[2];

if (!RUN || !["run1", "run2", "run3"].includes(RUN)) {
  console.error("Usage: npm run workshop:run1   (or :run2, :run3)");
  process.exit(1);
}

const RUN_NUM = RUN.slice(-1);

const CURSOR_USAGE_URL = "https://cursor.com/dashboard/usage";

/** OSC-8 hyperlink for terminals that support it (VS Code, iTerm, Cursor, …). */
function consoleLink(url: string, label: string): string {
  return `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;
}

function printCursorUsageLink(context: string): void {
  console.log(`  ${context}`);
  console.log(`  ${consoleLink(CURSOR_USAGE_URL, CURSOR_USAGE_URL)}`);
}

// ── agent ──────────────────────────────────────────────────────────────
// The agent is picked once at `npm run setup -- <agent>` and persisted, so every run targets it
// without a WORKSHOP_AGENT= prefix. (resolveAgent still honors WORKSHOP_AGENT as an override.)

function workshopRunCmd(runNum: string): string {
  return `npm run workshop:run${runNum}`;
}

function getGitUser(): string {
  try { return execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim() || "unknown"; } catch { return "unknown"; }
}

function activeScenario(): string {
  try {
    const name = readFileSync(join(REPO_ROOT, ".workshop", "active-scenario"), "utf8").trim();
    if (name) return name;
  } catch {}
  return "catalog-pagination";
}

/** Which lever this run exercises — labels the Grafana metric (esp. Run 3: proxy vs hooks). */
function detectLever(): string {
  if (RUN_NUM === "1") return "baseline";
  if (RUN_NUM === "2") return "hygiene";
  // Run 3 — detect the active tool layer
  try {
    if (readFileSync(join(APP_DIR, ".mcp.json"), "utf8").includes("9100")) return "proxy";
  } catch { /* no .mcp.json */ }
  try {
    if (readFileSync(join(APP_DIR, ".codex", "config.toml"), "utf8").includes("9100")) return "proxy";
  } catch { /* no .codex/config.toml */ }
  try {
    if (readFileSync(join(APP_DIR, ".codex", "hooks.json"), "utf8").includes("PostToolUse")) return "hooks";
  } catch { /* no .codex/hooks.json */ }
  try {
    const cursorMcp = readFileSync(join(APP_DIR, ".cursor", "mcp.json"), "utf8");
    if (cursorMcp.includes("9100")) return "proxy";
    const cursorHooks = readFileSync(join(APP_DIR, ".cursor", "hooks.json"), "utf8");
    if (cursorHooks.includes("afterMCPExecution")) return "hooks";
  } catch { /* no .cursor config */ }
  if (existsSync(join(APP_DIR, ".claude", "hooks", "post-tool-use.ts"))) return "hooks";
  return "tool-layer";
}

// ── saved deltas ───────────────────────────────────────────────────────

const SAVE_DIR = join(REPO_ROOT, ".workshop");
const SAVE_FILE = join(SAVE_DIR, `run-run${RUN_NUM}.json`);

/** Roll back ALL agent edits across the app, not just the active feature. resetScenario() only
 * restores the scenario's feature dir; an agent that touches app-level files (e.g. app.routes.ts)
 * or creates stray files would otherwise leak across runs. Pairs with resetScenario() at each reset. */
function cleanApp(): void {
  execFileSync("git", ["checkout", "--", "apps/angular-demo/src"], { cwd: REPO_ROOT, stdio: "ignore" });
  execFileSync("git", ["clean", "-fdq", "apps/angular-demo/src"], { cwd: REPO_ROOT, stdio: "ignore" });
}

function saveDelta(d: Snapshot, gatePassed: boolean, manualTokens = false) {
  if (!existsSync(SAVE_DIR)) mkdirSync(SAVE_DIR, { recursive: true });
  writeFileSync(SAVE_FILE, JSON.stringify({
    run: RUN, ...d, gatePassed, manualTokens, timestamp: new Date().toISOString(),
  }, null, 2));
}

function loadDelta(n: string) {
  const f = join(SAVE_DIR, `run-run${n}.json`);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, "utf8"));
}

function waitForEnter(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("\n  Press Enter when done…", () => { rl.close(); resolve(); });
  });
}

function compareRuns() {
  const r1 = loadDelta("1");
  if (!r1) { console.log("  Run 1 not yet measured."); return; }

  // Downstream runs belong to THIS workshop only if measured at/after run1. An older (or missing)
  // timestamp means a stale delta from a previous run — flag it and ignore it (don't auto-delete,
  // don't compare against it). Lets a re-run of run1 invalidate leftover run2/run3 by date alone.
  const ts = (r: { timestamp?: string } | null): number => Date.parse(r?.timestamp ?? "");
  const fresh = (r: { timestamp?: string } | null) => r != null && ts(r) >= ts(r1);
  const r2raw = loadDelta("2");
  const r3raw = loadDelta("3");
  const r2 = fresh(r2raw) ? r2raw : null;
  const r3 = fresh(r3raw) ? r3raw : null;
  if (r2raw && !r2) console.log(`  ⚠️  Run 2 delta stale (${String(r2raw.timestamp ?? "no date").slice(0, 10)}, older than run1) — ignored; re-run workshop:run2.`);
  if (r3raw && !r3) console.log(`  ⚠️  Run 3 delta stale (${String(r3raw.timestamp ?? "no date").slice(0, 10)}, older than run1) — ignored; re-run workshop:run3.`);

  // ↓ = reduction (good), ↑ = regression (worse). A hardcoded "↓${pct}" prints "↓-5.6%" when a run grows.
  const pct = (value: number, base: number): string => {
    const change = (1 - value / base) * 100;
    return change >= 0 ? `↓${change.toFixed(1)}%` : `↑${(-change).toFixed(1)}%`;
  };
  const gate = (r: { gatePassed?: boolean } | null): string => (r && r.gatePassed === false ? " (gate FAIL)" : "");
  const manual = r1.manualTokens === true;

  const fmtRun = (r: { totalTokens?: number; totalCost?: number; gatePassed?: boolean; manualTokens?: boolean }, label: string, vsBaseline?: number): void => {
    if (r.manualTokens || (manual && r.totalTokens === 0)) {
      console.log(`  ${label}: gate${gate(r)} | tokens: record from dashboard (not auto-measured)`);
      return;
    }
    const pctStr = vsBaseline !== undefined && vsBaseline > 0 ? ` (${pct(r.totalTokens ?? 0, vsBaseline)} vs baseline)` : "";
    console.log(`  ${label}: ${fmt(r.totalTokens ?? 0)} total | $${Number(r.totalCost ?? 0).toFixed(4)}${pctStr}${gate(r)}`);
  };

  // Three INDEPENDENT optimizations, each measured vs the SAME baseline (run1) — NOT cumulative.
  fmtRun(r1, "Run 1 (baseline):  ");
  if (r2) fmtRun(r2, "Run 2 (hygiene):   ", r1.totalTokens);
  if (r3) fmtRun(r3, "Run 3 (tool layer):", r1.totalTokens);
}

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  const agent = resolveAgent();
  const gitUser = getGitUser();

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Workshop Run ${RUN_NUM} — Measurement`);
  console.log(`  Agent: ${agent} | User: ${gitUser}`);
  console.log(`═══════════════════════════════════════════\n`);

  cleanApp();
  resetScenario();

  // Claude: pin a session id so we read EXACTLY this run's transcript — isolated from any other
  // concurrent claude sessions (no global ccusage).
  const sessionId = randomUUID();

  // Participant works in their agent — started FRESH and AFTER this screen, so config load +
  // MCP warmup land INSIDE the measured window.
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ⚠️  Your agent must NOT be running yet.");
  console.log("  Start it FRESH now — config + MCP load only on");
  console.log("  startup, and must happen INSIDE this window.");
  console.log("");
  console.log("  In a SECOND terminal:");
  console.log("    cd apps/angular-demo");
  if (agent === "claude") {
    console.log(`    claude --session-id ${sessionId}`);
  } else if (agent === "codex") {
    console.log(`    codex`);
  } else {
    console.log("    cursor-agent");
  }
  console.log("");
  console.log("  Read TASK.md, write your prompt, let the agent");
  console.log("  solve the task and report done, then CLOSE it.");
  console.log("  (the agent does NOT run the gate — you grade it");
  console.log("   here after Enter; it never sees the result.)");
  if (agent === "cursor") {
    console.log("");
    console.log("  Cursor tokens: note total tokens/cost from the usage dashboard");
    console.log("  (link printed after you press Enter). Match by runStart below.");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const runStart = Date.now();
  if (agent === "cursor") {
    console.log(`\n  runStart: ${new Date(runStart).toISOString()}`);
  }
  await waitForEnter();

  // Capture usage — per-agent, isolated (no global ccusage):
  let d: Snapshot;
  if (agent === "codex") {
    d = parseCodexSession(runStart);
    console.log(`\n  📊 Codex usage (session): ${fmt(d.inputTokens)} in + ${fmt(d.outputTokens)} out + cache r=${fmt(d.cacheReadTokens)} = ${fmt(d.totalTokens)} total`);
  } else if (agent === "claude") {
    d = parseClaudeSession(APP_DIR, sessionId, runStart);
    console.log(`\n  📊 Claude usage (session ${sessionId.slice(0, 8)}…): ${fmt(d.inputTokens)} in + ${fmt(d.outputTokens)} out + cache r=${fmt(d.cacheReadTokens)} w=${fmt(d.cacheCreationTokens)} = ${fmt(d.totalTokens)} total`);
  } else {
    d = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 };
  }

  printDelta(`Run ${RUN_NUM}`, d);

  if (agent === "cursor") {
    console.log(`\n  ℹ️  Record tokens for runStart ${new Date(runStart).toISOString()}:`);
    printCursorUsageLink("  Open:");
  }

  // Step 4: verify
  console.log("\n🔍 Verifying quality gate…");
  const gatePassed = verify();

  // Step 5: save & send
  saveDelta(d, gatePassed, agent === "cursor");

  sendWorkshopMetric({
    run: Number(RUN_NUM), agent, user: gitUser, task: activeScenario(), lever: detectLever(),
    inputTokens: d.inputTokens, outputTokens: d.outputTokens,
    cacheReadTokens: d.cacheReadTokens, cacheWriteTokens: d.cacheCreationTokens,
    totalTokens: d.totalTokens, totalCost: d.totalCost, gatePassed,
  });

  console.log("\n━━━ WORKSHOP PROGRESS ━━━");
  compareRuns();
  console.log(`\n  Gate: ${gatePassed ? "✅ PASS" : "❌ FAIL"}`);

  // Snapshot what the agent actually wrote (facilitator review / debugging) BEFORE rolling it back.
  try {
    const diff = execFileSync("git", ["diff", "--", "apps/angular-demo/src"], { cwd: REPO_ROOT, encoding: "utf8" });
    if (diff.trim()) writeFileSync(join(SAVE_DIR, `agent-fix-run${RUN_NUM}.diff`), diff);
  } catch { /* best effort */ }

  // Reset BEFORE any exit so even a FAILED run rolls back the agent's edits (verify already ran).
  // WORKSHOP_KEEP=1 skips this so a facilitator can inspect what the agent actually wrote.
  if (!process.env.WORKSHOP_KEEP) {
    cleanApp();
    resetScenario();
  }

  if (!gatePassed) {
    console.error(`\n  ⚠️  Quality gate FAILED. Re-run: ${workshopRunCmd(RUN_NUM)}`);
    process.exit(1);
  }

  console.log(`\n  ✅ Run ${RUN_NUM} measured.`);

  const run2 = workshopRunCmd("2");
  const run3 = workshopRunCmd("3");
  const nextHint = RUN === "run1"
    ? (agent === "cursor" ? `npm run agents:solution → ${run2}` : `optimize AGENTS.md → ${run2}`)
    : RUN === "run2"
      ? (agent === "cursor" ? `npm run proxy:solution or hooks:solution → ${run3}` : `build proxy or hooks → ${run3}`)
      : "wrap up — compare your three runs (Cursor: dashboard tokens)!";

  console.log(`  Next: ${nextHint}`);
}

main();
