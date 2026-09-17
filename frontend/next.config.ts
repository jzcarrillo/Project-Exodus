import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['tesseract.js'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
