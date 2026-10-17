import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(".", "src", p), "utf8");
describe("login stage", () => {
  it("rotates three perks with no invented claims, no dashes, no emoji", () => {
    const block = read("ui/LoginStage.tsx").split("LOGIN_PERKS")[1]!.split("];")[0]!;
    const texts = [...block.matchAll(/text: "([^"]+)"/g)].map((m) => m[1]!);
    expect(texts).toHaveLength(3);
    // One line at 320px wide: card inner is about 230px, 15px bold fits about 24 characters.
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(24);
    expect(read("ui/LoginStage.tsx")).toMatch(/numberOfLines=\{1\}[^>]*>\{perk\.text\}/);
    for (const t of texts) { expect(t).not.toMatch(/\u2014|\u2013/); expect(t).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u); }
  });
  it("respects Reduce Motion and keeps the photo unblurred", () => {
    const s = read("ui/LoginStage.tsx");
    expect(s).toContain("useReduceMotion"); expect(s).toMatch(/if \(reduce\) return;/);
    expect(s).toContain("KenBurns"); expect(s).not.toMatch(/blur\(\d+px\)[^\n]*sceneImagery/);
  });
  it("keeps Google-only sign-in and the legal links", () => {
    const s = read("ui/LoginStage.tsx"); expect(s).toContain("Google sign-in only"); expect(s).toContain("LegalLinks");
  });
});
