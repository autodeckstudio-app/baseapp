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
    page: "/bookings/:id",
    navigationType: "navigate",
    metrics: { LCP: { value: 1234.5, rating: "good" }, CLS: { value: 0.04, rating: "good" } },
  };

  it("accepts a valid coalesced beacon", () => {
    expect(recordWebVitalSchema.safeParse(good).success).toBe(true);
  });

  it("rejects an empty metrics object (no empty writes)", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, metrics: {} }).success).toBe(false);
  });

  it("rejects unknown metric names and bad ratings", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, metrics: { FID: { value: 1, rating: "good" } } }).success).toBe(false);
    expect(recordWebVitalSchema.safeParse({ ...good, metrics: { LCP: { value: 1, rating: "ok" } } }).success).toBe(false);
  });

  it("rejects negative or unbounded values", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, metrics: { LCP: { value: -1, rating: "poor" } } }).success).toBe(false);
    expect(recordWebVitalSchema.safeParse({ ...good, metrics: { LCP: { value: Number.POSITIVE_INFINITY, rating: "poor" } } }).success).toBe(false);
  });

  it("rejects extra keys (strict) and over-long pages", () => {
    expect(recordWebVitalSchema.safeParse({ ...good, debug: true }).success).toBe(false);
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

  it("carries a TTL-compatible expireAt field for the retention policy", () => {
    expect(src).toContain("expireAt");
    expect(src).toContain("Timestamp.fromMillis");
  });
});
