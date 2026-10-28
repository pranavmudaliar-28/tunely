// BullMQ queue and job names shared by the API (producer) and the worker (consumer).
export const QUEUE = {
  catalog: 'catalog',
  health: 'health',
  reports: 'playback-reports',
} as const;

export const JOB = {
  catalogSync: 'catalog-sync',
  healthBatch: 'health-batch',
  healthScore: 'health-score',
  flushReports: 'flush-reports',
} as const;

// Redis list the API appends playback reports to; the worker drains it into Postgres in batches.
export const REPORTS_BUFFER = 'playback-reports:buffer';

// The worker refreshes this key every minute; /v1/health/details reports how long ago it last did.
export const WORKER_HEARTBEAT_KEY = 'tunely:worker:heartbeat';
export const WORKER_HEARTBEAT_EVERY_S = 60;

/** Hash of job name → JSON {at, ms, ok, result | error}: the last run of each worker job, for /v1/health/details. */
export const WORKER_JOBS_KEY = 'tunely:worker:jobs';
