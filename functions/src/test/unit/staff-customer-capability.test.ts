/* Test doubles model Firestore transactions; endpoint ownership logic stays real. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ docs: {} as Record<string, any>, writes: [] as Array<{ path: string; value: any }>, next: 0 }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "owner" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/storage", () => ({ getStorage: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string): any => ({ path, id: path.split("/").pop(), get: async () => snap(path) });
  const snap = (path: string): any => ({ exists: !!h.docs[path], data: () => h.docs[path] });
  const db: any = { collection: (path: string) => { const q: any = { where: () => q, limit: () => q, doc: (id?: string) => ref(`${path}/${id ?? `new-${++h.next}`}`), get: async () => ({ docs: [], empty: true }) };return q; },
    runTransaction: async (fn: any) => fn({ get: async (r: any) => r.path ? snap(r.path) : { docs: [], empty: true }, set: (r: any, value: any) => h.writes.push({ path: r.path, value }), update: (r: any, value: any) => h.writes.push({ path: r.path, value }) }) };
  return { getFirestore: () => db };
});
import { extractCustomerUser, extractUser, assertRole } from "../../middleware/auth.js";
import { createBooking } from "../../functions/booking/createBooking.js";
import { requestPickupDrop } from "../../functions/booking/pickupRequests.js";
import { expressInterest, markMyListingSold } from "../../functions/carsale/carsale.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
const req = (payload: any, role = "studio"): any => ({ data: payload, auth: { uid: "staff", token: { role, tenantId: "tenant", studioId: "studio", email: "staff@example.com" } } });
beforeEach(() => { h.docs = {}; h.writes = []; h.next = 0; });
describe("additive customer capability", () => {
  it("does not demote persisted claims or grant staff roles to customers", () => {
    const r = req({});expect(extractCustomerUser(r).claims.role).toBe("customer");expect(extractUser(r).claims.role).toBe("studio");
    expect(() => assertRole(extractUser(req({}, "customer")), "studio", "admin")).toThrow();
  });
  it("staff can book their own car but cannot book someone else's", async () => {
    h.docs["services/svc"] = { tenantId: "tenant", active: true, basePrice: 0, requiredBayType: "wash", estimatedDurationMinutes: 30, vehicleCategoryPricing: [] };
    const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, open: "09:00", close: "21:00", closed: false }));
    h.docs["studioConfig/studio"] = { tenantId: "tenant", bays: [{ id: "bay", active: true, bayType: "wash" }], operatingHours: hours, holidays: [], timezone: "Asia/Kolkata", taxRatePercent: 0, taxDescription: "GST", currency: "INR" };
    h.docs["vehicles/car"] = { ownerId: "staff", tenantId: "tenant", registrationNumber: "MH40CQ3182", make: "Maruti", model: "Swift", year: 2022, color: "White" };
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const data = { serviceId: "svc", vehicleId: "car", vehicleCategory: "hatchback", studioId: "studio", scheduledDate: date, scheduledTime: "11:00", idempotencyKey: "own" };
    const result: any = await createBooking.run(req(data));expect(result.booking.customerId).toBe("staff");
    h.docs["vehicles/car"].ownerId = "other";
    await expect(createBooking.run(req({ ...data, idempotencyKey: "other" }))).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("staff can request pickup only for their own booking", async () => {
    h.docs["bookings/b"] = { customerId: "staff", tenantId: "tenant", studioId: "studio" };
    expect((await requestPickupDrop.run(req({ bookingId: "b", kind: "pickup", address: "Disposable test address" })) as any).request.customerId).toBe("staff");
    h.docs["bookings/b"].customerId = "other";
    await expect(requestPickupDrop.run(req({ bookingId: "b", kind: "pickup", address: "Disposable test address" }))).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("staff interest creates only a self-owned lead, never buyerId supplied by client", async () => {
    h.docs["carListings/l"] = { id: "l", tenantId: "tenant", studioId: "studio", sellerId: "other", status: "live" };
    h.docs["customers/staff"] = { name: "Staff customer" };
    await expressInterest.run(req({ listingId: "l", kind: "interest", phone: "9876543210" }));
    expect(h.writes.find((x) => x.path.startsWith("carLeads/"))?.value.buyerId).toBe("staff");
    await expect(expressInterest.run(req({ listingId: "l", kind: "interest", phone: "9876543210", buyerId: "other" }))).rejects.toMatchObject({ code: "invalid-argument" });
    h.docs["carListings/l"].tenantId = "other-tenant";
    await expect(expressInterest.run(req({ listingId: "l", kind: "interest", phone: "9876543210" }))).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("staff self-service cannot mark another seller's listing sold", async () => {
    h.docs["carListings/l"] = { tenantId: "tenant", sellerId: "other", status: "live" };
    await expect(markMyListingSold.run(req({ listingId: "l" }))).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("customer context applies ownership and cancellation limits to staff", async () => {
    h.docs["bookings/b"] = { tenantId: "tenant", customerId: "other", studioId: "studio", status: "CONFIRMED" };
    await expect(cancelBooking.run(req({ bookingId: "b", reason: "test", customerContext: true }))).rejects.toMatchObject({ code: "permission-denied" });
    h.docs["bookings/b"] = { ...h.docs["bookings/b"], customerId: "staff", scheduledAt: new Date(Date.now() + 3600000).toISOString(), scheduledDate: new Date().toISOString().slice(0,10) };
    await expect(cancelBooking.run(req({ bookingId: "b", reason: "test", customerContext: true }))).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
