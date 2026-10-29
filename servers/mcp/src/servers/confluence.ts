/** Confluence MCP mock — bloated docs search/read. Hosts the catalog frontend contract. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';
import { rng, paragraph, person, isoAt } from '../noise.js';

interface Contract {
  id: string;
  title: string;
  body: string;
}

const CONTRACTS: Contract[] = [
  {
    id: 'ENG-CATALOG-PAGINATION',
    title: 'Catalog Pagination — Frontend Contract (Web Platform)',
    body: `# Catalog Data Grid — Frontend Contract

## Endpoint
\`GET /api/products?page&pageSize&sort&category&q\` — \`page\` is **required**, integer ≥ 1 (the
backend rejects a missing/invalid page with HTTP 400). \`pageSize\` defaults to 12.

## URL is the single source of truth
All four query dimensions live in the query string and are read on init, so the grid is
deep-linkable and survives reload / back-forward:
- \`page\` (≥1), \`sort\` (name | price-asc | price-desc | category), \`category\`, \`q\`.
- Landing on /catalog with no params = page 1, default sort, no filter — requested immediately.
- Opening \`/catalog?page=3&sort=price-desc&category=Bowls&q=asada\` restores that exact state.
- Changing a filter or sort **resets to page 1** and is written to the URL.
- Absent/invalid \`page\` defaults to 1; never send undefined/NaN/<1.

## Data layer
- **Single request in flight**: when a newer query/page starts, cancel the previous one so a slower
  earlier response can never overwrite a newer one.
- **Cache + dedup**: cache results by the full query key; a repeated query is served from cache
  (no refetch).
- **Stale-while-revalidate**: while fetching an uncached query, keep the previous results visible
  (a subtle "updating" hint) instead of flashing the loading state.

## Empty states
Tell the three cases apart: **no-products** (catalog empty), **no-match** (a filter excluded
everything), **out-of-range** (the requested page is beyond the last page).

## Non-goals
Infinite scroll and server cursors are out of scope; numbered pagination via \`?page\` is agreed.

${FILLER}`,
  },
];

function searchResults(query: string) {
  const contractItems = CONTRACTS.map((c) => ({
    id: c.id,
    title: c.title,
    space: 'ENG',
    url: `https://confluence.platacard.local/display/ENG/${c.id}`,
    excerpt: 'Agreed frontend contract — required client behavior and the API shape.',
    lastModified: '2026-06-10T14:32:00Z',
    modifiedBy: 'system.engineer@platacard.local',
    version: 7,
    labels: ['frontend-contract', 'web-platform'],
    metadata: metadataBloat(c.id),
  }));
  const filler = Array.from({ length: 20 }, (_, i) => ({
    id: `ENG-2026-${String(i + 1).padStart(4, '0')}`,
    title: `Documentation for ${query}-${i + 1} — Architecture Overview and Implementation Guidelines`,
    space: 'ENG',
    url: `https://confluence.platacard.local/display/ENG/ENG-2026-${i + 1}`,
    excerpt: `Covers architecture, API surface, data model, migration strategy, and FAQ for ${query}-${i + 1}. ${paragraph(rng(`excerpt-${query}-${i}`), 2)}`,
    lastModified: '2026-05-20T10:00:00Z',
    modifiedBy: 'system.engineer@platacard.local',
    version: 12,
    labels: ['architecture', 'api-design'],
    metadata: metadataBloat(`f-${i + 1}`),
  }));
  const results = [...contractItems, ...filler];
  return {
    totalCount: 142,
    returnedCount: results.length,
    truncated: true,
    query,
    results,
    searchMetadata: {
      indexName: 'confluence-prod-2026-06',
      tookMs: 247,
      timedOut: false,
      shards: { total: 5, successful: 5, skipped: 0, failed: 0 },
      hits: { total: { value: 142, relation: 'eq' as const }, maxScore: 2.15 },
      aggregations: { bySpace: { ENG: 89, WEB: 32, OPS: 21 }, byLabel: { 'frontend-contract': 3, architecture: 56 } },
    },
  };
}

// ── Real-page volume the agent never needs (see noise.ts) ───────────────────────────────────────
function pageAppendix(pageId: string): string {
  const next = rng(`appendix-${pageId}`);
  const changeLog = Array.from({ length: 20 }, (_, i) =>
    `| v${i + 1} | ${isoAt(i * 20).slice(0, 10)} | ${person(next).displayName} | ${paragraph(next, 1)} |`).join('\n');
  const meetings = Array.from({ length: 5 }, (_, i) =>
    `### Sync ${isoAt(i * 48).slice(0, 10)}\nAttendees: ${Array.from({ length: 4 }, () => person(next).displayName).join(', ')}\n\n${paragraph(next, 6)}`).join('\n\n');
  const glossary = ['SWR', 'Deep link', 'Query key', 'Out-of-range', 'Stale response', 'Dedup', 'Pager', 'Facet']
    .map((t) => `- **${t}** — ${paragraph(next, 1)}`).join('\n');
  return `## Change log\n\n| Version | Date | Author | Summary |\n|---|---|---|---|\n${changeLog}

## Meeting notes\n\n${meetings}

## Appendix A — OpenAPI excerpt (GET /api/products)

\`\`\`json
${JSON.stringify(OPENAPI_PRODUCTS, null, 2)}
\`\`\`

## Appendix B — Glossary\n\n${glossary}`;
}

const OPENAPI_PRODUCTS = {
  openapi: '3.1.0',
  paths: {
    '/api/products': {
      get: {
        operationId: 'listProducts',
        parameters: [
          { name: 'page', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', default: 12, maximum: 100 } },
          { name: 'sort', in: 'query', required: false, schema: { type: 'string', enum: ['name', 'price-asc', 'price-desc', 'category'] } },
          { name: 'category', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'q', in: 'query', required: false, schema: { type: 'string', maxLength: 200 } },
        ],
        responses: {
          '200': { description: 'A page of products', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductPage' } } } },
          '400': { description: 'Invalid query (e.g. missing or invalid page)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      ProductPage: { type: 'object', required: ['items', 'total', 'page', 'pageSize'], properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Product' } }, total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' } } },
      Product: { type: 'object', required: ['id', 'name', 'price', 'category'], properties: { id: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, category: { type: 'string' }, description: { type: 'string' }, spicyLevel: { type: 'integer', minimum: 0, maximum: 5 }, imageUrl: { type: 'string', format: 'uri' }, tags: { type: 'array', items: { type: 'string' } }, updatedAt: { type: 'string', format: 'date-time' } } },
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' }, issues: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } } } } },
    },
  },
};

/** Confluence returns the page twice: rendered view + XHTML storage format. */
function storageFormat(markdown: string): string {
  return markdown.split('\n').map((line) => (line.startsWith('#')
    ? `<h${line.indexOf(' ')}>${line.replace(/^#+\s*/, '')}</h${line.indexOf(' ')}>`
    : `<p><ac:structured-macro ac:name="markdown-line"><ac:plain-text-body><![CDATA[${line}]]></ac:plain-text-body></ac:structured-macro></p>`)).join('\n');
}

function versionHistory(pageId: string) {
  const next = rng(`versions-${pageId}`);
  return Array.from({ length: 6 }, (_, i) => ({ number: i + 1, when: isoAt(i * 30), by: person(next), message: paragraph(next, 1), minorEdit: i % 3 === 0 }));
}

function pageComments(pageId: string) {
  const next = rng(`page-comments-${pageId}`);
  return Array.from({ length: 5 }, (_, i) => ({ id: `c-${i + 1}`, author: person(next), created: isoAt(i * 9), body: paragraph(next, 3), resolved: next() > 0.5 }));
}

function getPage(pageId: string) {
  const contract = CONTRACTS.find((c) => c.id === pageId);
  return {
    id: pageId,
    title: contract?.title ?? `Architecture Decision Record: ${pageId}`,
    space: 'ENG',
    status: 'current',
    body: contract ? `${contract.body}\n\n${pageAppendix(pageId)}` : `# ${pageId}\n\n${FILLER}\n`.repeat(3),
    bodyStorage: contract ? storageFormat(contract.body) : null,
    version: { number: 7, when: '2026-06-10T14:32:00Z', by: 'system.engineer@platacard.local', history: versionHistory(pageId) },
    ancestors: ['ENG', 'ENG-WEB', 'ENG-WEB-CONTRACTS', 'ENG-WEB-CONTRACTS-2026'].map((id, i) => ({ id, title: `Web Platform / ${['Engineering', 'Web', 'Contracts', '2026'][i]}`, url: `https://confluence.platacard.local/display/ENG/${id}` })),
    children: Array.from({ length: 12 }, (_, i) => ({ id: `${pageId}-NOTE-${i + 1}`, title: `Implementation note ${i + 1}`, url: `https://confluence.platacard.local/display/ENG/${pageId}-NOTE-${i + 1}` })),
    comments: pageComments(pageId),
    metadata: {
      ...metadataBloat(pageId),
      contributors: Array.from({ length: 12 }, (_, i) => ({
        email: `engineer${i + 1}@platacard.local`,
        contributions: ((i * 7) % 40) + 1,
        lastEdit: `2026-0${1 + (i % 6)}-${String(1 + i).padStart(2, '0')}T10:00:00Z`,
      })),
      watchers: Array.from({ length: 18 }, (_, i) => `watcher${i + 1}@platacard.local`),
      childPages: ['ENG-2026-0100', 'ENG-2026-0101'],
      parentPage: 'ENG-2026-0001',
      labels: ['frontend-contract'],
      spaceKey: 'ENG',
    },
  };
}

export function registerConfluence(server: McpServer): void {
  server.registerTool(
    'confluence_search',
    {
      title:
        'Search Confluence Documentation — Full-Text Query with Advanced Filtering, Sorting, Pagination, and Metadata Aggregation Across All Spaces, Pages, Blog Posts, and Attachments',
      description: `Performs a comprehensive full-text search across the entire Confluence knowledge base, indexing all spaces, pages, blog posts, comments, and attachments. Uses Apache Lucene with BM25 relevance scoring and supports boolean syntax, phrase matching, wildcards, fuzzy matching, and field-specific queries. Returns results enriched with space info, author details, modification timestamps, version summaries, labels, hierarchy, permissions, and view statistics. ${FILLER}`,
      inputSchema: { query: z.string().describe('Full-text query. Supports Lucene syntax; max 1000 chars.') },
    },
    async ({ query }) => jsonContent(searchResults(query)),
  );

  server.registerTool(
    'confluence_get_page',
    {
      title:
        'Retrieve Full Confluence Page Content with Complete Metadata, Version History, Contributor Details, Permission Information, and Child Page Hierarchy',
      description: `Retrieves the complete body and all metadata for a single Confluence page by ID, including the full storage-format body, creation/modification history, version tracking, contributor statistics, space hierarchy, permissions, child pages, inline comments, and attachments. ${FILLER}`,
      inputSchema: { pageId: z.string().describe('Page ID, e.g. ENG-CATALOG-PAGINATION.') },
    },
    async ({ pageId }) => jsonContent(getPage(pageId)),
  );
}
