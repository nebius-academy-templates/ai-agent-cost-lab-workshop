/**
 * tokens:compare — diff two usage snapshots (before/after) to show what a run cost.
 * Reports the delta in input / output / cache tokens and dollars.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs, die, REPO_ROOT } from './_lib';
import { ZERO, type UsageSnapshot } from './ccusage';

const args = parseArgs(process.argv.slice(2));
const before = typeof args.before === 'string' ? args.before : die('provide --before <label>');
const after = typeof args.after === 'string' ? args.after : die('provide --after <label>');

function load(label: string): UsageSnapshot {
  const path = resolve(REPO_ROOT, '.workshop', `measure-${label}.json`);
  if (!existsSync(path)) die(`no snapshot "${label}" — run \`npm run tokens:measure -- --label ${label}\` first`);
  return { ...ZERO, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<UsageSnapshot>) };
}

const b = load(before);
const a = load(after);

function num(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function row(label: string, x: number, y: number): string {
  const delta = y - x;
  const pct = x !== 0 ? ` (${delta >= 0 ? '+' : ''}${((delta / x) * 100).toFixed(1)}%)` : '';
  const sign = delta >= 0 ? '+' : '';
  return `| ${label.padEnd(16)} | ${num(x).padStart(12)} | ${num(y).padStart(12)} | ${sign}${num(delta)}${pct} |`;
}

const lines = [
  `Usage consumed between "${before}" and "${after}":`,
  '',
  `| metric           | ${before.padStart(12)} | ${after.padStart(12)} | delta |`,
  '| --- | ---: | ---: | ---: |',
  row('input tokens', b.inputTokens, a.inputTokens),
  row('output tokens', b.outputTokens, a.outputTokens),
  row('cache write', b.cacheCreationTokens, a.cacheCreationTokens),
  row('cache read', b.cacheReadTokens, a.cacheReadTokens),
  row('total tokens', b.totalTokens, a.totalTokens),
  `| ${'cost ($)'.padEnd(16)} | ${b.totalCost.toFixed(4).padStart(12)} | ${a.totalCost.toFixed(4).padStart(12)} | ${(a.totalCost - b.totalCost >= 0 ? '+' : '')}${(a.totalCost - b.totalCost).toFixed(4)} |`,
];
process.stdout.write(lines.join('\n') + '\n');
