import { describe, it, expect } from "vitest";
import { decidePaper } from "../../lib/paper-verification.js";
const check = (text: string, confidence = 96) => decidePaper(text, confidence, "PUC", "GJ01AB1234", "2026-10-10");
describe("evidence-only paper decisions", () => {
  it("approves a readable matching valid PUC", () => expect(check("Pollution Under Control GJ01AB1234 Valid upto: 31/12/2026").status).toBe("VERIFIED"));
  it("sends expired documents to review, same-day validity is valid", () => {
    expect(check("PUC GJ01AB1234 Expiry date: 09/10/2026").status).toBe("PENDING");
    expect(check("PUC GJ01AB1234 Expiry date: 10/10/2026").status).toBe("VERIFIED");
  });
  it("sends a mismatched plate to review with the reason", () => { const d = check("PUC MH40CQ3187 valid to 31-12-2026"); expect(d.status).toBe("PENDING"); expect(d.reason).toContain("does not match"); });
  it("routes ambiguous, unreadable and unsupported evidence to review", () => {
    for (const text of ["", "PUC GJ01AB1234 31/12/2026", "PUC GJ01AB1234 valid to 31/02/2026", "PUC GJ01AB1234 valid to 31/12/26", "PUC GJ01AB1234 MH40CQ3187 valid to 31/12/2026", "PUC GJ01AB1234 valid to 31/12/2026 expires 31/12/2027"]) expect(check(text).status).toBe("PENDING");
    expect(check("PUC GJ01AB1234 valid to 31/12/2026", 60).status).toBe("PENDING");
    expect(decidePaper("Insurance GJ01AB1234 expiry 2027-01-01", 95, "INSURANCE", "GJ01AB1234", "2026-10-10").status).toBe("VERIFIED");
  });
});
