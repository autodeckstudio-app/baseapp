// Guards the dev catalogue sample against claim drift: the sample is generated from the
// canonical service-details JSON with the same merge as the copy-fit harness and the
// live-write prep (name = proposed_name ?? live name, description = proposed_description),
// and these assertions fail if the sample is hand-edited or regenerated inconsistently.
import { describe, expect, it } from "vitest";
import { devCatalogueSeed } from "./catalogue-dev-sample";

describe("catalogue-dev-sample", () => {
  it("applies the canonical proposed_name merge (no live durability-tier title survives)", () => {
    const graphene = devCatalogueSeed.find((r) => r.id === "menu-coat-kovalent-graphene");
    expect(graphene?.name).toBe("Kovalent Graphene");
    expect(devCatalogueSeed.some((r) => /Graphene 7-year/.test(r.name))).toBe(false);
  });

  it("carries no banned claim strings in names or descriptions", () => {
    for (const r of devCatalogueSeed) {
      const text = `${r.name}\n${r.description}`;
      expect(text.toLowerCase()).not.toContain("flagship");
      expect(text.toLowerCase()).not.toContain("guarantee");
      expect(text.toLowerCase()).not.toContain("lifetime");
    }
  });

  it("qualifies every durability/warranty mention as a manufacturer claim, never an AutoDeck warranty", () => {
    for (const r of devCatalogueSeed) {
      for (const line of r.description.split("\n")) {
        if (/warranty/i.test(line) || /\d+\s*-?\s*years?/i.test(line)) {
          expect(line).toContain("manufacturer claim");
          expect(line).toContain("not an AutoDeck warranty");
        }
      }
    }
  });

  it("has one row per canonical branded record, all enquiry/consult priced or quote-on-request", () => {
    expect(devCatalogueSeed).toHaveLength(42);
    for (const r of devCatalogueSeed) {
      expect(r.consult === true || r.rupees > 0).toBe(true);
    }
  });
});
