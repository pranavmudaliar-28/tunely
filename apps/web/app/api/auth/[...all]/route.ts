import { getAuth } from '@/lib/auth';

// Better Auth's endpoints (sign-in links, Google, session, sign-out, delete account). 404 while accounts are off.
const handle = (req: Request) => getAuth()?.auth.handler(req) ?? new Response(null, { status: 404 });
export const GET = handle;
export const POST = handle;
