'use client';

import { useState } from 'react';
import { ShareIcon } from '@/components/ui/icons';

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${title} on Tunely`, url }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="bg-surface-raised flex h-12 items-center gap-2 rounded-[8px] px-[18px] text-[15px] font-semibold"
    >
      <ShareIcon size={18} />
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
