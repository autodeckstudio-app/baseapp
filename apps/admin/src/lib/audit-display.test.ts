import { describe, it, expect } from "vitest";
import type { AuditLog } from "@autodeck/core";
import { auditActor, auditTarget, auditVerb } from "./audit-display";
const entry = { entityType: "booking", entityId: "b1", action: "booking.confirmed", performedBy: "u1", performedByRole: "admin", metadata: {}, before: null, after: null } as AuditLog;
describe("readable audit entries", () => {
  it("uses known names and linked record labels", () => {
    expect(auditActor(entry, { u1: "Meet" })).toBe("Meet");
    expect(auditTarget(entry, { "booking:b1": "booking for MH40CQ3187" })).toEqual({ label: "booking for MH40CQ3187", href: "/bookings/b1" });
    expect(auditVerb(entry)).toBe("confirmed");
  });
  it("reads rejected papers as a decision", () => expect(auditVerb({ ...entry, action: "paper.reviewed", after: { status: "REJECTED" } })).toBe("rejected"));
  it("never prints an entire opaque actor uid", () => expect(auditActor({ ...entry, performedBy: "long-opaque-account-id" }, {})).toBe("Account long-opa"));
});
