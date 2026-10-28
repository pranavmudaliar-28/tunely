import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tunely/shared'],
  poweredByHeader: false,
  // Keep the dev badge away from the nav rail's Theme button.
  devIndicators: { position: 'bottom-right' },
};
export default config;
