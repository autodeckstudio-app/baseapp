import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
const db = getFirestore(); const T = "amt-tenant"; let n = 0;
const auth = { uid: "staff", token: { role: "admin", tenantId: T, studioId: null } };
async function seed(totalAmount: unknown) {
  const id = `amt-${Date.now()}-${++n}`, now = new Date().toISOString();
  const pb = { vehicleCategory: "hatchback", basePrice: 50000, scopeAdjustment: 0, addOns: [], subtotal: 50000, membershipDiscount: 0, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 9000, total: 59000, currency: "INR" };
  const common = { tenantId: T, studioId: "s", customerId: "c", vehicleId: id, serviceId: id, priceBreakdown: pb, createdAt: now, updatedAt: now, paymentStatus: "unpaid" };
  const amt = totalAmount === undefined ? {} : { totalAmount };
  await db.collection("bookings").doc(id).set({ ...common, ...amt, id, status: "CONFIRMED", scheduledAt: now });
  await db.collection("jobs").doc(id).set({ ...common, ...amt, id, bookingId: id, status: "READY_FOR_DELIVERY", isWalkIn: false, additionalWorkDelta: 0, statusHistory: [], estimatedEndAt: now });
  return id;
}
const record = (jobId: string) => recordManualPayment.run({ data: { jobId, method: "cash" }, auth } as never);
const writes = async (id: string) => ({
  payments: (await db.collection("payments").where("jobId", "==", id).get()).size,
  invoices: (await db.collection("invoices").where("jobId", "==", id).get()).size,
  job: (await db.collection("jobs").doc(id).get()).data()!,
});
describe("recordManualPayment needs a valid job amount", () => {
  it.each([["missing", undefined], ["NaN", NaN], ["string", "590"], ["negative", -100], ["fraction", 10.5]])("%s amount is refused and nothing is written", async (_n, v) => {
    const id = await seed(v);
    await expect(record(id)).rejects.toMatchObject({ code: "failed-precondition" });
    const w = await writes(id);
    expect(w.payments).toBe(0); expect(w.invoices).toBe(0); expect(w.job["paymentStatus"]).toBe("unpaid");
  });
  it("control: a job with a real amount still records as before", async () => {
    const id = await seed(59000);
    await record(id);
    const w = await writes(id);
    expect(w.payments).toBe(1); expect(w.invoices).toBe(1); expect(w.job["paymentStatus"]).toBe("paid");
  });
});
