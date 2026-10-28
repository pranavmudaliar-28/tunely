import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

// shortcut: one shared bearer token guards /v1/admin until Better Auth + roles + 2FA land in Phase 5.
export function requireAdmin(token: string | undefined) {
  const expected = token && token !== 'change-me' ? sha(token) : null;
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const given = req.headers.authorization?.replace(/^Bearer /i, '');
    if (!expected || !given || !timingSafeEqual(sha(given), expected)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  };
}

const sha = (s: string) => createHash('sha256').update(s).digest();
