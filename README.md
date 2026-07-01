# AI Agent Cost Lab — Workshop

To get a head start, please clone the workshop repository before the session.

In this practice, you’ll measure and optimize how many tokens a coding agent spends while fixing the same kind of feature bug.

You’ll work with a runnable **Angular** product, **Plata Burrito CRM**, backed by a dockerized API and five mock MCP servers. The agent receives the task through MCP, fixes a deliberately buggy feature, and then the workshop runner measures token usage from that run’s own session transcript.

The goal is simple:

Fix the feature correctly, then reduce the token cost without breaking the solution.

A token reduction that breaks the feature does not count. Correctness is decided by the quality gate: tests, typecheck, and lint. The `workshop:run*` commands run this gate automatically after the agent finishes.

## Prerequisites

You need:

* Node `>= 20.11`
* npm
* Docker
* One installed and authenticated coding agent:

  * `claude`
  * `codex`
  * `cursor-agent`

## Step 0: Setup

Install dependencies and start the workshop environment:

```bash
npm install
npm run setup
npm run workshop:doctor
```

The setup command starts Docker and MCP services, then auto-detects your available coding agent.

You can also choose the agent explicitly:

```bash
npm run setup -- claude
npm run setup -- codex
npm run setup -- cursor
```

The selected agent is saved to:

```bash
.workshop/active-agent
```

After that, every later command uses the same agent automatically:

* `proxy:*`
* `hooks:*`
* `workshop:run*`

No per-command flags are needed.

You can switch agents at any time:

```bash
npm run setup -- <agent>
npm run variant -- <n> <agent>
```

Supported agents:

```bash
claude | codex | cursor
```

------------⚠️ Spoiler alert! Continue only during the workshop or while working independently after it. -----------

## Practice goal

You will run the same feature-fixing task three times:

1. **Run 1:** establish the baseline token cost
2. **Run 2:** optimize `AGENTS.md` and measure again
3. **Run 3:** optimize the tool layer with an MCP proxy or agent hooks and measure again

Runs 2 and 3 are both compared against the same Run 1 baseline.

The second and third optimizations are measured independently. Do not switch branches between runs.

## Three bug variants

Pick one bug vector to work on:

| Variant | Page        | Ticket      | Type                                             |
| ------- | ----------- | ----------- | ------------------------------------------------ |
| 1       | `/catalog`  | `JIRA-0321` | Data grid: URL sync, cache, SWR, cancellation    |
| 2       | `/orders`   | `JIRA-0410` | Data grid: URL sync, debounce, cache, SWR        |
| 3       | `/edit/:id` | `JIRA-0455` | Forms: validation, 400-mapping, XSS, dirty state |

Set the variant:

```bash
npm run variant -- 1
npm run variant -- 2
npm run variant -- 3
```

This writes `TASK.md` and sets the scenario for the agent.

## How measured runs work

A measured run is a bracket:

1. `workshop:run*` resets the token baseline.
2. The command prints the exact agent launch command.
3. You start the agent in a second terminal.
4. The agent works on the task.
5. You close the agent.
6. Back in the first terminal, press Enter.
7. The quality gate runs.
8. Token usage is measured.

Start the agent only after the measured run has started waiting.

The agent must warm up, read config, use MCP, and fix the task inside the measured window.

## Workshop flow

You will use two terminals.

### Run 1: Baseline measurement

First, choose your bug variant:

```bash
npm run variant -- 1
# or
npm run variant -- 2
# or
npm run variant -- 3
```

Then start the measured baseline run.

**Terminal A — prep and measure:**

```bash
npm run workshop:run1
```

The runner prints the exact launch command for your selected agent.

**Terminal B — agent:**

Run the command printed by `workshop:run1`.

Examples:

```bash
cd apps/angular-demo
claude --session-id <id>
```

```bash
cd apps/angular-demo
codex
```

```bash
cd apps/angular-demo
cursor-agent
```

The agent reads `TASK.md`, pulls the ticket from the Jira MCP server, follows the chain into Confluence, Sentry, and TestRail, then fixes the feature.

When the agent finishes, close it.

**Back in Terminal A:**

Press Enter.

The runner will:

* run the quality gate
* measure token usage
* store Run 1 as the baseline

For Cursor, the runner prints a dashboard link. Read the token count from the matching run, using the printed `runStart` time.

## Run 2: Optimize `AGENTS.md`

In this run, optimize the agent instructions.

The file to edit is:

```bash
apps/angular-demo/AGENTS.md
```

Use the hygiene methods from the theory section.

You can also apply the reference workshop solution:

```bash
npm run agents:solution
```

To restore the original bloated version:

```bash
npm run agents:reset
```

Start the second measured run.

**Terminal A — prep and measure:**

```bash
npm run workshop:run2
```

The runner prints the exact launch command for the current selected agent.

**Terminal B — agent:**

Run the command printed by `workshop:run2`.

Examples:

```bash
cd apps/angular-demo
claude --session-id <id>
```

```bash
cd apps/angular-demo
codex
```

```bash
cd apps/angular-demo
cursor-agent
```

If you are already inside `apps/angular-demo`, you do not need to `cd` again.

Start the agent fresh after `workshop:run2` is already waiting.

When the agent finishes, close it.

**Back in Terminal A:**

Press Enter.

The runner will:

* run the quality gate
* measure token usage
* compare Run 2 against Run 1
* print the token delta

## Run 3: Optimize the tool layer

In this run, choose one tool-layer optimization:

* MCP proxy
* agent hooks

Both approaches compact or control the information sent to the agent.

### Option A: MCP proxy

Set up the proxy scaffold:

```bash
npm run proxy:setup
```

Then edit:

```bash
servers/proxy/src/index.ts
```

You can also apply the reference solution:

```bash
npm run proxy:solution
```

Useful reset commands:

```bash
npm run proxy:reset
npm run proxy:direct
```

### Option B: Agent hooks

Set up the passthrough hook scaffold:

```bash
npm run hooks:setup
```

You can also apply the reference compaction hook:

```bash
npm run hooks:solution
```

To reset:

```bash
npm run hooks:reset
```

### Measure Run 3

**Terminal A — prep and measure:**

```bash
npm run workshop:run3
```

The runner prints the exact launch command for the current selected agent.

**Terminal B — agent:**

Run the command printed by `workshop:run3`.

Examples:

```bash
cd apps/angular-demo
claude --session-id <id>
```

```bash
cd apps/angular-demo
codex
```

```bash
cd apps/angular-demo
cursor-agent
```

If you are already inside `apps/angular-demo`, you do not need to `cd` again.

Start the agent fresh after `workshop:run3` is already waiting.

When the agent finishes, close it.

**Back in Terminal A:**

Press Enter.

The runner will:

* run the quality gate
* measure token usage
* compare Run 3 against Run 1
* print the token delta

## Agent working directory

The participant agent runs from:

```bash
apps/angular-demo/
```

From there, it sees only the files it needs:

```bash
AGENTS.md
TASK.md
.mcp.json
.codex/config.toml
.cursor/mcp.json
```

This is intentional.

The agent should stay focused on the product task. It should not read or depend on the workshop infrastructure above it, including:

* `workshop/`
* `grader/`
* `e2e/`
* `servers/`

The agent also does not see the quality gate. The facilitator grades each run out-of-band through the workshop runner.

## Commands

### Setup and environment

```bash
npm run setup [-- <agent>]    # Docker + MCP; pick or auto-detect the agent
npm run cleanup               # stop Docker and remove MCP configs
npm run workshop:doctor       # preflight check
```

### Variant selection

```bash
npm run variant -- 1
npm run variant -- 2
npm run variant -- 3
```

Optional agent switch:

```bash
npm run variant -- <n> <agent>
```

Example:

```bash
npm run variant -- 2 claude
```

### Measured runs

```bash
npm run workshop:run1         # baseline run
npm run workshop:run2         # AGENTS.md hygiene run
npm run workshop:run3         # tool-layer optimization run
```

The quality gate runs automatically inside each measured run.

### Run 2: `AGENTS.md` hygiene

```bash
npm run agents:solution       # apply optimized AGENTS.md
npm run agents:reset          # restore original AGENTS.md
```

### Run 3: MCP proxy

```bash
npm run proxy:setup           # MCP config → compact proxy on :9100
npm run proxy:solution        # apply reference proxy and rebuild
npm run proxy:reset           # reset proxy implementation
npm run proxy:direct          # return to direct MCP wiring
```

### Run 3: Agent hooks

```bash
npm run hooks:setup           # install passthrough hook scaffold
npm run hooks:solution        # apply reference compaction hook
npm run hooks:reset           # reset hook implementation
```

## Docs

Read these during the theory and optimization parts of the workshop:

```bash
docs/hygiene-methods.md       # 10 AGENTS.md optimization levers
docs/mcp-proxy-methods.md     # 8 MCP proxy methods
```

## Cleanup

When you are done:

```bash
npm run cleanup
```

This stops Docker and removes generated MCP configs.
