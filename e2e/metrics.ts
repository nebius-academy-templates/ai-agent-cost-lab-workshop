/**
 * Local metrics record — appends every workshop run measurement to a git-ignored JSONL file.
 *
 * Usage:
 *   import { recordWorkshopMetric } from "./metrics.js";
 *   recordWorkshopMetric({ run: 1, agent: "claude", user: "kirill", ... });
 */
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

const MEASURE_DIR = process.env.MEASURE_DIR || join(REPO_ROOT, ".measurements");
const MEASURE_FILE = join(MEASURE_DIR, "metrics.jsonl");

export interface WorkshopMetric {
  run: number;            // 1, 2, or 3
  agent: string;          // "claude" | "cursor" | "codex"
  user: string;           // git user name
  task: string;           // task identifier (e.g. "catalog-search")
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  totalCost: number;
  gatePassed: boolean;
  lever?: string;         // "baseline" | "hygiene" | "proxy" | "hooks" — which Run 3 lever (or stage)
}

export function recordWorkshopMetric(m: WorkshopMetric): void {
  try {
    mkdirSync(MEASURE_DIR, { recursive: true });
    const record = { ts: new Date().toISOString(), metric: m };
    appendFileSync(MEASURE_FILE, JSON.stringify(record) + "\n", "utf8");
    console.log(`  💾 Recorded → .measurements/metrics.jsonl`);
  } catch (err: any) {
    console.log(`  ⚠️  Local record failed: ${err?.message?.substring(0, 80)}`);
  }
}
