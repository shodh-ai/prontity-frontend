import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Fix for canvas
    config.externals.push('canvas');

    // Fix for konva from next.config.js
    if (!isServer) {
      config.resolve.alias['konva'] = path.resolve(
        __dirname,
        './node_modules/konva/konva.js'
      );
    }
    return config;
  },
};

export default nextConfig;