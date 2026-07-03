import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许上传请求体最大 512MB（Next.js 16 App Router 默认无限制）
  serverExternalPackages: [],
};

export default nextConfig;
