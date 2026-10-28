/**
 * Parse CORS_ORIGINS ("https://a.com, https://b.com/"). Browsers send an Origin with no path and no
 * trailing slash, so a pasted "https://site.app/" would silently block every request: normalise it.
 */
export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
