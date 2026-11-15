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
  it("builds (never guesses HEAD~1) when the base commit is unknown", () => {
    const s = readFileSync(join(root, "scripts/vercel-ignore.sh"), "utf8");
    // Guard intent unchanged: the skip/build diff base is always VERCEL_GIT_PREVIOUS_SHA,
    // verified by cat-file, and a missing base BUILDS. No skip decision may diff against
    // HEAD~1/HEAD^ (a multi-commit push would then skip an app whose changes sit further back).
    expect(s).not.toMatch(/git diff[^\n]*HEAD[~^]/);
    expect(s).toMatch(/cat-file -e[^\n]*\|\| exit 1/);
    // The one permitted HEAD~1 use is the audited site release-marker parent check: it
    // resolves HEAD's exact parent and diffs parent..HEAD restricted to this script and
    // the marker, never as a relevance base. Pin every literal use to that mechanism.
    const headTildeUses = s.split("\n").filter((l) => !l.trimStart().startsWith("#") && (l.includes("HEAD~1") || l.includes("HEAD^")));
    expect(headTildeUses.length).toBeGreaterThan(0);
    for (const l of headTildeUses) expect(l).toMatch(/parent_sha|release_parent|parent=/);
  });
  it("never builds for docs, functions or rules alone", () => {
    const s = readFileSync(join(root, "scripts/vercel-ignore.sh"), "utf8");
    expect(s.split("\n").filter((l) => /paths=/.test(l)).join()).not.toMatch(/functions|rules/);
    expect(s).toMatch(/\\\.md\$/);
  });
});
