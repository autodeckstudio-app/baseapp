// GUARDRAIL. Firebase deploys only what functions/src/index.ts exports. A handler
// file that is never re-exported there is an orphan: its direct-import tests pass,
// yet `firebase deploy` silently ships nothing for it. (This happened to
// settleMembershipCoveredJob on the covered-settlement graft and was caught by the
// built-output diff, not by any test.) Keep this parity exact: every trigger const
// defined under src/functions/ must be re-exported by src/index.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const TRIGGER =
  /export const ([A-Za-z0-9_]+) = (onCall|onRequest|onSchedule|onDocumentCreated|onDocumentUpdated|onDocumentWritten|onMessagePublished)/g;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) yield p;
  }
}

describe("functions index exports (no orphaned handlers)", () => {
  it("every trigger const under src/functions/ is re-exported by src/index.ts", () => {
    const indexSrc = readFileSync(join(SRC, "index.ts"), "utf8");
    const exported = new Set<string>();
    for (const m of indexSrc.matchAll(/export \{([^}]+)\}/g)) {
      for (const name of m[1].split(",")) {
        const n = name.trim();
        if (n) exported.add(n);
      }
    }
    const orphans: string[] = [];
    for (const file of walk(join(SRC, "functions"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(TRIGGER)) {
        if (!exported.has(m[1])) orphans.push(`${m[1]} (${file.replace(SRC, "src")})`);
      }
    }
    expect(orphans, `handlers missing from index.ts: ${orphans.join(", ")}`).toEqual([]);
  });
});

describe("built-entry export assertion (esbuild, no deploy needed)", () => {
  it("the actual built bundle registers every trigger const, including settleMembershipCoveredJob", async () => {
    const { build } = await import("esbuild");
    const result = await build({
      entryPoints: [join(SRC, "index.ts")],
      bundle: true,
      write: false,
      platform: "node",
      target: "node20",
      format: "cjs",
      logLevel: "silent",
      external: ["firebase-admin", "firebase-functions", "zod", "tesseract.js", "@tesseract.js-data/eng"],
    });
    const text = result.outputFiles[0].text;
    // Same source scan as the source-level parity test: every trigger const must
    // appear in the BUILT entry (catches orphans even if index.ts is bypassed or
    // the export is tree-shaken/mis-wired).
    const missing: string[] = [];
    for (const file of walk(join(SRC, "functions"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(TRIGGER)) {
        if (!text.includes(m[1])) missing.push(m[1]);
      }
    }
    expect(missing).toEqual([]);
    // The settle handler specifically: present in the bundle AND wired into the
    // CommonJS export block (the exact orphan shape that slipped through before).
    expect(text).toContain("settleMembershipCoveredJob");
    expect(text).toMatch(/settleMembershipCoveredJob:\s*\(\)\s*=>\s*\w*settleMembershipCoveredJob/);
  }, 60000);
});
