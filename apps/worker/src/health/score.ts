export interface ScoreInput {
  /** Most recent first; only the first 12 are used. */
  checks: { ok: boolean; latencyMs: number | null }[];
  reportsOk: number;
  reportsError: number;
}

const DECAY = 0.8;
const MIN_REPORTS = 5;
/** A stream whose latest check failed stays under the public threshold (50) until it recovers. */
export const FAILED_CAP = 40;

/** 0–100. 80 points for recent check success (newer checks weigh more), 20 for a fast manifest,
 *  then blended 60/40 with real player reports once there are enough of them. */
export function computeScore({ checks, reportsOk, reportsError }: ScoreInput): number {
  const recent = checks.slice(0, 12);
  if (!recent.length) return 0;

  let weighted = 0;
  let total = 0;
  recent.forEach((c, i) => {
    const w = DECAY ** i;
    total += w;
    if (c.ok) weighted += w;
  });
  const latest = recent[0]!;
  const latency = latest.latencyMs ?? Infinity;
  const speed = !latest.ok ? 0 : latency < 1500 ? 1 : latency < 4000 ? 0.6 : 0.3;
  let score = 80 * (weighted / total) + 20 * speed;

  const reports = reportsOk + reportsError;
  if (reports >= MIN_REPORTS) score = 0.6 * score + 0.4 * 100 * (reportsOk / reports);
  if (!latest.ok) score = Math.min(score, FAILED_CAP);
  return Math.max(0, Math.min(100, Math.round(score)));
}
