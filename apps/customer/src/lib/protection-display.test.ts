import { describe, it, expect } from "vitest";
import { protectionDetail, protectionChip, protectionChipFor, protectionRecordTitle, isCustomerEditable, isOwnSelfDeclared, isSelfDeclared, isCurrentProtection, protectionLifecycleLabel, PROTECTION_KIND_LABELS, sortProtectionHistory } from "./protection-display";
import type { Protection } from "@autodeck/core";

const fmt = (iso: string) => iso;
const base = { id: "p", tenantId: "t", vehicleId: "v", customerId: "c", kind: "ppf" as const, provider: null, policyNumber: null, startDate: null, expiryDate: null, documentUrl: null, status: "unverified" as const, verifiedBy: null, verifiedAt: null, notes: null, createdAt: "x", updatedAt: "x" };

describe("protection display", () => {
  it("labels the cosmetic kinds", () => {
    expect(PROTECTION_KIND_LABELS.ppf).toBe("Paint Protection Film");
    expect(PROTECTION_KIND_LABELS.ceramic).toBe("Ceramic Coating");
  });
  it("marks self-declared entries as Added by you and shows years without an expiry", () => {
    const p: Protection = { ...base, source: "customer", provider: "Garware", warrantyYears: 5 };
    expect(isSelfDeclared(p)).toBe(true);
    expect(protectionChip(p)).toBe("Added by you");
    expect(protectionDetail(p, fmt)).toBe("Garware · Reported warranty: 5 years, not verified");
    expect(protectionDetail(p, fmt)).not.toContain("Expires");
  });
  it("never derives an expiry from years + start date", () => {
    const p: Protection = { ...base, source: "customer", warrantyYears: 5, startDate: "2025-06-01" };
    expect(protectionDetail(p, fmt)).toBe("Reported warranty: 5 years, not verified · since 2025-06-01");
  });
  it("shows expiry only when one is actually stored, and years are always on-record, never an affirmed warranty", () => {
    const p: Protection = { ...base, status: "verified", expiryDate: "2030-06-01" };
    expect(protectionDetail(p, fmt)).toBe("Expires 2030-06-01");
    expect(protectionChip(p)).toBe("On record"); // status verified but no verifiedBy/verifiedAt evidence
    // Even a verified studio record's years are only what the record says:
    // record verification checks the record, never the coverage.
    const w: Protection = { ...base, status: "verified", warrantyYears: 5 };
    expect(protectionDetail(w, fmt)).toBe("Warranty on record: 5 years");
  });

  it("history sorts newest end first; invalid or missing dates never dominate", () => {
    const mk = (id: string, lifecycleAt?: string) => ({ ...base, id, lifecycle: "removed", lifecycleAt } as Protection);
    const sorted = sortProtectionHistory([mk("undated", "not-a-date"), mk("old", "2026-01-01"), mk("new", "2026-10-20"), mk("missing")]);
    expect(sorted.map((p) => p.id)).toEqual(["new", "old", "undated", "missing"]);
    // Stable among undated rows.
    const stable = sortProtectionHistory([mk("u1"), mk("d", "2026-05-05"), mk("u2", "garbage")]);
    expect(stable.map((p) => p.id)).toEqual(["d", "u1", "u2"]);
  });
  it("labels only what the record proves: evidence-gated record verification, neutral otherwise, no coverage claim", () => {
    const v = { verifiedBy: "staff-1", verifiedAt: "2026-01-01" };
    expect(protectionChip({ ...base, kind: "insurance", source: "autodeck", status: "verified", ...v })).toBe("Record verified");
    expect(protectionChip({ ...base, kind: "insurance", status: "verified", ...v })).toBe("Record verified");
    expect(protectionChip({ ...base, kind: "insurance", status: "verified" })).toBe("On record"); // no evidence, no "verified"
    expect(protectionChip({ ...base, kind: "insurance", source: "autodeck", status: "unverified" })).toBe("On record");
    expect(protectionChip({ ...base, source: "customer", status: "verified" })).toBe("Added by you");
  });
  it("verification evidence requires the verifier+timestamp PAIR: blank, missing, or unparseable parts stay On record", () => {
    const k = { ...base, kind: "insurance" as const, status: "verified" as const };
    expect(protectionChip({ ...k, verifiedBy: "staff-1", verifiedAt: "2026-01-01" })).toBe("Record verified");
    expect(protectionChip({ ...k, verifiedBy: "", verifiedAt: "2026-01-01" })).toBe("On record"); // blank verifier
    expect(protectionChip({ ...k, verifiedBy: "   ", verifiedAt: "2026-01-01" })).toBe("On record"); // whitespace verifier
    expect(protectionChip({ ...k, verifiedBy: "staff-1", verifiedAt: null })).toBe("On record"); // verifier alone
    expect(protectionChip({ ...k, verifiedBy: null, verifiedAt: "2026-01-01" })).toBe("On record"); // timestamp alone
    expect(protectionChip({ ...k, verifiedBy: "staff-1", verifiedAt: "not-a-date" })).toBe("On record"); // unparseable timestamp
  });
  it("issuer wording names the issuer appropriate to the kind", () => {
    const v = { status: "verified" as const, verifiedBy: "staff-1", verifiedAt: "2026-01-01" };
    expect(protectionDetail({ ...base, kind: "insurance", ...v }, fmt)).toContain("not insurer confirmation");
    expect(protectionDetail({ ...base, kind: "fasttag", ...v }, fmt)).toContain("not issuing bank confirmation");
    expect(protectionDetail({ ...base, kind: "puc", ...v }, fmt)).toContain("not testing centre confirmation");
    expect(protectionDetail({ ...base, kind: "rc", ...v }, fmt)).toContain("not RTO confirmation");
    expect(protectionDetail({ ...base, kind: "extended_warranty", ...v }, fmt)).toContain("not warranty provider confirmation");
  });
  it("verification evidence requires the verifier+timestamp PAIR: blank, missing, or unparseable parts stay On record", () => {
    const k = { ...base, kind: "insurance" as const, status: "verified" as const };
    expect(protectionChip({ ...k, verifiedBy: "staff-1", verifiedAt: "2026-01-01" })).toBe("Record verified");
    expect(protectionChip({ ...k, verifiedBy: "", verifiedAt: "2026-01-01" })).toBe("On record"); // blank verifier
    expect(protectionChip({ ...k, verifiedBy: "   ", verifiedAt: "2026-01-01" })).toBe("On record"); // whitespace verifier
    expect(protectionChip({ ...k, verifiedBy: "staff-1", verifiedAt: null })).toBe("On record"); // verifier alone
    expect(protectionChip({ ...k, verifiedBy: null, verifiedAt: "2026-01-01" })).toBe("On record"); // timestamp alone
    expect(protectionChip({ ...k, verifiedBy: "staff-1", verifiedAt: "not-a-date" })).toBe("On record"); // unparseable timestamp
  });
  it("issuer wording names the issuer appropriate to the kind", () => {
    const v = { status: "verified" as const, verifiedBy: "staff-1", verifiedAt: "2026-01-01" };
    expect(protectionDetail({ ...base, kind: "insurance", ...v }, fmt)).toContain("not insurer confirmation");
    expect(protectionDetail({ ...base, kind: "fasttag", ...v }, fmt)).toContain("not issuing bank confirmation");
    expect(protectionDetail({ ...base, kind: "puc", ...v }, fmt)).toContain("not testing centre confirmation");
    expect(protectionDetail({ ...base, kind: "rc", ...v }, fmt)).toContain("not RTO confirmation");
    expect(protectionDetail({ ...base, kind: "extended_warranty", ...v }, fmt)).toContain("not warranty provider confirmation");
  });
  it("row titles name the record as a record, distinct from a customer document", () => {
    expect(protectionRecordTitle({ ...base, kind: "insurance" })).toBe("Insurance record");
    expect(protectionRecordTitle({ ...base, kind: "ppf" })).toBe("Paint Protection Film record");
  });
  it("issuer-backed verified records say the check is a record check only, never the issuer's confirmation", () => {
    const v = { status: "verified" as const, verifiedBy: "staff-1", verifiedAt: "2026-01-01" };
    expect(protectionDetail({ ...base, kind: "insurance", provider: "ICICI Lombard", expiryDate: "2027-12-05", ...v }, fmt)).toBe("ICICI Lombard · Verified as a record only, not insurer confirmation · Expires 2027-12-05");
    // without verification evidence the disclaimer does not appear either
    expect(protectionDetail({ ...base, kind: "insurance", provider: "ICICI", status: "verified" }, fmt)).not.toContain("record only");
    // cosmetic kinds are studio work records, no issuer disclaimer
    expect(protectionDetail({ ...base, kind: "ppf", provider: "Garware", ...v }, fmt)).toBe("Garware");
    // customer-declared insurance never carries the verification line
    expect(protectionDetail({ ...base, kind: "insurance", source: "customer", ...v }, fmt)).not.toContain("record only");
  });
  it("treats a missing source as AutoDeck-entered and editable only when own + self-declared + unverified", () => {
    expect(isSelfDeclared({ ...base })).toBe(false);
    expect(isCustomerEditable({ ...base }, "c")).toBe(false);
    expect(isCustomerEditable({ ...base, source: "customer" }, "c")).toBe(true);
    expect(isCustomerEditable({ ...base, source: "customer", status: "verified" }, "c")).toBe(false);
  });
  it("a self-declared record from a FORMER owner is never 'Added by you' and never editable for the current owner", () => {
    const former: Protection = { ...base, customerId: "former-owner", source: "customer" };
    expect(protectionChipFor(former, "c")).toBe("On record");
    expect(protectionChipFor(former, null)).toBe("On record");
    expect(protectionChipFor({ ...former, customerId: "c" }, "c")).toBe("Added by you");
    expect(isOwnSelfDeclared(former, "c")).toBe(false);
    expect(isCustomerEditable(former, "c")).toBe(false);
    expect(isCustomerEditable(former, null)).toBe(false);
  });
});

describe("protection lifecycle display", () => {
  it("absent lifecycle means current; superseded and removed are history", () => {
    expect(isCurrentProtection(base as Protection)).toBe(true);
    expect(isCurrentProtection({ ...base, lifecycle: "current" } as Protection)).toBe(true);
    expect(isCurrentProtection({ ...base, lifecycle: "superseded" } as Protection)).toBe(false);
    expect(isCurrentProtection({ ...base, lifecycle: "removed" } as Protection)).toBe(false);
  });

  it("a superseded or removed record is never editable, even own + self-declared + unverified", () => {
    const own = { ...base, source: "customer", status: "unverified", customerId: "me" } as Protection;
    expect(isCustomerEditable(own, "me")).toBe(true); // current: editable
    expect(isCustomerEditable({ ...own, lifecycle: "superseded" }, "me")).toBe(false);
    expect(isCustomerEditable({ ...own, lifecycle: "removed" }, "me")).toBe(false);
  });

  it("history rows carry neutral end provenance with the stored date, never a coverage claim", () => {
    expect(protectionLifecycleLabel(base as Protection, fmt)).toBeNull(); // current: no label
    // Explicit replace-event evidence (the superseding job) earns the "newer work" wording.
    expect(protectionLifecycleLabel({ ...base, lifecycle: "superseded", lifecycleAt: "2026-10-20", supersededByJobId: "job-9" } as Protection, fmt)).toBe("Replaced by newer work · 2026-10-20");
    // Legacy superseded without that evidence stays neutral - no newer-work assertion.
    expect(protectionLifecycleLabel({ ...base, lifecycle: "superseded", lifecycleAt: "2026-10-20" } as Protection, fmt)).toBe("Superseded · 2026-10-20");
    expect(protectionLifecycleLabel({ ...base, lifecycle: "superseded" } as Protection, fmt)).toBe("Superseded");
    expect(protectionLifecycleLabel({ ...base, lifecycle: "removed", lifecycleAt: "2026-10-20" } as Protection, fmt)).toBe("Removed · 2026-10-20");
    // A missing timestamp never blocks the honest end state.
    expect(protectionLifecycleLabel({ ...base, lifecycle: "removed" } as Protection, fmt)).toBe("Removed");
    // An unparseable timestamp renders no date at all, never "Invalid Date".
    expect(protectionLifecycleLabel({ ...base, lifecycle: "removed", lifecycleAt: "not-a-date" } as Protection, fmt)).toBe("Removed");
    expect(protectionLifecycleLabel({ ...base, lifecycle: "superseded", lifecycleAt: "not-a-date", supersededByJobId: "job-9" } as Protection, fmt)).toBe("Replaced by newer work");
  });
});
