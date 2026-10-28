import type { Db } from '@tunely/db';
import type { Queue } from 'bullmq';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { adminRoutes } from './routes/admin';

export interface Deps {
  db: Db;
  queues: { catalog: Pick<Queue, 'add'> };
  adminToken: string | undefined;
}

export function buildApp(deps: Deps) {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization'] },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get(
    '/v1/health',
    { schema: { response: { 200: z.object({ status: z.literal('ok') }) } } },
    async () => ({
      status: 'ok' as const,
    }),
  );

  app.register(adminRoutes(deps));

  return app;
}
