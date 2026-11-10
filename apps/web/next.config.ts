import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const config: NextConfig = {
  transpilePackages: ['@tunely/shared', '@tunely/db'],
  poweredByHeader: false,
  // Which deploy this build is. Open pages compare it with /version to pick up a new deploy (installed apps
  // can stay open for days). Empty off Vercel, which turns the check off.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? '' },
  // Self-contained server bundle for the Docker image (deploy/). Traced from the monorepo root so
  // workspace packages are included.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  // Keep the dev badge away from the nav rail's Theme button.
  devIndicators: { position: 'bottom-right' },
  // Search lives on Live TV (/browse) now; old /search?q= links keep working (the query string carries over).
  redirects: async () => [{ source: '/search', destination: '/browse', permanent: true }],
  // No framing (clickjacking would mean click fraud on our ad accounts). The full CSP waits for Phase 6: the ad
  // networks load scripts from hosts that change per account.
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Microphone for our own pages only: voice search. Embedded frames (ads) still get none.
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    },
  ],
};
export default config;
