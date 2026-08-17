import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@autodeck/auth",
    "@autodeck/core",
    "@autodeck/database",
    "@autodeck/ui",
  ],
  webpack: (config) => {
    // Workspace packages are consumed as TypeScript source (package.json "main"
    // points at src/index.ts) and use NodeNext-style relative imports with
    // explicit ".js" extensions (resolved by tsc/vite automatically). Webpack
    // needs an explicit alias to resolve those ".js" specifiers back to the
    // sibling ".ts" files.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
