import { render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('renders an AdSense unit and requests a fill when configured', async () => {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-1234567890');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT', '111');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_WATCH', '222');
  const { AdBanner } = await import('./ad-banner');
  window.adsbygoogle = [];
  const { container } = render(<AdBanner placement="watch" />);
  const ins = container.querySelector('ins.adsbygoogle')!;
  expect(ins.getAttribute('data-ad-client')).toBe('ca-pub-1234567890');
  expect(ins.getAttribute('data-ad-slot')).toBe('222'); // per-placement unit wins
  expect(window.adsbygoogle).toHaveLength(1);
  expect(container.textContent).toContain('Advertisement');
});

test('ads.txt names the publisher when configured, and is empty otherwise', async () => {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-1234567890');
  const { GET } = await import('@/app/ads.txt/route');
  expect(await GET().text()).toBe('google.com, pub-1234567890, DIRECT, f08c47fec0942fa0\n');
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', '');
  const empty = await import('@/app/ads.txt/route');
  expect(await empty.GET().text()).toBe('');
});
