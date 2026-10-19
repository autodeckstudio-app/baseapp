import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Bugs seen live at 390px: job cards stopped at about 80% width, the page sat inside a rounded
// frame with its own scrollbar, and the tab bar showed icons without names.
describe("studio phone layout contract", () => {
  it("Today stacks its lists full width on a phone", () => {
    expect(read("app/(tabs)/index.tsx")).toMatch(/alignItems: wide \? "flex-start" : "stretch"/);
  });
  it("the web canvas is full bleed on a phone (no frame inside the phone)", () => {
    const s = read("app/_layout.tsx");
    expect(s).toMatch(/top: phone \? 0 : 16/);
    expect(s).toMatch(/borderRadius: phone \? 0 : 44/);
  });
  it("every tab has a visible name", () => {
    const s = read("app/(tabs)/_layout.tsx");
    for (const n of ["Today", "Bays", "Calendar", "Lookup", "Account"]) expect(s).toContain(`"${n}"`);
    expect(s).toMatch(/labels=\{TAB_LABEL\}/);
  });
});
