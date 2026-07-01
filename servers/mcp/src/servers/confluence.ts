/** Confluence MCP mock — bloated docs search/read. Hosts the per-vector frontend contracts. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';

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
  {
    id: 'ENG-ORDERS-SEARCH',
    title: 'Orders Data Grid — Frontend Contract (Web Platform)',
    body: `# Orders Data Grid — Frontend Contract

## Endpoint
\`GET /api/orders?page&pageSize&q&sort&status&location\` — \`page\` is **required**, integer ≥ 1 (the
backend rejects a missing/invalid page with HTTP 400). \`pageSize\` defaults to 10.

## URL is the single source of truth
All query dimensions live in the query string and are read on init, so the grid is
deep-linkable and survives reload / back-forward:
- \`page\` (≥1), \`sort\` (date-desc | date-asc | total-desc | total-asc), \`status\`, \`q\`, \`location\`.
- Landing on /orders with no params = page 1, default sort, no filter — requested immediately.
- Opening \`/orders?page=3&sort=total-desc&status=refunded&q=ana\` restores that exact state.
- Changing a filter or sort **resets to page 1** and is written to the URL.
- Absent/invalid \`page\` defaults to 1; never send undefined/NaN/<1.

## Data layer
- **Debounce** search input by ~300ms: rapid keystrokes collapse into one request.
- **Single request in flight**: when a newer query/page starts, cancel the previous one so a slower
  earlier response can never overwrite a newer one.
- **Cache + dedup**: cache results by the full query key; a repeated query issues **zero** new GETs —
  including a query whose earlier request was cancelled mid-flight (dedupe the in-flight request,
  don't only cache on completion).
- **Stale-while-revalidate**: while fetching an uncached query, keep the previous results visible
  (a subtle "updating" hint) instead of flashing the loading state.
- **Errors**: a failed request surfaces an error state — never a silent blank grid.

## Empty states
Tell the three cases apart: **no-orders** (nothing in the system), **no-match** (a filter excluded
everything), **out-of-range** (the requested page is beyond the last page).

## Non-goals
Infinite scroll is out of scope; numbered pagination via \`?page\` is agreed.

${FILLER}`,
  },
  {
    id: 'ENG-EDIT-VALIDATION',
    title: 'Product Edit — Validation, Output-Encoding & Dirty-State Contract (Web Platform)',
    body: `# Product Edit — Validation, Output-Encoding & Dirty-State Contract

## Endpoint
\`PUT /api/products/:id\` — the backend validates the body and replies \`400 { error, issues:
[{ path, message }] }\` on bad input.

## Required client behavior
1. **Validate before submit**: name required (≤ 80), price ≥ 0 (≤ 100000), description ≤ 500,
   spicyLevel 0–5. Block the submit and show an inline message next to each offending field.
2. On a backend **400**, map each \`issues[].path\` to its field and show \`message\` there.
3. **Output-encode** the description before rendering — never inject raw HTML. Escape \`< > & " '\`
   (or render as text) so a value like \`<img src=x onerror=alert(1)>\` cannot execute (stored XSS).
4. **Dirty-state guard**: detect unsaved changes and warn or block when navigating away from an
   edited form (browser back, router link, etc.).
5. Surface saving / saved / error states.

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
  const filler = Array.from({ length: 18 }, (_, i) => ({
    id: `ENG-2026-${String(i + 1).padStart(4, '0')}`,
    title: `Documentation for ${query}-${i + 1} — Architecture Overview and Implementation Guidelines`,
    space: 'ENG',
    url: `https://confluence.platacard.local/display/ENG/ENG-2026-${i + 1}`,
    excerpt: `Covers architecture, API surface, data model, migration strategy, and FAQ for ${query}-${i + 1}.`,
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

function getPage(pageId: string) {
  const contract = CONTRACTS.find((c) => c.id === pageId);
  return {
    id: pageId,
    title: contract?.title ?? `Architecture Decision Record: ${pageId}`,
    space: 'ENG',
    version: 7,
    status: 'current',
    body: contract ? contract.body : `# ${pageId}\n\n${FILLER}\n`.repeat(3),
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
      inputSchema: { pageId: z.string().describe('Page ID, e.g. ENG-CATALOG-PAGINATION, ENG-ORDERS-SEARCH, ENG-EDIT-VALIDATION.') },
    },
    async ({ pageId }) => jsonContent(getPage(pageId)),
  );
}
