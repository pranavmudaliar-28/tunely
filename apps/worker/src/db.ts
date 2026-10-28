import { createDb } from '@tunely/db';

export function dbFromEnv() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return createDb(url);
}
