# Build Plan — Token-Efficient Coding Agents Workshop

**Date:** 2026-06-22
**Repo:** `/Users/ing/Code/nebius/workshop-optimize` (currently empty, not a git repo)
**Source of truth:** the workshop spec (sections 1–24) pasted by the user.

This is a build-ordering plan, not a restatement of the spec. It resolves dependencies,
locks the decisions the spec leaves open, sequences work so every phase is runnable and
verifiable, and marks what to defer to a "fast lane".

---

## 0. Locked decisions (my recommendation — change before P0 if you disagree)

These are choices the spec leaves implicit. I picked defaults to keep the workshop
**deterministic and runnable offline**, which matters more than any single tool choice.

| Decision | Choice | Why |
|---|---|---|
| Package manager | **npm workspaces** | Spec already uses `npm ci` / `npm run --workspace`. No reason to diverge. |
| Package language | **TypeScript**, compiled with `tsc` (project refs) | Cross-package types; `agent-core` must stay Angular-free. |
| CLI runtime | **tsx** for `workshop/` scripts | Fast DX, no build step for the command layer. |
| Demo test runner | **Jest** (`jest-preset-angular`), not Karma | Headless + deterministic. Karma needs a browser → flaky quality gate. |
| Tokenizer (offline) | `gpt-tokenizer` (or `@dqbd/tiktoken`) | Local estimate when no preflight API. Always tagged `local-estimate`. |
| Default run mode | **replay adapter** | Whole workshop runs with zero credentials; live providers are opt-in. |
| Pricing | external `pricing.config.json`, never hardcoded | Spec §8 requirement. Cost is `null` if no config. |
| Git | **`git init` in P0** | Checkpoint branches (§22) + `git-diff`/`apply-patch` tools need it. |

**The keystone decision:** the **replay adapter is built first-class and early**, not as a
fallback bolt-on. Everything downstream (tests, dashboard, A/B compare, CI) depends on
deterministic runs. Live OpenAI/Anthropic adapters become the optional path.

---

## 1. Dependency graph

```
P0 monorepo skeleton + git
        │
        ├──> P1 provider-adapters (ModelAdapter iface, replay first, then live)
        │           │
        │           └──> P2 token-metrics (ledger, cost, trace, report)
        │
        ├──> P3 agent-tools (read/search/run/patch/diff)  [needs git]
        │
        └──> P4 angular-demo scenario A + reference test suite (the quality gate target)
                    │
P1+P2+P3 ──────────┴──> P5 context-builder (repo-map, select-context, budget)
                                  │
P1+P2+P3+P5 ─────────────────────┴──> P6 agent-core (loop, request-builder, task-state)
                                              │
                                              ├──> P7 workshop CLI + profiles 00/02/03
                                              │           │
                                              │           └──> P8 record baseline replays
                                              │
                                              └──> P9 token-dashboard (reads traces)

P10 scenario B (isomorph) + exercises 1/4 + checkpoint branches
P11 (fast lane) caching, model routing, lazy tools, scoped subagents
```

Critical path: **P0 → P1 → P2/P3 → P4 → P5 → P6 → P7 → P8**. P9 (dashboard) and P10
(scenario B, advanced exercises) parallelize once P6/P7 exist.

---

## 2. Phases

Each phase ends runnable + verifiable. Don't start a phase before its deps are green.

### P0 — Monorepo skeleton + git  *(deps: none)*
- `git init`; npm workspaces root `package.json`; root `tsconfig.base.json` + project refs.
- Empty package dirs per spec §5 (`packages/*`, `apps/*`, `workshop/*`, `traces/`, `artifacts/`).
- `workshop:doctor` v0: checks Node version, package manager, clean worktree, test command presence. (Credential/model/usage/preflight checks land in P1/P8.)
- **Verify:** `npm ci` clean; `npm run workshop:doctor` passes on empty tree.

### P1 — provider-adapters  *(deps: P0)*
- `ModelAdapter` interface (`countInput`, `complete`) + `NormalizedUsage` / `RawProviderUsage` types (spec §7). `measurementSource` enum.
- **`replay-adapter` first:** request → stable hash → canned `{output, usage}` from a fixtures file. Deterministic.
- `model-adapter` factory (selects replay vs live by config/env).
- Live adapters (`openai`, `anthropic`, `internal-gateway`) — thin; preflight token-count where the provider supports it, else local-estimate tagged.
- **Verify:** unit tests for normalize logic (cached/uncached/reasoning split per provider shape); replay round-trips a recorded fixture byte-stable.

### P2 — token-metrics  *(deps: P1)*
- `usage-ledger` (records per-call NormalizedUsage), `cost-calculator` (reads pricing config; `null` if absent), `trace-writer` (JSONL per spec §7 schema), `report-generator` (waterfall + comparison table §8).
- `trace:validate`, `tokens:report`, `tokens:compare` commands.
- **Verify:** feed synthetic usage → assert trace JSONL schema, attribution blocks sum sanity, cost `null` without pricing, compare table renders.

### P3 — agent-tools  *(deps: P0; git from P0)*
- `read-file`, `search-code` (ripgrep wrapper), `run-check`, `apply-patch`, `git-diff`.
- Build the **compact-result variants from day one** (Exercise 3 is core, not optional): structured `runCheck` result (exit code, parsed diagnostics, artifact path, `truncated`/`omittedLines`), `read_artifact_slice`, content-hash dedup on `readFile`, omitted-match count on search.
- Full outputs always persisted to `artifacts/`; never silently dropped.
- **Verify:** `npm run test --workspace packages/agent-tools`; a failing Jest run produces a compact result whose `diagnostics` pinpoint the failing assertion; hash dedup detects unchanged re-read.

### P4 — angular-demo: scenario A + quality gate  *(deps: P0; Jest config)*
- Minimal Angular app with **Component Catalog Search** (`GET /api/components?q=`), shipped in the **buggy baseline state** (per-keystroke request, stale-response overwrite, incomplete states, missing race test, mixed concerns).
- **Two test layers (integrity-critical):**
  - *shipped tests* — what the agent sees/edits.
  - *reference ("mandatory") tests* — held by the quality gate, verify all 9 acceptance criteria incl. the race condition. The agent must not see/edit these, else it passes by writing weak tests.
- `scenario:reset` (restore buggy state), `scenario:verify` (run reference tests + typecheck + lint → deterministic pass/fail = the quality gate §3).
- **Verify:** on shipped buggy code `scenario:verify` **fails** (reference race test red); a hand-applied correct fix makes it **pass**. This is the gate's ground truth — must be proven before any agent runs.

### P5 — context-builder  *(deps: P1, P3)*
- `repository-map`, `select-context` (Exercise 2 starter signature), `context-budget`.
- Excludes generated/`node_modules`/`dist`/`.angular`; rg term search + co-located tests + one-level direct imports; per-file `reason` + `priority` + `contentHash` + `estimatedTokens`; budget-bounded; deterministic manifest.
- `context:build`, `test:context-pack` commands.
- **Verify:** manifest reproducible across runs on unchanged repo; contains component+service+tests, excludes generated; respects budget.

### P6 — agent-core  *(deps: P1, P2, P3, P5)*
- `task-state` (durable `TaskState` per §15), `request-builder` (labeled blocks: system / tool schemas / history / task / repository / tool results / state — for attribution §7), `agent-loop`.
- Ship the **intentionally-suboptimal baseline loop** (§6) as the real default: full history every step, all tools always, unbounded tool stdout, no dedup, no compaction. This is the thing students optimize.
- **Verify:** `npm run test --workspace packages/agent-core`; loop drives replay adapter through scenario A end-to-end and emits a valid trace.

### P7 — workshop CLI + core profiles  *(deps: P6)*
- `agent:run --scenario --profile`; profiles `00-baseline`, `02-context-pack`, `03-compact-tools` (the minimal-pilot set, §24).
- Token-budget policy loader (§18) wired into the loop (warning/compact/hardstop thresholds).
- **Verify:** `agent:run --profile 00-baseline` solves scenario A via replay, passes quality gate, emits trace; `03-compact-tools` shows lower tool-result tokens with gate still green.

### P8 — record baseline replays + doctor completion  *(deps: P7, one-time live credentials)*
- Run baseline + optimized profiles **once against a live provider**, record request→response fixtures into the replay store. From then on the workshop is fully offline.
- Finish `workshop:doctor`: credential / model-availability / usage-support / preflight checks (skip-aware).
- **Verify:** wipe credentials → full workshop runs from replays; `tokens:compare baseline candidate` shows a real delta with both gates green.

### P9 — token-dashboard  *(deps: P2 trace schema; parallel after P7)*
- Angular app reading `traces/*.jsonl`: stacked input/output/cache/reasoning bars, context growth per step, cumulative cost, tool-call count, repeated reads, costliest tool results, tool-schema share, quality gate, baseline-vs-optimized table (§8).
- **Verify:** loads recorded traces from P8; comparison table matches `tokens:compare` numbers.

### P10 — scenario B + advanced exercises + checkpoints  *(deps: P7)*
- **Scenario B (Customer Directory Search)** — isomorphic to A for unbiased A/B (§4).
- Exercise 1 (bounded output / stage contracts), Exercise 4 (durable state + compaction, profile `05-budget-aware`, `test:compaction`).
- Checkpoint branches (§22): `starter`, `checkpoint/00..06`; reference solutions in a separate `facilitator-solutions/*` location.
- **Verify:** compaction fires on `--context-budget small` without losing constraints/checks/blockers (invariant check over `TaskState`); scenario B gate green; each checkpoint branch builds.

### P11 — Fast lane (defer; strong-participant material)  *(deps: P10)*
- Exercise 5 cache-friendly layout (`prompt:hash`, `cache:experiment`) — capability-gated, `SKIPPED_PROVIDER_UNSUPPORTED` allowed.
- Exercise 6 tracks: A lazy tool loading, B model routing, C scoped subagents.
- Final challenge harness (§23) + rubric wiring (§20).

---

## 3. What to defer (and why it's safe to)

Per spec §24, the pilot is **P0–P9 + scenario B**. Deferred to P11 fast lane:
prompt caching, model routing, lazy/deferred tools, scoped subagents, final challenge.
Safe because each is an *additive profile/track* over a working agent-core + metrics +
dashboard — none change the core data model. The workshop is teachable after P9.

---

## 4. Top risks → how this plan handles them

| Risk | Mitigation in plan |
|---|---|
| Workshop unrunnable without API keys | Replay adapter is P1 keystone; P8 records fixtures; offline by default. |
| Agent "passes" by writing weak tests | P4 split: hidden reference/mandatory suite owns the quality gate; agent can't edit it. |
| Quality gate not actually deterministic | Jest over Karma; P4 verify proves red→green by hand before any agent runs. |
| Non-deterministic agent runs muddy A/B | Replay = byte-stable; for live runs use median-of-N (§19); fix model id, commit, suite. |
| Token attribution misleading | Labeled request blocks (P6) + incremental counting; authoritative metric stays total actual usage (§7). |
| Checkpoints/git tools need a repo | `git init` in P0. |
| Cost numbers fabricated | Pricing external (P2); cost `null` without config; estimates tagged `local-estimate`. |

---

## 5. Open decisions needing your sign-off (before P0/P1/P4)

1. **Test runner:** Jest (my pick, deterministic/headless) vs Karma/Jasmine (Angular default). Affects P4.
2. **Live provider for recording replays:** OpenAI, Anthropic, or internal gateway? Affects which live adapter is built first in P1 and who supplies credentials in P8.
3. **Hidden reference-test integrity:** OK to keep the mandatory suite in a path the agent's tools refuse to read/edit (e.g. `workshop/checkpoints/` or `facilitator/`)? Needed for gate integrity in P4.
4. **Pilot stop line:** build through P9 (runnable pilot) then pause for review, or push straight through P10?

---

## 6. Suggested first action

Lock the 4 open decisions above, then execute **P0 + P1** together (skeleton + adapter
interface + replay adapter) — that unblocks everything and is independently testable.
