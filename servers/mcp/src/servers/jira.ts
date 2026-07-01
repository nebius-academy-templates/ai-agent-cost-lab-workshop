/**
 * Jira MCP mock — bloated issue search/read. Each ticket is self-contained: bug description,
 * Definition of Done, and links to the Confluence contract / Sentry error / TestRail suite. The
 * agent discovers everything it needs from the ticket; TASK.md only carries the ticket number.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';

interface Ticket {
  key: string;
  summary: string;
  description: string;
  definitionOfDone: string[];
  resources: { confluence: string; sentry: string; testrailSuite: string };
  labels: string[];
}

const TICKETS: Record<string, Ticket> = {
  'JIRA-0321': {
    key: 'JIRA-0321',
    summary: 'Catalog grid: URL state ignored, no caching/stale-while-revalidate, and stale responses overwrite newer ones',
    description: `The Catalog page (/catalog) is a product data grid (filter by category, search, sort, paginate).
It loads page 1 on open, but the whole grid state is broken in several interacting ways:

1. It ignores the URL. /catalog?page=3&sort=price-desc&category=Bowls&q=asada still shows the
   default page-1/no-filter view, and browser back/forward don't restore state. Only the toolbar
   controls and pager buttons change anything, and those changes are not written to the URL.
2. Changing a filter or sort does not reset to page 1 — you can sit on page 5 of a 2-page result.
3. Every navigation re-fetches and flashes the loading state; there's no caching/dedup and no
   stale-while-revalidate (the list blanks out between pages).
4. A slower earlier response can overwrite a newer one (no request cancellation) — the list flickers.
5. Empty results are always shown the same way — no "no products" vs "nothing matches your filter"
   vs "that page is out of range" distinction.

Expected: a fully URL-driven, race- and cache-safe grid. See the linked Confluence contract for the
exact behavior, the Sentry issue, and the TestRail acceptance suite.`,
    definitionOfDone: [
      'page, sort, category, and search query all live in the URL and are read on init (deep-linkable).',
      'Changing a filter or sort resets to page 1 and updates the URL.',
      'Back/forward (route changes) reload the corresponding state.',
      'Absent or invalid page defaults to 1; never send an undefined/NaN/<1 page.',
      'A stale (slower, older) response never overwrites a newer one (cancel in flight).',
      'Cache results by query and serve repeats from cache (no refetch).',
      'Stale-while-revalidate: keep the previous results visible while loading an uncached query (no loading flash).',
      'Classify empty results: no-products vs no-match (filtered) vs out-of-range (page beyond last).',
      'Do not change the GET /api/products contract; add no runtime dependencies.',
    ],
    resources: { confluence: 'ENG-CATALOG-PAGINATION', sentry: 'PLATA-WEB-1F2A', testrailSuite: 'S-CATALOG-PAGINATION' },
    labels: ['catalog', 'pagination', 'web', 'frontend'],
  },
  'JIRA-0410': {
    key: 'JIRA-0410',
    summary: 'Orders grid: URL state ignored, no debounce/caching/stale-while-revalidate, and stale responses overwrite newer ones',
    description: `The Orders page (/orders) is a data grid (filter by status, search, sort, paginate).
It loads page 1 on open, but the whole grid state is broken in several interacting ways:

1. It ignores the URL. /orders?page=3&sort=total-desc&status=refunded&q=ana still shows the
   default page-1/no-filter view, and browser back/forward don't restore state.
2. Changing a filter or sort does not reset to page 1 — you can sit on page 5 of a 2-page result.
3. Every keystroke fires a request (no debounce) and a slow earlier response can overwrite a newer
   one (mergeMap keeps every request in flight) — the list storms the API and flickers.
4. Every navigation re-fetches and flashes the loading state; there's no caching/dedup and no
   stale-while-revalidate (the list blanks out between pages).
5. Empty results are always shown the same way — no "no orders" vs "nothing matches your filter"
   vs "that page is out of range" distinction.

Expected: a fully URL-driven, debounced, race- and cache-safe grid. See the linked Confluence
contract, Sentry issue, and TestRail acceptance suite.`,
    definitionOfDone: [
      'page, sort, status, q, and location all live in the URL and are read on init (deep-linkable).',
      'Changing a filter or sort resets to page 1 and updates the URL.',
      'Back/forward (route changes) reload the corresponding state.',
      'Absent or invalid page defaults to 1; never send an undefined/NaN/<1 page.',
      'Debounce search input so rapid keystrokes produce one request for the final query.',
      'A stale (slower, older) response never overwrites a newer one (cancel in flight).',
      'Cache by the full query key and dedupe in flight: a repeated query issues zero new GET /api/orders calls — even one whose earlier request was superseded mid-flight (do not only fill the cache on completion).',
      'Stale-while-revalidate: keep previous results visible while loading an uncached query (no loading flash).',
      'Classify empty results: no-orders vs no-match (filtered) vs out-of-range (page beyond last).',
      'Surface an error state when a request fails — show an error, not a silent blank grid.',
      'Do not change the GET /api/orders contract; add no runtime dependencies.',
    ],
    resources: { confluence: 'ENG-ORDERS-SEARCH', sentry: 'PLATA-WEB-ORDERS', testrailSuite: 'S-ORDERS-SEARCH' },
    labels: ['orders', 'data-grid', 'debounce', 'web', 'frontend'],
  },
  'JIRA-0455': {
    key: 'JIRA-0455',
    summary: 'Edit product: no client-side validation, backend 400 swallowed, stored XSS, no dirty guard, no optimistic save',
    description: `The Edit product page (/edit/:id) gives no feedback on invalid input, is unsafe, and has poor UX.

Steps to reproduce:
1. Open /edit/BRT-001, clear the name or set a negative price or spicy level 99, and save.
   The invalid payload is sent and the backend 400 is swallowed — nothing is shown next to the field.
2. Set the description to <img src=x onerror=alert(1)> and reload; the script executes (stored XSS).
3. Change any field, then click the browser back button — the unsaved changes are silently discarded
   (no dirty-state guard).
4. The UI waits for the server round-trip before showing "saved" (no optimistic update).

Expected: client-side validation before submit, per-field error display (including backend 400
mapping), output-encoding for the description, dirty-state guard on navigation, and an optimistic
save pattern. See the linked Sentry XSS report and Confluence contract.`,
    definitionOfDone: [
      'Validate all inputs client-side before save: name required (≤80), price 0–100000, description ≤500, spicyLevel 0–5.',
      'Block save and show inline field-level error messages when validation fails.',
      'Map backend 400 issues (error + issues[{path, message}]) onto the corresponding fields.',
      'Escape/sanitize the description on render — no HTML injection / XSS.',
      'Detect dirty state: warn or block when navigating away from an unsaved edited form.',
      'saving, saved, and error states are all surfaced.',
      'Do not change the PUT /api/products/:id contract; add no runtime dependencies.',
    ],
    resources: { confluence: 'ENG-EDIT-VALIDATION', sentry: 'PLATA-WEB-EDIT-XSS', testrailSuite: 'S-EDIT-VALIDATION' },
    labels: ['edit', 'validation', 'xss', 'security', 'dirty-state', 'web'],
  },
};

function bloatedIssue(key: string) {
  const ticket = TICKETS[key];
  if (!ticket) {
    return { key, errorMessages: [`Issue does not exist or you do not have permission to see it: ${key}`], errors: {} };
  }
  return {
    id: `100${key.replace(/\D/g, '')}`,
    key: ticket.key,
    self: `https://platacard.atlassian.net/rest/api/3/issue/${ticket.key}`,
    fields: {
      summary: ticket.summary,
      issuetype: { name: 'Bug', id: '1', iconUrl: 'https://platacard.atlassian.net/images/icons/bug.png', subtask: false },
      status: { name: 'Open', id: '1', statusCategory: { key: 'new', name: 'To Do', colorName: 'blue-gray' } },
      priority: { name: 'High', id: '2' },
      labels: ticket.labels,
      components: [{ id: '10', name: 'Plata Burrito CRM' }],
      assignee: { displayName: 'Unassigned', accountId: null, active: false },
      reporter: { displayName: 'QA Bot', accountId: 'acc-qa-001', emailAddress: 'qa@platacard.local', active: true },
      created: '2026-06-12T09:14:00.000Z',
      updated: '2026-06-18T16:40:00.000Z',
      description: ticket.description,
      // The Definition of Done the agent must satisfy — lives in the ticket, not in TASK.md.
      definitionOfDone: ticket.definitionOfDone,
      relatedResources: {
        confluence: { pageId: ticket.resources.confluence, hint: 'fetch with confluence_get_page', url: `https://confluence.platacard.local/display/ENG/${ticket.resources.confluence}` },
        sentry: { issueId: ticket.resources.sentry, hint: 'fetch with sentry_get_event', url: `https://sentry.platacard.local/issues/${ticket.resources.sentry}` },
        testrail: { suiteId: ticket.resources.testrailSuite, hint: 'fetch with testrail_get_cases / testrail_get_results' },
      },
      comment: {
        total: 2,
        comments: [
          { id: '1', author: { displayName: 'Tech Lead' }, created: '2026-06-13T10:00:00Z', body: 'Repro confirmed. See the Definition of Done and the linked contract page.' },
          { id: '2', author: { displayName: 'QA Bot' }, created: '2026-06-14T11:00:00Z', body: 'Acceptance is tracked in the linked TestRail suite; CI gates the commit.' },
        ],
      },
      watches: { watchCount: 6, isWatching: false },
      metadata: metadataBloat(key),
    },
  };
}

function searchIssues(jql: string) {
  return {
    expand: 'schema,names',
    startAt: 0,
    maxResults: 50,
    total: Object.keys(TICKETS).length,
    jql,
    issues: Object.keys(TICKETS).map(bloatedIssue),
    warningMessages: [],
    names: { summary: 'Summary', status: 'Status', priority: 'Priority' },
  };
}

export function registerJira(server: McpServer): void {
  server.registerTool(
    'jira_search_issues',
    {
      title: 'Search Jira Issues via JQL with Full Field Expansion, Pagination, and Schema/Names Metadata Across All Projects and Boards',
      description: `Executes a JQL search across all accessible projects, returning matching issues with fully expanded fields, comments, watchers, and rendered descriptions. Supports ordering, pagination (maxResults up to 100), and field selection. ${FILLER}`,
      inputSchema: { jql: z.string().describe('JQL query, e.g. project = PLATA AND labels = catalog ORDER BY updated DESC.') },
    },
    async ({ jql }) => jsonContent(searchIssues(jql)),
  );

  server.registerTool(
    'jira_get_issue',
    {
      title: 'Retrieve a Single Jira Issue with Complete Fields, Definition of Done, Linked Resources, Comments, Change Log, and Watchers',
      description: `Fetches one issue by key with all fields including the Definition of Done and links to the related Confluence page, Sentry error, and TestRail suite, plus the full comment thread and watchers. ${FILLER}`,
      inputSchema: { issueKey: z.string().describe('Issue key, e.g. JIRA-0321, JIRA-0410, JIRA-0455.') },
    },
    async ({ issueKey }) => jsonContent(bloatedIssue(issueKey)),
  );
}
