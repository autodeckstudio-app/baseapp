/**
 * Emulator integration tests for the duplicate-RC (plate identity) paths of
 * createVehicle — the paths live validation could not exercise in production.
 * Run with: pnpm test:emulator (requires Firestore Emulator).
 * Pattern: real exported handlers via `.run({ data, auth } as never)`, same as
 * approval.emulator.test.ts / garage-ownership.emulator.test.ts.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { createVehicle } from "../../functions/vehicle/createVehicle.js";

const db = getFirestore();
const TENANT = "dup-rc-tenant";
let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}
function customerAuth(authUid: string) {
  return { uid: authUid, token: { role: "customer", tenantId: TENANT, studioId: null } };
}
const car = { registrationNumber: "GJ01QZ1234", make: "Toyota", model: "Land Cruiser", year: 2024, color: "Black" };

describe("createVehicle duplicate RC", () => {
  it("creates the first car for a plate", async () => {
    const res = await createVehicle.run({ data: car, auth: customerAuth(uid("c")) } as never);
    const vehicle = (res as { vehicle: { id: string; registrationNumber: string } }).vehicle;
    expect(vehicle.registrationNumber).toBe("GJ01QZ1234");
    const snap = await db.collection(COLLECTIONS.vehicles()).doc(vehicle.id).get();
    expect(snap.exists).toBe(true);
  });

  it("refuses the same plate again for the same owner (already-exists, names the live vehicle)", async () => {
    const owner = uid("c");
    await createVehicle.run({ data: car, auth: customerAuth(owner) } as never);
    await expect(createVehicle.run({ data: { ...car, make: "Other" }, auth: customerAuth(owner) } as never)).rejects.toMatchObject({
      code: "already-exists",
    });
    const rows = await db.collection(COLLECTIONS.vehicles()).where("ownerId", "==", owner).get();
    expect(rows.size).toBe(1);
  });

  it("allows the same plate for a different owner (per-owner identity)", async () => {
    await createVehicle.run({ data: car, auth: customerAuth(uid("c")) } as never);
    const res = await createVehicle.run({ data: car, auth: customerAuth(uid("c")) } as never);
    expect((res as { vehicle: { id: string } }).vehicle.id).toBeTruthy();
  });

  it("an archived car with the same plate blocks with failed-precondition archived-match, not a silent second row", async () => {
    const owner = uid("c");
    const res = await createVehicle.run({ data: car, auth: customerAuth(owner) } as never);
    const first = (res as { vehicle: { id: string } }).vehicle;
    await db.collection(COLLECTIONS.vehicles()).doc(first.id).update({ deletedAt: new Date().toISOString() });
    await expect(createVehicle.run({ data: car, auth: customerAuth(owner) } as never)).rejects.toMatchObject({
      code: "failed-precondition",
      message: "archived-match",
    });
    const rows = await db.collection(COLLECTIONS.vehicles()).where("ownerId", "==", owner).get();
    expect(rows.size).toBe(1);
  });
});
