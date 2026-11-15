import { describe, it, expect, vi } from "vitest";
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "admin" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({
  collection: (name: string) => ({ doc: (id?: string) => ({ key: `${name}/${id ?? "new"}`, id: id ?? "new" }) }),
}) }));
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { createServiceSchema } from "../../schemas/service.js";
import { createService } from "../../functions/service/createService.js";

const baseService = {
  name: "Wash", category: "washing", brand: null, description: "d",
  basePrice: 100, estimatedDurationMinutes: 60, warrantyLabel: null,
};

describe("input resource guardrails", () => {
  it("passes normal valid input through unchanged", () => {
    const out = validate(createServiceSchema, { ...baseService, careTips: ["a", "b"] });
    expect(out.name).toBe("Wash");
    expect(out.careTips).toEqual(["a", "b"]);
  });

  it("keeps the ordinary invalid-argument contract with field paths", () => {
    try {
      validate(createServiceSchema, { ...baseService, basePrice: -5 });
      expect.unreachable();
    } catch (err: any) {
      expect(err.code).toBe("invalid-argument");
      expect(err.message).toContain("basePrice");
    }
  });

  it("accepts known-legitimate array sizes (photo batches, id lists, order lines)", () => {
    const schema = z.object({ ids: z.array(z.string().min(1)).max(300) });
    expect(validate(schema, { ids: Array(20).fill("photo-ref") }).ids).toHaveLength(20); // inspection photos
    expect(validate(schema, { ids: Array(50).fill("booking-id") }).ids).toHaveLength(50); // purge id list
    expect(validate(schema, { ids: Array(300).fill("order-line") }).ids).toHaveLength(300); // largest declared bound
  });

  it("rejects an over-budget array BEFORE schema parsing (safeParse spy not called)", () => {
    const spy = vi.spyOn(createServiceSchema, "safeParse");
    const oversized = { ...baseService, vehicleCategoryPricing: Array(1001).fill({ vehicleCategory: "suv", additionalPricePaise: 0, additionalMinutes: 0 }) };
    try {
      validate(createServiceSchema, oversized);
      expect.unreachable();
    } catch (err: any) {
      expect(err.code).toBe("invalid-argument");
      expect(err.message).toContain("1000-item input budget");
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("counts UTF-8 bytes, not UTF-16 units: multibyte payload over 1MB UTF-8 is rejected", () => {
    const spy = vi.spyOn(createServiceSchema, "safeParse");
    // 340k Han chars: 340,000 UTF-16 code units (under 1,000,000) but ~1,020,000 UTF-8 bytes (over budget)
    const big = { ...baseService, description: "汉".repeat(340_000) };
    try {
      validate(createServiceSchema, big);
      expect.unreachable();
    } catch (err: any) {
      expect(err.code).toBe("invalid-argument");
      expect(err.message).toContain("input resource budget");
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("accepts a payload just under the UTF-8 budget", () => {
    // The canonical createServiceSchema caps description at 2000 chars (product
    // input policy); this probe extends ONLY that field so the test exercises
    // validate()'s UTF-8 byte budget, not the schema's per-field cap.
    const budgetProbe = createServiceSchema.extend({ description: z.string() });
    const ok = { ...baseService, description: "x".repeat(900_000) };
    expect(validate(budgetProbe, ok).description).toHaveLength(900_000);
  });

  it("rejects excessive nesting depth and accepts ordinary nesting", () => {
    let deep: any = { leaf: 1 };
    for (let i = 0; i < 40; i++) deep = { child: deep };
    const schema = z.object({ child: z.any() });
    expect(() => validate(schema, deep)).toThrowError(/input resource budget/);
    let shallow: any = { leaf: 1 };
    for (let i = 0; i < 10; i++) shallow = { child: shallow };
    expect(validate(z.object({ child: z.any() }), shallow).child).toBeTruthy();
  });

  it("fails closed on cyclic input instead of recursing or hanging", () => {
    const cyclic: any = { ...baseService };
    cyclic.self = cyclic;
    expect(() => validate(createServiceSchema, cyclic)).toThrowError(/not plain JSON/);
  });

  it("bounds total nodes across many keys without full key-array allocation", () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 25_000; i++) wide[`k${i}`] = i;
    expect(() => validate(z.object({}).strict().passthrough(), wide)).toThrowError(/input resource budget/);
  });

  it("runs authentication before any parsing on createService (spy proves safeParse never ran)", async () => {
    const spy = vi.spyOn(createServiceSchema, "safeParse");
    const oversized = { ...baseService, vehicleCategoryPricing: Array(5000).fill({ vehicleCategory: "suv", additionalPricePaise: 0, additionalMinutes: 0 }) };
    await expect(createService.run({ data: oversized } as any)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("diagnostic sanitization", () => {
  it("never echoes an attacker-controlled enum value in error text", () => {
    const SENTINEL = "PRIVATE-SENTINEL-9f3a7c";
    try {
      validate(createServiceSchema, { ...baseService, category: SENTINEL });
      expect.unreachable();
    } catch (err: any) {
      expect(err.code).toBe("invalid-argument");
      expect(err.message).not.toContain(SENTINEL);
      expect(err.message).toContain("category"); // field path preserved
    }
  });

  it("sanitizes attacker key names in strict-mode paths", () => {
    const SENTINEL = "evil key \"><script>";
    try {
      validate(z.object({ a: z.string() }).strict(), { a: "x", [SENTINEL]: 1 });
      expect.unreachable();
    } catch (err: any) {
      expect(err.message).not.toContain(SENTINEL);
      expect(err.message).toContain("Unrecognized key(s)");
    }
  });

  it("caps issue count and total output bytes", () => {
    const schema = z.object({ items: z.array(z.object({ n: z.number() })) });
    const bad = { items: Array(200).fill({ n: "not-a-number" }) }; // 200 issues, under array budget
    try {
      validate(schema, bad);
      expect.unreachable();
    } catch (err: any) {
      expect(err.code).toBe("invalid-argument");
      expect(err.message).toContain("items.0.n"); // first issue path preserved
      expect(err.message).toContain("(200 total)");
      expect(err.message.length).toBeLessThanOrEqual(4_200); // hard output ceiling + marker
    }
  });
});
