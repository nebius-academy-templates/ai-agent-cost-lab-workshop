/**
 * Jira MCP mock — bloated issue search/read. Each ticket is self-contained: bug description,
 * Definition of Done, and links to the Confluence contract / Sentry error / TestRail suite. The
 * agent discovers everything it needs from the ticket; TASK.md only carries the ticket number.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';
import { rng, paragraph, person, isoAt, pick, PEOPLE } from '../noise.js';

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
        total: 2 + NOISE_COMMENTS,
        comments: [
          { id: '1', author: { displayName: 'Tech Lead' }, created: '2026-06-13T10:00:00Z', body: 'Repro confirmed. See the Definition of Done and the linked contract page.' },
          { id: '2', author: { displayName: 'QA Bot' }, created: '2026-06-14T11:00:00Z', body: 'Acceptance is tracked in the linked TestRail suite; CI gates the commit.' },
          ...noiseComments(key),
        ],
      },
      watches: { watchCount: 6, isWatching: false },
      attachment: noiseAttachments(key),
      worklog: noiseWorklog(key),
      ...noiseCustomFields(key),
      metadata: metadataBloat(key),
    },
    renderedFields: { description: renderHtml(ticket.description), definitionOfDone: ticket.definitionOfDone.map(renderHtml) },
    changelog: noiseChangelog(key),
    names: NOISE_NAMES,
    schema: NOISE_SCHEMA,
  };
}

// ── Real-API volume the agent never needs (see noise.ts) ─────────────────────────────────────────
const NOISE_COMMENTS = 8;
const NOISE_SEARCH_HITS = 8;
const CUSTOM_FIELD_NAMES = [
  'Story Points', 'Sprint', 'Epic Link', 'Team', 'Rank', 'Flagged', 'Severity', 'Environment', 'Found In Version',
  'Fix Version', 'Root Cause', 'Customer Impact', 'Release Notes', 'QA Owner', 'Design Link', 'Analytics Tag',
  'Support Case', 'Region', 'Platform', 'Browser',
] as const;
const NOISE_NAMES = Object.fromEntries(CUSTOM_FIELD_NAMES.map((n, i) => [`customfield_${10100 + i}`, n]));
const NOISE_SCHEMA = Object.fromEntries(CUSTOM_FIELD_NAMES.map((n, i) => [`customfield_${10100 + i}`, {
  type: i % 3 === 0 ? 'number' : i % 3 === 1 ? 'string' : 'array',
  custom: `com.atlassian.jira.plugin.system.customfieldtypes:${n.toLowerCase().replace(/[^a-z]+/g, '')}`,
  customId: 10100 + i,
}]));

function noiseCustomFields(key: string) {
  const next = rng(`cf-${key}`);
  return Object.fromEntries(CUSTOM_FIELD_NAMES.map((n, i) => [
    `customfield_${10100 + i}`,
    i % 4 === 0 ? null : i % 4 === 1 ? Math.floor(next() * 13) : i % 4 === 2 ? `${n}: ${pick(next, ['n/a', 'pending', 'web', 'mx-north', 'release-26.6'])}` : [pick(next, ['web', 'catalog', 'mx', 'pos'])],
  ]));
}

function noiseComments(key: string) {
  const next = rng(`comments-${key}`);
  return Array.from({ length: NOISE_COMMENTS }, (_, i) => ({
    id: String(10 + i),
    self: `https://platacard.atlassian.net/rest/api/3/issue/${key}/comment/${10 + i}`,
    author: person(next),
    created: isoAt(i * 5),
    updated: isoAt(i * 5 + 1),
    body: paragraph(next, 4),
    jsdPublic: true,
  }));
}

function noiseChangelog(key: string) {
  const next = rng(`changelog-${key}`);
  const fieldsChanged = ['status', 'assignee', 'Sprint', 'labels', 'priority', 'Story Points', 'Fix Version', 'description'] as const;
  return {
    startAt: 0,
    maxResults: 8,
    total: 8,
    histories: Array.from({ length: 8 }, (_, i) => ({
      id: String(5000 + i),
      author: person(next),
      created: isoAt(i * 3),
      items: Array.from({ length: 1 + (i % 3) }, () => {
        const field = pick(next, fieldsChanged);
        return { field, fieldtype: 'jira', from: null, fromString: pick(next, ['To Do', 'In Progress', 'Unassigned', '3', 'web']), to: null, toString: pick(next, ['In Review', 'To Do', pick(next, PEOPLE), '5', 'catalog']) };
      }),
    })),
  };
}

function noiseAttachments(key: string) {
  const next = rng(`attach-${key}`);
  return Array.from({ length: 3 }, (_, i) => ({
    id: String(70000 + i),
    self: `https://platacard.atlassian.net/rest/api/3/attachment/${70000 + i}`,
    filename: pick(next, ['screen-recording.mp4', 'har-export.har', 'console.log', 'catalog-page.png', 'network.json']).replace('.', `-${i + 1}.`),
    author: person(next),
    created: isoAt(i * 7),
    size: 10_000 + Math.floor(next() * 4_000_000),
    mimeType: pick(next, ['video/mp4', 'application/json', 'text/plain', 'image/png']),
    content: `https://platacard.atlassian.net/rest/api/3/attachment/content/${70000 + i}`,
    thumbnail: `https://platacard.atlassian.net/rest/api/3/attachment/thumbnail/${70000 + i}`,
  }));
}

function noiseWorklog(key: string) {
  const next = rng(`worklog-${key}`);
  return {
    startAt: 0,
    maxResults: 3,
    total: 3,
    worklogs: Array.from({ length: 3 }, (_, i) => ({
      id: String(9000 + i),
      author: person(next),
      comment: paragraph(next, 2),
      started: isoAt(i * 11),
      timeSpent: `${1 + (i % 4)}h`,
      timeSpentSeconds: (1 + (i % 4)) * 3600,
    })),
  };
}

function renderHtml(text: string): string {
  return text.split('\n').map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');
}

/** Search hit for a real ticket: issue fields without comments, history or rendered duplicates. */
function searchIssue(key: string) {
  const full = bloatedIssue(key);
  if (!('fields' in full) || full.fields === undefined) return full;
  const { comment: _comment, attachment: _attachment, worklog: _worklog, ...fields } = full.fields;
  return { id: full.id, key: full.key, self: full.self, fields };
}

/** Other tickets a broad JQL also matches — closed work from earlier sprints. */
function noiseIssue(i: number) {
  const next = rng(`issue-${i}`);
  const key = `JIRA-${String(200 + i).padStart(4, '0')}`;
  return {
    id: `100${200 + i}`,
    key,
    self: `https://platacard.atlassian.net/rest/api/3/issue/${key}`,
    fields: {
      summary: pick(next, ['Finance chart tooltip overlaps legend', 'Navbar logo blurry on retina', 'Orders export CSV encoding', 'Footer links open in same tab', 'Edit form autosave toast copy', 'Theme tokens for dark mode']) + ` (#${i + 1})`,
      issuetype: { name: pick(next, ['Bug', 'Task', 'Story']), id: '1', iconUrl: 'https://platacard.atlassian.net/images/icons/task.png', subtask: false },
      status: { name: 'Done', id: '10001', statusCategory: { key: 'done', name: 'Done', colorName: 'green' } },
      priority: { name: pick(next, ['Low', 'Medium']), id: '3' },
      labels: [pick(next, ['finance', 'shell', 'orders', 'theme'])],
      assignee: person(next),
      reporter: person(next),
      created: isoAt(i * 13),
      updated: isoAt(i * 13 + 40),
      resolutiondate: isoAt(i * 13 + 40),
      description: paragraph(next, 5),
      metadata: metadataBloat(key),
    },
  };
}

function searchIssues(jql: string) {
  return {
    expand: 'schema,names',
    startAt: 0,
    maxResults: 50,
    total: Object.keys(TICKETS).length + NOISE_SEARCH_HITS,
    jql,
    issues: [...Object.keys(TICKETS).map(searchIssue), ...Array.from({ length: NOISE_SEARCH_HITS }, (_, i) => noiseIssue(i))],
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
      inputSchema: { issueKey: z.string().describe('Issue key, e.g. JIRA-0321.') },
    },
    async ({ issueKey }) => jsonContent(bloatedIssue(issueKey)),
  );
}
