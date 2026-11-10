// Dead air: a stream that "plays" but shows a frozen or black picture with no sound. Decided from tiny frame samples
// and, where the browser allows, the audio level. A still picture with sound is a radio channel, not dead air.

/** Mean luma (0–255) of an RGBA frame sample. */
export function meanLuma(px: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
  return sum / (px.length / 4);
}

/** Mean absolute luma change between two samples of the same size. */
export function lumaChange(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
    const lb = 0.299 * b[i]! + 0.587 * b[i + 1]! + 0.114 * b[i + 2]!;
    sum += Math.abs(la - lb);
  }
  return sum / (a.length / 4);
}

/** Root mean square of audio samples in -1..1. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export interface DeadAirSample {
  at: number;
  luma: number;
  /** Change since the previous sample (Infinity for the first). */
  change: number;
  /** null: the sound can't be measured here. */
  silent: boolean | null;
  /** The playback position moved since the previous sample (a stall is buffering, not dead air). */
  advancing: boolean;
}

export const DEAD_AIR_MS = 20_000;
/** About -50 dBFS. */
export const SILENCE_RMS = 0.003;
const STILL = 1.5;
const BLACK = 12;

/**
 * Feed it a sample every few seconds; it returns true once the picture has been still and the sound silent for
 * `windowMs`, or, where sound can't be measured, the picture has been still and black.
 */
export function deadAirDetector(windowMs = DEAD_AIR_MS) {
  let since: number | null = null;
  return (s: DeadAirSample): boolean => {
    const still = s.advancing && s.change < STILL;
    const dead = still && (s.silent === true || (s.silent === null && s.luma < BLACK));
    if (!dead) {
      since = null;
      return false;
    }
    since ??= s.at;
    return s.at - since >= windowMs;
  };
}
