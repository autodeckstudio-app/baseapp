// Track B: shared abuse limiter + shop deployment guards (fresh).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hitLimiter, limiterKey } from "../../lib/shop-rate-limit.js";
import { fakeFirestore } from "./fake-firestore.js";

const RULE = { limit: 10, windowMs: 60_000 } as const;

describe("shared abuse limiter", () => {
  it("counts exactly and denies hit 11 within the window", async () => {
    const { db } = fakeFirestore();
    for (let i = 1; i <= 10; i++) {
      expect((await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-1", rule: RULE })).allowed).toBe(true);
    }
    const over = await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-1", rule: RULE });
    expect(over.allowed).toBe(false);
    expect(over.retryAfterMs).toBeGreaterThan(0);
  });

  it("shares one count across callers (two 'instances', one store)", async () => {
    const { db, data } = fakeFirestore();
    // Two separate logical instances hitting the same backing store.
    for (let i = 0; i < 6; i++) await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-2", rule: RULE });
    for (let i = 0; i < 4; i++) await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-2", rule: RULE });
    expect((await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-2", rule: RULE })).allowed).toBe(false);
    expect(Object.keys(data["shopRateLimits"] ?? {})).toHaveLength(1);
  });

  it("a new window resets the count", async () => {
    const { db } = fakeFirestore();
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-3", rule: RULE, nowMs: t0 + i });
    expect((await hitLimiter(db, { scope: "placeGuestOrder", rawId: "key-3", rule: RULE, nowMs: t0 + 61_000 })).allowed).toBe(true);
  });

  it("scopes and keys are isolated, and stored ids are hashed", async () => {
    const { db, data } = fakeFirestore();
    await hitLimiter(db, { scope: "placeGuestOrder", rawId: "secret-client-key", rule: RULE });
    await hitLimiter(db, { scope: "otherScope", rawId: "secret-client-key", rule: RULE });
    expect(limiterKey("placeGuestOrder", "secret-client-key")).not.toBe(limiterKey("otherScope", "secret-client-key"));
    for (const key of Object.keys(data["shopRateLimits"] ?? {})) {
      expect(key).not.toContain("secret-client-key");
      expect(key).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});

describe("shop deployment guards", () => {
  it("the guest-order callable is NOT exported (cannot deploy)", () => {
    const index = readFileSync(`${__dirname}/../../index.ts`, "utf8");
    expect(index).not.toContain("placeGuestOrder");
    expect(index).not.toContain("functions/shop");
  });
  it("firestore.rules keeps shopRateLimits server-only", () => {
    const rules = readFileSync(`${__dirname}/../../../../firestore.rules`, "utf8");
    const block = rules.indexOf("match /shopRateLimits/{key}");
    expect(block).toBeGreaterThan(-1);
    expect(rules.slice(block, block + 120)).toContain("allow read, write: if false;");
  });
});
