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
