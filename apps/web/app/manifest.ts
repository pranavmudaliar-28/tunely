import type { MetadataRoute } from 'next';

// Install-to-home-screen metadata. The offline service worker is deferred (see docs/decisions.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Tunely: free live TV',
    short_name: 'Tunely',
    description: 'Free live TV in your browser.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0D12',
    theme_color: '#0B0D12',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
