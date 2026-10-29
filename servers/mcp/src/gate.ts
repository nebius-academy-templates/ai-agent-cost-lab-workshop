/**
 * Reads the real quality-gate result for the workshop scenario so testrail/github narrative mirrors
 * it instead of re-implementing grading. `scenario:verify` writes `.workshop/<scenario>.gate.json`,
 * which is mounted into the containers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface GateResult {
  passed: boolean;
  tests: string;
  typecheck: string;
  lint: string;
}

export const SCENARIO = 'catalog-pagination';

export function readGate(): GateResult | null {
  const path = process.env.GATE_FILE ?? resolve(process.cwd(), `.workshop/${SCENARIO}.gate.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GateResult;
  } catch {
    return null;
  }
}
