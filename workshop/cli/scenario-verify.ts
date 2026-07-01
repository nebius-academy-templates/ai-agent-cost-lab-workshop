/** scenario:verify — run the quality gate and exit non-zero on failure. */
import { parseArgs } from './_lib';
import { resolveScenario } from './scenarios';
import { runQualityGate } from './gate';

const args = parseArgs(process.argv.slice(2));
const scenario = resolveScenario(typeof args.scenario === 'string' ? args.scenario : undefined);
const verbose = args.verbose === true;

process.stdout.write(`scenario:verify ${scenario.name}\n`);
const { gate, outputs } = runQualityGate(scenario);
for (const [label, status] of [['tests (mandatory)', gate.tests], ['typecheck', gate.typecheck], ['lint', gate.lint]] as const) {
  process.stdout.write(`  ${status === 'passed' ? '✓' : '✗'} ${label}\n`);
}
process.stdout.write(`\nquality gate: ${gate.passed ? 'PASS' : 'FAIL'}  ${JSON.stringify(gate)}\n`);

if (!gate.passed && verbose) {
  for (const key of ['tests', 'typecheck', 'lint'] as const) {
    if (gate[key === 'tests' ? 'tests' : key] === 'failed') process.stdout.write(`\n--- ${key} ---\n${outputs[key]}\n`);
  }
}

process.exit(gate.passed ? 0 : 1);
