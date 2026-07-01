/**
 * E2E Test: Proxy-MCP
 *
 * Thesis: A compact proxy between Claude Code and bloated MCP servers
 * significantly reduces token consumption vs direct connections.
 *
 * Uses the 2 MCP mocks from spike/ (confluence + testenv) with bloated schemas.
 * Run A: claude connects directly to mocks
 * Run B: claude connects through compact proxy
 *
 * Requires: spike/mocks/* and spike/proxy/proxy-server.ts to exist.
 * These are on the spike-pre-build-gate branch.
 */
import { writeJson, runClaude, printDelta, printCompare } from "./_lib.js";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

// ── task prompt (same for both runs) ──────────────────────────────────

const TASK_PROMPT = `Use the available MCP tools to:
1. Search confluence documentation for "catalog search API"
2. Read page PAGE-2024-0042
3. Run the "catalog-search" test suite
4. Get the latest test result

Summarize what you find in one paragraph.`;

// ── MCP configs ───────────────────────────────────────────────────────

const BLOATED_MCP = join(REPO_ROOT, ".mcp-bloated.json");
const PROXY_MCP = join(REPO_ROOT, ".mcp-proxy.json");

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  E2E: Proxy-MCP A/B");
  console.log("  Thesis: proxy significantly reduces tokens");
  console.log("═══════════════════════════════════════════\n");

  // Check spike files exist
  const mockDir = join(REPO_ROOT, "spike", "mocks");
  const proxyFile = join(REPO_ROOT, "spike", "proxy", "proxy-server.ts");
  if (!existsSync(mockDir) || !existsSync(proxyFile)) {
    console.error("  ❌ spike/ files not found. Cherry-pick from spike-pre-build-gate branch:");
    console.error("     git checkout spike-pre-build-gate -- spike/");
    console.error("     npm install");
    process.exit(1);
  }

  // Write MCP configs (not .mcp.json — we pass via --mcp-config to isolate)
  writeJson(".mcp-bloated.json", {
    mcpServers: {
      "confluence-bloated": {
        type: "stdio",
        command: "npx",
        args: ["-y", "tsx", "spike/mocks/confluence-server.ts"],
      },
      "testenv-bloated": {
        type: "stdio",
        command: "npx",
        args: ["-y", "tsx", "spike/mocks/testenv-server.ts"],
      },
    },
  });

  writeJson(".mcp-proxy.json", {
    mcpServers: {
      "compact-proxy": {
        type: "stdio",
        command: "npx",
        args: ["-y", "tsx", "spike/proxy/proxy-server.ts"],
      },
    },
  });

  // ── Run A: Direct (bloated) ────────────────────────────────────────
  console.log("━━━ Run A: Direct MCP (bloated) ━━━");

  const runA = await runClaude(TASK_PROMPT, {
    mcpConfig: ".mcp-bloated.json",
    allowedTools: ["search_docs", "get_page", "run_tests", "get_test_result"],
  });

  if (runA.usage.totalTokens === 0) {
    console.error("  ❌ Run A produced no token data — claude may have failed. Check above.");
    process.exit(1);
  }

  printDelta("Run A (direct)", runA.usage);

  // ── Run B: Proxy (compact) ─────────────────────────────────────────
  console.log("\n━━━ Run B: Compact Proxy ━━━");

  const runB = await runClaude(TASK_PROMPT, {
    mcpConfig: ".mcp-proxy.json",
    allowedTools: ["search_docs", "get_page", "run_tests", "get_test_result"],
  });

  if (runB.usage.totalTokens === 0) {
    console.error("  ❌ Run B produced no token data — claude may have failed. Check above.");
    process.exit(1);
  }

  printDelta("Run B (proxy)", runB.usage);

  // ── Compare ───────────────────────────────────────────────────────
  console.log("\n━━━ COMPARISON ━━━");
  printCompare("Run A (direct)", runA.usage, "Run B (proxy)", runB.usage);

  const reduction = runA.usage.totalTokens > 0
    ? (1 - runB.usage.totalTokens / runA.usage.totalTokens) * 100
    : 0;

  console.log(`\n  Thesis: proxy reduces total tokens by ${reduction.toFixed(1)}%`);

  // Cleanup temp files
  try { rmSync(BLOATED_MCP); } catch {}
  try { rmSync(PROXY_MCP); } catch {}

  process.exit(reduction >= 20 ? 0 : 1); // ≥20% threshold for real MCP servers
}

main();
