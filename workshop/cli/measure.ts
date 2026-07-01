/**
 * tokens:measure — snapshot cumulative Claude Code usage (via ccusage) under a label.
 *
 * Take one BEFORE a run and one AFTER; `tokens:compare` diffs them to show exactly
 * what that run consumed (tokens by type + cost). Snapshots are cumulative totals,
 * so the diff is robust regardless of how ccusage groups sessions.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs, die, REPO_ROOT } from './_lib';
import { captureSnapshot } from './ccusage';

const args = parseArgs(process.argv.slice(2));
const label = typeof args.label === 'string' ? args.label : die('provide --label <name> (e.g. before / after)');

const snapshot = captureSnapshot();
const record = { label, capturedAt: new Date().toISOString(), ...snapshot };

const dir = resolve(REPO_ROOT, '.workshop');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, `measure-${label}.json`), JSON.stringify(record, null, 2) + '\n');

process.stdout.write(
  `measured "${label}": ${snapshot.totalTokens.toLocaleString('en-US')} tokens, $${snapshot.totalCost.toFixed(4)} (cumulative)\n` +
    `next: run the agent, then \`npm run tokens:measure -- --label after\` and \`npm run tokens:compare -- --before ${label} --after after\`\n`,
);
