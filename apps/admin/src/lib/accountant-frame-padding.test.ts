import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// TEST (source guard, layout only): the accountant frame's main area keeps the same side padding as its header.
const src = readFileSync(join(__dirname, "../app/(admin)/layout.tsx"), "utf8");
describe("accountant frame", () => {
  it("pads the main content like the header", () => {
    expect(src).toContain('<main style={{ padding: "0 var(--ad-space-section) var(--ad-space-section)" }}>');
  });
});
