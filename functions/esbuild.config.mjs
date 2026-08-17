// Bundles the Cloud Functions entrypoint into a single self-contained CommonJS
// file for lib/index.js.
//
// Why bundling instead of plain `tsc`: @autodeck/core, @autodeck/database, and
// @autodeck/auth are internal workspace packages whose package.json "main"
// points directly at TypeScript source (never compiled to .js) — that is fine
// for TS-aware tools (tsc typecheck, Vite/Vitest, tsx) which resolve NodeNext's
// ".js"-imports-mean-sibling-".ts" convention themselves, but a plain Node
// `require("@autodeck/core")` at runtime cannot: it resolves the package's
// "main" to raw .ts source and then fails trying to resolve that source's own
// relative ".js" imports as literal files. Bundling inlines those three
// packages at build time, so the deployed/emulated function never needs Node
// to resolve them at runtime. firebase-admin/firebase-functions/zod are real
// published npm packages and stay external (already correctly resolvable).
import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "lib/index.js",
  sourcemap: true,
  logLevel: "info",
  external: ["firebase-admin", "firebase-functions", "zod"],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[esbuild] watching for changes...");
} else {
  await build(options);
}
