import { describe, it, expect } from "vitest";
import { checkPhotoUpload, MAX_PHOTOS } from "./inspection-photo-rules";
import { checkAdminRequest, ADMIN_REQUEST_NOTE } from "./admin-approval-rules";

describe("inspection photo checks (provisional contract)", () => {
  it("accepts jpeg, png and webp", () => { for (const t of ["image/jpeg", "image/png", "image/webp"]) expect(checkPhotoUpload(t, 0).ok).toBe(true); });
  it("rejects other types", () => expect(checkPhotoUpload("image/heic", 0).ok).toBe(false));
  it("stops at the cap", () => { expect(checkPhotoUpload("image/png", MAX_PHOTOS - 1).ok).toBe(true); expect(checkPhotoUpload("image/png", MAX_PHOTOS).ok).toBe(false); });
});
describe("admin request checks (provisional contract)", () => {
  it("needs a reason and a target", () => {
    expect(checkAdminRequest({ targetType: "none", reason: "ok" })).toMatch(/few words/);
    expect(checkAdminRequest({ targetType: "job", reason: "Customer wants a goodwill discount" })).toMatch(/Pick/);
    expect(checkAdminRequest({ targetType: "job", targetId: "j1", reason: "Customer wants a goodwill discount", amountPaise: 5000 })).toBeNull();
    expect(checkAdminRequest({ targetType: "none", reason: "Need a day off approved", amountPaise: -1 })).toMatch(/amount/);
  });
  it("never says money moved", () => expect(ADMIN_REQUEST_NOTE).not.toMatch(/refunded|paid|discount applied/i));
});
