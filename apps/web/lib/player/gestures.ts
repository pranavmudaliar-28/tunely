/** A deliberate vertical flick: far enough, mostly vertical, and quick. Up = next channel, like short-video apps. */
export function swipeDirection(dx: number, dy: number, ms: number): 'up' | 'down' | null {
  if (ms > 700 || Math.abs(dy) < 60 || Math.abs(dy) < 2 * Math.abs(dx)) return null;
  return dy < 0 ? 'up' : 'down';
}

/** Which third of the player a tap landed in; double taps on the sides skip 10 seconds. */
export function tapSide(x: number, width: number): 'left' | 'center' | 'right' {
  if (x < width / 3) return 'left';
  if (x > (2 * width) / 3) return 'right';
  return 'center';
}

/** Two taps on the same side within this many milliseconds. */
export const DOUBLE_TAP_MS = 300;
