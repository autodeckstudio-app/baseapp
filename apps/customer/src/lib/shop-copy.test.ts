// Guard: user-visible shop copy carries no em dashes (brand copy rule).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shop = readFileSync(`${__dirname}/../app/shop.tsx`, "utf8");

const kit = readFileSync(`${__dirname}/../ui/kit.tsx`, "utf8");

const concepts = readFileSync(`${__dirname}/../../../../packages/core/src/shop-concepts.ts`, "utf8");

describe("shop design integration", () => {
  it("is built on the shared kit, not one-off styles", () => {
    for (const part of ["PageHeader", "Pane", "Chip", "Button"]) {
      expect(shop).toMatch(new RegExp(`\\b${part}\\b`));
    }
    expect(shop).toContain('from "../ui/kit"');
    // The active filter chip follows the catalogue pattern (accent + accentHaze).
    expect(shop).toContain("colors.accentHaze");
  });
  it("keeps the shared shell and a working back path on the guest route", () => {
    // Non-tab screens must keep their onBack in the AppBar (was dropped outside tabs).
    expect(kit).toContain('{ title: appBar, back: onBackOverride }');
    expect(shop).toContain('appBar="Shop"');
    expect(shop).toContain('onBack={() => setOpen(null)}');
  });
  it("does not repeat the placeholder word in every blurb", () => {
    expect(concepts.match(/ Concept\."| Concept\`/g) ?? []).toHaveLength(0);
  });
});

describe("shop copy", () => {
  it("uses no em dashes in rendered text", () => {
    const jsxText = shop.split("\n").filter((l) => /<Text/.test(l)).join("\n");
    expect(jsxText).not.toContain("—");
  });
  it("states ordering is not open", () => {
    expect(shop).toContain("Ordering is not open yet.");
  });
});
