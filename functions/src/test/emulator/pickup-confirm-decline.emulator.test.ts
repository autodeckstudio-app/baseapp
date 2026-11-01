/**
 * Emulator integration tests for the first-use pickup Confirm/Decline legs —
 * requested by the release follow-up as the flow live read-only validation
 * could not exercise in production. Fee is pinned to an explicit admin-set 0
 * so the money/membership billing path stays out of scope (covered elsewhere).
 * Run with: pnpm test:emulator (requires Firestore Emulator).
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { requestPickupDrop, updatePickupRequest } from "../../functions/booking/pickupRequests.js";

const db = getFirestore();
const TENANT = "pickup-tenant";
const STUDIO = "pickup-studio";
let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}
const customerAuth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
const studioAuth = (u: string, studioId = STUDIO) => ({ uid: u, token: { role: "studio", tenantId: TENANT, studioId } });
const adminAuth = (u: string) => ({ uid: u, token: { role: "admin", tenantId: TENANT, studioId: null } });

async function seedBooking(status: string): Promise<{ bookingId: string; customerId: string }> {
  const bookingId = uid("bk");
  const customerId = uid("cust");
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId,
    tenantId: TENANT,
    studioId: STUDIO,
    customerId,
    status,
    createdAt: new Date().toISOString(),
  });
  return { bookingId, customerId };
}
const reqDoc = (bookingId: string) => db.collection(COLLECTIONS.pickupRequests()).doc(bookingId).get();

describe("pickup request confirm/decline legs (first-use paths)", () => {
  it("customer requests both legs with no pin: REQUESTED, fee undecided", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    const doc = (await reqDoc(bookingId)).data() as { status: string; feePaise: number | null };
    expect(doc.status).toBe("REQUESTED");
    expect(doc.feePaise).toBeNull();
  });

  it("a second open request for the same booking is refused already-exists", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await expect(
      requestPickupDrop.run({ data: { bookingId, kind: "drop", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });

  it("a customer cannot request pickup on someone else's booking", async () => {
    const { bookingId } = await seedBooking("CONFIRMED");
    await expect(
      requestPickupDrop.run({ data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(uid("other")) } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("closed booking: request refused, and an open request can then only be declined", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await db.collection(COLLECTIONS.bookings()).doc(bookingId).update({ status: "CANCELLED" });
    const staff = uid("st");
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", agreedPickupAt: "2026-11-04 10:30", agreedDropAt: "2026-11-04 18:30" }, auth: studioAuth(staff) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "DECLINED", staffNote: "Booking cancelled" }, auth: studioAuth(staff) } as never);
    expect(((await reqDoc(bookingId)).data() as { status: string }).status).toBe("DECLINED");
    // A fresh request is still refused on the cancelled booking.
    await expect(
      requestPickupDrop.run({ data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("fee discipline: studio cannot set the fee, admin sets it once, confirm without it is refused", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "REQUESTED", feePaise: 0 }, auth: studioAuth(uid("st")) } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", agreedPickupAt: "2026-11-04 10:30", agreedDropAt: "2026-11-04 18:30" }, auth: studioAuth(uid("st")) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" }); // unpriced guard: no fee yet
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "REQUESTED", feePaise: 0 }, auth: adminAuth(uid("ad")) } as never);
    // Fee already worked out: setting it again is refused.
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "REQUESTED", feePaise: 5000 }, auth: adminAuth(uid("ad")) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("confirm needs the agreed times for every requested leg", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "REQUESTED", feePaise: 0 }, auth: adminAuth(uid("ad")) } as never);
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", agreedPickupAt: "2026-11-04 10:30" }, auth: studioAuth(uid("st")) } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" }); // missing dropoff time
  });

  it("happy path: confirm with both times, legs complete once and idempotently, then DONE", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "REQUESTED", feePaise: 0 }, auth: adminAuth(uid("ad")) } as never);
    const staff = uid("st");
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", agreedPickupAt: "2026-11-04 10:30", agreedDropAt: "2026-11-04 18:30" }, auth: studioAuth(staff) } as never);
    let doc = (await reqDoc(bookingId)).data() as { status: string; agreedPickupAt: string | null; pickupCompletedAt?: string | null };
    expect(doc.status).toBe("CONFIRMED");
    expect(doc.agreedPickupAt).toBeTruthy();
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", markLegCompleted: "pickup" }, auth: studioAuth(staff) } as never);
    doc = (await reqDoc(bookingId)).data() as { status: string; agreedPickupAt: string | null; pickupCompletedAt?: string | null };
    const firstStamp = doc.pickupCompletedAt;
    expect(firstStamp).toBeTruthy();
    // Re-marking the same leg keeps the original server timestamp (no-op).
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", markLegCompleted: "pickup" }, auth: studioAuth(staff) } as never);
    expect(((await reqDoc(bookingId)).data() as { pickupCompletedAt?: string | null }).pickupCompletedAt).toBe(firstStamp);
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "CONFIRMED", markLegCompleted: "drop" }, auth: studioAuth(staff) } as never);
    expect(((await reqDoc(bookingId)).data() as { dropCompletedAt?: string | null }).dropCompletedAt).toBeTruthy();
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "DONE" }, auth: studioAuth(staff) } as never);
    expect(((await reqDoc(bookingId)).data() as { status: string }).status).toBe("DONE");
  });

  it("a cross-studio staff member cannot touch the request", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "DECLINED" }, auth: studioAuth(uid("st"), "other-studio") } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("legs cannot be marked on an unconfirmed request", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await expect(
      updatePickupRequest.run({ data: { requestId: bookingId, status: "REQUESTED", markLegCompleted: "pickup" }, auth: studioAuth(uid("st")) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("after DECLINED the customer can request again", async () => {
    const { bookingId, customerId } = await seedBooking("CONFIRMED");
    await requestPickupDrop.run({ data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    await updatePickupRequest.run({ data: { requestId: bookingId, status: "DECLINED", staffNote: "No driver available" }, auth: studioAuth(uid("st")) } as never);
    await requestPickupDrop.run({ data: { bookingId, kind: "drop", address: "12 Ring Road, Ahmedabad" }, auth: customerAuth(customerId) } as never);
    const doc = (await reqDoc(bookingId)).data() as { status: string; kind: string };
    expect(doc.status).toBe("REQUESTED");
    expect(doc.kind).toBe("drop");
  });
});
