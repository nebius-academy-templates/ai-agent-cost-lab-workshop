# Agent Instructions — Plata Burrito CRM

Angular 19 app. Each feature lives in `src/app/<feature>/` (catalog, orders, edit-card) and has:
`*.controller.ts` (state + business logic), `*.types.ts` (interfaces + constants), and
`*.controller.spec.ts` (acceptance tests). REST backend at `/api`.

## Task discovery
Read `TASK.md` → ticket id. Pull the ticket from the **jira** MCP (`jira_get_issue`): description,
Definition of Done, and links (confluence contract, sentry error, testrail cases). The ticket plus
the failing `*.controller.spec.ts` fully define the fix — read the spec to see the exact expected behaviour.

## Scope
- Edit ONLY the feature dir named in the ticket. Don't touch other features.
- The fix goes in `*.controller.ts`. The types/constants you need already exist in `*.types.ts` —
  import and use them, don't redefine them, don't edit them.
- Don't edit the spec. Keep the existing public methods/getters and the `/api` contract. No new deps.

## Pattern
Controllers hold state in a `BehaviorSubject` exposed as `state$`, plus plain fields/getters/methods
(e.g. `load`, `setField`, `save`, `errors`, validation). Tests build the controller with a fake API
and assert on its public fields/getters — so the behaviour the test checks must be reachable through
those. Match the surrounding style.

## Output
Make the failing spec pass with minimal changes. No preamble, no essays. Report what changed in 1–2
lines and stop.
## Backend Services
REST backend at `/api`. Five MCP: **jira** (tickets), **confluence** (contracts), **sentry** (errors), **testrail** (acceptance tests), **github** (commit status).

## Common Patterns
Controllers manage state via `BehaviorSubject<StateType>`, expose it as `readonly state$`.
Methods like `setQuery()`, `setPage()`, `setSort()` update state. Components subscribe to
`state$` and render reactively.

## Commands
`npm run start` · `npm run test` · `npm run lint`
