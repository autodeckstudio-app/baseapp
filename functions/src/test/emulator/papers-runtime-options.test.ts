// Regression guard: the papers callables' runtime options are pinned to the
// live-verified production values (captured from Cloud Run console, 2026-10-31).
// firebase deploy treats code RuntimeOptions as source of truth and RESETS
// unset options to defaults (firebase.google.com/docs/functions/manage-functions) -
// without these pins, redeploying would raise max instances 20 -> 100.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const papersDir = join(__dirname, "../../functions/papers");
const src = (f: string) => readFileSync(join(papersDir, f), "utf8");

const PINNED: Array<{ fn: string; file: string; timeout: number; concurrency: number; maxInstances: number }> = [
  { fn: "submitPaper", file: "submitPaper.ts", timeout: 60, concurrency: 80, maxInstances: 20 },
  { fn: "reviewPaper", file: "reviewPaper.ts", timeout: 60, concurrency: 80, maxInstances: 20 },
  { fn: "updatePaper", file: "updatePaper.ts", timeout: 60, concurrency: 80, maxInstances: 20 },
  { fn: "submitMyPaper", file: "submitMyPaper.ts", timeout: 60, concurrency: 80, maxInstances: 20 },
  { fn: "finalizeMyPaper", file: "submitMyPaper.ts", timeout: 120, concurrency: 1, maxInstances: 3 },
  { fn: "updateMyPaper", file: "myPaperEdits.ts", timeout: 60, concurrency: 80, maxInstances: 20 },
  { fn: "deleteMyPaper", file: "myPaperEdits.ts", timeout: 60, concurrency: 80, maxInstances: 20 },
];

describe("papers callable runtime options stay pinned to verified live config", () => {
  for (const p of PINNED) {
    it(`${p.fn} declares timeoutSeconds=${p.timeout}, concurrency=${p.concurrency}, maxInstances=${p.maxInstances}`, () => {
      const text = src(p.file);
      const decl = text.match(new RegExp(`export const ${p.fn} = onCall\\(\\{[^}]*\\}`));
      expect(decl, `${p.fn} onCall options block not found in ${p.file}`).toBeTruthy();
      const opts = decl![0];
      expect(opts).toContain(`timeoutSeconds: ${p.timeout}`);
      expect(opts).toContain(`concurrency: ${p.concurrency}`);
      expect(opts).toContain(`maxInstances: ${p.maxInstances}`);
    });
  }

  it("no papers callable relies on implicit defaults (every onCall sets the three pins)", () => {
    for (const f of ["submitPaper.ts", "reviewPaper.ts", "updatePaper.ts", "submitMyPaper.ts", "myPaperEdits.ts"]) {
      const blocks = src(f).match(/onCall\(\{[^}]*\}/g) ?? [];
      for (const b of blocks) {
        expect(b, `${f} has an unpinned onCall options block`).toContain("maxInstances:");
        expect(b).toContain("timeoutSeconds:");
        expect(b).toContain("concurrency:");
      }
      expect(blocks.length).toBeGreaterThan(0);
    }
  });
});

describe("getPrivateFileUrl (new reader) matches customer-callable live pattern", () => {
  it("declares invoker public + the three pins", () => {
    const text = readFileSync(join(__dirname, "../../functions/files/getPrivateFileUrl.ts"), "utf8");
    const decl = text.match(/export const getPrivateFileUrl = onCall\(\{[^}]*\}/);
    expect(decl, "getPrivateFileUrl onCall options block not found").toBeTruthy();
    const opts = decl![0];
    expect(opts).toContain('invoker: "public"');
    expect(opts).toContain("timeoutSeconds: 60");
    expect(opts).toContain("concurrency: 80");
    expect(opts).toContain("maxInstances: 20");
  });
});
