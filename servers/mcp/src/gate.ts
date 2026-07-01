/**
 * Reads the real quality-gate result for the ACTIVE scenario so testrail/github narrative mirrors
 * it instead of re-implementing grading. `scenario:verify` writes `.workshop/<scenario>.gate.json`
 * and `npm run variant` writes `.workshop/active-scenario`; both are mounted into the containers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface GateResult {
  passed: boolean;
  tests: string;
  typecheck: string;
  lint: string;
}

export function activeScenario(): string {
  const pointer = resolve(process.cwd(), '.workshop/active-scenario');
  if (existsSync(pointer)) {
    const name = readFileSync(pointer, 'utf8').trim();
    if (name) return name;
  }
  return 'catalog-pagination';
}

export function readGate(): GateResult | null {
  const path = process.env.GATE_FILE ?? resolve(process.cwd(), `.workshop/${activeScenario()}.gate.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GateResult;
  } catch {
    return null;
  }
}
