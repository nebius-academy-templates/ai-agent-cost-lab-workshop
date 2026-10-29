# AI Agent Cost Lab — Optimization Playbook

Use this playbook to revisit the methods demonstrated in the session and try them in the repository.

The repository contains two resources:

- **Reference guides:** optimization methods, implementation details, and measured results.
- **A runnable sandbox:** the feature-fixing task you saw in the masterclass, with commands for measuring your own results.

Start with the reference guides. When you're ready to experiment, follow the sandbox instructions below.

## Find the reference material

The reference files are in `docs/eng/`.

| File | What you'll find |
| --- | --- |
| [Optimization catalog](docs/eng/optimization-catalog.md) | Start here: an overview of the optimization methods, their two layers, and how they map to the sandbox runs |
| [Hygiene methods](docs/eng/hygiene-methods.md) | Ten levers covering model choice, reasoning effort, context scope, file hints, output, prompts, caching, configuration, subagents, and skills |
| [Tool-response methods](docs/eng/tool-layer-matrix.md) | Seven methods for reducing tool responses, with agent support, tradeoffs, and measured or estimated effects |
| [MCP proxy implementation guide](docs/eng/mcp-proxy-methods.md) | How to implement the tool-response methods in the proxy, including commands, file locations, and reference code |
| [Agent hooks implementation guide](docs/eng/hooks-methods.md) | How to implement the methods with agent hooks, including configuration, output formats, and agent-specific limitations |
| [October 2026 measurements](docs/eng/measurements-2026-10.md) | The measured results, test setup, token and cost breakdowns, and limitations |

The guides distinguish **measured results**, **calculations**, and **estimates**. Use those labels when comparing methods. A reduction in response size, total tokens, and cost describes three different outcomes.

### Choose an optimization layer

| Layer | What you change | Where to start |
| --- | --- | --- |
| Hygiene | Agent instructions, model, reasoning effort, prompt, and configuration | `docs/eng/hygiene-methods.md` |
| Tool responses | The information returned by MCP tools before it enters the model's context | `docs/eng/tool-layer-matrix.md` |

For tool responses, the updated catalog covers:

- Field filtering
- Truncation
- Structured summary
- Pagination
- Deduplication and caching
- Diff-based responses
- Aggregation and batching

Use the tool-response matrix to choose a method, then open the proxy or hooks guide for implementation details.

### Choose where to implement tool-response methods

| Approach | When to use it |
| --- | --- |
| Built-in limits | To try response truncation through agent configuration |
| Agent hooks | To transform individual tool calls or results in an agent that supports the required hook |
| MCP proxy | To share an implementation across agents, keep state in memory, aggregate calls, or work around hook limitations |

In the supplied October 2026 measurements, MCP hooks never fired for Codex with Sol 6.1 because its MCP calls ran inside `exec`. Use the proxy for that configuration. The hooks guide also documents Cursor's configuration at the repository root.

## Try the sandbox yourself

The sandbox lets you repeat the experiment demonstrated in the masterclass.

You'll work with Plata Burrito CRM, a runnable Angular product backed by a Dockerized API and five mock MCP servers. The coding agent retrieves a ticket through MCP, follows its linked resources, and fixes a deliberately buggy feature.

The runner measures usage from the agent's session and checks the solution.

**Your goal:** reduce token usage while keeping the feature correct.

A reduction counts only when the solution passes the quality gate: tests, typecheck, and lint. The `workshop:run*` commands run this gate automatically.

The repository retains its `workshop:*` command names.

### Prerequisites

Before starting, clone the repository and make sure you have:

- Node.js ≥ 20.11
- npm
- Docker
- One installed and authenticated coding agent: `claude` (Claude Code), `codex` (Codex CLI), `agent` (Cursor CLI), or `agy` (Antigravity CLI)

### Set up the environment

Run these commands from the repository root:

```bash
npm install
npm run setup
npm run workshop:doctor
```

Setup starts Docker and MCP services, then detects your available coding agent.

To choose an agent explicitly, run one of these commands:

```bash
npm run setup -- claude
npm run setup -- codex
npm run setup -- cursor
npm run setup -- agy
```

The selected agent is saved to `.workshop/active-agent`. Subsequent `proxy:*`, `hooks:*`, and `workshop:run*` commands use it automatically.

To switch agents:

```bash
npm run setup -- <agent>
```

Supported values: `claude`, `codex`, `cursor`, and `agy`.

### Get the task

The sandbox has one task, the same one shown in the masterclass:

| Page | Ticket | Feature |
| --- | --- | --- |
| `/catalog` | `JIRA-0321` | Data grid: URL sync, cache, SWR, cancellation |

Write the task into the app:

```bash
npm run task
```

This copies `TASK.md` into `apps/angular-demo/`. To switch the agent at the same time:

```bash
npm run task -- codex
```

## Measure a baseline and compare optimizations

The sandbox has three measured runs:

| Run | Configuration | Comparison |
| --- | --- | --- |
| 1 | Original instructions and direct MCP connections | Establish the baseline |
| 2 | Hygiene optimizations | Compare with Run 1 |
| 3 | Tool-response optimizations | Compare with Run 1 |

Runs 2 and 3 test the layers independently. For the reference comparison, Run 3 uses the original `AGENTS.md`.

Stay on the same branch between runs. The runner resets the app code after each measured run.

### How to measure each run

Use two terminals:

- **Terminal A:** Start the runner, then collect the result.
- **Terminal B:** Start the coding agent.

For each run:

1. In Terminal A, start the relevant `workshop:run*` command.
2. Wait until the runner prints the agent launch command and waits for you.
3. In Terminal B, run the printed command from `apps/angular-demo`.
4. Let the agent complete the task, then close it.
5. Return to Terminal A and press Enter.
6. Review the quality-gate result and usage measurement.

Start a fresh agent session inside each measured window. Agent startup, configuration reading, MCP use, and the feature fix all belong inside that window.

Use the exact launch command printed by the runner. For Claude Code, this includes the session ID used to identify the correct log.

### Run 1: Establish the baseline

Start with the original instructions and direct MCP connections. To restore that configuration:

```bash
npm run agents:reset
npm run hooks:reset
npm run proxy:reset
npm run proxy:rebuild
```

Then start the baseline measurement in Terminal A:

```bash
npm run workshop:run1
```

Complete the two-terminal sequence above. The runner checks the solution and stores Run 1 as the baseline.

For Cursor, use the dashboard link and printed `runStart` time to find the matching run's token count.

### Run 2: Try hygiene optimizations

Open `docs/eng/hygiene-methods.md` and choose the levers you want to test.

The agent instruction file is:

```text
apps/angular-demo/AGENTS.md
```

To try the reference instruction file:

```bash
npm run agents:solution
```

To restore the original:

```bash
npm run agents:reset
```

Start the measurement in Terminal A:

```bash
npm run workshop:run2
```

Complete the two-terminal sequence. The runner checks the solution, compares usage with Run 1, and prints the token change.

### Run 3: Try tool-response optimizations

Restore the original instructions so this run measures the tool layer independently:

```bash
npm run agents:reset
```

Choose a method from `docs/eng/tool-layer-matrix.md`, then implement it through the proxy or hooks.

#### Option A: MCP proxy

Open `docs/eng/mcp-proxy-methods.md`.

Set up the proxy:

```bash
npm run proxy:setup
```

Edit:

```text
servers/proxy/src/index.ts
```

After each code change, rebuild and restart the proxy:

```bash
npm run proxy:rebuild
```

Alternatively, apply the reference implementation:

```bash
npm run proxy:solution
```

Useful reset commands:

```bash
npm run proxy:direct    # Restore direct MCP connections
npm run proxy:reset     # Restore direct connections and the proxy scaffold
```

#### Option B: Agent hooks

Open `docs/eng/hooks-methods.md` for your agent's file locations and configuration requirements.

Reference hooks exist for Claude Code, Codex, and Cursor. Antigravity has no reference hook; use the proxy.

Install the passthrough scaffold:

```bash
npm run hooks:setup
```

Implement your chosen transformation, or apply the reference compaction hook:

```bash
npm run hooks:solution
```

To remove the hook and restore the direct MCP connection:

```bash
npm run hooks:reset
```

#### Measure the result

Start the measurement in Terminal A:

```bash
npm run workshop:run3
```

Complete the two-terminal sequence. The runner checks the solution, compares usage with Run 1, and prints the token change.

Reset the active optimization before testing another approach.

## Review your results

Results are appended to:

```text
.measurements/metrics.jsonl
```

Each record contains:

- Whether the solution passed the quality gate
- Tokens by type: uncached input, output, cache reads, and cache writes
- Total tokens
- Cost, where available

Compare your records with the reference experiment in `docs/eng/measurements-2026-10.md`.

The reference experiment reports medians of 3–5 attempts per configuration. Single runs of the same configuration varied by up to 2× in tokens, so compare medians of several runs. Its mock responses were deliberately enlarged, so the results depend on how much MCP output enters the context.

A token reduction and a cost reduction can differ widely. The measurements guide includes examples and separates cached input, uncached input, and output.

## Keep the agent focused on the product task

Run the coding agent from:

```text
apps/angular-demo/
```

The agent should use `TASK.md` and the product files to fix the feature. Keep workshop infrastructure and reference tests outside its task scope, including `workshop/` (the hidden reference tests are in `workshop/checkpoints/`), `e2e/`, and `servers/`.

These files live in the same repository, so the working directory alone does not prevent access. The measurements guide documents how reading hidden reference tests affected one baseline.

Measure on a clean, committed tree: uncommitted file paths can reveal hidden tests through `git status`.

## Clean up

When you finish:

```bash
npm run cleanup
```

This stops Docker and removes generated MCP configurations.
