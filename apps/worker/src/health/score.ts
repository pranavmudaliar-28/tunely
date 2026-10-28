export interface ScoreInput {
  /** Most recent first; only the first 12 are used. */
  checks: { ok: boolean; latencyMs: number | null }[];
  /** Distinct viewer sessions that played it OK in the last 24 h. */
  reportsOk: number;
  reportsError: number;
}

const DECAY = 0.8;
const MIN_REPORTS = 5;
/** A stream whose latest check failed stays under the public threshold (50) until it recovers… */
export const FAILED_CAP = 40;
/** …unless real viewers prove it plays: this many distinct sessions played it OK in 24 h, with at
 *  least half of all attempts succeeding. Covers streams our server can't reach (geo-limited to the
 *  viewer's country, blocking datacenter IPs) but browsers can. */
export const PLAYER_CONFIRM_SESSIONS = 2;
/** Score given to a stream confirmed only by players. */
export const PLAYER_CONFIRMED_SCORE = 60;

/** Viewers' browsers played it: it needs no CORS/HTTPS proof from our checker. */
export function confirmedByPlayers(reportsOk: number, reportsError: number): boolean {
  return reportsOk >= PLAYER_CONFIRM_SESSIONS && reportsOk / (reportsOk + reportsError) >= 0.5;
}

/** 0–100. 80 points for recent check success (newer checks weigh more), 20 for a fast manifest,
 *  then blended 60/40 with real player reports once there are enough of them. */
export function computeScore({ checks, reportsOk, reportsError }: ScoreInput): number {
  const recent = checks.slice(0, 12);
  const players = confirmedByPlayers(reportsOk, reportsError);
  if (!recent.length) return players ? PLAYER_CONFIRMED_SCORE : 0;

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
  if (!latest.ok) score = players ? Math.max(score, PLAYER_CONFIRMED_SCORE) : Math.min(score, FAILED_CAP);
  return Math.max(0, Math.min(100, Math.round(score)));
}
