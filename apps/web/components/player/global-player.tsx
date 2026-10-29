'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useNowPlaying } from '@/lib/player/now-playing';
import { cn } from '@/lib/utils';
import { Player } from './player';

/**
 * One player for the whole site, mounted in the root layout. On the watch page it sits exactly over
 * the page's <PlayerSlot>; anywhere else it docks as a mini player in the corner. The <video> element
 * never unmounts, so picture-in-picture and playback carry on across navigation.
 */
export function GlobalPlayer() {
  const { now, slot, close } = useNowPlaying();
  const rect = useSlotRect(slot);
  const inPip = usePictureInPicture();
  if (!now) return null;

  const full = Boolean(slot && rect);
  return (
    <div
      className={cn(
        'z-40',
        full
          ? 'absolute'
          : 'border-border fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] min-[720px]:bottom-4 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[12px] border shadow-2xl shadow-black/60',
        // In browser picture-in-picture the video shows in its own window; keep the element in the
        // document (removing it would end PiP) but out of the way.
        !full && inPip && 'pointer-events-none opacity-0',
      )}
      style={full && rect ? { top: rect.top, left: rect.left, width: rect.width } : undefined}
    >
      <Player
        channel={now.channel}
        fallbackLineup={now.fallbackLineup}
        meta={now.meta}
        mode={full ? 'full' : 'mini'}
        onClose={close}
      />
    </div>
  );
}

/** The slot's position in document coordinates, kept up to date as the layout shifts. */
function useSlotRect(slot: HTMLElement | null) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!slot) return;
    const measure = () => {
      const r = slot.getBoundingClientRect();
      setRect((prev) => {
        const next = { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width };
        return prev && prev.top === next.top && prev.left === next.left && prev.width === next.width
          ? prev
          : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(document.body); // content above the slot changing height moves it
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [slot]);
  // A stale rect from a previous slot is never used: no slot means mini player.
  return slot ? rect : null;
}

function usePictureInPicture() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const on = () => setActive(true);
    const off = () => setActive(false);
    document.addEventListener('enterpictureinpicture', on, true);
    document.addEventListener('leavepictureinpicture', off, true);
    return () => {
      document.removeEventListener('enterpictureinpicture', on, true);
      document.removeEventListener('leavepictureinpicture', off, true);
    };
  }, []);
  return active;
}
