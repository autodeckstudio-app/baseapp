import { describe, it, expect } from "vitest";
import { normaliseGiftCode } from "@autodeck/core";
import { generateGiftCode, hashGiftCode } from "../../lib/gift-code.js";
describe("gift codes", () => {
  it("generated codes are valid, random and hash stably", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) { const c = generateGiftCode(); expect(normaliseGiftCode(c)).toBe(c); seen.add(c); }
    expect(seen.size).toBe(200);
    const c = generateGiftCode();
    expect(hashGiftCode(c)).toBe(hashGiftCode(c.toLowerCase()));
    expect(hashGiftCode(c)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("a malformed code never hashes", () => expect(hashGiftCode("nope")).toBeNull());
});
