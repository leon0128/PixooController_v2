import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits a self-contained server with only the files it actually needs, which is
  // what the production image copies instead of the whole node_modules tree.
  output: 'standalone',
};

export default nextConfig;
