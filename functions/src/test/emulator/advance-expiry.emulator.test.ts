import { it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { sweepExpiredBookingHolds } from "../../lib/booking-hold.js";
const db = getFirestore();
it.each([false,true])("expiry cancels advance link after releasing hold, provider failure=%s", async fail => {
  if (!process.env["FIRESTORE_EMULATOR_HOST"]) throw new Error("emulator required");
  const id = `expiry-${Date.now()}-${fail}`;
  const now = Date.now();
  await db.collection("bookings").doc(id).set({ id, tenantId: "t", studioId: "s", customerId: "c",
    status: "PENDING", paymentStatus: "unpaid", holdExpiresAt: new Date(now-1000).toISOString(), advancePaymentId: `advance-${id}` });
  await db.collection("payments").doc(`advance-${id}`).set({ id: `advance-${id}`, targetType: "booking", bookingId: id,
    tenantId: "t", status: "pending", razorpayPaymentLinkId: `plink-${id}` });
  const calls: string[] = [];
  await sweepExpiredBookingHolds(db, now, async link => {
    calls.push(link);
    expect((await db.collection("bookings").doc(id).get()).data()!.status).toBe("EXPIRED");
    if (fail) throw new Error("provider unavailable");
    return { outcome: "cancelled" };
  });
  expect(calls).toContain(`plink-${id}`);
  const b = (await db.collection("bookings").doc(id).get()).data()!;
  expect(b.status).toBe("EXPIRED");
  expect(b.advancePaidAt ?? null).toBeNull();
});
