import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tunely/shared'],
  poweredByHeader: false,
};
export default config;
