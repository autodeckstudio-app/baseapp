// Guard: the production web export must not contain dev preview screens or their sample data.
// Run after `expo export --platform web`:  node scripts/prod-bundle-guard.mjs   (the Vercel build command runs it)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const dist = new URL("../dist/", import.meta.url).pathname;
if (!existsSync(dist)) { console.error("FAIL dist/ missing: run expo export first"); process.exit(1); }
// Strings that exist only in dev sample data or dev preview screens.
const MARKERS = ["Local test build", "Dev-only mock of the Cars screen", "Dev preview only. Sample data", "DEV_SAMPLE_BOOKING", "Grand i10", "Seltos", "MH40CQ3182", "FIXTURE product (not for sale)", "fixture-tee"];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let bad = 0;
for (const f of walk(dist).filter((f) => /\.(js|html|map)$/.test(f) && !/\.map$/.test(f) || /\.js$/.test(f))) {
  const t = readFileSync(f, "utf8");
  for (const m of MARKERS) if (t.includes(m)) { console.error(`FAIL ${f.replace(dist, "")} contains dev sample marker "${m}"`); bad++; }
}
// Preview routes must not be in the exported route list.
const routes = walk(dist).filter((f) => /preview[-.a-z]*\.html$/.test(f));
for (const r of routes) { console.error(`FAIL preview route exported: ${r.replace(dist, "")}`); bad++; }
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log("prod-bundle-guard ok");
