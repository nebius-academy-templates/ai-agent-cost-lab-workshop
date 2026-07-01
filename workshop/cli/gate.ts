/** The deterministic quality gate (spec §3), shared by scenario:verify. */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './_lib';
import type { ScenarioDef } from './scenarios';

export type CheckStatus = 'passed' | 'failed';

export interface QualityGate {
  passed: boolean;
  tests: CheckStatus;
  typecheck: CheckStatus;
  lint: CheckStatus;
}

export interface GateRun {
  gate: QualityGate;
  outputs: Record<string, string>;
}

function run(cmd: string, cmdArgs: string[]): { status: CheckStatus; output: string } {
  const r = spawnSync(cmd, cmdArgs, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status === 0 ? 'passed' : 'failed', output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Run mandatory tests + typecheck + lint; write traces/<scenario>.gate.json. */
export function runQualityGate(scenario: ScenarioDef): GateRun {
  const tests = run('npx', ['jest', '--config', scenario.referenceJestConfig]);
  const typecheck = run('npx', ['tsc', '-p', scenario.tsconfig, '--noEmit']);
  const lint = run('npx', ['eslint', scenario.lintTarget]);
  const gate: QualityGate = {
    passed: tests.status === 'passed' && typecheck.status === 'passed' && lint.status === 'passed',
    tests: tests.status,
    typecheck: typecheck.status,
    lint: lint.status,
  };
  mkdirSync(resolve(REPO_ROOT, '.workshop'), { recursive: true });
  writeFileSync(resolve(REPO_ROOT, '.workshop', `${scenario.name}.gate.json`), JSON.stringify(gate, null, 2) + '\n');
  return { gate, outputs: { tests: tests.output, typecheck: typecheck.output, lint: lint.output } };
}
