import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Admin is white theme only: the shared palette code reads this at build time.
  env: { NEXT_PUBLIC_THEME_LOCK: "light" },
  devIndicators: false,
  // Lets the built-in optimizer serve small thumbnails of listing photos.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // Security headers (66B7): baseline set enforced. COOP allows popups because
  // Google sign-in uses signInWithRedirect primarily and signInWithPopup as fallback.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
      // Firebase's same-origin AuthRelay iframe must be framed by this app.
      // Keep every other document DENY, including the popup handler. The
      // route's SAMEORIGIN + frame-ancestors self reject outside embedding.
      {
        source: "/__/auth/iframe",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
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
