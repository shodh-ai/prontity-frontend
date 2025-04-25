/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Handle konva and react-konva as client-side only packages
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    
    return config;
  },
  // Add any other Next.js config options below
  reactStrictMode: true,
};

module.exports = nextConfig;
