import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const turbopackRoot = path.join(currentDir, "..", "..");

const normalizeApiBaseUrl = (value?: string) => {
  const raw = (value || "http://localhost:3001")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\/$/, "");

  return raw.toLowerCase().endsWith("/api") ? raw : `${raw}/api`;
};

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
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
