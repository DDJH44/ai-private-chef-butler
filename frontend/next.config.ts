import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: isProd ? "export" : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  distDir: ".next",
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  compiler: {
    // 生产环境移除 console.* 调用，保留 console.error 用于排错
    removeConsole: isProd ? { exclude: ["error"] } : false,
  },
  async rewrites() {
    if (isProd) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
