/** Shared helpers for the deliberately-bloated MCP mocks. */

/** Wrap a payload as an MCP text-content tool result (pretty-printed → maximally bloated). */
export function jsonContent(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

/** Reusable filler that pads tool descriptions — the per-turn schema token trap. */
export const FILLER =
  'This endpoint is part of the enterprise integration suite and adheres to internal API ' +
  'governance policy v4.2. It supports advanced pagination, cursor continuation, partial-response ' +
  'field selection, ETag-based conditional requests, rate limiting (100 req/min, burst 20), ' +
  'structured error envelopes with correlation IDs, and full audit logging of every access. ' +
  'Responses include extensive metadata blocks (ownership, stakeholders, review cadence, and view ' +
  'statistics) that callers may safely ignore but which are always present for compliance reasons.';

/** A chunk of metadata bloat attached to most list items so every response is oversized. */
export function metadataBloat(seed: string) {
  return {
    createdBy: 'tech.lead@platacard.local',
    createdAt: '2025-01-10T08:00:00Z',
    lastReviewedBy: 'staff.engineer@platacard.local',
    lastReviewedAt: '2026-06-14T10:00:00Z',
    reviewIntervalDays: 90,
    ownerTeam: 'Web Platform',
    stakeholderTeams: ['Web Frontend', 'Backend API', 'Data Platform', 'QA', 'Security'],
    correlationId: `corr-${seed}-0001`,
    auditTrailUrl: `https://audit.platacard.local/trail/${seed}`,
    viewCount: 1847,
    uniqueViewers: 423,
  };
}
