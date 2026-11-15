import { describe, expect, it } from "vitest";
import { offerFormError } from "./offer-form";
const now = Date.parse("2026-10-16T00:00:00Z");
const good = { headline: "Monsoon check", startsAt: "2026-10-17T00:00:00Z", endsAt: "2026-11-17T00:00:00Z", linkKind: "catalogue", serviceId: "", hasImage: true };
describe("offerFormError", () => {
  it("passes a good form", () => expect(offerFormError(good, now)).toBeNull());
  it("needs an image, a headline and a sane range", () => {
    expect(offerFormError({ ...good, hasImage: false }, now)).toMatch(/image/);
    expect(offerFormError({ ...good, headline: "ab" }, now)).toMatch(/headline/);
    expect(offerFormError({ ...good, endsAt: "2026-10-16T12:00:00Z", startsAt: "2026-10-17T00:00:00Z" }, now)).toMatch(/after/);
    expect(offerFormError({ ...good, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-10T00:00:00Z" }, now)).toMatch(/past/);
    expect(offerFormError({ ...good, endsAt: "2027-06-01T00:00:00Z" }, now)).toMatch(/120/);
  });
  it("a service link needs a service", () => expect(offerFormError({ ...good, linkKind: "service" }, now)).toMatch(/service/));
});
