export type Direction = 'left' | 'right' | 'up' | 'down';

type Box = { left: number; top: number; width: number; height: number };

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};
export const arrowDirection = (key: string): Direction | undefined => ARROWS[key];

/**
 * Index of the box a remote's arrow should move to: ahead of `from` in that direction, scored by distance along the
 * direction plus twice the sideways offset (so "down" prefers the card straight below over a nearer one off to the
 * side). -1 when nothing lies that way.
 */
export function nextInDirection(from: Box, boxes: Box[], dir: Direction): number {
  const cx = (b: Box) => b.left + b.width / 2;
  const cy = (b: Box) => b.top + b.height / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    const dx = cx(b) - cx(from);
    const dy = cy(b) - cy(from);
    const ahead = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const sideways = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 1) return;
    const score = ahead + 2 * sideways;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
