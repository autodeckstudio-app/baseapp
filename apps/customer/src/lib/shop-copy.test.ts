// Guard: user-visible shop copy carries no em dashes (brand copy rule).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shop = readFileSync(new URL("../app/shop.tsx", import.meta.url), "utf8");

describe("shop copy", () => {
  it("uses no em dashes in rendered text", () => {
    const jsxText = shop.split("\n").filter((l) => /<Text/.test(l)).join("\n");
    expect(jsxText).not.toContain("—");
  });
  it("states ordering is not open", () => {
    expect(shop).toContain("Ordering is not open yet.");
  });
});
