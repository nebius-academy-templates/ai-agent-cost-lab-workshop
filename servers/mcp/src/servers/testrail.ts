/**
 * TestRail MCP mock — acceptance cases + run results for the ACTIVE vector. Results MIRROR the
 * real quality gate (readGate) rather than re-implementing grading.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';
import { readGate, activeScenario } from '../gate.js';

interface Case {
  id: string;
  title: string;
  refs: string;
  priority: string;
}

const CASES_BY_SCENARIO: Record<string, Case[]> = {
  'catalog-pagination': [
    { id: 'C1001', title: 'Deep-link restores page+sort+category+q from the URL', refs: 'JIRA-0321', priority: 'High' },
    { id: 'C1002', title: 'Changing a filter/sort resets to page 1 and updates the URL', refs: 'JIRA-0321', priority: 'High' },
    { id: 'C1003', title: 'A stale (slower) response never overwrites a newer one', refs: 'JIRA-0321', priority: 'High' },
    { id: 'C1004', title: 'Repeated queries are served from cache (no refetch)', refs: 'JIRA-0321', priority: 'Medium' },
    { id: 'C1005', title: 'Stale-while-revalidate: previous results stay visible (no loading flash)', refs: 'JIRA-0321', priority: 'Medium' },
    { id: 'C1006', title: 'Empty results are classified (no-products / no-match / out-of-range)', refs: 'JIRA-0321', priority: 'Medium' },
  ],
  'orders-search': [
    { id: 'C2001', title: 'Deep-link restores page+sort+status+q+location from the URL', refs: 'JIRA-0410', priority: 'High' },
    { id: 'C2002', title: 'Changing a filter/sort resets to page 1 and updates the URL', refs: 'JIRA-0410', priority: 'High' },
    { id: 'C2003', title: 'Rapid input is debounced into one request for the final query', refs: 'JIRA-0410', priority: 'High' },
    { id: 'C2004', title: 'A stale (slower) response never overwrites a newer one', refs: 'JIRA-0410', priority: 'High' },
    { id: 'C2005', title: 'Repeated queries are served from cache (no refetch)', refs: 'JIRA-0410', priority: 'Medium' },
    { id: 'C2006', title: 'Stale-while-revalidate: previous results stay visible (no loading flash)', refs: 'JIRA-0410', priority: 'Medium' },
    { id: 'C2007', title: 'Empty results are classified (no-orders / no-match / out-of-range)', refs: 'JIRA-0410', priority: 'Medium' },
  ],
  'editcard-validation': [
    { id: 'C3001', title: 'Invalid input blocks save and shows per-field errors (name, price, desc, spicy)', refs: 'JIRA-0455', priority: 'High' },
    { id: 'C3002', title: 'Backend 400 issues are surfaced next to the offending fields', refs: 'JIRA-0455', priority: 'High' },
    { id: 'C3003', title: 'Description is escaped on render (no HTML injection / XSS)', refs: 'JIRA-0455', priority: 'High' },
    { id: 'C3004', title: 'Dirty state is detected — unsaved changes are guarded on navigation', refs: 'JIRA-0455', priority: 'High' },
    { id: 'C3005', title: 'saving / saved / error states are surfaced', refs: 'JIRA-0455', priority: 'Medium' },
  ],
};

function casesFor(): Case[] {
  return CASES_BY_SCENARIO[activeScenario()] ?? CASES_BY_SCENARIO['catalog-pagination'];
}

function getCases(suiteId: string) {
  const cases = casesFor();
  return {
    suiteId,
    scenario: activeScenario(),
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
      custom_preconds: 'Plata Burrito CRM running against the REST mock.',
      custom_steps_separated: [{ content: 'Exercise the feature per the ticket.', expected: 'Behaves per the Definition of Done.' }],
      metadata: metadataBloat(c.id),
    })),
  };
}

function getResults(runId: string) {
  const cases = casesFor();
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
    scenario: activeScenario(),
    name: `${activeScenario()} — acceptance run`,
    source: 'automated acceptance suite for the active scenario',
    summary: { passed: known && passed ? cases.length : 0, failed: known && !passed ? headline.size : 0, untested: known ? 0 : cases.length },
    results: cases.map((c) => ({
      test_id: c.id,
      case_id: c.id,
      title: c.title,
      ...statusFor(c.id),
      comment: known ? 'Reflected from the latest acceptance run.' : 'Not yet run for the current code.',
      elapsed: '1s',
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
      inputSchema: { suiteId: z.string().describe('Suite id, e.g. S-CATALOG-PAGINATION / S-ORDERS-SEARCH / S-EDIT-VALIDATION.') },
    },
    async ({ suiteId }) => jsonContent(getCases(suiteId)),
  );

  server.registerTool(
    'testrail_get_results',
    {
      title: 'Retrieve TestRail Run Results with Per-Case Status, Comments, Elapsed Time, Defects, and Full Run Configuration Metadata',
      description: `Returns the per-case results for a run, including status, comments, elapsed time, and linked defects. For this workshop the results mirror the repository quality gate for the active scenario. ${FILLER}`,
      inputSchema: { runId: z.string().describe('Run id, e.g. R-LATEST.') },
    },
    async ({ runId }) => jsonContent(getResults(runId)),
  );
}
