import { ADSENSE_CLIENT, publisherId } from '@/lib/ads';

// ads.txt tells ad buyers which sellers may sell this site's inventory. AdSense checks it.
// f08c47fec0942fa0 is Google's fixed certification authority id.
export function GET() {
  const body = ADSENSE_CLIENT ? `google.com, ${publisherId(ADSENSE_CLIENT)}, DIRECT, f08c47fec0942fa0\n` : '';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
