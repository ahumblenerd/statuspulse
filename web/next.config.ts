import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  async rewrites() {
    const apiHost = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
    return [
      { source: "/api/:path*", destination: `${apiHost}/api/:path*` },
    ];
  },
};

export default nextConfig;
