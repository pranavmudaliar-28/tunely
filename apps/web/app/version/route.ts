// The deploy that's live now. Open pages (installed apps especially) compare it with the build they run.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID || null },
    { headers: { 'cache-control': 'no-store' } },
  );
}
