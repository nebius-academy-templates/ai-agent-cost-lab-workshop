/** scenario:reset — restore the pristine buggy baseline into the working copy. */
import { parseArgs } from './_lib';
import { resolveScenario, resetScenario } from './scenarios';

const args = parseArgs(process.argv.slice(2));
const scenario = resolveScenario(typeof args.scenario === 'string' ? args.scenario : undefined);
resetScenario(scenario);
process.stdout.write(`reset ${scenario.name}: baseline → ${scenario.workingDir}\n`);
