import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isProd = process.env.NODE_ENV === "production";
const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: isProd ? "export" : undefined,
  trailingSlash: true,
  turbopack: {
    root: frontendRoot,
  },
  images: {
    unoptimized: true,
  },
  distDir: ".next",
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  compiler: {
    // 生产环境移除 console.* 调用，保留 console.error 用于排错
    removeConsole: isProd ? { exclude: ["error"] } : false,
  },
  ...(!isProd && {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:8001/api/:path*",
        },
      ];
    },
  }),
};

export default nextConfig;
