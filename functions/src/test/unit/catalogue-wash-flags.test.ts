import { describe, expect, it } from "vitest";
import { buildCatalogueDraft, cataloguePayloadSchema, reviewCatalogueDraft } from "../../lib/catalogue-draft.js";
import { createServiceSchema, updateServiceSchema } from "../../schemas/service.js";

// Duplicate-wash prompt flags: optional booleans, set per service by Admin, absent = false. They carry no resource
// or duration (preparation is staff-managed) and are never derived from category or name.
const payload = { name: "Regular Wash", category: "washing" as const, brand: null, description: "Exterior wash", basePrice: 50000, estimatedDurationMinutes: 45, warrantyLabel: null };
const review = (extra: Record<string, unknown>) => {
  const draft = buildCatalogueDraft({ id: "d", tenantId: "automodz", actor: "owner", now: "now", existing: null, input: { serviceId: "svc", expectedServiceUpdatedAt: "old", expectedDraftVersion: 0, payload: { ...payload, ...extra } } });
  return reviewCatalogueDraft(draft, { actor: "owner", now: "now", expectedVersion: 1, currentServiceUpdatedAt: "old", trustedPublicRowHash: "a".repeat(64) });
};

describe("catalogue duplicate-wash flags", () => {
  it("are optional booleans in the draft, create and update schemas, and reject non-booleans", () => {
    expect(cataloguePayloadSchema.parse({ ...payload, standaloneExteriorWash: true, includesExteriorWash: false })).toMatchObject({ standaloneExteriorWash: true, includesExteriorWash: false });
    expect(cataloguePayloadSchema.parse(payload)).not.toHaveProperty("standaloneExteriorWash");
    expect(createServiceSchema.safeParse({ ...payload, includesExteriorWash: true }).success).toBe(true);
    expect(updateServiceSchema.safeParse({ serviceId: "svc", standaloneExteriorWash: false }).success).toBe(true);
    for (const bad of ["yes", 1, null]) {
      expect(cataloguePayloadSchema.safeParse({ ...payload, standaloneExteriorWash: bad }).success).toBe(false);
      expect(updateServiceSchema.safeParse({ serviceId: "svc", includesExteriorWash: bad }).success).toBe(false);
    }
  });

  it("are covered by the review hash: a changed flag is a different reviewed version; absent stays identical", () => {
    const absent = review({}).reviewHash;
    expect(review({}).reviewHash).toBe(absent);
    const standalone = review({ standaloneExteriorWash: true }).reviewHash;
    expect(standalone).not.toBe(absent);
    expect(review({ standaloneExteriorWash: false }).reviewHash).not.toBe(standalone);
    expect(review({ includesExteriorWash: true }).reviewHash).not.toBe(standalone);
    expect(review({ standaloneExteriorWash: true }).payload).toMatchObject({ standaloneExteriorWash: true });
  });
});
