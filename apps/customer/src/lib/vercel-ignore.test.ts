import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard: every app must skip Vercel builds when nothing it uses changed.
// Builds are capped, so an app without this rule burns the cap on every push.
const root = join(__dirname, "../../../..");

describe("vercel ignored-build rule", () => {
  it("has the shared script", () => {
    expect(existsSync(join(root, "scripts/vercel-ignore.sh"))).toBe(true);
  });
  for (const app of ["customer", "admin", "studio", "site"]) {
    it(`${app} uses ignoreCommand`, () => {
      const cfg = JSON.parse(readFileSync(join(root, `apps/${app}/vercel.json`), "utf8"));
      expect(cfg.ignoreCommand).toBe(`bash ../../scripts/vercel-ignore.sh ${app}`);
    });
  }
  it("never builds for docs, functions or rules alone", () => {
    const s = readFileSync(join(root, "scripts/vercel-ignore.sh"), "utf8");
    expect(s.split("\n").filter((l) => /paths=/.test(l)).join()).not.toMatch(/functions|rules/);
    expect(s).toMatch(/\\\.md\$/);
  });
});
