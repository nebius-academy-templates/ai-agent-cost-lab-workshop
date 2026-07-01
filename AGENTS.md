# Agent instructions — Plata Burrito CRM

## What this repo is

**Plata Burrito CRM** — a small Angular app for managing burrito sales (catalog, orders, finance,
edit). It talks to a REST backend at `/api/...` and is supported by five MCP servers —
`jira`, `confluence`, `sentry`, `testrail`, `github` — that hold the task context.

## Finding the task

`TASK.md` carries the **ticket number** and how to run the app. Pull the ticket from the **jira**
MCP (`jira_get_issue`): it has the bug description, the **Definition of Done**, and links to the
**confluence** contract, the **sentry** error, and the **testrail** acceptance suite. Follow those
to understand the fix. The ticket and MCP context are everything you need — you don't have to look
anywhere else.

## Commands

| Command | Purpose |
|---|---|
| `npm run start` | Serve the app at http://localhost:4200. |
| `npm run test` | Run the Jest test suite. |
| `npm run lint` | Run ESLint. |

## Working rules

- Edit only the feature dir named in the ticket. Match the surrounding style.
- **Keep the API contract** (`GET /api/products`, `GET /api/orders`, `PUT /api/products/:id`) and
  the public controller surface (`state$`, `init`, `setQuery`, …) unchanged.
- **Do not add runtime dependencies.**
- When the fix satisfies the ticket's Definition of Done, you're done — report what you changed and
  stop. There is no separate verification step for you to run.

## Model

The default model is set in `.claude/settings.json`. Model choice is a cost lever — a cheaper model
for routine edits may use fewer tokens.
