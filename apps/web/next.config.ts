import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const config: NextConfig = {
  transpilePackages: ['@tunely/shared'],
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (deploy/). Traced from the monorepo root so
  // workspace packages are included.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  // Keep the dev badge away from the nav rail's Theme button.
  devIndicators: { position: 'bottom-right' },
};
export default config;
