import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recordWebVitalSchema } from "../../schemas/telemetry.js";

// Schema contract for the first-party RUM beacon, plus source-text wiring checks
// (same honest approach as app-check-coverage.test.ts: onCall options are not
// introspectable at runtime, so the source itself is checked).
describe("recordWebVitalSchema", () => {
  const good = {
    app: "customer",
    name: "LCP",
    value: 1234.5,
    rating: "good",
    page: "/bookings",
    navigationType: "navigate",
  };

  it("accepts a valid beacon", () => {
    expect(recordWebVitalSchema.safeParse(good).success).toBe(true);
  });

  it("accepts a beacon without navigationType", () => {
    const { navigationType: _omit, ...rest } = good;
    expect(recordWebVitalSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects unknown metric names", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, name: "FID" }).success).toBe(false);
  });

  it("rejects negative or unbounded values", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, value: -1 }).success).toBe(false);
    expect(recordWebVitalSchema.safeParse({ ...good, value: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(recordWebVitalSchema.safeParse({ ...good, value: 3_600_001 }).success).toBe(false);
  });

  it("rejects extra keys (strict)", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, debug: true }).success).toBe(false);
  });

  it("rejects over-long page paths", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, page: `/${"a".repeat(200)}` }).success).toBe(false);
  });
});

describe("recordWebVital wiring", () => {
  const src = readFileSync(join(__dirname, "../../functions/customer/recordWebVital.ts"), "utf8");

  it("is pinned to asia-south1 and App Check-wired", () => {
    expect(src).toContain('region: "asia-south1"');
    expect(src).toContain("enforceAppCheck: shouldEnforceAppCheck()");
  });

  it("requires an authenticated user and is rate limited", () => {
    expect(src).toContain("extractUser(request)");
    expect(src).toContain('"telemetry.webVital"');
  });
});
