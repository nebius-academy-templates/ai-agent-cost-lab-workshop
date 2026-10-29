/**
 * GitHub MCP mock — commit status + commit creation for the catalog pagination vector.
 * The combined status is success only when the real gate passes (readGate) AND the TestRail
 * acceptance mirrors green — i.e. github verifies the vector, not every bug.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonContent, FILLER, metadataBloat } from '../bloat.js';
import { readGate } from '../gate.js';
import { rng, paragraph, isoAt, pick } from '../noise.js';

// ── Real-API volume the agent never needs (see noise.ts) ────────────────────────────────────────
function noiseStatusHistory(ref: string) {
  const next = rng(`status-history-${ref}`);
  return Array.from({ length: 26 }, (_, i) => ({
    context: pick(next, ['ci/local-tests', 'ci/typecheck', 'ci/lint', 'testrail/acceptance', 'ci/build', 'security/sast']),
    state: pick(next, ['success', 'success', 'failure', 'pending']), description: `superseded run #${400 + i}`,
    created_at: isoAt(i * 6), target_url: `https://ci.platacard.local/runs/${400 + i}`,
  }));
}

function noiseCheckRuns(ref: string) {
  const next = rng(`check-runs-${ref}`);
  return Array.from({ length: 10 }, (_, i) => ({
    id: 880000 + i, name: pick(next, ['build', 'unit', 'e2e-smoke', 'bundle-size', 'sast', 'license-scan']), status: 'completed',
    conclusion: pick(next, ['success', 'neutral', 'skipped']), started_at: isoAt(i * 2), completed_at: isoAt(i * 2 + 1),
    output: { title: `Run ${i + 1}`, summary: paragraph(next, 2), text: Array.from({ length: 12 }, (_, j) => `[${isoAt(i * 2).slice(11, 19)}] step ${j + 1}: ${paragraph(next, 1)}`).join('\n') },
  }));
}

function commitStatus(ref: string) {
  const gate = readGate();
  const known = gate != null;
  const ok = gate?.passed === true;
  const mapState = (good: boolean) => (!known ? 'pending' : good ? 'success' : 'failure');

  const statuses = [
    { context: 'ci/local-tests', state: mapState(gate?.tests === 'passed'), description: known ? `tests: ${gate?.tests}` : 'awaiting run', target_url: 'https://ci.platacard.local/tests' },
    { context: 'ci/typecheck', state: mapState(gate?.typecheck === 'passed'), description: known ? `typecheck: ${gate?.typecheck}` : 'awaiting run', target_url: 'https://ci.platacard.local/typecheck' },
    { context: 'ci/lint', state: mapState(gate?.lint === 'passed'), description: known ? `lint: ${gate?.lint}` : 'awaiting run', target_url: 'https://ci.platacard.local/lint' },
    { context: 'testrail/acceptance', state: mapState(ok), description: 'Catalog / Pagination acceptance', target_url: 'https://testrail.platacard.local/runs/catalog-pagination' },
  ];

  return {
    ref,
    sha: ref,
    state: !known ? 'pending' : ok ? 'success' : 'failure',
    total_count: statuses.length,
    statuses,
    repository: { full_name: 'platacard/plata-burrito-web', default_branch: 'main', private: true, metadata: metadataBloat('repo') },
    commit_url: `https://api.github.com/repos/platacard/plata-burrito-web/commits/${ref}`,
    status_history: noiseStatusHistory(ref),
    check_runs: noiseCheckRuns(ref),
    _note: 'Mergeable only when state === "success" (local tests + TestRail acceptance both green).',
  };
}

function createCommit(message: string) {
  const gate = readGate();
  const ok = gate?.passed === true;
  return {
    sha: 'c0ffee1234567890abcdef1234567890abcdef12',
    node_id: 'C_kwDOABC123',
    message,
    accepted: true,
    checks_required: ['ci/local-tests', 'ci/typecheck', 'ci/lint', 'testrail/acceptance'],
    mergeable: ok,
    merge_blocked_reason: ok ? null : 'required status checks have not passed (run the quality gate; fix the catalog-pagination vector)',
    author: { name: 'Workshop Participant', email: 'participant@platacard.local', date: '2026-06-25T00:00:00Z' },
    committer: { name: 'Plata CI', email: 'ci@platacard.local', date: '2026-06-25T00:00:00Z' },
    html_url: 'https://github.com/platacard/plata-burrito-web/commit/c0ffee12',
    metadata: metadataBloat('commit'),
  };
}

export function registerGithub(server: McpServer): void {
  server.registerTool(
    'github_get_commit_status',
    {
      title: 'Get the Combined Commit Status for a Ref with All Individual Check Contexts, States, Target URLs, and Repository Metadata',
      description: `Returns the combined status for a git ref (branch/sha), aggregating every status context (CI, typecheck, lint, acceptance) into an overall state. The ref is mergeable only when the combined state is success. ${FILLER}`,
      inputSchema: { ref: z.string().describe('Branch name or commit sha, e.g. workshop-charter.') },
    },
    async ({ ref }) => jsonContent(commitStatus(ref)),
  );

  server.registerTool(
    'github_create_commit',
    {
      title: 'Create a Commit on the Repository with Author/Committer Metadata, Required Status Checks, and Mergeability Evaluation',
      description: `Records a commit and evaluates mergeability against the required status checks. Returns the commit object plus whether it can be merged (it cannot until local tests and TestRail acceptance pass). ${FILLER}`,
      inputSchema: { message: z.string().describe('Commit message.') },
    },
    async ({ message }) => jsonContent(createCommit(message)),
  );
}
