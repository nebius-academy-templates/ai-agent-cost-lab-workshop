/** Sentry MCP mock — bloated error monitoring. One headline error per vector. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';

interface EventSeed {
  id: string;
  shortId: string;
  type: string;
  value: string;
  title: string;
  culprit: string;
  message: string;
  frames: { filename: string; function: string; lineNo: number; inApp: boolean }[];
  endpoint: string;
  httpStatus?: string;
}

const EVENTS: EventSeed[] = [
  {
    id: 'PLATA-WEB-1F2A',
    shortId: 'PLATA-WEB-12',
    type: 'StateConsistencyWarning',
    value: 'URL state ignored; out-of-order responses overwrite newer results',
    title: 'Catalog grid: URL state ignored and a stale response overwrote a newer one',
    culprit: 'CatalogController.init(catalog.controller.ts)',
    message:
      'The catalog grid ignores the URL on init (page/sort/category/q), so deep-links and back/forward do not restore state. It also re-fetches on every navigation with no caching and no cancellation: a slower earlier response resolved after a newer one and overwrote it, and the list blanks out between pages. The controller never reads queryParamMap and uses a manual subscribe instead of switchMap.',
    frames: [
      { filename: 'app/catalog/catalog.controller.ts', function: 'CatalogController.init', lineNo: 40, inApp: true },
      { filename: 'app/catalog/catalog.page.ts', function: 'CatalogPageComponent.ngOnInit', lineNo: 0, inApp: true },
    ],
    endpoint: 'GET /api/products',
  },
  {
    id: 'PLATA-WEB-ORDERS',
    shortId: 'PLATA-WEB-31',
    type: 'StateConsistencyWarning',
    value: 'URL state ignored; out-of-order responses overwrite newer results; no cache/SWR',
    title: 'Orders grid: URL state ignored, no debounce/cache, and a stale response overwrote a newer one',
    culprit: 'OrdersController.init(orders.controller.ts)',
    message:
      'The orders grid ignores the URL on init (page/sort/status/q/location), so deep-links and back/forward do not restore state. It also fires a request on every keystroke with no debounce, re-fetches on every navigation with no caching, and a slower earlier response can overwrite a newer one (no cancellation). The list blanks out between pages. The controller never reads queryParamMap and uses a manual subscribe instead of switchMap.',
    frames: [
      { filename: 'app/orders/orders.controller.ts', function: 'OrdersController.init', lineNo: 44, inApp: true },
      { filename: 'app/orders/orders.page.ts', function: 'OrdersPageComponent.ngOnInit', lineNo: 0, inApp: true },
    ],
    endpoint: 'GET /api/orders',
  },
  {
    id: 'PLATA-WEB-EDIT-XSS',
    shortId: 'PLATA-WEB-44',
    type: 'SecurityError',
    value: 'stored XSS in product description; no client validation; no dirty guard',
    title: 'Edit product: stored XSS via description + swallowed 400 + no validation + no dirty guard',
    culprit: 'EditCardController.safeDescription(editcard.controller.ts)',
    message:
      'The product description is rendered as raw HTML, so a stored value like <img src=x onerror=alert(1)> executes (stored XSS). Separately, there is no client-side validation before save (invalid input is sent as-is), PUT /api/products/:id 400 validation responses are swallowed into a generic error and never shown per-field, and unsaved changes are silently discarded on navigation (no dirty-state guard). Needs output-encoding + client validation + 400 mapping + dirty guard.',
    frames: [
      { filename: 'app/edit-card/editcard.controller.ts', function: 'EditCardController.save', lineNo: 44, inApp: true },
      { filename: 'app/edit-card/edit-card.page.ts', function: 'EditCardPageComponent.template', lineNo: 0, inApp: true },
    ],
    endpoint: 'PUT /api/products/:id',
    httpStatus: '400',
  },
];

function bloatedEvent(issueId: string) {
  const seed = EVENTS.find((e) => e.id === issueId);
  if (!seed) return { id: issueId, title: `Error ${issueId}`, message: 'No additional detail.', metadata: metadataBloat(issueId) };
  return {
    id: seed.id,
    eventID: 'a1b2c3d4e5f6',
    project: 'plata-burrito-web',
    platform: 'javascript',
    level: 'error',
    title: seed.title,
    culprit: seed.culprit,
    message: seed.message,
    metadata: { ...metadataBloat(seed.id), type: seed.type, value: seed.value },
    tags: [
      { key: 'browser', value: 'Chrome 126.0' },
      { key: 'url', value: 'https://crm.platacard.local' },
      { key: 'release', value: 'plata-burrito-web@2026.06.0' },
      { key: 'environment', value: 'production' },
      { key: 'endpoint', value: seed.endpoint },
      ...(seed.httpStatus ? [{ key: 'http.status_code', value: seed.httpStatus }] : []),
    ],
    breadcrumbs: {
      values: [
        { timestamp: '2026-06-18T16:39:58Z', category: 'navigation', message: 'route change' },
        { timestamp: '2026-06-18T16:39:59Z', category: 'xhr', message: seed.endpoint },
        { timestamp: '2026-06-18T16:39:59Z', category: 'console', level: 'warning', message: seed.value },
      ],
    },
    entries: [
      {
        type: 'exception',
        data: {
          values: [
            {
              type: seed.type,
              value: seed.value,
              stacktrace: { frames: seed.frames.map((f) => ({ ...f, colNo: 5 })) },
            },
          ],
        },
      },
    ],
    dateCreated: '2026-06-18T16:39:59Z',
  };
}

function listIssues(query: string) {
  const issues = EVENTS.map((e, i) => ({
    id: e.id,
    shortId: e.shortId,
    title: e.title,
    culprit: e.culprit,
    level: e.type === 'SecurityError' ? 'error' : e.type === 'StateConsistencyWarning' ? 'warning' : 'error',
    status: 'unresolved',
    count: 318 - i * 80,
    userCount: 142 - i * 40,
    firstSeen: '2026-06-12T09:00:00Z',
    lastSeen: '2026-06-18T16:39:59Z',
    metadata: metadataBloat(`sentry-${i + 1}`),
  }));
  return { query, total: issues.length, issues, pageInfo: { hasNextPage: true, endCursor: '0:0:100' } };
}

export function registerSentry(server: McpServer): void {
  server.registerTool(
    'sentry_list_issues',
    {
      title: 'List Sentry Issues with Full Aggregation, Tags, Frequency Counts, First/Last Seen, and User Impact Across the Selected Project and Environment',
      description: `Lists unresolved (and optionally resolved) issues for a project, with event counts, user impact, first/last seen timestamps, culprit, level, and aggregated tags. Supports search queries and cursor pagination. ${FILLER}`,
      inputSchema: { query: z.string().describe('Search, e.g. is:unresolved.') },
    },
    async ({ query }) => jsonContent(listIssues(query)),
  );

  server.registerTool(
    'sentry_get_event',
    {
      title: 'Retrieve a Single Sentry Event/Issue with Full Stacktrace, Breadcrumbs, Tags, Request Context, and Release Information',
      description: `Fetches the latest event for an issue, including the full exception stacktrace with in-app frames, breadcrumb trail, tags, request/response context, and release metadata. ${FILLER}`,
      inputSchema: { issueId: z.string().describe('Issue id, e.g. PLATA-WEB-1F2A, PLATA-WEB-ORDERS, PLATA-WEB-EDIT-XSS.') },
    },
    async ({ issueId }) => jsonContent(bloatedEvent(issueId)),
  );
}
