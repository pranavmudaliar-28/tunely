import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { accountMethods, getAuth } from '@/lib/auth';
import { AccountPanel } from './account-panel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false },
  alternates: { canonical: '/account' },
};

export default async function AccountPage() {
  const a = getAuth();
  const session = a ? await a.auth.api.getSession({ headers: await headers() }) : null;
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14">
      <h1 className="text-[32px] font-bold tracking-[-0.02em]">Your account</h1>
      <AccountPanel
        methods={accountMethods()}
        user={session ? { id: session.user.id, email: session.user.email } : null}
      />
    </div>
  );
}
