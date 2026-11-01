import { describe, expect, it } from "vitest";
import { createProtectionSchema, updateProtectionSchema } from "../../schemas/protection.js";

// Calendar-valid dates: the YYYY-MM-DD regex alone accepts impossible dates.
const base = { vehicleId: "v1", kind: "ppf" as const };

describe("protection dateStr calendar validity", () => {
  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "2025-02-29", "2026-04-31"])(
    "rejects impossible date %s",
    (d) => {
      expect(createProtectionSchema.safeParse({ ...base, startDate: d }).success).toBe(false);
      expect(updateProtectionSchema.safeParse({ vehicleId: "v1", protectionId: "p1", expiryDate: d }).success).toBe(false);
    },
  );
  it.each(["2026-02-28", "2024-02-29", "2026-12-31"])("accepts real date %s", (d) => {
    expect(createProtectionSchema.safeParse({ ...base, startDate: d }).success).toBe(true);
  });
});
