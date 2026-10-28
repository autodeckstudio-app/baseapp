import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("studio tab navigator history", () => {
  it("Tabs uses backBehavior=history so Back returns to the page the user came from, not the Today tab", () => {
    const s = readFileSync(join(__dirname, "../app/(tabs)/_layout.tsx"), "utf8");
    const tabsOpen = /<Tabs\b[^>]*?backBehavior="history"/s;
    expect(s).toMatch(tabsOpen);
  });
});
