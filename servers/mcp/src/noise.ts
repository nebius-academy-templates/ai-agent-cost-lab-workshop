/**
 * Deterministic "real-world" response volume for the MCP mocks: comment threads, change history,
 * stack frames, breadcrumbs, run history. Real Jira/Confluence/Sentry/TestRail/GitHub APIs return this
 * kind of payload by default; the agent never needs it to fix the bug. Seeded by key, so every run
 * gets byte-identical responses and token measurements stay comparable.
 */

/** mulberry32 seeded by a string hash — same seed, same sequence. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = (h << 13) | (h >>> 19);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}

export const PEOPLE = [
  'Ana Torres', 'Luis Mendoza', 'QA Bot', 'Sofia Ramirez', 'Diego Herrera', 'Tech Lead',
  'Valeria Cruz', 'Mateo Flores', 'Release Manager', 'Camila Ortiz', 'Product Owner', 'Javier Rios',
] as const;

const PHRASES = [
  'Discussed in sprint grooming; estimate stays as is until the design review closes.',
  'Re-ran the regression pack on the staging build; unrelated failures in the finance widget were triaged separately.',
  'Product confirmed the priority for this release train, no scope change for now.',
  'Linked the analytics dashboard snapshot from last week for context on traffic patterns.',
  'Reminder: the release freeze starts Thursday, please keep PRs small and reviewed by two people.',
  'Customer support reported a similar symptom on a legacy kiosk build, tracked in the support queue.',
  'Moved to the current sprint after the capacity check with the web chapter.',
  'Infra note: the staging cluster was rotated overnight, cached assets may be stale for an hour.',
  'Security review is not required for this change according to the checklist v3.1.',
  'Pinged the design team about the empty-state illustrations; they will share the final assets later.',
  'Load test from the performance guild shows p95 within budget on the reference device profile.',
  'Updated the acceptance notes in the linked suite, no functional change in the expectations.',
  'Daily sync: no blockers reported by the web squad, the API squad is on call this week.',
  'Accessibility audit backlog item is separate; keep this ticket focused on the reported behavior.',
  'Localization strings for es-MX are already merged, no copy changes expected from this ticket.',
  'Observed the same pattern in the burrito-truck POS tablets, logs attached to the support case.',
  'Retro action item: add a short screen recording to future bug reports of this type.',
  'Dependency bot opened three PRs this week; none of them touch the affected module.',
] as const;

/** A paragraph of `n` sentences from the phrase bank. */
export function paragraph(next: () => number, n: number): string {
  return Array.from({ length: n }, () => pick(next, PHRASES)).join(' ');
}

/** ISO timestamp `i` hours after a fixed base, so ordering is stable. */
export function isoAt(i: number): string {
  return new Date(Date.UTC(2026, 4, 2, 9, 0, 0) + i * 3_600_000).toISOString();
}

export function person(next: () => number) {
  const displayName = pick(next, PEOPLE);
  const handle = displayName.toLowerCase().replace(/[^a-z]+/g, '.');
  return {
    displayName,
    accountId: `acc-${handle}`,
    emailAddress: `${handle}@platacard.local`,
    active: true,
    timeZone: 'America/Mexico_City',
    avatarUrls: {
      '48x48': `https://avatars.platacard.local/${handle}/48.png`,
      '24x24': `https://avatars.platacard.local/${handle}/24.png`,
      '16x16': `https://avatars.platacard.local/${handle}/16.png`,
      '32x32': `https://avatars.platacard.local/${handle}/32.png`,
    },
  };
}
