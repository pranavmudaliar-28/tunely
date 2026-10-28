// BullMQ queue and job names shared by the API (producer) and the worker (consumer).
export const QUEUE = {
  catalog: 'catalog',
  health: 'health',
  reports: 'playback-reports',
} as const;

export const JOB = {
  catalogSync: 'catalog-sync',
} as const;
