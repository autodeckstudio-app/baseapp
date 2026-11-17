// Isolated restore regression for claimed staged identities. No live records.
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle } from "@autodeck/core";
import { archiveVehicle } from "../../functions/vehicle/archiveVehicle.js";
import { restoreVehicle } from "../../functions/vehicle/restoreVehicle.js";
const db = getFirestore();
const TENANT = "custody-lifecycle-tenant";
const auth = { customer: (uid: string) => ({ uid, token: { role: "customer", tenantId: TENANT, studioId: null } }) };
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
async function seedCustomerVehicle(label: string, opts: { claimed?: boolean } = {}) {
  // claimed: a staged counter-created record whose doc id differs from the
  // claiming login's auth uid (claimCustomerRecord binds authUid on the doc).
  const customerId = uid(`cust-${label}`);
  const authUid = opts.claimed ? uid(`auth-${label}`) : customerId;
  const now = new Date().toISOString();
  await db.collection("customers").doc(customerId).set({
    id: customerId, authUid, tenantId: TENANT, name: `Probe ${label}`, phone: "+919876543210",
    notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null,
    ...(opts.claimed ? { claimedAt: now } : {}),
  });
  const vehicleId = uid(`veh-${label}`);
  await db.collection("vehicles").doc(vehicleId).set({
    id: vehicleId, tenantId: TENANT, ownerId: customerId, registrationNumber: "GJ01MD1234",
    make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv",
    photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null,
  });
  await db.collection("memberships").doc(`prio-${customerId}`).set({
    id: `prio-${customerId}`, tenantId: TENANT, customerId, status: "active", prioritySlot: true, endDate: null,
  });
  return { customerId, authUid, vehicleId };
}

describe("claimed customer vehicle restore", () => {
  it("D: a claimed staged customer (doc id != authUid) can archive AND restore their own vehicle", async () => {
    const { customerId, authUid, vehicleId } = await seedCustomerVehicle("claimed", { claimed: true });
    const asCustomer = auth.customer(authUid); // the login that claimed the staged record

    // archiveVehicle resolves the doc id via requireCustomerDocId: works.
    await archiveVehicle.run({ data: { vehicleId }, auth: asCustomer } as never);
    const archived = (await db.collection("vehicles").doc(vehicleId).get()).data() as Vehicle;
    expect(archived.deletedAt).toBeTruthy();

    // Regression: restoreVehicle previously compared v.ownerId !== user.uid, skipping the
    // doc-id resolver every sibling handler uses. For a claimed customer the
    // ownerId is the staged doc id, never the auth uid - so the legitimate
    // owner is denied. Expected: restore succeeds. Actual (pre-fix): throws.
    await restoreVehicle.run({ data: { vehicleId }, auth: asCustomer } as never);
    const restored = (await db.collection("vehicles").doc(vehicleId).get()).data() as Vehicle;
    expect(restored.deletedAt).toBeNull();
    // Replay is safe and does not add another restore audit entry.
    await restoreVehicle.run({data:{vehicleId},auth:asCustomer} as never);
    const audits=await db.collection("auditLog").where("entityId","==",vehicleId).where("action","==","vehicle.restored").get();
    expect(audits.size).toBe(1);
    const stranger=await seedCustomerVehicle("stranger",{claimed:true});
    await expect(restoreVehicle.run({data:{vehicleId},auth:auth.customer(stranger.authUid)} as never)).rejects.toMatchObject({code:"permission-denied"});
    // A coincident auth uid equal to the owner document id is not its binding.
    await expect(restoreVehicle.run({data:{vehicleId},auth:auth.customer(customerId)} as never)).rejects.toThrow(/review/i);
    // Legacy uid-keyed ownership remains supported.
    const legacy=await seedCustomerVehicle("legacy");
    await archiveVehicle.run({data:{vehicleId:legacy.vehicleId},auth:auth.customer(legacy.authUid)} as never);
    await restoreVehicle.run({data:{vehicleId:legacy.vehicleId},auth:auth.customer(legacy.authUid)} as never);
    expect((await db.collection("vehicles").doc(legacy.vehicleId).get()).data()!.deletedAt).toBeNull();
    await archiveVehicle.run({data:{vehicleId},auth:asCustomer} as never);
    const duplicateId=uid("duplicate");
    await db.collection("vehicles").doc(duplicateId).set({...restored,id:duplicateId,deletedAt:null});
    await expect(restoreVehicle.run({data:{vehicleId},auth:asCustomer} as never)).rejects.toMatchObject({code:"already-exists"});
    expect((await db.collection("vehicles").doc(vehicleId).get()).data()!.deletedAt).toBeTruthy();
    await expect(restoreVehicle.run({data:{vehicleId},auth:{uid:authUid,token:{role:"admin",tenantId:"other-tenant",studioId:null}}} as never)).rejects.toMatchObject({code:"permission-denied"});
  }, 30000);
});
