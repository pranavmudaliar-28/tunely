// Render's free plan has one always-available web service and no free background workers, so this
// runs migrations, then the API and the worker in a single process. Each keeps its own Redis and
// Postgres connections; nothing else is shared.
import { spawnSync } from 'node:child_process';

const migrate = spawnSync(process.execPath, ['apps/api/dist/migrate.js'], { stdio: 'inherit' });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

await import('../../apps/api/dist/index.js');
await import('../../apps/worker/dist/index.js');
