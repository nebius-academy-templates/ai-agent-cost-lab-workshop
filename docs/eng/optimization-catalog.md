# Optimization catalog — index

The umbrella reference for every lever that lowers an agent's cost in this workshop. It splits
them into two layers and links to the detailed catalogs.

> **Related:** [charter.md](./charter.md) — workshop design;
> [hygiene-methods.md](./hygiene-methods.md) — hygiene levers (L0–L9);
> [tool-layer-matrix.md](./tool-layer-matrix.md) — tool-response methods (7);
> how to build them: [mcp-proxy-methods.md](./mcp-proxy-methods.md), [hooks-methods.md](./hooks-methods.md);
> measured runs: [measurements-2026-10.md](./measurements-2026-10.md).

---

## Two layers

| Layer | What you set | Where | Catalog | Measured effect, 2026-10-07 |
|---|---|---|---|---|
| **Hygiene (L0–L9)** | Model, Effort, Scoping, File Hints, Output, Up-front Prompt, Cache, Config, Subagents, Skills | `settings.json` / `config.toml`, `AGENTS.md`, the prompt, `.claude/agents/`, `.claude/skills/` | [hygiene-methods.md](./hygiene-methods.md) | reference `AGENTS.md`: tokens −28…−44%, cost −15…−38% |
| **Tool responses (7 methods)** | Field Filtering, Truncation, Summary, Pagination, Dedup, Diff, Aggregation | the proxy **or** agent hooks **or** built-in limits | [tool-layer-matrix.md](./tool-layer-matrix.md) | hook: tokens −60…−70% (Claude, Cursor); proxy: tokens −5…−54% |

---

## How it maps onto the three runs

- **Run 1 — bloated baseline.** Naive prompt, bloated `AGENTS.md`, bloated MCP responses.
  Measured 2026-10-05 (Claude Code, Opus 5.5): $1.46, 1.7M tokens; 37% of cost is model output,
  41% is cache writes.
- **Run 2 — hygiene.** At least L0 (model) + L5 (precise prompt) + the reference `AGENTS.md`. The
  main saving here: the model writes less and skips needless steps.
- **Run 3 — tool responses.** The proxy (Option A) or hooks (Option B) shrink MCP responses before
  they enter the context. The effect follows the share of MCP responses in the context, and it grows
  because every later request re-reads them.

**Measured 2026-10-07:** 4 agents, 15 runs, all passed the quality gate. Report:
[measurements-2026-10.md](./measurements-2026-10.md).

| Agent | Run 2 — hygiene | Run 3 — proxy | Run 3 — hook |
|---|---|---|---|
| Claude Code (Sonnet 5.5) | tokens −44%, cost −38% | tokens −54%, cost −36% | tokens −60%, cost −46% |
| Codex (Sol 6.1) | tokens −28%, cost −15% | tokens −5%, cost +12% | hook never fired |
| Cursor (GLM 5.2 High) | tokens −30% | tokens −12% | tokens −70% |
| agy (Gemini 3.8 Flash) | tokens −48% ⚠️ | tokens −33%, cost −9% ⚠️ | no reference hook |

⚠️ agy Run 1 read the hidden tests, so its baseline is inflated.

---

## Where the ceiling is

Hygiene does not change **what** the tools return. The tool layer does not change **how much the
model writes**. Agents now load tool schemas on demand, so that cost item has almost disappeared
by itself.
