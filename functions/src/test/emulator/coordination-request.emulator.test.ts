import { it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import {
  requestVisitCoordination as start,
  getVisitCoordinationRequests as list,
  updateVisitCoordinationRequest as update,
} from "../../functions/visit/coordinationRequests";
const db = getFirestore();
let tenant: string,
  uid: string,
  customer: string,
  studio: string,
  vehicle: string,
  services: string[],
  operationId: string;
const call = (
  data: any,
  role = "customer",
  user = uid,
  s = studio,
  t = tenant,
) =>
  ({
    data,
    auth: {
      uid: user,
      token: { role, tenantId: t, studioId: role === "studio" ? s : null },
    },
  }) as any;
const body = () => ({
  operationId,
  studioId: studio,
  vehicleId: vehicle,
  serviceIds: services,
});
beforeEach(async () => {
  const x = randomUUID();
  tenant = "coord-" + x;
  uid = "uid-" + x;
  customer = "customer-" + x;
  studio = "studio-" + x;
  vehicle = "car-" + x;
  services = ["wash-" + x, "coat-" + x];
  operationId = randomUUID();
  await db
    .collection("customers")
    .doc(customer)
    .set({
      id: customer,
      authUid: uid,
      tenantId: tenant,
      name: "Sample owner",
      deletedAt: null,
    });
  await db
    .collection("vehicles")
    .doc(vehicle)
    .set({
      id: vehicle,
      ownerId: customer,
      tenantId: tenant,
      make: "Sample",
      model: "Car",
      registrationNumber: "SAMPLE",
      deletedAt: null,
    });
  await db
    .collection("studioConfig")
    .doc(studio)
    .set({ id: studio, tenantId: tenant });
  for (const [id, i] of services.map((id, i) => [id, i] as const))
    await db
      .collection("services")
      .doc(id)
      .set({
        id,
        tenantId: tenant,
        name: i ? "Coating" : "Wash",
        active: true,
        category: i ? "ceramic" : "washing",
        requiredBayType: i ? "protection" : "wash",
        basePrice: 100000,
        estimatedDurationMinutes: 60,
        updatedAt: "source1",
      });
});
const none = async () => {
  for (const col of [
    "bookings",
    "jobs",
    "carVisits",
    "visitIntakes",
    "payments",
    "bayLocks",
    "invoices",
  ])
    expect(
      (await db.collection(col).where("tenantId", "==", tenant).get()).size,
    ).toBe(0);
};
it("retries identical request without duplication and rejects changed retry", async () => {
  const r = await start.run(call(body()));
  expect(
    await start.run(call({ ...body(), serviceIds: [...services].reverse() })),
  ).toEqual(r);
  await expect(
    start.run(call({ ...body(), notes: "changed" })),
  ).rejects.toMatchObject({ code: "already-exists" });
  expect(
    (
      await db
        .collection("visitCoordinationRequests")
        .where("tenantId", "==", tenant)
        .get()
    ).size,
  ).toBe(1);
  await none();
});
it("saves canonical request snapshots with no payable promise", async () => {
  const r = await start.run(call({ ...body(), notes: "One arrival please." }));
  expect(r.customerId).toBe(customer);
  expect(r.lines.map((l) => l.serviceId)).toEqual(services);
  expect(r.notes).toBe("One arrival please.");
  expect(r).not.toHaveProperty("totalAmount");
  expect(r).not.toHaveProperty("scheduledAt");
  await none();
});
it.each([
  { active: false },
  { tenantId: "foreign" },
  { priceOnRequest: true },
  { basePrice: 0 },
  { estimatedDurationMinutes: 0 },
  { catalogueEntryKind: "enquiry" },
  { customerMenu: { bookingMode: "walk_in" } },
  { customerMenu: { bookingMode: "coordination" } },
])("rejects unavailable or non-bookable selection %j", async (patch) => {
  await db.collection("services").doc(services[0]!).update(patch);
  await expect(start.run(call(body()))).rejects.toThrow();
  expect(
    (
      await db
        .collection("visitCoordinationRequests")
        .where("tenantId", "==", tenant)
        .get()
    ).size,
  ).toBe(0);
  await none();
});
it("rejects same-bay and duplicate requests without effects", async () => {
  await expect(
    start.run(call({ ...body(), serviceIds: [services[0], services[0]] })),
  ).rejects.toMatchObject({ code: "invalid-argument" });
  await db
    .collection("services")
    .doc(services[1]!)
    .update({ requiredBayType: "wash" });
  await expect(start.run(call(body()))).rejects.toThrow(/normal booking/);
  await none();
});
it("rejects a foreign or archived car", async () => {
  await db
    .collection("vehicles")
    .doc(vehicle)
    .update({ ownerId: "someone-else" });
  await expect(start.run(call(body()))).rejects.toMatchObject({
    code: "permission-denied",
  });
  await db
    .collection("vehicles")
    .doc(vehicle)
    .update({ ownerId: customer, deletedAt: new Date().toISOString() });
  await expect(start.run(call(body()))).rejects.toMatchObject({
    code: "permission-denied",
  });
});
it("rejects foreign studio and duplicate alternative coating scope", async () => {
  await db
    .collection("studioConfig")
    .doc(studio)
    .update({ tenantId: "foreign" });
  await expect(start.run(call(body()))).rejects.toThrow(/Studio/);
  await db.collection("studioConfig").doc(studio).update({ tenantId: tenant });
  await db
    .collection("services")
    .doc(services[0]!)
    .update({ category: "ceramic" });
  await expect(start.run(call(body()))).rejects.toThrow(/alternative/);
});
it("customer and studio see same persisted response, retries do not repeat audit or create work", async () => {
  const r = await start.run(call(body()));
  const staff = call(
    {
      id: r.id,
      expectedVersion: 1,
      operationId: randomUUID(),
      action: "reply",
      reply: "Please contact us to agree timing.",
    },
    "studio",
    "staff",
  );
  const answered = await update.run(staff);
  expect(answered.status).toBe("answered");
  expect(answered.version).toBe(2);
  expect(await update.run(staff)).toEqual(answered);
  expect((await list.run(call({}))).requests).toEqual([answered]);
  expect(
    (await list.run(call({ studioId: studio }, "studio", "staff"))).requests,
  ).toEqual([answered]);
  await none();
});
it("cannot reply as customer or a different studio or tenant", async () => {
  const r = await start.run(call(body()));
  const d = {
    id: r.id,
    expectedVersion: 1,
    operationId: randomUUID(),
    action: "reply",
    reply: "No authority",
  };
  await expect(update.run(call(d))).rejects.toMatchObject({
    code: "permission-denied",
  });
  await expect(
    update.run(call(d, "studio", "staff", "other")),
  ).rejects.toMatchObject({ code: "permission-denied" });
  await expect(
    update.run(call(d, "admin", "admin", studio, "foreign")),
  ).rejects.toMatchObject({ code: "not-found" });
  await expect(list.run(call({ studioId: studio }))).rejects.toMatchObject({
    code: "permission-denied",
  });
  await expect(
    list.run(call({ studioId: studio }, "studio", "staff", "other")),
  ).rejects.toMatchObject({ code: "permission-denied" });
});
it("withdraws only own request; stale response and reused-operation changed reply are rejected", async () => {
  const r = await start.run(call(body()));
  const d = {
    id: r.id,
    expectedVersion: 1,
    operationId: randomUUID(),
    action: "withdraw",
  };
  await expect(update.run(call(d, "customer", "another"))).rejects.toThrow();
  const withdrawn = await update.run(call(d));
  expect(withdrawn.status).toBe("withdrawn");
  expect(await update.run(call(d))).toEqual(withdrawn);
  await expect(
    update.run(
      call(
        {
          id: r.id,
          expectedVersion: 1,
          operationId: randomUUID(),
          action: "reply",
          reply: "Late",
        },
        "studio",
        "staff",
      ),
    ),
  ).rejects.toMatchObject({ code: "aborted" });
  await none();
});
it("concurrent reply and withdrawal cannot both claim version1", async () => {
  const r = await start.run(call(body()));
  const results = await Promise.allSettled([
    update.run(
      call(
        {
          id: r.id,
          expectedVersion: 1,
          operationId: randomUUID(),
          action: "reply",
          reply: "Timing still needs agreement.",
        },
        "studio",
        "staff",
      ),
    ),
    update.run(
      call({
        id: r.id,
        expectedVersion: 1,
        operationId: randomUUID(),
        action: "withdraw",
      }),
    ),
  ]);
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  await none();
});
it("rejects client money, schedule, HTML-shaped extra fields and oversized reply", async () => {
  for (const extra of [
    { totalAmount: 1 },
    { scheduledAt: "2026-11-20" },
    { status: "answered" },
    { customerId: "someone" },
  ])
    await expect(
      start.run(call({ ...body(), ...extra })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  const r = await start.run(call(body()));
  await expect(
    update.run(
      call(
        {
          id: r.id,
          expectedVersion: 1,
          operationId: randomUUID(),
          action: "reply",
          reply: "x".repeat(2001),
        },
        "studio",
        "staff",
      ),
    ),
  ).rejects.toMatchObject({ code: "invalid-argument" });
});
