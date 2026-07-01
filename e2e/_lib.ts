/**
 * E2E test harness — shared helpers for proving optimization theses.
 *
 * Each test runs `claude -p` (non-interactive) so ccusage captures exactly
 * one session boundary per invocation. No workshop noise.
 *
 * Usage (from repo root):
 *   npx tsx e2e/test-hygiene.ts
 *   npx tsx e2e/test-proxy.ts
 */
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync, readFileSync, readdirSync, existsSync, cpSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REPO_ROOT = join(import.meta.dirname, "..");

/** Active workshop scenario (from .workshop/active-scenario); defaults to catalog-pagination. */
export function activeScenario(): string {
  try {
    const name = readFileSync(join(REPO_ROOT, ".workshop", "active-scenario"), "utf8").trim();
    if (name) return name;
  } catch { /* fall through */ }
  return "catalog-pagination";
}

/** Git user.name for metric attribution, or "unknown". */
export function gitUser(): string {
  try { return execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim() || "unknown"; } catch { return "unknown"; }
}

export interface Snapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  totalCost: number;
}

// ── ccusage ────────────────────────────────────────────────────────────

/** Capture cumulative ccusage snapshot (ALL sessions). */
export function snapshot(): Snapshot {
  const raw = execFileSync("npx", ["--yes", "ccusage@latest", "session", "--json"], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: REPO_ROOT,
  });
  const parsed = JSON.parse(raw) as { session?: Array<Record<string, number>> };
  return (parsed.session ?? []).reduce<Snapshot>(
    (acc, s) => ({
      inputTokens: acc.inputTokens + (s.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (s.outputTokens ?? 0),
      cacheReadTokens: acc.cacheReadTokens + (s.cacheReadTokens ?? 0),
      cacheCreationTokens: acc.cacheCreationTokens + (s.cacheCreationTokens ?? 0),
      totalTokens: acc.totalTokens + (s.totalTokens ?? 0),
      totalCost: acc.totalCost + (s.totalCost ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 },
  );
}

export function delta(after: Snapshot, before: Snapshot): Snapshot {
  return {
    inputTokens: after.inputTokens - before.inputTokens,
    outputTokens: after.outputTokens - before.outputTokens,
    cacheReadTokens: after.cacheReadTokens - before.cacheReadTokens,
    cacheCreationTokens: after.cacheCreationTokens - before.cacheCreationTokens,
    totalTokens: after.totalTokens - before.totalTokens,
    totalCost: after.totalCost - before.totalCost,
  };
}

// ── scenario / quality gate ────────────────────────────────────────────

export function resetScenario() {
  execFileSync("npx", ["tsx", "workshop/cli/scenario-reset.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
}

export function verify(): boolean {
  try {
    execFileSync("npx", ["tsx", "workshop/cli/scenario-verify.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

// ── file helpers ───────────────────────────────────────────────────────

export function writeJson(path: string, data: unknown) {
  writeFileSync(join(REPO_ROOT, path), JSON.stringify(data, null, 2), "utf8");
}

export function writeText(path: string, text: string) {
  writeFileSync(join(REPO_ROOT, path), text, "utf8");
}

export function readText(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

export function backup(path: string): string {
  const src = join(REPO_ROOT, path);
  const bak = src + ".e2e-bak";
  if (existsSync(src)) cpSync(src, bak);
  return bak;
}

export function restore(path: string) {
  const src = join(REPO_ROOT, path);
  const bak = src + ".e2e-bak";
  if (existsSync(bak)) {
    cpSync(bak, src);
    rmSync(bak);
  }
}

// ── claude invocation ──────────────────────────────────────────────────

export interface RunResult {
  usage: Snapshot;
  gatePassed: boolean;
}

const ZERO_USAGE: Snapshot = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 };

/**
 * Parse per-invocation usage + cost from `claude -p --output-format json` stdout.
 * The json format prints one result object; we also scan lines as a fallback if
 * stray output precedes it.
 */
function parseClaudeUsage(stdout: string): Snapshot {
  const trimmed = stdout.trim();
  if (!trimmed) return { ...ZERO_USAGE };
  for (const candidate of [trimmed, ...trimmed.split("\n").reverse()]) {
    try {
      const obj = JSON.parse(candidate) as { usage?: Record<string, number>; total_cost_usd?: number };
      const u = obj?.usage;
      if (!u) continue;
      const input = u.input_tokens ?? 0;
      const output = u.output_tokens ?? 0;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      const cacheCreate = u.cache_creation_input_tokens ?? 0;
      return {
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheCreationTokens: cacheCreate,
        totalTokens: input + output + cacheRead + cacheCreate,
        totalCost: obj.total_cost_usd ?? 0,
      };
    } catch { /* try next candidate */ }
  }
  console.error("  ⚠️  could not parse claude usage from --output-format json output");
  return { ...ZERO_USAGE };
}

/**
 * Run `claude -p --output-format json <prompt>` and return per-invocation usage + gate status.
 * Usage comes from claude's OWN result json (not global ccusage), so concurrent claude
 * sessions in other shells can't contaminate the measurement.
 */
export function runClaude(prompt: string, opts: {
  model?: string;
  mcpConfig?: string;
  noMcp?: boolean;
  allowedTools?: string[];
  systemPrompt?: string;
} = {}): Promise<RunResult> {
  const args: string[] = ["--dangerously-skip-permissions", "--output-format", "json", "-p", prompt];

  if (opts.model) args.unshift("--model", opts.model);
  // Resolve mcp-config against repo root — claude runs with cwd=apps/angular-demo (below),
  // so a repo-relative path would otherwise break.
  if (opts.mcpConfig) args.unshift("--mcp-config", join(REPO_ROOT, opts.mcpConfig));
  if (opts.noMcp) args.unshift("--no-mcp");
  if (opts.systemPrompt) args.unshift("--append-system-prompt", opts.systemPrompt);
  if (opts.allowedTools) {
    args.unshift("--allowedTools", opts.allowedTools.join(","));
  }

  console.log(`\n  → claude is working (--output-format json, this may take 1–10 minutes)…\n`);

  return new Promise((resolve) => {
    let settled = false;
    const done = (r: RunResult) => { if (!settled) { settled = true; resolve(r); } };

    const child = spawn("claude", args, {
      cwd: join(REPO_ROOT, "apps", "angular-demo"),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });

    child.on("error", (err) => {
      console.error(`  ✗ claude failed to start: ${err.message}`);
      done({ usage: { ...ZERO_USAGE }, gatePassed: false });
    });

    child.on("close", (code) => {
      if (code !== 0) console.error(`\n  ✗ claude exited with code ${code}`);
      const usage = parseClaudeUsage(stdout);
      console.log(`\n  📊 Claude: ${usage.inputTokens} in + ${usage.outputTokens} out + cache r=${usage.cacheReadTokens} w=${usage.cacheCreationTokens} = ${usage.totalTokens} total ($${usage.totalCost.toFixed(4)})`);
      const gate = verify();
      done({ usage, gatePassed: gate });
    });

    setTimeout(() => {
      console.error("\n  ✗ claude timed out after 10 minutes — parsing whatever it emitted");
      child.kill();
      // 'close' fires after kill → parses stdout (the result json is usually already printed)
    }, 600_000);
  });
}

// ── codex usage + pricing ───────────────────────────────────────────────

/** Codex model from ~/.codex/config.toml top-level `model = "..."` (no per-event model field); default gpt-5.5. */
function codexModel(): string {
  try {
    for (const line of readFileSync(join(homedir(), ".codex", "config.toml"), "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith("[")) break; // top-level only — stop at the first [section]
      const g = t.match(/^model\s*=\s*"([^"]+)"/)?.[1];
      if (g) return g;
    }
  } catch { /* no config */ }
  return "gpt-5.5";
}

/** OpenAI list price for codex models, $/MTok (standard tier — what interactive codex bills). */
const CODEX_PRICE: Record<string, { in: number; cachedIn: number; out: number }> = {
  "gpt-5.5": { in: 5, cachedIn: 0.5, out: 30 },
};

interface CodexUsage { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number }

/** Pull the usage block from a codex JSON event across formats (exec stdout / log-dir). */
function extractCodexUsage(e: any): CodexUsage | null {
  if ((e?.type === "turn.completed" || e?.type === "response.completed") && e?.usage) return e.usage;
  if (e?.response?.completed?.usage) return e.response.completed.usage;
  if (e?.turn?.completed?.usage) return e.turn.completed.usage;
  return null;
}

const warnedCodexModels = new Set<string>();

/** USD cost of one codex usage block. input_tokens includes cached; cached bills cheaper. */
function codexCost(model: string, u: CodexUsage): number {
  const p = CODEX_PRICE[model];
  if (!p) {
    if (!warnedCodexModels.has(model)) { warnedCodexModels.add(model); console.log(`  ⚠️  no price for codex model "${model}" — cost excludes its tokens`); }
    return 0;
  }
  const input = u.input_tokens ?? 0;
  const cached = u.cached_input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const nonCached = Math.max(0, input - cached);
  return (nonCached * p.in + cached * p.cachedIn + output * p.out) / 1_000_000;
}

/**
 * Token usage + cost for ONE interactive Codex session. Codex writes a session rollout to
 *   ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl
 * (the `-c log_dir=` flag does NOT capture usage). We pick the newest rollout modified since the
 * run started — time-window isolation, like the Claude fallback (Codex has no pre-set session id).
 * Usage lives in `event_msg`/`token_count` events; `total_token_usage` is CUMULATIVE, so we take
 * the LAST one (summing would multi-count). Tokens split like Claude's: inputTokens = non-cached.
 */
export function parseCodexSession(sinceMs: number): Snapshot {
  const zero: Snapshot = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 };
  const dir = join(homedir(), ".codex", "sessions");
  if (!existsSync(dir)) {
    console.log(`  ⚠️  Codex sessions dir not found: ${dir}`);
    return zero;
  }

  // newest rollout-*.jsonl (nested by YYYY/MM/DD) modified since the run started
  let newest: { file: string; m: number } | undefined;
  try {
    for (const rel of readdirSync(dir, { recursive: true })) {
      const name = String(rel);
      if (!name.endsWith(".jsonl") || !name.includes("rollout-")) continue;
      const full = join(dir, name);
      let m: number;
      try { m = statSync(full).mtimeMs; } catch { continue; }
      if (m < sinceMs) continue;
      if (!newest || m > newest.m) newest = { file: full, m };
    }
  } catch { /* unreadable sessions dir */ }

  if (!newest) {
    console.log(`  ⚠️  No codex session found since run start — did you start codex fresh after Run began?`);
    return zero;
  }

  // last token_count event carries the cumulative total_token_usage for the whole session
  let tu: CodexUsage | undefined;
  try {
    for (const line of readFileSync(newest.file, "utf8").trim().split("\n")) {
      try {
        const e = JSON.parse(line);
        if (e?.type === "event_msg" && e?.payload?.type === "token_count") {
          const t = e.payload?.info?.total_token_usage;
          if (t) tu = t;
        }
      } catch { /* skip non-JSON line */ }
    }
  } catch { /* unreadable file */ }

  if (!tu) return zero;

  const input = tu.input_tokens ?? 0;
  const cached = tu.cached_input_tokens ?? 0;
  const output = tu.output_tokens ?? 0;
  const nonCached = Math.max(0, input - cached);
  return {
    inputTokens: nonCached,
    outputTokens: output,
    cacheReadTokens: cached,
    cacheCreationTokens: 0,
    totalTokens: nonCached + output + cached,
    totalCost: codexCost(codexModel(), tu),
  };
}

/**
 * Sum token usage for ONE interactive Claude Code session — isolated from any other concurrent
 * claude sessions (unlike global ccusage). Reads the session transcript at
 *   ~/.claude/projects/<cwd with '/'→'-'>/<sessionId>.jsonl
 * summing `message.usage.*` across `type:"assistant"` lines.
 *
 * Primary: the exact <sessionId>.jsonl (participant launched `claude --session-id <id>`).
 * Fallback: newest *.jsonl in the project dir modified since the run started (forgot the flag).
 * Cost is computed from per-model token usage × MODEL_PRICE (the transcript has no cost field).
 */

/** Anthropic list price, $/MTok input & output. Cache: read = 0.1×in, write-5m = 1.25×in, write-1h = 2×in. */
const MODEL_PRICE: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}

const warnedModels = new Set<string>();

/** USD cost of one assistant message from its model + usage block (0 for an unpriced model). */
function claudeMsgCost(model: string, u: ClaudeUsage): number {
  const p = MODEL_PRICE[model];
  if (!p) {
    if (!warnedModels.has(model)) { warnedModels.add(model); console.log(`  ⚠️  no price for model "${model}" — cost excludes its tokens`); }
    return 0;
  }
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const eph5m = u.cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const eph1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const cacheWriteCost = (eph5m + eph1h) > 0
    ? eph5m * 1.25 * p.in + eph1h * 2 * p.in
    : (u.cache_creation_input_tokens ?? 0) * 1.25 * p.in; // assume 5m TTL when no breakdown
  return (input * p.in + output * p.out + cacheRead * 0.1 * p.in + cacheWriteCost) / 1_000_000;
}

export function parseClaudeSession(appDir: string, sessionId: string, sinceMs: number): Snapshot {
  const zero: Snapshot = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 };
  const projectDir = join(homedir(), ".claude", "projects", appDir.replace(/\//g, "-"));
  if (!existsSync(projectDir)) {
    console.log(`  ⚠️  Claude project dir not found: ${projectDir}`);
    return zero;
  }

  let file = join(projectDir, `${sessionId}.jsonl`);
  if (!existsSync(file)) {
    const newest = readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ f, m: statSync(join(projectDir, f)).mtimeMs }))
      .filter((c) => c.m >= sinceMs)
      .sort((a, b) => b.m - a.m)[0];
    if (!newest) {
      console.log(`  ⚠️  No claude session found for id ${sessionId} — did you launch with --session-id?`);
      return zero;
    }
    file = join(projectDir, newest.f);
    console.log(`  ℹ️  session-id transcript missing; using newest session in window: ${newest.f}`);
  }

  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0, totalCost = 0;
  try {
    for (const line of readFileSync(file, "utf8").trim().split("\n")) {
      try {
        const e = JSON.parse(line);
        if (e?.type !== "assistant") continue;
        const u = e?.message?.usage as ClaudeUsage | undefined;
        if (!u) continue;
        inputTokens += u.input_tokens ?? 0;
        outputTokens += u.output_tokens ?? 0;
        cacheReadTokens += u.cache_read_input_tokens ?? 0;
        cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
        totalCost += claudeMsgCost(e?.message?.model ?? "", u);
      } catch { /* skip non-JSON / malformed line */ }
    }
  } catch { /* unreadable file */ }

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
    totalCost,
  };
}

/**
 * Run `codex exec --json <prompt>` non-interactively and parse usage.
 * Used by e2e tests — not by workshop runner (which uses interactive + parseCodexLogs).
 */
export function runCodex(prompt: string): Promise<RunResult> {
  console.log(`\n  → codex exec --json (this may take 1–2 minutes)…\n`);
  return new Promise((resolve) => {
    const child = spawn("codex", ["exec", "--json", "--dangerously-bypass-hook-trust", prompt], {
      cwd: join(REPO_ROOT, "apps", "angular-demo"), stdio: ["ignore", "pipe", "pipe"], env: { ...process.env },
    });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); process.stdout.write(`  ${chunk.toString().replace(/\n/g, "\n  ")}`); });
    child.on("error", (err) => {
      console.error(`  ✗ codex failed: ${err.message}`);
      resolve({ usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 }, gatePassed: false });
    });
    child.on("close", (code) => {
      if (code !== 0) console.error(`\n  ✗ codex exited with code ${code}`);
      const model = codexModel();
      let totalInput = 0, totalOutput = 0, totalCached = 0, totalCost = 0;
      try { for (const line of stdout.trim().split("\n")) { try { const u = extractCodexUsage(JSON.parse(line)); if (u) { totalInput += u.input_tokens ?? 0; totalOutput += u.output_tokens ?? 0; totalCached += u.cached_input_tokens ?? 0; totalCost += codexCost(model, u); } } catch {} } } catch {}
      const nonCachedInput = Math.max(0, totalInput - totalCached);
      const totalTokens = nonCachedInput + totalOutput + totalCached;
      console.log(`\n  📊 Codex: ${nonCachedInput} in + ${totalOutput} out + cache r=${totalCached} = ${totalTokens} total ($${totalCost.toFixed(4)})`);
      const gatePassed = verify();
      resolve({ usage: { inputTokens: nonCachedInput, outputTokens: totalOutput, cacheReadTokens: totalCached, cacheCreationTokens: 0, totalTokens, totalCost }, gatePassed });
    });
    setTimeout(() => { child.kill(); resolve({ usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 }, gatePassed: false }); }, 600_000);
  });
}

/**
 * Run `cursor-agent -p --output-format stream-json` and parse usage from result event.
 */
export function runCursor(prompt: string): Promise<RunResult> {
  console.log(`\n  → cursor-agent -p (this may take 1–2 minutes)…\n`);
  return new Promise((resolve) => {
    const child = spawn("cursor-agent", ["-p", "--output-format", "stream-json", prompt], {
      cwd: join(REPO_ROOT, "apps", "angular-demo"), stdio: ["ignore", "pipe", "pipe"], env: { ...process.env },
    });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); process.stdout.write(`  ${chunk.toString().replace(/\n/g, "\n  ")}`); });
    child.on("error", (err) => {
      console.error(`  ✗ cursor-agent failed: ${err.message}`);
      resolve({ usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 }, gatePassed: false });
    });
    child.on("close", (code) => {
      if (code !== 0) console.error(`\n  ✗ cursor-agent exited with code ${code}`);
      let ti = 0, to = 0, tcr = 0, tcw = 0;
      try { for (const line of stdout.trim().split("\n")) { try { const e = JSON.parse(line); if (e?.type === "result" && e?.usage) { ti += e.usage.inputTokens ?? 0; to += e.usage.outputTokens ?? 0; tcr += e.usage.cacheReadTokens ?? 0; tcw += e.usage.cacheWriteTokens ?? 0; } } catch {} } } catch {}
      const total = ti + to + tcr + tcw;
      console.log(`\n  📊 Cursor: ${ti} in + ${to} out + ${tcr} cacheR + ${tcw} cacheW = ${total} total`);
      const gatePassed = verify();
      resolve({ usage: { inputTokens: ti, outputTokens: to, cacheReadTokens: tcr, cacheCreationTokens: tcw, totalTokens: total, totalCost: 0 }, gatePassed });
    });
    setTimeout(() => { child.kill(); resolve({ usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 }, gatePassed: false }); }, 600_000);
  });
}

// ── formatting ─────────────────────────────────────────────────────────

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function printDelta(label: string, d: Snapshot) {
  console.log(`  ${label}:`);
  console.log(`    Input:  ${fmt(d.inputTokens)} | Output: ${fmt(d.outputTokens)}`);
  console.log(`    Cache:  r=${fmt(d.cacheReadTokens)} w=${fmt(d.cacheCreationTokens)}`);
  console.log(`    Total:  ${fmt(d.totalTokens)} | Cost: $${d.totalCost.toFixed(4)}`);
}

export function printCompare(labelA: string, a: Snapshot, labelB: string, b: Snapshot) {
  const inputPct = a.inputTokens > 0 ? ((1 - b.inputTokens / a.inputTokens) * 100).toFixed(1) : "N/A";
  const totalPct = a.totalTokens > 0 ? ((1 - b.totalTokens / a.totalTokens) * 100).toFixed(1) : "N/A";
  const costPct = a.totalCost > 0 ? ((1 - b.totalCost / a.totalCost) * 100).toFixed(1) : "N/A";

  console.log(`\n  ${labelA} → ${labelB}:`);
  console.log(`    Input:  ${fmt(a.inputTokens)} → ${fmt(b.inputTokens)} (↓${inputPct}%)`);
  console.log(`    Total:  ${fmt(a.totalTokens)} → ${fmt(b.totalTokens)} (↓${totalPct}%)`);
  console.log(`    Cost:   $${a.totalCost.toFixed(4)} → $${b.totalCost.toFixed(4)} (↓${costPct}%)`);
}
