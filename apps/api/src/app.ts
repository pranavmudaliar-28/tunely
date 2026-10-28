import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Db } from '@tunely/db';
import type { Queue } from 'bullmq';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { adminRoutes } from './routes/admin';
import { devRoutes } from './routes/dev';
import { publicRoutes } from './routes/public';

export interface Deps {
  db: Db;
  redis: Redis;
  queues: { catalog: Pick<Queue, 'add'> };
  adminToken: string | undefined;
  reportHashSecret: string;
  corsOrigins?: string[];
  trustProxy?: boolean;
  /** Global per-client request budget per minute. */
  rateLimitPerMin?: number;
}

export function buildApp(deps: Deps) {
  const app = Fastify({
    trustProxy: deps.trustProxy ?? false,
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization'],
      // No IPs or user agents in logs.
      serializers: { req: (req) => ({ method: req.method, url: req.url }) },
    },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: deps.corsOrigins ?? false, methods: ['GET', 'POST'] });
  app.register(rateLimit, {
    global: true,
    max: deps.rateLimitPerMin ?? 120,
    timeWindow: '1 minute',
    redis: deps.redis,
    nameSpace: 'rl:',
    // The IP only ever exists as a hash inside a key that expires after the window.
    keyGenerator: (req) => createHash('sha256').update(req.ip).digest('base64url').slice(0, 22),
    allowList: (req) => req.url === '/v1/health',
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Tunely API',
        version: '1.0.0',
        description: 'Public catalog of curated, browser-playable live TV.',
      },
      servers: [],
    },
    transform: jsonSchemaTransform,
  });
  app.register(swaggerUi, { routePrefix: '/v1/docs' });

  app.get(
    '/v1/health',
    { schema: { tags: ['meta'], response: { 200: z.object({ status: z.literal('ok') }) } } },
    async () => ({ status: 'ok' as const }),
  );

  app.register(publicRoutes(deps));
  app.register(adminRoutes(deps));
  if (process.env.NODE_ENV !== 'production') app.register(devRoutes(deps));

  return app;
}
