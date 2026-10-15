import { describe, it, expect } from "vitest";
import { isOfferLive } from "@autodeck/core";
import { createOfferSchema, updateOfferSchema, listOffersSchema } from "../../schemas/offer.js";

const ok = { studioId: "s", path: "t/offers/a.jpg", contentType: "image/jpeg", headline: "Monsoon check", link: { kind: "catalogue" }, startsAt: "2026-10-20T00:00:00.000Z", endsAt: "2026-11-20T00:00:00.000Z" };

describe("offer schema", () => {
  it("accepts a normal offer", () => expect(createOfferSchema.safeParse(ok).success).toBe(true));
  it("rejects an end before the start", () => expect(createOfferSchema.safeParse({ ...ok, endsAt: "2026-10-01T00:00:00.000Z" }).success).toBe(false));
  it("rejects an offer longer than 120 days", () => expect(createOfferSchema.safeParse({ ...ok, endsAt: "2027-06-01T00:00:00.000Z" }).success).toBe(false));
  it("a service link needs a service", () => {
    expect(createOfferSchema.safeParse({ ...ok, link: { kind: "service" } }).success).toBe(false);
    expect(createOfferSchema.safeParse({ ...ok, link: { kind: "service", serviceId: "menu-wash-foam" } }).success).toBe(true);
  });
  it("rejects unknown fields, bad image types and long copy", () => {
    expect(createOfferSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(createOfferSchema.safeParse({ ...ok, contentType: "video/mp4" }).success).toBe(false);
    expect(createOfferSchema.safeParse({ ...ok, headline: "x".repeat(61) }).success).toBe(false);
  });
  it("update and list are strict", () => {
    expect(updateOfferSchema.safeParse({ offerId: "o", hidden: true }).success).toBe(true);
    expect(updateOfferSchema.safeParse({ offerId: "o", startsAt: "2026-10-01T00:00:00Z" }).success).toBe(false);
    expect(listOffersSchema.safeParse({ includeAll: true }).success).toBe(true);
  });
});

describe("isOfferLive", () => {
  const o = { hidden: false, startsAt: "2026-10-20T00:00:00.000Z", endsAt: "2026-10-25T00:00:00.000Z" };
  it("only between start and end, and not hidden", () => {
    expect(isOfferLive(o, Date.parse("2026-10-19T23:59:00Z"))).toBe(false);
    expect(isOfferLive(o, Date.parse("2026-10-22T00:00:00Z"))).toBe(true);
    expect(isOfferLive(o, Date.parse("2026-10-25T00:00:00Z"))).toBe(false);
    expect(isOfferLive({ ...o, hidden: true }, Date.parse("2026-10-22T00:00:00Z"))).toBe(false);
  });
});
