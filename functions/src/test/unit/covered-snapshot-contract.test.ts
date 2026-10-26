import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
describe("display-only consumed-wash snapshot contract", () => {
  it("writer adds no false field; nonmember spread is byte-identical", () => {
    const source = readFileSync(
      resolve(__dirname, "../../functions/booking/createBooking.ts"),
      "utf8",
    );
    expect(source).toContain("...(membershipWashUsed ? {membershipWashUsed:true} : {})");
    const old = { id: "job", paymentStatus: "unpaid", totalAmount: 1000 };
    const membershipWashUsed = false;
    expect(
      JSON.stringify({
        ...old,
        ...(membershipWashUsed ? { membershipWashUsed: true } : {}),
      }),
    ).toBe(JSON.stringify(old));
  });
  it("settlement, invoice and money projections never read job snapshot", () => {
    for (const f of [
      "membership-covered.ts",
      "invoice-builder.ts",
      "job-invoice.ts",
      "dayAggregates.ts",
    ])
      expect(readFileSync(resolve(__dirname, "../../lib", f), "utf8")).not.toMatch(
        /job\.membershipWashUsed/,
      );
  });
});
