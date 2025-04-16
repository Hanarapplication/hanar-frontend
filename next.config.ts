import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['source.unsplash.com'], // ✅ Allow images from Unsplash
  },
  experimental: {
    // ✅ Fix cross-origin LAN access warning
    allowedDevOrigins: ['http://192.168.1.252:3000'],
  },
};

export default nextConfig;
