/**
 * Mark this repo as a trusted workspace in ~/.claude.json so the agent's
 * apps/angular-demo/.claude/settings.json (allow/deny + model) actually applies.
 *
 * Without trust, Claude Code prints "Ignoring N permissions.allow entries … not trusted"
 * and the agent prompts for every tool call. Trust is keyed to the git-root absolute path.
 *
 * Non-fatal: if ~/.claude.json is missing or unparseable, it warns and exits 0.
 */
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const CONFIG = join(homedir(), ".claude.json");

interface ClaudeConfig {
  projects?: Record<string, { hasTrustDialogAccepted?: boolean } | undefined>;
  [key: string]: unknown;
}

if (!existsSync(CONFIG)) {
  console.log("  ⚠️  ~/.claude.json not found — start Claude Code once, then re-run `npm run setup`.");
  process.exit(0);
}

let config: ClaudeConfig;
try {
  config = JSON.parse(readFileSync(CONFIG, "utf8")) as ClaudeConfig;
} catch {
  console.log("  ⚠️  ~/.claude.json is not valid JSON — skipping trust step.");
  process.exit(0);
}

const projects = (config.projects ??= {});
const entry = (projects[REPO_ROOT] ??= {});
const already = entry.hasTrustDialogAccepted === true;
entry.hasTrustDialogAccepted = true;

// Atomic write — never leave the user's global config half-written.
const tmp = `${CONFIG}.workshop.tmp`;
writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", "utf8");
renameSync(tmp, CONFIG);

console.log(`  ✅ Workspace trusted${already ? " (already)" : ""}: ${REPO_ROOT}`);
console.log("     Start the agent FRESH so the trust + settings.json take effect.");
