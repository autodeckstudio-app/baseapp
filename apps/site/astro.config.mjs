import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  // Every script stays an external file so the CSP can use script-src 'self' (no unsafe-inline). See scripts/headers-guard.mjs.
  vite: { build: { assetsInlineLimit: 0 } },
});
