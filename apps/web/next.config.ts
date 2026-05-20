import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .replace(/\/$/, '');
    const destinationBase = raw.toLowerCase().endsWith('/api') ? raw : `${raw}/api`;
    return [
      {
        source: '/api/:path*',
        destination: `${destinationBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
