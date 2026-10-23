import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Owner design choice for the customer app (Meet, 18 Oct iMessage, option 1:
// white main buttons, orange reserved for active navigation and small
// highlights), confirmed by the connected Instinct from its user's original
// messages with locators (phonemsg-01M56KYTSGE053B53J9JR6PDST in
// phoneconv-01M0NBXH0TC5NETW2EGQ3PEBST). The kit primary button must not fall
// back to the charcoal fill.
const kit = readFileSync(join(__dirname, "..", "ui", "kit.tsx"), "utf8");

describe("kit primary button", () => {
  it("fills the primary button white in day mode", () => {
    expect(kit).toContain('mode === "light" ? "#FFFFFF" : "#F3F1ED"');
  });
  it("never uses the charcoal fill for the primary action", () => {
    const inkLine = kit.split("\n").find((l) => l.includes("inkButton ="));
    expect(inkLine).toBeDefined();
    // The white override must come after the inherited shadow recipe to win.
    expect(inkLine).toMatch(/\.dark.*backgroundColor/);
  });
  it("keeps the label readable with dark ink on the white button", () => {
    expect(kit).not.toContain('name === "light" ? "#FFFFFF" : "#16181C"');
  });
});
