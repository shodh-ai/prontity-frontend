const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Forcefully resolve 'konva' to its browser build file
      config.resolve.alias['konva'] = path.resolve(
        __dirname,
        './node_modules/konva/konva.js'
      );
    }
    return config;
  },
};

module.exports = nextConfig;
