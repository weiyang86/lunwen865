import type { NextConfig } from "next";

const normalizeApiBaseUrl = (value?: string) => {
  const raw = (value || "http://localhost:3001")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\/$/, "");

  return raw.toLowerCase().endsWith("/api") ? raw : `${raw}/api`;
};

const nextConfig: NextConfig = {
  async rewrites() {
    const destinationBase = normalizeApiBaseUrl(process.env.API_BASE_URL);

    return [
      {
        source: "/api/:path*",
        destination: `${destinationBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;