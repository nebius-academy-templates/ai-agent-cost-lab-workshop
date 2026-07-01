/**
 * Grafana metrics sender — OTLP HTTP endpoint.
 *
 * Sends workshop run measurements to Grafana Cloud.
 * Reads credentials from .env: GRAFANA_TOKEN, GRAFANA_USER (default: 1703013)
 *
 * Usage:
 *   import { sendWorkshopMetric } from "./grafana.js";
 *   await sendWorkshopMetric({ run: 1, agent: "claude", user: "kirill", ... });
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

function loadDotEnv(): void {
  const envPath = join(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadDotEnv();

const GRAFANA_USER = process.env.GRAFANA_USER || "1703013";
const GRAFANA_TOKEN = process.env.GRAFANA_TOKEN || "";
const OTEL_ENDPOINT =
  process.env.GRAFANA_OTLP_ENDPOINT ||
  "https://otlp-gateway-prod-eu-west-2.grafana.net/otlp/v1/metrics";

// Local, git-ignored record of every metric — to cross-check what we send vs what Grafana shows.
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

function getGitUser(): string {
  try {
    return execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function nanos(): number {
  return Date.now() * 1_000_000;
}

/** Append every metric (sent or not) to a local git-ignored JSONL for later cross-check with Grafana. */
function recordMetric(m: WorkshopMetric, sent: boolean, status: string, runId: string): void {
  try {
    mkdirSync(MEASURE_DIR, { recursive: true });
    const record = { ts: new Date().toISOString(), runId, sent, status, endpoint: OTEL_ENDPOINT, metric: m };
    appendFileSync(MEASURE_FILE, JSON.stringify(record) + "\n", "utf8");
    console.log(`  💾 Recorded → .measurements/metrics.jsonl`);
  } catch (err: any) {
    console.log(`  ⚠️  Local record failed: ${err?.message?.substring(0, 80)}`);
  }
}

export function sendWorkshopMetric(m: WorkshopMetric): void {
  // ISO timestamp doubles as the unique per-run id (each run = its own Prometheus series, no
  // merge/overwrite of repeated agent/task/run) AND the human-readable "record time" column.
  const runId = new Date(Date.now()).toISOString();

  if (!GRAFANA_TOKEN) {
    console.log("  ⚠️  GRAFANA_TOKEN not set — skipping metrics push");
    recordMetric(m, false, "no-token", runId);
    return;
  }

  const auth = Buffer.from(`${GRAFANA_USER}:${GRAFANA_TOKEN}`).toString("base64");

  // Shared label set on every dataPoint. `lever` distinguishes the Run 3 tool layer (proxy vs hooks)
  // and labels Run 1/2 (baseline/hygiene); `run_id` keeps each push its own Prometheus series.
  const attrs = [
    { key: "run", value: { stringValue: String(m.run) } },
    { key: "agent", value: { stringValue: m.agent } },
    { key: "user", value: { stringValue: m.user } },
    { key: "task", value: { stringValue: m.task } },
    { key: "lever", value: { stringValue: m.lever ?? "" } },
    { key: "run_id", value: { stringValue: runId } },
  ];
  const intGauge = (v: number) => ({ dataPoints: [{ asInt: v, timeUnixNano: nanos(), attributes: attrs }] });
  const dblGauge = (v: number) => ({ dataPoints: [{ asDouble: v, timeUnixNano: nanos(), attributes: attrs }] });

  const payload = {
    resourceMetrics: [{
      resource: { attributes: [{ key: "service.name", value: { stringValue: "workshop" } }] },
      scopeMetrics: [{
        scope: { name: "workshop" },
        metrics: [
          { name: "workshop_input_tokens", unit: "1", gauge: intGauge(m.inputTokens) },
          { name: "workshop_output_tokens", unit: "1", gauge: intGauge(m.outputTokens) },
          { name: "workshop_cache_read_tokens", unit: "1", gauge: intGauge(m.cacheReadTokens) },
          { name: "workshop_cache_write_tokens", unit: "1", gauge: intGauge(m.cacheWriteTokens) },
          { name: "workshop_total_tokens", unit: "1", gauge: intGauge(m.totalTokens) },
          { name: "workshop_cost_usd", unit: "USD", gauge: dblGauge(m.totalCost) },
          // gate: 0=FAIL, 1=PASS, 2=PROBE (the `variant` registration ping — no run yet).
          { name: "workshop_gate_passed", unit: "1", gauge: intGauge(m.lever === "probe" ? 2 : (m.gatePassed ? 1 : 0)) },
        ]
      }]
    }]
  };

  const data = JSON.stringify(payload);

  let sent = false;
  let status = "ok";
  try {
    execFileSync("curl", [
      "-k", "-sS", "-f", "-X", "POST",
      "-H", "Content-Type: application/json",
      "-H", `Authorization: Basic ${auth}`,
      OTEL_ENDPOINT,
      "-d", data,
    ], { stdio: "pipe", maxBuffer: 1024 * 1024 });
    sent = true;
    console.log("  📊 Metrics sent to Grafana");
  } catch (err: any) {
    // Don't fail the workshop run if Grafana push fails
    status = `curl-failed: ${err.message?.substring(0, 80)}`;
    console.log(`  ⚠️  Grafana push failed: ${err.message?.substring(0, 100)}`);
  }
  recordMetric(m, sent, status, runId);
}
