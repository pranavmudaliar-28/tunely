import { createDb, sql, type Db } from '@tunely/db/client';
import * as schema from '@tunely/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins';
import { SITE_URL } from './site';

// Accounts (server only): optional, for keeping a viewer's own lists in step across devices. Each sign-in method is
// on only when its keys are set; with none, there are no accounts and nothing here runs.

const env = process.env;
/** Dev and e2e only: keep sign-in links in memory instead of emailing them. Never on Vercel. */
const devMailbox = env.AUTH_DEV_MAILBOX === '1' && !env.VERCEL;

export function accountMethods() {
  const email = Boolean(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM) || devMailbox;
  const google = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  return env.BETTER_AUTH_SECRET && env.DATABASE_URL && (email || google) ? { email, google } : null;
}

/** Sign-in links kept for /api/dev/mailbox (one module copy per route bundle, so on globalThis). */
export const mailbox: Map<string, string> = ((globalThis as { __tunelyMailbox?: Map<string, string> })
  .__tunelyMailbox ??= new Map());

const MAX_LINKS_PER_HOUR = 3;

/** Stops anyone from flooding one address with sign-in emails (the IP-based limit is per server instance). */
async function limitLinks(db: Db, email: string) {
  const { rows } = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from auth_verification
    where created_at > now() - interval '1 hour' and value like '{%' and (value::jsonb ->> 'email') = ${email}`);
  if ((rows[0]?.n ?? 0) > MAX_LINKS_PER_HOUR)
    throw new APIError('TOO_MANY_REQUESTS', { message: 'Too many sign-in links for this address. Try again later.' });
}

async function sendLink(email: string, url: string) {
  if (devMailbox) {
    mailbox.set(email.toLowerCase(), url);
    return;
  }
  // Resend's HTTP API: no SDK needed.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: email,
      subject: 'Your Tunely sign-in link',
      text: `Sign in to Tunely:\n\n${url}\n\nThe link works once, within 10 minutes. If you didn't ask for it, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new APIError('INTERNAL_SERVER_ERROR', { message: "We couldn't send the email. Try again." });
}

function createAuth() {
  const methods = accountMethods()!;
  // Few connections: each serverless instance gets its own pool.
  const { db } = createDb(env.DATABASE_URL!, 3);
  return {
    db,
    auth: betterAuth({
      appName: 'Tunely',
      baseURL: SITE_URL,
      secret: env.BETTER_AUTH_SECRET,
      database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
          user: schema.authUser,
          session: schema.authSession,
          account: schema.authAccount,
          verification: schema.authVerification,
        },
      }),
      telemetry: { enabled: false },
      advanced: { ipAddress: { disableIpTracking: true } },
      session: { expiresIn: 90 * 24 * 3600, updateAge: 24 * 3600 },
      user: { deleteUser: { enabled: true } },
      socialProviders: methods.google
        ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
        : {},
      databaseHooks: {
        // We keep who signed in, nothing about where from or with what.
        session: { create: { before: async (s) => ({ data: { ...s, ipAddress: null, userAgent: null } }) } },
        account: {
          create: {
            before: async (a) => ({ data: { ...a, accessToken: null, refreshToken: null, idToken: null } }),
          },
          update: {
            before: async (a) => ({ data: { ...a, accessToken: null, refreshToken: null, idToken: null } }),
          },
        },
      },
      plugins: methods.email
        ? [
            magicLink({
              expiresIn: 600,
              sendMagicLink: async ({ email, url }) => {
                await limitLinks(db, email);
                await sendLink(email, url);
              },
            }),
          ]
        : [],
    }),
  };
}

let instance: ReturnType<typeof createAuth> | null | undefined;
/** Null when accounts are off. */
export function getAuth() {
  instance ??= accountMethods() ? createAuth() : null;
  return instance;
}
