import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Customer primary action contract. The owner first picked white main
// buttons (18 Oct 2026), then on 8 Nov 2026 rejected the resulting flat look
// and directed a glass language with orange as the action highlight, so the
// primary button is now one matte brand-orange fill: no gradient, no colour
// glow, dark ink label.
const kit = readFileSync(join(__dirname, "..", "ui", "kit.tsx"), "utf8");

describe("kit primary button", () => {
  it("fills the primary button with one matte brand orange, both modes", () => {
    const inkLine = kit.split("\n").find((l) => l.includes("inkButton ="));
    expect(inkLine).toBeDefined();
    expect(inkLine).toContain('backgroundColor: "#EC8638"');
    // The fill must come after the inherited shadow recipe to win.
    expect(inkLine).toMatch(/\.dark.*backgroundColor/);
  });
  it("stays matte: no gradient and no coloured glow on web", () => {
    const inkLine = kit.split("\n").find((l) => l.includes("inkButton ="));
    expect(inkLine).toContain('backgroundImage: "none"');
    expect(inkLine).not.toContain("F7A257");
    expect(inkLine).not.toMatch(/rgba\(236,134,56,0\.[4-9]/);
  });
  it("keeps the label readable with dark ink on the orange button", () => {
    expect(kit).toContain('"#231E18"');
    expect(kit).not.toContain('name === "light" ? "#FFFFFF" : "#16181C"');
  });
});
