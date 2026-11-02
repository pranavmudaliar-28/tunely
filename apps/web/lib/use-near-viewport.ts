'use client';

import { useCallback, useState } from 'react';

/** Attach `ref` to an element; `near` turns true (and stays true) once it comes within `rootMargin` of the screen. */
export function useNearViewport<T extends Element>(rootMargin: string) {
  const [near, setNear] = useState(false);
  const ref = useCallback(
    (el: T | null) => {
      if (!el) return;
      const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && setNear(true), {
        rootMargin,
      });
      io.observe(el);
      return () => io.disconnect();
    },
    [rootMargin],
  );
  return [ref, near] as const;
}
