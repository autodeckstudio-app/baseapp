import { describe, it, expect } from "vitest";
import { rupees } from "./money";
describe("rupees", () => {
  it("shows whole amounts without decimals", () => { expect(rupees(59000)).toBe("\u20b9590"); });
  it("always shows two decimals for part rupees", () => {
    expect(rupees(132750)).toBe("\u20b91,327.50");
    expect(rupees(59005)).toBe("\u20b9590.05");
  });
  it("groups lakhs the Indian way", () => { expect(rupees(14500000)).toBe("\u20b91,45,000"); });
});
