import type { MetadataRoute } from 'next';

// Install-to-home-screen metadata. The offline service worker is deferred (see docs/decisions.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tunely',
    short_name: 'Tunely',
    description: 'Free live TV in your browser.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0D12',
    theme_color: '#0B0D12',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
