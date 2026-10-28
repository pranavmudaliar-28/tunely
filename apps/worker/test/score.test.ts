import { expect, test } from 'vitest';
import { computeScore, FAILED_CAP } from '../src/health/score';

const ok = (latencyMs = 500) => ({ ok: true, latencyMs });
const fail = { ok: false, latencyMs: null };

test('no checks scores 0; always-fast-and-ok scores 100', () => {
  expect(computeScore({ checks: [], reportsOk: 0, reportsError: 0 })).toBe(0);
  expect(computeScore({ checks: [ok(), ok(), ok()], reportsOk: 0, reportsError: 0 })).toBe(100);
});

test('slow manifests lose the speed points', () => {
  expect(computeScore({ checks: [ok(5000)], reportsOk: 0, reportsError: 0 })).toBe(86);
});

test('a failed latest check keeps the stream under the public threshold', () => {
  const s = computeScore({ checks: [fail, ok(), ok(), ok()], reportsOk: 0, reportsError: 0 });
  expect(s).toBeLessThanOrEqual(FAILED_CAP);
  expect(s).toBeLessThan(50);
});

test('an old failure matters less than a recent one', () => {
  const recentFail = computeScore({ checks: [ok(), fail, ok()], reportsOk: 0, reportsError: 0 });
  const oldFail = computeScore({ checks: [ok(), ok(), fail], reportsOk: 0, reportsError: 0 });
  expect(oldFail).toBeGreaterThan(recentFail);
});

test('player reports pull the score down once there are enough', () => {
  const checks = [ok(), ok()];
  expect(computeScore({ checks, reportsOk: 1, reportsError: 3 })).toBe(100); // too few reports
  expect(computeScore({ checks, reportsOk: 1, reportsError: 9 })).toBe(64);
});

test('viewers confirming playback lift a stream our checker cannot reach', () => {
  const failing = [
    { ok: false, latencyMs: null },
    { ok: false, latencyMs: null },
  ];
  expect(computeScore({ checks: failing, reportsOk: 1, reportsError: 0 })).toBeLessThan(50); // one session isn't enough
  expect(computeScore({ checks: failing, reportsOk: 2, reportsError: 0 })).toBe(60);
  expect(computeScore({ checks: failing, reportsOk: 2, reportsError: 5 })).toBeLessThan(50); // mostly failing for viewers
  expect(computeScore({ checks: [], reportsOk: 3, reportsError: 1 })).toBe(60); // never checked
});
