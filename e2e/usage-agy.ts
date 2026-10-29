/**
 * Token usage + cost for Antigravity CLI (`agy`) sessions. agy keeps every conversation in its own
 * SQLite file and the index of conversations in another:
 *   ~/.gemini/antigravity-cli/conversation_summaries.db   (conversation_id, workspace_uris, last_modified_time)
 *   ~/.gemini/antigravity-cli/conversations/<id>.db       (gen_metadata: one protobuf blob per model call)
 *
 * The blob layout is undocumented. Field numbers below were matched (agy 1.3.1) against the totals
 * agy prints with `--output-format json`: gen_metadata.data → 1 → 4 { 2: input without cache,
 * 3: output incl. thinking, 5: cache reads, 9: thinking }, and 1 → 19 = model id.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Snapshot } from "./_lib.js";

const AGY_DIR = join(homedir(), ".gemini", "antigravity-cli");

export type ProtoField =
  | { field: number; kind: "varint"; value: number }
  | { field: number; kind: "bytes"; value: Uint8Array };

/** Minimal protobuf wire-format reader: varint and length-delimited fields, fixed ones skipped. */
export function readFields(buf: Uint8Array): ProtoField[] {
  const out: ProtoField[] = [];
  let i = 0;
  const varint = (): number => {
    let result = 0, scale = 1;
    for (;;) {
      const byte = buf[i++];
      if (byte === undefined) throw new RangeError("truncated varint");
      result += (byte & 0x7f) * scale;
      if ((byte & 0x80) === 0) return result;
      scale *= 128;
    }
  };
  while (i < buf.length) {
    const key = varint();
    const field = Math.floor(key / 8);
    const wireType = key % 8;
    if (wireType === 0) out.push({ field, kind: "varint", value: varint() });
    else if (wireType === 2) {
      const length = varint();
      out.push({ field, kind: "bytes", value: buf.subarray(i, i + length) });
      i += length;
    } else if (wireType === 1) i += 8;
    else if (wireType === 5) i += 4;
    else break; // groups / unknown wire types: stop rather than misread
  }
  return out;
}

/** Nested messages reached by following `path` through length-delimited fields. */
export function subMessages(buf: Uint8Array, path: number[]): Uint8Array[] {
  let level: Uint8Array[] = [buf];
  for (const field of path) {
    const next: Uint8Array[] = [];
    for (const msg of level) {
      try {
        for (const f of readFields(msg)) if (f.field === field && f.kind === "bytes") next.push(f.value);
      } catch { /* not a message at this level */ }
    }
    level = next;
  }
  return level;
}

export interface AgyGenerationUsage { input: number; output: number; cacheRead: number; thinking: number; model: string }

const varintOf = (fields: ProtoField[], field: number): number => {
  const f = fields.find((x) => x.field === field && x.kind === "varint");
  return f && f.kind === "varint" ? f.value : 0;
};

/** Usage + model of one gen_metadata blob. */
export function generationUsage(data: Uint8Array): AgyGenerationUsage {
  const usage = subMessages(data, [1, 4])[0];
  const fields = usage ? readFields(usage) : [];
  const modelBytes = subMessages(data, [1, 19])[0];
  return {
    input: varintOf(fields, 2),
    output: varintOf(fields, 3),
    cacheRead: varintOf(fields, 5),
    thinking: varintOf(fields, 9),
    model: modelBytes ? new TextDecoder().decode(modelBytes) : "",
  };
}

/**
 * Gemini API paid-tier price, $/MTok (ai.google.dev/gemini-api/docs/pricing, October 2026).
 * Output price includes thinking; `cached` is the context-caching price. The 3.6–3.8 Flash promo
 * price ends on 2026-12-31.
 */
export function geminiPrice(model: string, at: Date): { in: number; cached: number; out: number } | undefined {
  if (/^gemini-3\.[678]-flash/.test(model)) {
    return at < new Date("2027-01-01T00:00:00Z") ? { in: 0.75, cached: 0.075, out: 3.75 } : { in: 1.5, cached: 0.15, out: 7.5 };
  }
  if (model.startsWith("gemini-3.5-flash")) return { in: 1.5, cached: 0.15, out: 9 };
  if (model.startsWith("gemini-3.1-pro")) return { in: 2, cached: 0.2, out: 12 }; // prompts ≤ 200K tokens
  return undefined;
}

const warnedModels = new Set<string>();

/** Sum generations; cost at time `at`. */
export function sumAgyGenerations(gens: AgyGenerationUsage[], at: Date): Snapshot {
  let input = 0, output = 0, cacheRead = 0, cost = 0;
  for (const g of gens) {
    input += g.input;
    output += g.output;
    cacheRead += g.cacheRead;
    const p = geminiPrice(g.model, at);
    if (p) cost += (g.input * p.in + g.cacheRead * p.cached + g.output * p.out) / 1_000_000;
    else if (!warnedModels.has(g.model)) { warnedModels.add(g.model); console.log(`  ⚠️  no price for agy model "${g.model}" — cost excludes its tokens`); }
  }
  return { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, cacheCreationTokens: 0, totalTokens: input + output + cacheRead, totalCost: cost };
}

/** Run a read-only query through the sqlite3 CLI (Node 20 has no built-in SQLite). */
function sqliteJson(dbPath: string, sql: string): Partial<Record<string, string>>[] {
  const out = execFileSync("sqlite3", ["-json", `file:${dbPath}?immutable=1`, sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.trim() ? (JSON.parse(out) as Partial<Record<string, string>>[]) : [];
}

/** Conversations in `appDir` touched at/after `sinceMs` (subagent conversations included). */
function conversationsSince(appDir: string, sinceMs: number): string[] {
  const rows = sqliteJson(join(AGY_DIR, "conversation_summaries.db"),
    "select conversation_id, workspace_uris, last_modified_time from conversation_summaries");
  const workspace = `file://${appDir}`;
  const ids: string[] = [];
  for (const r of rows) {
    const uris = JSON.parse(r.workspace_uris ?? "[]") as string[];
    const modified = Date.parse((r.last_modified_time ?? "").replace(" ", "T"));
    if (r.conversation_id && uris.includes(workspace) && modified >= sinceMs) ids.push(r.conversation_id);
  }
  return ids;
}

export function parseAgySession(appDir: string, sinceMs: number): Snapshot {
  const zero: Snapshot = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, totalCost: 0 };
  try {
    const ids = conversationsSince(appDir, sinceMs);
    if (ids.length === 0) {
      console.log(`  ⚠️  No agy conversation in ${appDir} since run start — did you start agy from apps/angular-demo?`);
      return zero;
    }
    const gens: AgyGenerationUsage[] = [];
    for (const id of ids) {
      const db = join(AGY_DIR, "conversations", `${id}.db`);
      if (!existsSync(db)) continue;
      for (const row of sqliteJson(db, "select hex(data) as data from gen_metadata order by idx")) {
        if (row.data) gens.push(generationUsage(Buffer.from(row.data, "hex")));
      }
    }
    return sumAgyGenerations(gens, new Date(sinceMs));
  } catch (err) {
    console.log(`  ⚠️  Could not read agy conversations: ${err instanceof Error ? err.message : String(err)}`);
    return zero;
  }
}
