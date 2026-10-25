import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { MEMBERSHIP_SETTLEMENT_ENABLED } from "./backend-features";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("backend availability gates (studio)", () => {
  it("the flag is enabled because settleMembershipCoveredJob ships with this UI stage", () => {
    expect(MEMBERSHIP_SETTLEMENT_ENABLED).toBe(true);
  });
  it("the settle action remains gated on the flag", () => {
    const job = src("../app/(tabs)/jobs/[id].tsx");
    expect(job).toContain("MEMBERSHIP_SETTLEMENT_ENABLED && booking?.membershipWashUsed");
  });
  it("the record-cash suppression is gated on the same flag", () => {
    const job = src("../app/(tabs)/jobs/[id].tsx");
    expect(job).toContain("!(MEMBERSHIP_SETTLEMENT_ENABLED && (membershipCoveredLabel(job) || (booking && membershipCoveredLabel(booking))))");
  });
});

describe("backend features enabled with their backend release; UPI stays held", () => {
  it("photos and admin requests are on, UPI remains off pending the user's verification decision", async () => {
    const f = await import("./backend-features");
    expect(f.INSPECTION_PHOTOS_ENABLED).toBe(true);
    expect(f.ADMIN_APPROVAL_ENABLED).toBe(true);
    expect(f.UPI_RECORD_ENABLED).toBe(false);
  });
  it("the screens are gated on those flags", () => {
    expect(src("../app/(tabs)/jobs/inspection/[jobId].tsx")).toContain("INSPECTION_PHOTOS_ENABLED && jobId");
    expect(src("../app/(tabs)/jobs/[id].tsx")).toContain("ADMIN_APPROVAL_ENABLED && job");
    expect(src("../app/(tabs)/jobs/[id].tsx")).toContain("UPI_RECORD_ENABLED && cashConfirm === \"record\"");
  });
});


describe("record payment confirm wording", () => {
  it("does not show cash wording when UPI is selected", () => {
    const s = require("fs").readFileSync(require("path").join(__dirname, "../app/(tabs)/jobs/[id].tsx"), "utf8");
    expect(s).toMatch(/payMethod === "upi_manual" \? "Record UPI payment\?/);
  });
});

describe("record payment double-tap guard", () => {
  it("uses a synchronous ref guard so a same-tick double tap sends one call", () => {
    const s = require("fs").readFileSync(require("path").join(__dirname, "../app/(tabs)/jobs/[id].tsx"), "utf8");
    expect(s).toMatch(/payBusyRef\.current\) return;\s*payBusyRef\.current = true;/);
    expect(s).toMatch(/payBusyRef\.current = false;/);
  });
});

import { isJobPhotoPath } from "./inspection-photo-rules";
import { requestsForTarget, decisionLabel } from "./admin-approval-rules";
describe("photo paths and admin decisions", () => {
  it("accepts only this job's documented photo path", () => {
    expect(isJobPhotoPath("t1/jobs/j1/photos/abc-1.jpg", "j1")).toBe(true);
    expect(isJobPhotoPath("t1/jobs/j2/photos/abc.jpg", "j1")).toBe(false);
    expect(isJobPhotoPath("t1/jobs/j1/photos/../x.jpg", "j1")).toBe(false);
    expect(isJobPhotoPath("https://x/y.jpg", "j1")).toBe(false);
  });
  it("sorts requests for one target newest first and words decisions as records only", () => {
    const base = { tenantId: "t", studioId: "s", amountPaise: null, status: "pending" as const };
    const r = requestsForTarget([
      { ...base, id: "a", targetType: "job", targetId: "j1", reason: "old", createdAt: 1 },
      { ...base, id: "b", targetType: "job", targetId: "j1", reason: "new", createdAt: 5 },
      { ...base, id: "c", targetType: "job", targetId: "j2", reason: "other", createdAt: 9 },
    ], "job", "j1");
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
    expect(decisionLabel({ status: "approved", responseNote: " ok " })).toEqual({ title: "Office said yes", detail: "ok" });
    expect(decisionLabel({ status: "rejected" }).title).toBe("Office said no");
    expect(JSON.stringify([decisionLabel({ status: "approved" }), decisionLabel({ status: "rejected" })])).not.toMatch(/refund|discount|paid/i);
  });
});

describe("photo count honesty", () => {
  it("counts only showable paths and reports the rest", () => {
    const s = require("fs").readFileSync(require("path").join(__dirname, "../components/InspectionPhotos.tsx"), "utf8");
    expect(s).toMatch(/\$\{valid\.length\} of \$\{MAX_PHOTOS\}/);
    expect(s).toMatch(/not a photo this app can show/);
  });
});

describe("photo reads stay private", () => {
  it("reads bytes through authenticated getBlob and never makes a download link", () => {
    const s = require("fs").readFileSync(require("path").join(__dirname, "../components/PhotoThumb.tsx"), "utf8");
    expect(s).toContain("getBlob(ref(storage, path))");
    expect(s).not.toMatch(/getDownloadURL/);
    expect(s).toContain("URL.revokeObjectURL");
  });
});

import { payErrorNote } from "./record-payment-rules";
describe("payment error wording", () => {
  it("passes through only rule refusals and hides raw network or internal errors", () => {
    expect(payErrorNote(Object.assign(new Error("This job already has a payment."), { code: "functions/already-exists" }), "record")).toBe("This job already has a payment.");
    expect(payErrorNote(Object.assign(new Error("Firebase: Error (functions/internal)"), { code: "functions/internal" }), "record")).toMatch(/Check the job's payment status/);
    expect(payErrorNote(new Error("network down"), "confirm")).toMatch(/Could not confirm the payment/);
    expect(payErrorNote("x", "record")).toMatch(/Could not record/);
  });
  it("the job screen routes payment errors through payErrorNote", () => {
    const s = require("fs").readFileSync(require("path").join(__dirname, "../app/(tabs)/jobs/[id].tsx"), "utf8");
    expect(s).toContain("setCashError(payErrorNote(err, mode));");
  });
});
