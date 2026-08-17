import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@autodeck/auth",
    "@autodeck/core",
    "@autodeck/database",
    "@autodeck/ui",
  ],
};

export default nextConfig;
