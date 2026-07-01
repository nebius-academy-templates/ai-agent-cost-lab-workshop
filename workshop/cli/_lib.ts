/** Shared CLI helpers: arg parsing + repo-root resolution. Standalone (no deps). */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Parse `--key value` and `--flag` from argv (everything after the script name). */
export function parseArgs(argv: readonly string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined || !token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function die(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}
