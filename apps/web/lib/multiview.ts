export const MAX_TILES = 4;
const ID = /^[A-Za-z0-9][A-Za-z0-9.@_-]{0,99}$/;

/** Channel ids from `?c=a,b`: at most 4, no repeats, only plausible ids. */
export function parseTiles(raw: string | null | undefined): string[] {
  const ids = (raw ?? '').split(',').filter((id) => ID.test(id));
  return [...new Set(ids)].slice(0, MAX_TILES);
}

export const tilesHref = (ids: string[]) =>
  ids.length ? `/multiview?c=${ids.map(encodeURIComponent).join(',')}` : '/multiview';
