import { describe, expect, it } from "vitest";
import { shareStoryHtml, shareStoryReady } from "./share-story";

const base = { carTitle: "BMW M340i", subtitle: "2023 · Black", visits: [{ date: "10 Sept 2026", service: "Foam wash" }], protections: [{ title: "Ceramic Coating", detail: "Kovalent" }], generatedOn: "8 Nov 2026" };

describe("share story export", () => {
  it("renders visits and verified protections, escaping markup", () => {
    const h = shareStoryHtml({ ...base, carTitle: 'A <b> car "x"' });
    expect(h).toContain("Foam wash");
    expect(h).toContain("Ceramic Coating");
    expect(h).not.toContain("<b> car");
    expect(h).toContain("&lt;b&gt;");
  });
  it("never renders an image: pixel redaction (plate, people) is unverified, so no photo ships", () => {
    expect(shareStoryHtml(base)).not.toContain("<img");
    expect(shareStoryHtml(base)).not.toContain("photoUrl");
  });
  it("carries no plate, invoice, odometer or contact field", () => {
    const h = shareStoryHtml(base);
    for (const banned of ["plate", "invoice", "odometer", "km", "phone", "address"]) expect(h.toLowerCase()).not.toContain(banned);
  });
  it("omits empty sections", () => {
    const h = shareStoryHtml({ ...base, visits: [], protections: [] });
    expect(h).not.toContain("Care history");
    expect(h).not.toContain("Protection on record");
  });
  it("is ready only when there is at least one shareable fact", () => {
    expect(shareStoryReady({ visits: [], protections: [] })).toBe(false);
    expect(shareStoryReady({ visits: base.visits, protections: [] })).toBe(true);
  });
});
