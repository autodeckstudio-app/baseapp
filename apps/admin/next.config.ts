import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets the built-in optimizer serve small thumbnails of listing photos.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // Serves Firebase's sign-in handler from this site so redirect sign-in works in Safari.
  async rewrites() {
    const host = process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"];
    if (!host || host.endsWith(".invalid")) return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${host}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${host}/__/firebase/:path*` },
    ];
  },
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
