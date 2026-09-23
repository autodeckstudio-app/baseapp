/**
 * M6 office module security rules tests.
 *
 * Covers the collections added for the Automodz Office migration:
 * /attendance, /expenses, /inventoryItems, /inventoryTxns, /papers,
 * /dailyClosings, /gallery. Every one is Cloud-Function-only for writes;
 * reads are tenant-scoped staff reads, plus per-owner reads on attendance
 * and papers, plus public read of ACTIVE gallery images.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_TENANT_ID } from "@autodeck/core";

const RULES_PATH = resolve(__dirname, "../../../../firestore.rules");
const OTHER_TENANT = "tenant-other";
const STUDIO = "studio-ahmedabad";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "autodeck-dev",
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "localhost",
      // Default 8080 matches the rest of the suite; override for sandboxes
      // where 8080 is occupied.
      port: Number(process.env.FIRESTORE_EMULATOR_TEST_PORT ?? 8080),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function studioCtx(uid = "uid-studio", tenantId = FIRST_TENANT_ID) {
  return testEnv.authenticatedContext(uid, { role: "studio", tenantId, studioId: STUDIO });
}
function adminCtx(uid = "uid-admin", tenantId = FIRST_TENANT_ID) {
  return testEnv.authenticatedContext(uid, { role: "admin", tenantId, studioId: null });
}
function customerCtx(uid: string, tenantId = FIRST_TENANT_ID) {
  return testEnv.authenticatedContext(uid, { role: "customer", tenantId, studioId: null });
}

async function seed(
  coll: string,
  docId: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(coll).doc(docId).set({
      id: docId,
      tenantId: FIRST_TENANT_ID,
      studioId: STUDIO,
      ...data,
    });
  });
}

// ─── /attendance ──────────────────────────────────────────────────────────────

describe("/attendance — staff tenant read, employee own read, no client writes", () => {
  const rec = { employeeId: "emp-1", employeeAuthUid: "uid-emp-1", date: "2026-09-24", status: "PRESENT" };

  it("Studio staff can read their tenant's record", async () => {
    await seed("attendance", "att-1", rec);
    await assertSucceeds(studioCtx().firestore().collection("attendance").doc("att-1").get());
  });

  it("Admin can read their tenant's record", async () => {
    await seed("attendance", "att-1", rec);
    await assertSucceeds(adminCtx().firestore().collection("attendance").doc("att-1").get());
  });

  it("Staff from another tenant cannot read", async () => {
    await seed("attendance", "att-1", rec);
    await assertFails(studioCtx("uid-x", OTHER_TENANT).firestore().collection("attendance").doc("att-1").get());
  });

  it("The employee can read their own record via employeeAuthUid", async () => {
    await seed("attendance", "att-1", rec);
    await assertSucceeds(customerCtx("uid-emp-1").firestore().collection("attendance").doc("att-1").get());
  });

  it("A different customer cannot read the record", async () => {
    await seed("attendance", "att-1", rec);
    await assertFails(customerCtx("uid-emp-2").firestore().collection("attendance").doc("att-1").get());
  });

  it("No client writes, even from staff in the same tenant", async () => {
    await assertFails(studioCtx().firestore().collection("attendance").doc("att-x").set(rec));
    await seed("attendance", "att-1", rec);
    await assertFails(adminCtx().firestore().collection("attendance").doc("att-1").update({ status: "ABSENT" }));
  });
});

// ─── /expenses ────────────────────────────────────────────────────────────────

describe("/expenses — staff tenant read, no client writes", () => {
  const rec = { amount: 12500, category: "SUPPLIES", paidVia: "CASH", date: "2026-09-24", month: "2026-09" };

  it("Studio staff can read their tenant's expense", async () => {
    await seed("expenses", "exp-1", rec);
    await assertSucceeds(studioCtx().firestore().collection("expenses").doc("exp-1").get());
  });

  it("Staff from another tenant cannot read", async () => {
    await seed("expenses", "exp-1", rec);
    await assertFails(studioCtx("uid-x", OTHER_TENANT).firestore().collection("expenses").doc("exp-1").get());
  });

  it("Customers cannot read expenses", async () => {
    await seed("expenses", "exp-1", rec);
    await assertFails(customerCtx("uid-cust").firestore().collection("expenses").doc("exp-1").get());
  });

  it("No client writes, even from admin in the same tenant", async () => {
    await assertFails(adminCtx().firestore().collection("expenses").doc("exp-x").set(rec));
    await seed("expenses", "exp-1", rec);
    await assertFails(adminCtx().firestore().collection("expenses").doc("exp-1").delete());
  });
});

// ─── /inventoryItems + /inventoryTxns ─────────────────────────────────────────

describe("/inventoryItems + /inventoryTxns — staff tenant read, no client writes", () => {
  const item = { name: "Ceramic shampoo", category: "WASH", unit: "ML", stockQty: 500, active: true };
  const txn = { itemId: "inv-1", type: "USAGE", qtyDelta: -50 };

  it("Studio staff can read items and txns in their tenant", async () => {
    await seed("inventoryItems", "inv-1", item);
    await seed("inventoryTxns", "txn-1", txn);
    await assertSucceeds(studioCtx().firestore().collection("inventoryItems").doc("inv-1").get());
    await assertSucceeds(studioCtx().firestore().collection("inventoryTxns").doc("txn-1").get());
  });

  it("Cross-tenant staff cannot read items or txns", async () => {
    await seed("inventoryItems", "inv-1", item);
    await seed("inventoryTxns", "txn-1", txn);
    await assertFails(studioCtx("uid-x", OTHER_TENANT).firestore().collection("inventoryItems").doc("inv-1").get());
    await assertFails(studioCtx("uid-x", OTHER_TENANT).firestore().collection("inventoryTxns").doc("txn-1").get());
  });

  it("No client writes to items or txns (stock moves via recordInventoryTxn only)", async () => {
    await assertFails(studioCtx().firestore().collection("inventoryItems").doc("inv-x").set(item));
    await assertFails(studioCtx().firestore().collection("inventoryTxns").doc("txn-x").set(txn));
    await seed("inventoryItems", "inv-1", item);
    await assertFails(adminCtx().firestore().collection("inventoryItems").doc("inv-1").update({ stockQty: 0 }));
  });
});

// ─── /papers ──────────────────────────────────────────────────────────────────

describe("/papers — staff tenant read, owner read, no client writes", () => {
  const rec = { vehicleId: "veh-1", customerId: "uid-owner", kind: "INSURANCE", reference: "POL-123", status: "PENDING" };

  it("Studio staff can read their tenant's paper", async () => {
    await seed("papers", "pap-1", rec);
    await assertSucceeds(studioCtx().firestore().collection("papers").doc("pap-1").get());
  });

  it("The vehicle owner can read their own paper", async () => {
    await seed("papers", "pap-1", rec);
    await assertSucceeds(customerCtx("uid-owner").firestore().collection("papers").doc("pap-1").get());
  });

  it("A different customer cannot read it", async () => {
    await seed("papers", "pap-1", rec);
    await assertFails(customerCtx("uid-other").firestore().collection("papers").doc("pap-1").get());
  });

  it("Cross-tenant staff cannot read", async () => {
    await seed("papers", "pap-1", rec);
    await assertFails(studioCtx("uid-x", OTHER_TENANT).firestore().collection("papers").doc("pap-1").get());
  });

  it("No client writes, including the owner changing status", async () => {
    await seed("papers", "pap-1", rec);
    await assertFails(customerCtx("uid-owner").firestore().collection("papers").doc("pap-1").update({ status: "VERIFIED" }));
    await assertFails(studioCtx().firestore().collection("papers").doc("pap-x").set(rec));
  });
});

// ─── /dailyClosings ───────────────────────────────────────────────────────────

describe("/dailyClosings — staff tenant read, no client writes", () => {
  const rec = { date: "2026-09-24", status: "CLOSED", expectedCashPaise: 45000, countedCashPaise: 44800, variancePaise: -200 };

  it("Studio staff can read their tenant's close", async () => {
    await seed("dailyClosings", "dc-1", rec);
    await assertSucceeds(studioCtx().firestore().collection("dailyClosings").doc("dc-1").get());
  });

  it("Customers cannot read closes", async () => {
    await seed("dailyClosings", "dc-1", rec);
    await assertFails(customerCtx("uid-cust").firestore().collection("dailyClosings").doc("dc-1").get());
  });

  it("No client writes, even from admin", async () => {
    await assertFails(adminCtx().firestore().collection("dailyClosings").doc("dc-x").set(rec));
    await seed("dailyClosings", "dc-1", rec);
    await assertFails(adminCtx().firestore().collection("dailyClosings").doc("dc-1").update({ countedCashPaise: 99999 }));
  });
});

// ─── /gallery ─────────────────────────────────────────────────────────────────

describe("/gallery — public read of active only, staff tenant read, no client writes", () => {
  const activeImg = { imageUrl: "https://example.com/a.jpg", category: "PPF", active: true };
  const hiddenImg = { imageUrl: "https://example.com/h.jpg", category: "PPF", active: false };

  it("Anyone (unauthenticated) can read an ACTIVE image", async () => {
    await seed("gallery", "gal-1", activeImg);
    await assertSucceeds(testEnv.unauthenticatedContext().firestore().collection("gallery").doc("gal-1").get());
  });

  it("Unauthenticated cannot read an INACTIVE image", async () => {
    await seed("gallery", "gal-2", hiddenImg);
    await assertFails(testEnv.unauthenticatedContext().firestore().collection("gallery").doc("gal-2").get());
  });

  it("Customers cannot read inactive images either", async () => {
    await seed("gallery", "gal-2", hiddenImg);
    await assertFails(customerCtx("uid-cust").firestore().collection("gallery").doc("gal-2").get());
  });

  it("Staff can read inactive images in their tenant", async () => {
    await seed("gallery", "gal-2", hiddenImg);
    await assertSucceeds(studioCtx().firestore().collection("gallery").doc("gal-2").get());
  });

  it("No client writes at all, even from admin", async () => {
    await assertFails(adminCtx().firestore().collection("gallery").doc("gal-x").set(activeImg));
    await seed("gallery", "gal-1", activeImg);
    await assertFails(adminCtx().firestore().collection("gallery").doc("gal-1").update({ active: false }));
  });
});
