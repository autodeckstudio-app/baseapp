import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("Profile (concept A)", () => {
  const src = read("app/(tabs)/profile.tsx");
  it("uses the same glass pane as Home and uses one page heading", () => {
    expect(src).toContain("glassPane(");
    expect(read("ui/ProfileHero.tsx")).toContain("glassPane(");
    expect(src.split("<PageHeader").length-1).toBe(1);
    expect(src).toContain('title="Your account"');
  });
  it("each thing appears once, in order: identity, list, appearance, sign out", () => {
    expect(src).not.toContain('title="Help & contact"');
    const order = ["<ProfileHero", "<LicenceSection", "Appearance", "Delete my account", "<LegalLinks"];
    const pos = order.map((o) => src.indexOf(o));
    expect(pos.every((x) => x > 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    for (const o of ["<LegalLinks", "<ProfileHero"]) expect(src.split(o).length - 1).toBe(1);
  });
  it("no tilted card, no 3D shadow, no orange text links, no member tiles", () => {
    const h = read("ui/ProfileHero.tsx");
    expect(h).not.toMatch(/rotate|AUTODECK MEMBER|boxShadow/);
    expect(h).not.toContain("#EC8638");
  });
});
