/** Scenario registry: where each scenario's baseline, working copy, and gate live. */
import { resolve } from 'node:path';
import { rmSync, mkdirSync, cpSync, existsSync, readFileSync } from 'node:fs';
import { REPO_ROOT } from './_lib';

export interface ScenarioDef {
  readonly name: string;
  /** Pristine buggy source (copied into the working copy by scenario:reset). */
  readonly baselineDir: string;
  /** Agent-editable working copy under the Angular app. */
  readonly workingDir: string;
  /** Task definition (acceptance criteria + search terms). */
  readonly taskFile: string;
  /** App typecheck project. */
  readonly tsconfig: string;
  /** Facilitator-owned mandatory test config (the quality gate). */
  readonly referenceJestConfig: string;
  /** Lint target (relative to repo root). */
  readonly lintTarget: string;
}

export const SCENARIOS: Record<string, ScenarioDef> = {
  'catalog-pagination': {
    name: 'catalog-pagination',
    baselineDir: resolve(REPO_ROOT, 'workshop/scenarios/catalog-pagination/baseline'),
    workingDir: resolve(REPO_ROOT, 'apps/angular-demo/src/app/catalog'),
    taskFile: resolve(REPO_ROOT, 'workshop/scenarios/catalog-pagination/task.json'),
    tsconfig: resolve(REPO_ROOT, 'apps/angular-demo/tsconfig.app.json'),
    referenceJestConfig: resolve(REPO_ROOT, 'workshop/checkpoints/catalog-pagination/jest.reference.config.cjs'),
    lintTarget: 'apps/angular-demo/src',
  },
  'orders-search': {
    name: 'orders-search',
    baselineDir: resolve(REPO_ROOT, 'workshop/scenarios/orders-search/baseline'),
    workingDir: resolve(REPO_ROOT, 'apps/angular-demo/src/app/orders'),
    taskFile: resolve(REPO_ROOT, 'workshop/scenarios/orders-search/task.json'),
    tsconfig: resolve(REPO_ROOT, 'apps/angular-demo/tsconfig.app.json'),
    referenceJestConfig: resolve(REPO_ROOT, 'workshop/checkpoints/orders-search/jest.reference.config.cjs'),
    lintTarget: 'apps/angular-demo/src',
  },
  'editcard-validation': {
    name: 'editcard-validation',
    baselineDir: resolve(REPO_ROOT, 'workshop/scenarios/editcard-validation/baseline'),
    workingDir: resolve(REPO_ROOT, 'apps/angular-demo/src/app/edit-card'),
    taskFile: resolve(REPO_ROOT, 'workshop/scenarios/editcard-validation/task.json'),
    tsconfig: resolve(REPO_ROOT, 'apps/angular-demo/tsconfig.app.json'),
    referenceJestConfig: resolve(REPO_ROOT, 'workshop/checkpoints/editcard-validation/jest.reference.config.cjs'),
    lintTarget: 'apps/angular-demo/src',
  },
};

export const DEFAULT_SCENARIO = 'catalog-pagination';

/** The variant the participant selected with `npm run variant`, or the default. */
function activeScenario(): string {
  const pointer = resolve(REPO_ROOT, '.workshop/active-scenario');
  if (existsSync(pointer)) {
    const name = readFileSync(pointer, 'utf8').trim();
    if (name) return name;
  }
  return DEFAULT_SCENARIO;
}

export function resolveScenario(name: string | undefined): ScenarioDef {
  const key = name ?? activeScenario();
  const scenario = SCENARIOS[key];
  if (!scenario) {
    const known = Object.keys(SCENARIOS).join(', ');
    throw new Error(`unknown scenario "${key}" (known: ${known})`);
  }
  return scenario;
}

/** Restore the pristine buggy baseline into the working copy. */
export function resetScenario(scenario: ScenarioDef): void {
  if (!existsSync(scenario.baselineDir)) throw new Error(`baseline not found: ${scenario.baselineDir}`);
  rmSync(scenario.workingDir, { recursive: true, force: true });
  mkdirSync(scenario.workingDir, { recursive: true });
  cpSync(scenario.baselineDir, scenario.workingDir, { recursive: true });
}
