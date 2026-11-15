import { describe, it, expect } from "vitest";
import { formatPaise } from "./format";

// TEST. Display guard: non-finite or non-number amounts print "-" (never "₹NaN"); finite values print as before.
describe("formatPaise guard", () => {
  it("prints a dash for missing or non-finite input", () => {
    for (const v of [NaN, undefined, null, Infinity, -Infinity, "15000"]) expect(formatPaise(v as unknown as number)).toBe("-");
  });
  it("leaves finite values unchanged", () => {
    expect(formatPaise(0)).toBe("₹0");
    expect(formatPaise(89900)).toBe("₹899");
    expect(formatPaise(150050)).toBe("₹1,500.50");
  });
});
