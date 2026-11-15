// listOwnerKey: canonical id always wins; the legacy-self key exists only
// for staff after a FOUNDED absent resolution - never for customers, never
// on error/claim-required/loading.
import { describe, expect, it } from "vitest";
import { listOwnerKey } from "./owner-key";

const base = {
  status: "ready",
  user: { uid: "uid-1" },
  claims: { role: "admin" as const, tenantId: "automodz" },
};

describe("listOwnerKey", () => {
  it("canonical customerDocId wins for every role", () => {
    expect(listOwnerKey({ ...base, customerDocId: "staged-9", customerDocResolution: "resolved" }))
      .toEqual({ key: "staged-9", kind: "canonical" });
    expect(listOwnerKey({ ...base, claims: { role: "customer" as const, tenantId: "t" }, customerDocId: "staged-9", customerDocResolution: "resolved" }))
      .toEqual({ key: "staged-9", kind: "canonical" });
  });

  it("staff with a founded absent resolution get their own uid as legacy-self", () => {
    for (const role of ["studio", "admin", "superadmin", "accountant"] as const) {
      expect(listOwnerKey({ ...base, claims: { role, tenantId: "t" }, customerDocId: null, customerDocResolution: "absent" }))
        .toEqual({ key: "uid-1", kind: "legacy-self" });
    }
  });

  it("customer role NEVER falls back, whatever the resolution", () => {
    for (const resolution of ["absent", "error", "claim-required", "resolved"]) {
      expect(listOwnerKey({ ...base, claims: { role: "customer" as const, tenantId: "t" }, customerDocId: null, customerDocResolution: resolution }))
        .toBeNull();
    }
  });

  it("staff with errored or pending resolution get no key (truthful unknown/pending, not empty)", () => {
    expect(listOwnerKey({ ...base, customerDocId: null, customerDocResolution: "error" })).toBeNull();
    expect(listOwnerKey({ ...base, customerDocId: null, customerDocResolution: "claim-required" })).toBeNull();
  });

  it("not-ready states get no key", () => {
    expect(listOwnerKey({ status: "loading" })).toBeNull();
    expect(listOwnerKey({ status: "unauthenticated" })).toBeNull();
    expect(listOwnerKey({ status: "authenticated_no_claims", user: { uid: "u" } })).toBeNull();
  });
});
