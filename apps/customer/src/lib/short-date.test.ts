import { describe, it, expect } from "vitest";
import { shortDate } from "../../../../packages/ui/src/components/shortDate";
describe("shortDate", () => {
  it("formats ISO dates without raw ISO text", () => {
    expect(shortDate("2026-10-18")).toBe("18 Oct");
    expect(shortDate("junk")).toBe("junk");
  });
});
