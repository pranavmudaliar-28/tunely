import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './run-migrations';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

await runMigrations(url, fileURLToPath(new URL('../migrations', import.meta.url)));
console.log('migrations applied');
