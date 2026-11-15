import { describe, it, expect } from "vitest";
import { formatPaise } from "../../../../packages/ui/src/format";
describe("shared formatPaise", () => {
  it("finite amounts are unchanged", () => { expect(formatPaise(59000)).toBe("₹590"); expect(formatPaise(59050)).toBe("₹590.50"); expect(formatPaise(0)).toBe("₹0"); expect(formatPaise(-5000)).toBe("₹-50"); });
  it("missing, NaN, infinite or non-number amounts print '-' not ₹NaN", () => {
    for (const v of [undefined, null, NaN, Infinity, "590", {}]) expect(formatPaise(v as never)).toBe("-");
  });
});
