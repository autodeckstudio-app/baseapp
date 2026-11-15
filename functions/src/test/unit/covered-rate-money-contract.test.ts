import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
describe("covered rate counter is not a money input", () => {
  it("dayclose/report/accountant aggregate readers never read rateLimits", () => {
    for (const file of [
      "functions/dailyclose/getDailyClose.ts",
      "functions/office/getOfficeReport.ts",
      "functions/office/getAccountantMoney.ts",
      "lib/dayAggregates.ts",
    ]) {
      const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
      expect(source).not.toMatch(/COLLECTIONS\.rateLimits|collection\(["']rateLimits/);
    }
    const limiter = readFileSync(resolve(__dirname, "../../middleware/rateLimit.ts"), "utf8");
    expect(limiter).toContain('"job.settleMembershipCovered": { limit: 60, windowMs: 60_000 }');
    expect(limiter).toContain("Promise<void>");
  });
});
