/** Sentry MCP mock — bloated error monitoring. One headline error for the catalog bug. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';
import { rng, paragraph, isoAt, pick } from '../noise.js';

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
        ...noiseBreadcrumbs(seed.id),
        { timestamp: '2026-06-18T16:39:58Z', category: 'navigation', message: 'route change' },
        { timestamp: '2026-06-18T16:39:59Z', category: 'xhr', message: seed.endpoint },
        { timestamp: '2026-06-18T16:39:59Z', category: 'console', level: 'warning', message: seed.value },
      ],
    },
    contexts: NOISE_CONTEXTS,
    request: NOISE_REQUEST,
    sdk: NOISE_SDK,
    entries: [
      {
        type: 'exception',
        data: {
          values: [
            {
              type: seed.type,
              value: seed.value,
              // In-app frames first (the mock's convention), then the framework frames real events carry.
              stacktrace: { frames: [...seed.frames.map((f) => ({ ...f, colNo: 5 })), ...vendorFrames(seed.id)] },
            },
          ],
        },
      },
    ],
    dateCreated: '2026-06-18T16:39:59Z',
  };
}

// ── Real-event volume the agent never needs (see noise.ts) ──────────────────────────────────────
const VENDOR_MODULES = [
  ['node_modules/zone.js/fesm2015/zone.js', 'ZoneDelegate.invokeTask'],
  ['node_modules/rxjs/dist/esm/internal/Subscriber.js', 'Subscriber._next'],
  ['node_modules/rxjs/dist/esm/internal/operators/map.js', 'OperatorSubscriber._next'],
  ['node_modules/@angular/core/fesm2022/core.mjs', 'executeListenerWithErrorHandling'],
  ['node_modules/@angular/common/fesm2022/http.mjs', 'HttpXhrBackend.handle'],
  ['node_modules/@angular/router/fesm2022/router.mjs', 'Router.navigateByUrl'],
] as const;

function vendorFrames(seed: string) {
  const next = rng(`frames-${seed}`);
  return Array.from({ length: 12 }, (_, i) => {
    const [filename, fn] = pick(next, VENDOR_MODULES);
    const line = 100 + Math.floor(next() * 4000);
    const src = (n: number) => `      ${fn.split('.').pop()}(arg${n}) { return this.delegate.invoke(arg${n}, ${n}); } // ${filename.split('/').slice(-1)[0]}:${line + n}`;
    return {
      filename, function: fn, lineNo: line, colNo: 1 + (i % 40), inApp: false,
      preContext: [-3, -2, -1].map(src), contextLine: src(0), postContext: [1, 2, 3].map(src),
      vars: { this: '<object>', arg0: '<function>', arg1: i },
    };
  });
}

function noiseBreadcrumbs(seed: string) {
  const next = rng(`crumbs-${seed}`);
  return Array.from({ length: 30 }, (_, i) => {
    const category = pick(next, ['ui.click', 'navigation', 'xhr', 'console', 'fetch'] as const);
    return {
      timestamp: isoAt(i).replace('2026-05', '2026-06'),
      category,
      level: category === 'console' ? 'info' : 'debug',
      message: category === 'xhr' || category === 'fetch'
        ? `GET /api/${pick(next, ['finance/summary', 'orders?page=1', 'locations', 'session'])} [200]`
        : category === 'navigation' ? `/${pick(next, ['finance', 'orders', 'catalog', 'edit/BRT-001'])}`
        : paragraph(next, 1),
      data: { durationMs: Math.floor(next() * 900), statusCode: 200 },
    };
  });
}

const NOISE_CONTEXTS = {
  browser: { name: 'Chrome', version: '126.0.6478.127', type: 'browser' },
  os: { name: 'Windows', version: '10', build: '19045', type: 'os' },
  device: { family: 'Desktop', model: 'Unknown', arch: 'x64', memorySizeGb: 16, screenResolution: '1920x1080', type: 'device' },
  runtime: { name: 'v8', version: '12.6.228.21', type: 'runtime' },
  trace: { traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: '00f067aa0ba902b7', op: 'navigation', status: 'ok', type: 'trace' },
  culture: { locale: 'es-MX', timezone: 'America/Mexico_City', calendar: 'gregory', type: 'culture' },
};

const NOISE_REQUEST = {
  url: 'https://crm.platacard.local/catalog?page=3&sort=price-desc',
  method: 'GET',
  headers: Object.fromEntries(['Accept', 'Accept-Encoding', 'Accept-Language', 'Cache-Control', 'Connection', 'Cookie', 'Host', 'Pragma', 'Referer', 'Sec-Ch-Ua', 'Sec-Ch-Ua-Mobile', 'Sec-Ch-Ua-Platform', 'Sec-Fetch-Dest', 'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'Upgrade-Insecure-Requests', 'User-Agent', 'X-Request-Id', 'X-Forwarded-For', 'X-Plata-Client']
    .map((h, i) => [h, `${h.toLowerCase()}-value-${i}-[Filtered]`])),
};

const NOISE_SDK = {
  name: 'sentry.javascript.angular',
  version: '8.27.0',
  integrations: ['InboundFilters', 'FunctionToString', 'TryCatch', 'Breadcrumbs', 'GlobalHandlers', 'LinkedErrors', 'Dedupe', 'HttpContext', 'BrowserTracing', 'Replay'],
  packages: Array.from({ length: 50 }, (_, i) => ({ name: `npm:@plata/web-dep-${i + 1}`, version: `1.${i % 10}.${(i * 7) % 13}` })),
};

const NOISE_ISSUE_TITLES = [
  'ChunkLoadError: Loading chunk finance failed', 'ResizeObserver loop completed with undelivered notifications',
  'TypeError: Cannot read properties of undefined (reading \'map\') in FinancePage', 'NG0100: ExpressionChangedAfterItHasBeenChecked in navbar',
  'HttpErrorResponse 502 on /api/locations', 'SecurityError: localStorage access denied in Safari private mode',
] as const;

function listIssues(query: string) {
  const next = rng(`sentry-list-${query}`);
  const noise = Array.from({ length: 24 }, (_, i) => ({
    id: `PLATA-WEB-N${100 + i}`, shortId: `PLATA-WEB-${100 + i}`, title: pick(next, NOISE_ISSUE_TITLES),
    culprit: pick(next, ['FinancePage.ngOnInit', 'NavbarComponent', 'LocationsApi.load', 'ThemeService']),
    level: pick(next, ['error', 'warning']), status: 'unresolved', count: 5 + Math.floor(next() * 900), userCount: 1 + Math.floor(next() * 300),
    firstSeen: isoAt(i * 17), lastSeen: isoAt(i * 17 + 60), metadata: metadataBloat(`sentry-n-${i}`),
  }));
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
  return { query, total: issues.length + noise.length, issues: [...issues, ...noise], pageInfo: { hasNextPage: true, endCursor: '0:0:100' } };
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
      inputSchema: { issueId: z.string().describe('Issue id, e.g. PLATA-WEB-1F2A.') },
    },
    async ({ issueId }) => jsonContent(bloatedEvent(issueId)),
  );
}
