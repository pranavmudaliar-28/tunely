// The visitor's country, from the header Vercel adds to every request (no IP is read or stored here).
// The home page uses it to add a "Popular in {country}" row in the browser, so the page itself stays cached.
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const raw = req.headers.get('x-vercel-ip-country')?.toUpperCase();
  const country = raw && /^[A-Z]{2}$/.test(raw) && raw !== 'XX' ? raw : null;
  return Response.json({ country }, { headers: { 'cache-control': 'private, no-store' } });
}
