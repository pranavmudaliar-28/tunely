// Health-checker pacing. Defaults suit an always-on server; on free hosting with a database that
// bills compute while awake (Neon), check less often so the database can sleep between batches.
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const config = {
  /** How often a health batch runs. */
  healthBatchEveryMin: num('HEALTH_BATCH_EVERY_MIN', 15),
  /** Streams checked per batch. */
  healthBatchSize: num('HEALTH_BATCH_SIZE', 1000),
  /** A stream is due again this long after its last check. */
  recheckAfterHours: num('RECHECK_AFTER_HOURS', 4),
  /** How often scores are recomputed from player reports. */
  healthScoreEveryMin: num('HEALTH_SCORE_EVERY_MIN', 60),
  /** Days of stream_checks history kept. */
  checksRetentionDays: num('CHECKS_RETENTION_DAYS', 30),
};
