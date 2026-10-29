/**
 * TestRail MCP mock — acceptance cases + run results for the catalog bug. Results MIRROR the
 * real quality gate (readGate) rather than re-implementing grading.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';
import { readGate, SCENARIO } from '../gate.js';
import { rng, paragraph, person, isoAt, pick } from '../noise.js';

interface Case {
  id: string;
  title: string;
  refs: string;
  priority: string;
}

const CASES: Case[] = [
  { id: 'C1001', title: 'Deep-link restores page+sort+category+q from the URL', refs: 'JIRA-0321', priority: 'High' },
  { id: 'C1002', title: 'Changing a filter/sort resets to page 1 and updates the URL', refs: 'JIRA-0321', priority: 'High' },
  { id: 'C1003', title: 'A stale (slower) response never overwrites a newer one', refs: 'JIRA-0321', priority: 'High' },
  { id: 'C1004', title: 'Repeated queries are served from cache (no refetch)', refs: 'JIRA-0321', priority: 'Medium' },
  { id: 'C1005', title: 'Stale-while-revalidate: previous results stay visible (no loading flash)', refs: 'JIRA-0321', priority: 'Medium' },
  { id: 'C1006', title: 'Empty results are classified (no-products / no-match / out-of-range)', refs: 'JIRA-0321', priority: 'Medium' },
];

// ── Real-suite volume the agent never needs (see noise.ts) ──────────────────────────────────────
function noiseSteps(caseId: string) {
  const next = rng(`steps-${caseId}`);
  return Array.from({ length: 4 }, (_, i) => ({
    content: `Step ${i + 2}: open /catalog with a saved view, apply a filter, switch pages, then reload. ${paragraph(next, 1)}`,
    expected: `The grid shows the expected state for step ${i + 2}. ${paragraph(next, 1)}`,
    additional_info: paragraph(next, 1),
  }));
}

function noiseCaseFields(caseId: string) {
  const next = rng(`case-fields-${caseId}`);
  return Object.fromEntries(['custom_automation_owner', 'custom_component', 'custom_browser_matrix', 'custom_data_set', 'custom_env', 'custom_risk',
    'custom_regression_set', 'custom_estimate', 'custom_milestone', 'custom_release', 'custom_tags', 'custom_notes', 'custom_device', 'custom_locale', 'custom_review_status']
    .map((k) => [k, k === 'custom_notes' ? paragraph(next, 2) : pick(next, ['web', 'chrome+safari', 'mx', 'release-26.6', 'reviewed', 'smoke', 'desktop'])]));
}

function noiseCaseHistory(caseId: string) {
  const next = rng(`case-history-${caseId}`);
  return Array.from({ length: 4 }, (_, i) => ({ id: i + 1, user: person(next).displayName, created_on: isoAt(i * 40), changes: [{ field: pick(next, ['title', 'steps', 'priority', 'refs']), old_value: paragraph(next, 1), new_value: paragraph(next, 1) }] }));
}

function noiseResultHistory(caseId: string) {
  const next = rng(`result-history-${caseId}`);
  return Array.from({ length: 8 }, (_, i) => ({
    run: `R-${1200 + i}`, version: `web@2026.0${5 + (i % 2)}.${i}`, status: pick(next, ['passed', 'passed', 'failed', 'retest']),
    tested_by: person(next).displayName, tested_on: isoAt(i * 24), elapsed: `${1 + (i % 9)}s`, comment: paragraph(next, 2), defects: i % 5 === 0 ? `JIRA-${200 + i}` : null,
  }));
}

function getCases(suiteId: string) {
  const cases = CASES;
  return {
    suiteId,
    scenario: SCENARIO,
    offset: 0,
    limit: 250,
    size: cases.length,
    _links: { next: null, prev: null },
    cases: cases.map((c) => ({
      ...c,
      section_id: 42,
      type_id: 7,
      template_id: 1,
      is_deleted: 0,
      custom_automation_type: 1,
      custom_preconds: `Plata Burrito CRM running against the REST mock. ${paragraph(rng(`pre-${c.id}`), 3)}`,
      custom_steps_separated: [{ content: 'Exercise the feature per the ticket.', expected: 'Behaves per the Definition of Done.' }, ...noiseSteps(c.id)],
      ...noiseCaseFields(c.id),
      history: noiseCaseHistory(c.id),
      metadata: metadataBloat(c.id),
    })),
  };
}

function getResults(runId: string) {
  const cases = CASES;
  const gate = readGate();
  const known = gate != null;
  const passed = gate?.passed === true;
  // When the gate fails, the two headline acceptance cases for the vector are the ones failing.
  const headline = new Set(cases.slice(0, 2).map((c) => c.id));
  const statusFor = (caseId: string): { status_id: number; status: string } => {
    if (!known) return { status_id: 3, status: 'untested' };
    if (passed) return { status_id: 1, status: 'passed' };
    return headline.has(caseId) ? { status_id: 5, status: 'failed' } : { status_id: 1, status: 'passed' };
  };
  return {
    runId,
    scenario: SCENARIO,
    name: `${SCENARIO} — acceptance run`,
    source: 'automated acceptance suite for the scenario',
    summary: { passed: known && passed ? cases.length : 0, failed: known && !passed ? headline.size : 0, untested: known ? 0 : cases.length },
    results: cases.map((c) => ({
      test_id: c.id,
      case_id: c.id,
      title: c.title,
      ...statusFor(c.id),
      comment: known ? 'Reflected from the latest acceptance run.' : 'Not yet run for the current code.',
      elapsed: '1s',
      history: noiseResultHistory(c.id),
      metadata: metadataBloat(c.id),
    })),
  };
}

export function registerTestrail(server: McpServer): void {
  server.registerTool(
    'testrail_get_cases',
    {
      title: 'List TestRail Cases for a Suite with Full Step Definitions, Preconditions, Custom Fields, Automation Metadata, and References',
      description: `Returns all test cases in a suite with separated steps, expected results, preconditions, priority, references, automation type, and custom fields. ${FILLER}`,
      inputSchema: { suiteId: z.string().describe('Suite id, e.g. S-CATALOG-PAGINATION.') },
    },
    async ({ suiteId }) => jsonContent(getCases(suiteId)),
  );

  server.registerTool(
    'testrail_get_results',
    {
      title: 'Retrieve TestRail Run Results with Per-Case Status, Comments, Elapsed Time, Defects, and Full Run Configuration Metadata',
      description: `Returns the per-case results for a run, including status, comments, elapsed time, and linked defects. For this workshop the results mirror the repository quality gate for the scenario. ${FILLER}`,
      inputSchema: { runId: z.string().describe('Run id, e.g. R-LATEST.') },
    },
    async ({ runId }) => jsonContent(getResults(runId)),
  );
}
