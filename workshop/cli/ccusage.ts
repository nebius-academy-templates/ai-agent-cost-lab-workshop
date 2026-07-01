/** Shared ccusage helpers: run it and roll its sessions into a cumulative snapshot. */
import { execFileSync } from 'node:child_process';
import { die } from './_lib';

export interface UsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

export const ZERO: UsageSnapshot = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  totalCost: 0,
};

interface CcusageSession {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  totalCost?: number;
}

/** Run `ccusage session --json` and sum across all sessions into one snapshot. */
export function captureSnapshot(): UsageSnapshot {
  let raw: string;
  try {
    raw = execFileSync('npx', ['--yes', 'ccusage@latest', 'session', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    return die(`ccusage failed to run — is Claude Code installed and have you used it yet? ${(err as Error).message}`);
  }
  let parsed: { session?: CcusageSession[] };
  try {
    parsed = JSON.parse(raw) as { session?: CcusageSession[] };
  } catch {
    return die('could not parse ccusage --json output');
  }
  return (parsed.session ?? []).reduce<UsageSnapshot>(
    (acc, s) => ({
      inputTokens: acc.inputTokens + (s.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (s.outputTokens ?? 0),
      cacheCreationTokens: acc.cacheCreationTokens + (s.cacheCreationTokens ?? 0),
      cacheReadTokens: acc.cacheReadTokens + (s.cacheReadTokens ?? 0),
      totalTokens: acc.totalTokens + (s.totalTokens ?? 0),
      totalCost: acc.totalCost + (s.totalCost ?? 0),
    }),
    { ...ZERO },
  );
}
