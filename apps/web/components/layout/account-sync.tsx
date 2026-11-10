'use client';

import { useEffect } from 'react';
import { readSyncMeta, startSync } from '@/lib/storage/sync';

/** Keeps a signed-in browser's lists in step. In a browser that never signed in it does nothing, not even a request. */
export function AccountSync() {
  useEffect(() => {
    const meta = readSyncMeta();
    return meta ? startSync(meta.userId) : undefined;
  }, []);
  return null;
}
