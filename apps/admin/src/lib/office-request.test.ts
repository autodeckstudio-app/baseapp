import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ADMIN_APPROVAL_REVIEW_ENABLED } from "./backend-features";
import { checkDecision, sortNewestFirst, targetLink, DECISION_NOTE, type OfficeRequestRow } from "./office-request-rules";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
const base = { tenantId: "t", studioId: "s", reason: "r", amountPaise: null, status: "pending" as const };
describe("office review of staff requests", () => {
  it("gate is on: backend requestAdminApproval/respondToAdminApproval + adminApprovalRequests rules are live (2026-10-26 deploy, main-held activation vehicle)", () => { expect(ADMIN_APPROVAL_REVIEW_ENABLED).toBe(true); });
  it("the gated page returns before any query or callable is reachable", () => {
    const p = src("../app/(admin)/office-requests/page.tsx");
    expect(p.indexOf("if (!ADMIN_APPROVAL_REVIEW_ENABLED)")).toBeLessThan(p.indexOf("<Review />"));
    expect(p.match(/function Review\(\)/)).toBeTruthy();
    expect(p.slice(0, p.indexOf("function Review()"))).not.toMatch(/listenToOfficeRequests\(/);
  });
  it("reads by tenantId only with no orderBy, and calls only respondToAdminApproval", () => {
    const s = src("./office-request-service.ts");
    expect(s).toContain('where("tenantId", "==", tenantId)');
    expect(s).not.toContain("orderBy");
    expect(s).toContain('"respondToAdminApproval"');
    expect(s).not.toMatch(/recordManualPayment|refund|updateDoc|setDoc|addDoc/i);
  });
  it("sorts newest first and links only safe targets", () => {
    expect(sortNewestFirst([{ ...base, id: "a", targetType: "job", targetId: "j", createdAt: 1 }, { ...base, id: "b", targetType: "job", targetId: "j", createdAt: 9 }]).map((r: OfficeRequestRow) => r.id)).toEqual(["b", "a"]);
    expect(targetLink({ targetType: "job", targetId: "j1" })).toEqual({ href: "/jobs/j1", label: "Open job" });
    expect(targetLink({ targetType: "booking", targetId: "../x" })).toBeNull();
    expect(targetLink({ targetType: "none", targetId: null })).toBeNull();
  });
  it("validates decisions and keeps the record-only wording", () => {
    expect(checkDecision("approved", "")).toBeNull();
    expect(checkDecision("refund", "")).not.toBeNull();
    expect(checkDecision("rejected", "x".repeat(301))).not.toBeNull();
    expect(DECISION_NOTE).toMatch(/does not refund, discount or change any price or payment/);
  });
});
