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
