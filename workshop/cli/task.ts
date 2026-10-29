/**
 * task — hand out the workshop task. Copies the scenario's TASK.md into apps/angular-demo/TASK.md.
 * An optional arg re-picks the agent (persisted), e.g. `npm run task -- codex`.
 *
 *   npm run task            # catalog pagination (JIRA-0321)
 *   npm run task -- codex   # also switch the active agent
 */
import { resolve } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';
import { REPO_ROOT, die } from './_lib';
import { parseAgentArg, setAgent } from './agent';
import { DEFAULT_SCENARIO } from './scenarios';

// Optional agent override — persists the choice for proxy:* / hooks:* / workshop:run*.
const agentArg = parseAgentArg(process.argv[2]);
if (agentArg) setAgent(agentArg);

const taskSrc = resolve(REPO_ROOT, 'workshop/scenarios', DEFAULT_SCENARIO, 'TASK.md');
if (!existsSync(taskSrc)) die(`missing workshop/scenarios/${DEFAULT_SCENARIO}/TASK.md`);

// Copy TASK.md into the Angular app directory — the participant's agent starts there.
copyFileSync(taskSrc, resolve(REPO_ROOT, 'apps', 'angular-demo', 'TASK.md'));

process.stdout.write(`task ready → apps/angular-demo/TASK.md (scenario: ${DEFAULT_SCENARIO})\n`);
