/** Unit tests for the usage parsers' pure building blocks.  npm run test:usage */
import { test } from "node:test";
import assert from "node:assert/strict";
import { geminiPrice, generationUsage, readFields, subMessages, sumAgyGenerations } from "./usage-agy.js";

// ── protobuf test encoder (wire format only what the reader handles) ──
const varint = (n: number): number[] => { const out: number[] = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 0x80; out.push(b); } while (n > 0); return out; };
const vField = (field: number, value: number): number[] => [...varint(field * 8), ...varint(value)];
const bField = (field: number, bytes: number[]): number[] => [...varint(field * 8 + 2), ...varint(bytes.length), ...bytes];
const str = (s: string): number[] => [...new TextEncoder().encode(s)];

test("readFields / subMessages: varint and nested length-delimited fields", () => {
  const msg = new Uint8Array([...vField(1, 300), ...bField(2, [...vField(3, 7)])]);
  const fields = readFields(msg);
  assert.deepEqual(fields[0], { field: 1, kind: "varint", value: 300 });
  const nested = subMessages(msg, [2]);
  assert.equal(nested.length, 1);
  assert.deepEqual(readFields(nested[0] ?? new Uint8Array()), [{ field: 3, kind: "varint", value: 7 }]);
});

test("generationUsage: usage at 1→4 {2,3,5,9} and model at 1→19", () => {
  const blob = new Uint8Array(bField(1, [...bField(4, [...vField(2, 2349), ...vField(3, 150), ...vField(5, 16270), ...vField(9, 126)]), ...bField(19, str("gemini-3.8-flash-n"))]));
  assert.deepEqual(generationUsage(blob), { input: 2349, output: 150, cacheRead: 16270, thinking: 126, model: "gemini-3.8-flash-n" });
});

test("geminiPrice: 3.8 Flash promo until end of 2026, unknown model undefined", () => {
  assert.deepEqual(geminiPrice("gemini-3.8-flash-n", new Date("2026-10-07T00:00:00Z")), { in: 0.75, cached: 0.075, out: 3.75 });
  assert.deepEqual(geminiPrice("gemini-3.8-flash-n", new Date("2027-01-02T00:00:00Z")), { in: 1.5, cached: 0.15, out: 7.5 });
  assert.equal(geminiPrice("some-model", new Date()), undefined);
});

test("sumAgyGenerations: sums tokens and prices each generation", () => {
  const snap = sumAgyGenerations([
    { input: 12651, output: 114, cacheRead: 0, thinking: 113, model: "gemini-3.8-flash-n" },
    { input: 2349, output: 150, cacheRead: 16270, thinking: 126, model: "gemini-3.8-flash-n" },
  ], new Date("2026-10-07T00:00:00Z"));
  assert.deepEqual([snap.inputTokens, snap.outputTokens, snap.cacheReadTokens, snap.totalTokens], [15000, 264, 16270, 31534]);
  assert.ok(Math.abs(snap.totalCost - (15000 * 0.75 + 16270 * 0.075 + 264 * 3.75) / 1e6) < 1e-12);
});
