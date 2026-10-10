import { describe, it, expect } from "vitest";
import { submitMyPaperSchema, submitPaperSchema, isValidDateOnly, normalizeRcReference } from "../../schemas/paper.js";

const base = { studioId: "s", vehicleId: "v" };
const parse = (o: Record<string, unknown>) => submitMyPaperSchema.safeParse({ ...base, ...o });

describe("date-only validity", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidDateOnly("2026-10-10")).toBe(true);
    expect(isValidDateOnly("2028-02-29")).toBe(true);
    for (const bad of ["22-22-2026", "2026-22-22", "2027-02-29", "2026-04-31", "2026-00-10", "2026-10-00", "2026-1-1"]) {
      expect(isValidDateOnly(bad)).toBe(false);
    }
    expect(parse({ kind: "PUC", reference: "x", expiresOn: "2026-13-01" }).success).toBe(false);
  });
  it("keeps the date string exactly as given (no timezone shift)", () => {
    const r = parse({ kind: "PUC", reference: "x", expiresOn: "2026-12-31" });
    expect(r.success && r.data.expiresOn).toBe("2026-12-31");
  });
});

describe("RC reference", () => {
  it("normalises case and separators", () => {
    expect(normalizeRcReference("gj-01 ab.1234")).toBe("GJ01AB1234");
    const r = parse({ kind: "RC", reference: "gj 01-a 1234" });
    expect(r.success && r.data.reference).toBe("GJ01A1234");
  });
  it("rejects bad structure", () => {
    for (const bad of ["GJ01ABC1234", "G01AB1234", "GJ1AB1234", "GJ01AB123", "GJ01AB12345", "0101AB1234", "GJ01121234", "hello"]) {
      expect(parse({ kind: "RC", reference: bad }).success, bad).toBe(false);
    }
  });
  it("insurance, PUC and other stay free text", () => {
    for (const kind of ["INSURANCE", "PUC", "OTHER"]) {
      const r = parse({ kind, reference: "any thing / 12 - x" });
      expect(r.success && r.data.reference).toBe("any thing / 12 - x");
    }
  });
});

describe("FASTAG", () => {
  it("is not a new customer kind, but staff/stored kind remains", () => {
    expect(parse({ kind: "FASTAG", reference: "x" }).success).toBe(false);
    expect(submitPaperSchema.safeParse({ ...base, kind: "FASTAG", reference: "x" }).success).toBe(true);
  });
});

describe("paper rejection reason", () => {
  it("trims reasons and rejects blank or excessive reasons", async () => {
    const { reviewPaperSchema } = await import("../../schemas/paper.js");
    expect(reviewPaperSchema.safeParse({ paperId: "p", decision: "REJECTED", rejectionReason: "   " }).success).toBe(false);
    expect(reviewPaperSchema.parse({ paperId: "p", decision: "REJECTED", rejectionReason: "  Expired  " }).rejectionReason).toBe("Expired");
    expect(reviewPaperSchema.safeParse({ paperId: "p", decision: "REJECTED", rejectionReason: "x".repeat(301) }).success).toBe(false);
  });
});
