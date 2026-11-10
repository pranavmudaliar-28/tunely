'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { forgetSync, syncNow, type SyncResult } from '@/lib/storage/sync';

const btn = 'bg-surface-raised text-text h-12 rounded-[8px] px-[18px] text-[15px] font-semibold disabled:opacity-70';
const field = 'bg-surface border-border h-12 w-full max-w-[360px] rounded-[8px] border px-3 text-[15px]';

export function AccountPanel({
  methods,
  user,
}: {
  methods: { email: boolean; google: boolean } | null;
  user: { id: string; email: string } | null;
}) {
  if (!methods)
    return (
      <p className="text-text-muted max-w-[640px]">
        Accounts aren&apos;t switched on yet. Your favorites, history and settings are kept in this browser.
      </p>
    );
  return user ? <SignedIn user={user} /> : <SignIn methods={methods} />;
}

function SignIn({ methods }: { methods: { email: boolean; google: boolean } }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<string>('idle');
  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <p className="text-text-muted">
        Sign in to keep your favorites, folders, history and settings on every device where you sign in. Without an
        account they stay in this browser, as now.
      </p>
      {methods.email && (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState('busy');
            const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: '/account' });
            setState(error ? (error.message ?? "That didn't work. Try again.") : 'sent');
          }}
        >
          <label htmlFor="account-email" className="text-[15px] font-semibold">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          <p>
            <button type="submit" disabled={state === 'busy'} className={btn}>
              Email me a sign-in link
            </button>
          </p>
          <p role="status" className="text-text-muted text-sm">
            {state === 'sent'
              ? `Check your inbox at ${email.trim()}. The link works once, within 10 minutes.`
              : state === 'idle' || state === 'busy'
                ? ''
                : state}
          </p>
        </form>
      )}
      {methods.google && (
        <p>
          <button
            type="button"
            className={btn}
            onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/account' })}
          >
            Continue with Google
          </button>
        </p>
      )}
      <p className="text-text-muted text-sm">
        We keep your email address and your lists, nothing else. See the{' '}
        <Link href="/privacy" className="underline">
          privacy page
        </Link>
        .
      </p>
    </div>
  );
}

const MESSAGES: Record<SyncResult, string> = {
  ok: 'Synced. Changes here are saved to your account within seconds.',
  'signed-out': 'You were signed out.',
  error: "Couldn't sync just now. We'll try again.",
};

function SignedIn({ user }: { user: { id: string; email: string } }) {
  const router = useRouter();
  const [state, setState] = useState<'syncing' | SyncResult>('syncing');
  const confirm = useRef<HTMLDialogElement>(null);
  // Landing here after signing in: the first sync merges this browser's lists with the account's.
  useEffect(() => {
    let current = true;
    void syncNow(user.id).then((r) => current && setState(r));
    return () => {
      current = false;
    };
  }, [user.id]);
  const sync = async () => {
    setState('syncing');
    setState(await syncNow(user.id));
  };
  const signOut = async () => {
    await syncNow(user.id);
    forgetSync();
    await authClient.signOut();
    router.refresh();
  };
  const deleteAccount = async () => {
    const { error } = await authClient.deleteUser();
    confirm.current?.close();
    if (error) return setState('error');
    forgetSync();
    router.refresh();
  };
  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <p>
        Signed in as <strong>{user.email}</strong>. Your favorites, folders, history and settings are kept in step on
        every device where you sign in.
      </p>
      <p role="status" className="text-text-muted text-sm">
        {state === 'syncing' ? 'Syncing…' : MESSAGES[state]}
      </p>
      <p className="flex flex-wrap gap-2.5">
        <button type="button" className={btn} onClick={sync} disabled={state === 'syncing'}>
          Sync now
        </button>
        <button type="button" className={btn} onClick={signOut}>
          Sign out
        </button>
      </p>
      <p className="text-text-muted text-sm">
        Signing out keeps your lists in this browser.{' '}
        <button type="button" className="underline" onClick={() => confirm.current?.showModal()}>
          Delete my account
        </button>
      </p>
      <dialog
        ref={confirm}
        aria-labelledby="delete-title"
        className="bg-surface-raised text-text border-border m-auto w-[min(440px,calc(100vw-32px))] rounded-[12px] border p-5 backdrop:bg-black/60"
      >
        <h2 id="delete-title" className="pb-2 text-lg font-semibold">
          Delete your account?
        </h2>
        <p className="text-text-muted pb-4 text-sm">
          We delete your email address and the lists kept with your account. This browser keeps its own copy.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={`${btn} bg-accent text-[#0B0D12]`} onClick={deleteAccount}>
            Delete account
          </button>
          <button type="button" className={btn} onClick={() => confirm.current?.close()}>
            Keep it
          </button>
        </div>
      </dialog>
    </div>
  );
}
