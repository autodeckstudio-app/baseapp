/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These workspace packages ship raw TypeScript source (`main`/`types`
  // point straight at `.ts` files, not compiled output) — Next's webpack
  // build otherwise treats all of node_modules as pre-built and skips
  // transforming it. `transpilePackages` is Next's own supported mechanism
  // for exactly this monorepo case, not a workaround.
  transpilePackages: ['@autodeck/domain', '@autodeck/api-client', '@autodeck/design-tokens'],
};

module.exports = nextConfig;
