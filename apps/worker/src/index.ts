import { pino } from 'pino';
import { createRedis } from './redis';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const connection = createRedis();

// Jobs are registered here from Phase 1 onward.
connection.on('ready', () => log.info('worker connected to redis'));

const shutdown = async () => {
  await connection.quit();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
