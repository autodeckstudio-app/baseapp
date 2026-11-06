// REAL rules, REAL listener-shaped queries: the customer app's protections
// listener is query(vehicles/{id}/protections, tenantId ==, customerId ==)
// and the admin app lists with tenantId == only. These run the actual query
// shapes against the actual firestore.rules - no source inspection - so the
// intersection audience (record customer AND current car owner, same
// tenant, car present and unarchived) is proven as a query contract:
// cross-tenant, former-owner, new-owner-inheritance and archived parent all
// fail CLOSED; a legacy car MISSING the deletedAt field reads as never-archived
// for the legitimate current owner only (schema-compatible, guards retained).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { TEST_PROJECT_ID } from "../emulator-setup";

const db = getFirestore();
const T = "lr-tenant";
const CAR = "lr-car";
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"), host: "localhost", port: Number(process.env["FIRESTORE_EMULATOR_TEST_PORT"] ?? 8080) },
  });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore();
 for(const id of ["lr-owner","lr-buyer","lr-other"])await db.collection("customers").doc(id).set({id,authUid:id,tenantId:T,deletedAt:null});
 });

const asCustomer = (uid: string, tenantId = T) => testEnv.authenticatedContext(uid, { role: "customer", tenantId, studioId: null }).firestore();
const asStaff = (role: string, tenantId = T) => testEnv.authenticatedContext(`lr-${role}`, { role, tenantId, studioId: role === "studio" ? "s1" : null }).firestore();

async function seedCar(over: Record<string, unknown> = {}) {
  await db.collection("vehicles").doc(CAR).set({ id: CAR, tenantId: T, ownerId: "lr-owner", deletedAt: null, ...over });
}
async function seedProtection(id: string, over: Record<string, unknown> = {}) {
  await db.collection("vehicles").doc(CAR).collection("protections").doc(id).set({
    id, tenantId: T, vehicleId: CAR, customerId: "lr-owner", kind: "ppf", coverage: "full_body",
    status: "unverified", source: "customer", revision: 1, createdAt: "x", updatedAt: "x", ...over,
  });
}
// The exact customer listener shape from apps/customer protection-service.
function customerListener(fs: ReturnType<typeof asCustomer>, customerId: string, tenantId = T) {
  return getDocs(query(collection(fs, `vehicles/${CAR}/protections`), where("tenantId", "==", tenantId), where("customerId", "==", customerId)));
}

describe("protections listener-query rules (real rules, real query shapes)", () => {
  it("the owner customer's listener-shape query succeeds and returns only their records", async () => {
    await seedCar();
    await seedProtection("lr-p1");
    await seedProtection("lr-p2", { id: "lr-p2", customerId: "lr-other" });
    const snap = (await assertSucceeds(customerListener(asCustomer("lr-owner"), "lr-owner"))) as { docs: { id: string }[] };
    expect(snap.docs.map((d: { id: string }) => d.id).sort()).toEqual(["lr-p1"]);
  });

  it("denies a customer querying someone ELSE's records (rules are not filters)", async () => {
    await seedCar();
    await seedProtection("lr-p1", { customerId: "lr-other" });
    await assertFails(customerListener(asCustomer("lr-owner"), "lr-other"));
  });

  it("denies an unfiltered collection query and an unauthenticated one", async () => {
    await seedCar();
    await seedProtection("lr-p1");
    await assertFails(getDocs(query(collection(asCustomer("lr-owner"), `vehicles/${CAR}/protections`))));
    await assertFails(getDocs(query(collection(testEnv.unauthenticatedContext().firestore(), `vehicles/${CAR}/protections`), where("tenantId", "==", T), where("customerId", "==", "lr-owner"))));
  });

  it("denies a cross-tenant customer even when the query names the car's tenant", async () => {
    await seedCar();
    await seedProtection("lr-p1");
    await assertFails(customerListener(asCustomer("lr-owner", "lr-tenant-b"), "lr-owner", T));
  });

  it("intersection: a FORMER owner loses access at transfer; the new owner inherits nothing", async () => {
    await seedCar({ ownerId: "lr-buyer" }); // car moved
    await seedProtection("lr-p1"); // record still names the former owner
    await assertFails(customerListener(asCustomer("lr-owner"), "lr-owner")); // former owner: no longer the car's owner
    // New owner's honest listener finds none of the former owner's records (empty, not an error).
    const snap = (await assertSucceeds(customerListener(asCustomer("lr-buyer"), "lr-buyer"))) as { docs: unknown[] };
    expect(snap.docs).toHaveLength(0);
    await assertFails(customerListener(asCustomer("lr-buyer"), "lr-owner")); // and cannot ask for the former owner's either
  });

  it("archived parent (deletedAt set) fails closed for the customer", async () => {
    await seedCar({ deletedAt: "2026-01-01T00:00:00Z" });
    await seedProtection("lr-p1");
    await assertFails(customerListener(asCustomer("lr-owner"), "lr-owner"));
  });

  it("legacy parent with MISSING deletedAt reads as never-archived for the legitimate owner (schema-compatible; guards retained)", async () => {
    await db.collection("vehicles").doc(CAR).set({ id: CAR, tenantId: T, ownerId: "lr-owner" }); // no deletedAt field at all
    await seedProtection("lr-p1");
    // Missing field == never archived: the CURRENT owner keeps access.
    await assertSucceeds(customerListener(asCustomer("lr-owner"), "lr-owner"));
    // The other guards still bite on a legacy doc: cross-owner and cross-tenant stay denied.
    await assertFails(customerListener(asCustomer("lr-other"), "lr-other"));
    await assertFails(customerListener(asCustomer("lr-owner", "other-tenant"), "lr-owner"));
    // Staff of the same tenant are unaffected by the customer intersection.
    await assertSucceeds(getDocs(query(collection(asStaff("studio"), `vehicles/${CAR}/protections`), where("tenantId", "==", T))));
  });

  it("staff tenant-scoped list succeeds same-tenant, fails cross-tenant", async () => {
    await seedCar();
    await seedProtection("lr-p1");
    const list = (role: string, tenant = T) => getDocs(query(collection(asStaff(role, tenant), `vehicles/${CAR}/protections`), where("tenantId", "==", T)));
    await assertSucceeds(list("studio"));
    await assertSucceeds(list("admin"));
    await assertSucceeds(list("superadmin", "anywhere"));
    await assertFails(list("admin", "lr-tenant-b"));
    await assertFails(list("studio", "lr-tenant-b"));
  });
});
