'use client';

import { useEffect } from 'react';
import { arrowDirection, nextInDirection } from '@/lib/spatial';

/**
 * TV remotes and keyboards: while focus is on a channel card, tile or nav item (anything marked data-nav), the arrow
 * keys move to the nearest one in that direction, across rails and grids. Runs before the player's own arrow keys,
 * so on the watch page arrows move between cards when a card has focus and change channel otherwise.
 */
export function SpatialNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = arrowDirection(e.key);
      const from = document.activeElement;
      if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!(from instanceof HTMLElement) || !from.matches('[data-nav]')) return;
      e.preventDefault();
      e.stopPropagation();
      const items = [...document.querySelectorAll<HTMLElement>('[data-nav]')].filter(
        (el) => el !== from && el.getClientRects().length > 0,
      );
      const i = nextInDirection(
        from.getBoundingClientRect(),
        items.map((el) => el.getBoundingClientRect()),
        dir,
      );
      const next = items[i];
      if (!next) return;
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return null;
}
