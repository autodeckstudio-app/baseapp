import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(".", "src", p.replace(/^\.\.\//, "")), "utf8");
describe("profile licence state", () => {
  const p = read("ui/LicenceSection.tsx");
  it("an uploaded licence reads View licence, not Add, and replace is a separate themed action", () => {
    expect(p).toContain('licPhoto.state === "ready" ? "View licence" : "Add"');
    expect(p).toContain('label="Replace licence photo"');
    expect(p).toContain('label="Keep current photo"');
  });
  it("replace mode exits after save and on account switch", () => {
    expect(p).toContain("setLicReplace(false); setLicRefresh");
    expect(p).toContain("setLicOpen(false); setLicReplace(false);");
    expect(p).toContain("[scope]");
  });
  it("the You tab renders the real section with the shared save lock", () => {
    const profile = read("../app/(tabs)/profile.tsx");
    expect(profile).toContain("<LicenceSection");
    expect(profile).toContain("lock={saveLock}");
    expect(profile).toContain("epoch={generation}");
  });
});
