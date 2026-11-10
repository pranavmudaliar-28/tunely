import { mailbox } from '@/lib/auth';

// Development and e2e only (AUTH_DEV_MAILBOX=1, never on Vercel): the last sign-in link sent to an address.
export function GET(req: Request) {
  if (process.env.AUTH_DEV_MAILBOX !== '1' || process.env.VERCEL) return new Response(null, { status: 404 });
  const email = new URL(req.url).searchParams.get('email')?.toLowerCase() ?? '';
  const url = mailbox.get(email);
  return url ? Response.json({ url }) : new Response(null, { status: 404 });
}
