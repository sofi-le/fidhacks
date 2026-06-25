import type { NextConfig } from "next";

// Proxy /api/* and /health to the Express backend so the browser only ever
// talks to ONE host (the Next dev server). The backend stays on :8787 but is
// invisible to the user. Override the target with API_PROXY_TARGET if needed.
const API_TARGET = process.env.API_PROXY_TARGET || "http://localhost:8787";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_TARGET}/api/:path*` },
      { source: "/health", destination: `${API_TARGET}/health` },
    ];
  },
};

export default nextConfig;
