import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LOGIN_PERKS } from "../ui/LoginStage";
const read = (p: string) => readFileSync(resolve(".", "src", p), "utf8");
describe("login stage", () => {
  it("rotates three perks with no invented claims, no dashes, no emoji", () => {
    expect(LOGIN_PERKS).toHaveLength(3);
    for (const p of LOGIN_PERKS) { expect(p.text).not.toMatch(/\u2014|\u2013/); expect(p.text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u); }
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
