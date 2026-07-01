/**
 * TEMP facilitator demo driver — full Claude flow via the REAL participant npm commands
 * (variant / workshop:run* / proxy:setup,rebuild,reset / hooks:setup,reset). Headless: it sets
 * WORKSHOP_TASK so `npm run workshop:run*` runs claude itself (--output-format json, reliable usage)
 * instead of waiting for a 2nd terminal. It also applies the reference solutions (the "эталон" exception).
 *
 *   npx tsx e2e/_demo-run.ts [variant=3]
 *
 * Produces 4 Grafana rows: run1 baseline · run2 hygiene · run3 proxy · run3 hooks (lever-labelled).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..");
const APP = join(REPO, "apps", "angular-demo");
const AGENTS = join(APP, "AGENTS.md");
const PROXY_SRC = join(REPO, "servers", "proxy", "src", "index.ts");
const HOOK_SOLUTION = join(REPO, "workshop", "hooks", "post-tool-use.solution.ts");
const HOOK_DST = join(APP, ".claude", "hooks", "post-tool-use.ts");
const VARIANT = process.argv[2] ?? "3";
const TASK = "Read TASK.md and fix the bug per the ticket's Definition of Done (pull the ticket from the jira MCP, follow its links). Report what you changed when done.";

const OPTIMIZED_AGENTS = `# Agent Instructions — Plata Burrito CRM

Angular 19 app (catalog / orders / edit-card / finance). REST backend at \`/api\`; task context in
5 MCP servers: jira, confluence, sentry, testrail, github.

## Task
Read \`TASK.md\` → ticket number. Pull the ticket from the **jira** MCP (\`jira_get_issue\`): description,
Definition of Done, links to confluence / sentry / testrail. The ticket + MCP context fully define the fix.

## Scope
- Edit ONLY the feature dir named in the ticket (\`src/app/<feature>/\`). Don't explore the rest of the repo.
- The bug is in \`*.controller.ts\`. Don't change \`*.types.ts\`. Tests are \`*.controller.spec.ts\`.
- Keep API contracts and the public controller surface. No new dependencies.

## Output
Apply minimal changes. No preamble. When the fix meets the Definition of Done, report what changed and stop.
`;

const sh = (cmd: string) => { console.log(`\n$ ${cmd}`); execSync(cmd, { cwd: REPO, stdio: "inherit" }); };

async function waitHealth(url: string, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up */ }
    await new Promise((s) => setTimeout(s, 1000));
  }
  throw new Error(`timeout waiting ${url}`);
}

/** Run ONE real `npm run workshop:runN` headless (WORKSHOP_TASK → runner runs claude itself). */
function driveRun(runArg: string): void {
  console.log(`\n$ WORKSHOP_TASK=… npm run workshop:${runArg}`);
  try {
    execSync(`npm run workshop:${runArg}`, {
      cwd: REPO, stdio: "inherit",
      env: { ...process.env, WORKSHOP_TASK: TASK, WORKSHOP_MODEL: "opus" },
    });
  } catch {
    // runner exits 1 on gate FAIL (expected for the bloated baseline) — metric is already sent.
    console.log(`  (workshop:${runArg} exited non-zero — gate likely FAIL; metric already sent, continuing)`);
  }
}

async function main(): Promise<void> {
  console.log(`\n████ DEMO RUN — variant ${VARIANT} (real npm commands, headless) ████`);
  sh(`npm run variant -- ${VARIANT}`);

  // ── RUN 1 — baseline ──
  driveRun("run1");

  // ── RUN 2 — hygiene (apply optimized AGENTS.md — facilitator/эталон exception) ──
  const bloated = readFileSync(AGENTS, "utf8");
  writeFileSync(AGENTS, OPTIMIZED_AGENTS);
  try { driveRun("run2"); } finally { writeFileSync(AGENTS, bloated); }

  // ── RUN 3 — proxy (real commands: proxy:setup → edit code → proxy:rebuild) ──
  sh("npm run proxy:setup");
  const proxyCode = readFileSync(PROXY_SRC, "utf8");
  writeFileSync(PROXY_SRC, proxyCode.replace('const COMPACT = process.env.COMPACT === "1";', "const COMPACT = true; // эталон applied"));
  try {
    sh("npm run proxy:rebuild");
    await waitHealth("http://localhost:9100/health");
    driveRun("run3"); // lever auto-detected = proxy (.mcp.json → :9100)
  } finally {
    writeFileSync(PROXY_SRC, proxyCode);                 // restore passthrough code
    sh("npm run proxy:reset");                           // .mcp.json → direct
    try { sh("npm run proxy:rebuild"); } catch { /* back to passthrough */ }
  }

  // ── RUN 3 — hooks (real commands: hooks:setup → apply solution) ──
  sh("npm run hooks:setup");
  copyFileSync(HOOK_SOLUTION, HOOK_DST);                 // эталон applied
  try {
    driveRun("run3"); // lever auto-detected = hooks (.claude/hooks present, .mcp.json direct)
  } finally {
    sh("npm run hooks:reset");
  }

  // ── final cleanup: roll back any agent edits beyond the scenario reset ──
  sh("git checkout apps/angular-demo/src");
  execSync("git clean -fd apps/angular-demo/src", { cwd: REPO, stdio: "inherit" });
  console.log("\n████ DEMO RUN DONE — 4 rows in Grafana (baseline/hygiene/proxy/hooks) ████");
}

main().catch((e) => { console.error("DEMO ERR", e); process.exit(1); });
