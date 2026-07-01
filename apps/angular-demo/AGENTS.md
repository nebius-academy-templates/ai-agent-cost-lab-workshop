# Agent Instructions — Plata Burrito CRM Application

Welcome to the Plata Burrito CRM codebase! This document contains everything you need to know
to work effectively in this repository. Please read all sections carefully before starting any
task.

## Project Overview and Business Context

Plata Burrito is a rapidly growing chain of Mexican fast-casual restaurants operating across
multiple locations. The business serves over 50,000 customers daily and processes orders for
burritos, bowls, tacos, sides, drinks, and house-made salsas. This application is the internal
CRM used by restaurant managers, kitchen staff, and the central operations team to manage the
complete product catalog, track incoming orders, monitor financial metrics, and maintain product
information.

The application is built with **Angular 19** using a standalone component architecture with
RxJS-based reactive state management. It communicates with a backend REST API that provides
product, order, and finance endpoints. The backend at `/api` is a local fixture — you don't run,
read, or modify it; the request/response shapes you need are defined in each feature's `*.types.ts`
and the confluence contract.

## Repository Structure and Organization

```
/
├── src/
│   ├── app/
│   │   ├── catalog/                    # Product catalog with data grid
│   │   │   ├── catalog-api.ts          # HTTP client for GET /api/products
│   │   │   ├── catalog.controller.ts   # State management and business logic
│   │   │   ├── catalog.controller.spec.ts  # Unit tests
│   │   │   ├── catalog.page.ts         # UI component with template
│   │   │   └── catalog.types.ts        # TypeScript interfaces and constants
│   │   ├── orders/                     # Order search and management
│   │   │   ├── orders-api.ts           # HTTP client for GET /api/orders
│   │   │   ├── orders.controller.ts    # State management for order grid
│   │   │   ├── orders.controller.spec.ts
│   │   │   ├── orders.page.ts
│   │   │   └── orders.types.ts
│   │   ├── edit-card/                  # Product editing form
│   │   │   ├── editcard-api.ts         # HTTP client for PUT /api/products/:id
│   │   │   ├── editcard.controller.ts  # Form state and validation
│   │   │   ├── editcard.controller.spec.ts
│   │   │   ├── edit-card.page.ts
│   │   │   └── editcard.types.ts
│   │   ├── finance/                    # Financial overview dashboard
│   │   └── shell/                      # Navigation and footer components
│   ├── theme/                          # CSS theming (Plata brand)
│   └── styles.css                      # Global styles
├── angular.json                        # Angular CLI workspace config
├── package.json                        # Dependencies and npm scripts
└── tsconfig.json                       # TypeScript configuration
```

## Available Development Commands

The following npm scripts are available in this project.

| Command | Purpose | Expected Output |
|---|---|---|
| `npm run start` | Start the Angular dev server on port 4200. | Server listening on http://localhost:4200 |
| `npm run build` | Production build with AOT compilation and minification. | Output in `dist/` directory |
| `npm run test` | Run the unit spec for the feature this ticket targets (scoped via `TASK.md`). | Test results summary |
| `npm run typecheck` | Type-check the app with no emit. | Clean or type errors |
| `npm run lint` | Run ESLint across `src`. | Warnings/errors or clean |

## Task Discovery

Always gather the full task context through the available MCP tools before touching any code.
The Jira ticket, Confluence contract, Sentry error, and TestRail acceptance suite together
define what needs to be fixed and how. Read TASK.md to get started, then pull the rest.

## Working Rules and Conventions

1. **Edit only relevant files.** Make minimal, focused changes. Do not refactor unrelated code,
   reorganize imports unnecessarily, or change formatting outside the task scope.

2. **Preserve the API contract.** These endpoints and their shapes must remain unchanged:
   - `GET /api/products?page&pageSize&sort&category&q` → `ProductPage`
   - `GET /api/orders?page&pageSize&q&sort&status&location` → `OrderPage`
   - `PUT /api/products/:id` accepts `ProductDraft`, returns `Product`

3. **Preserve public controller interfaces.** `state$`, `setQuery`, `setPage`, `init`, etc.
   must maintain their public signatures.

4. **Do not add runtime dependencies.** Use only packages already in `package.json`.

5. **The ticket is the source of truth.** The jira ticket (via MCP) — with its Confluence
   contract, Sentry error, and TestRail suite — fully defines the change. This project and the
   MCP tools are everything you need; you don't have to look anywhere else.

6. **Match existing code style.** TypeScript strict mode, Angular standalone components,
   RxJS reactive state. Same naming, formatting, patterns as surrounding code.

7. **Finish cleanly.** When the fix satisfies the ticket's Definition of Done, you're done — report
   it and stop.

## Backend Services

The app talks to a REST backend at `/api`. Five MCP servers give you task context:
**jira** (tickets), **confluence** (contracts), **sentry** (errors), **testrail** (acceptance
tests), **github** (commit status).

## TypeScript and Angular Conventions

- All types in `*.types.ts` files. Controllers use `BehaviorSubject` + `state$: Observable`.
- HTTP clients extend abstract API classes, use `HttpClient` + `HttpParams`.
- Components are standalone with inline templates.
- Constants in `as const` objects (`CATALOG`, `ORDERS`, `EDITCARD`).
- Tests use `fakeAsync`/`tick` for timing, custom stub API classes.

## Common Patterns

### Controller Pattern
Controllers manage state via `BehaviorSubject<StateType>`, expose it as `readonly state$`.
Methods like `setQuery()`, `setPage()`, `setSort()` update state. Components subscribe to
`state$` and render reactively.

### API Pattern
API classes extend abstract base, implement `list()` / `get()` / `save()`. Use Angular's
`HttpClient` with `HttpParams` for query serialization.

### Testing Pattern
Tests create stub/fake API implementations, pass them to controller constructor, subscribe
to `state$` for assertions. Time-sensitive tests use `fakeAsync` with `tick()`.

