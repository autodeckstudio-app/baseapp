import { describe, it, expect } from "vitest";
import { calculatePrice } from "../../lib/pricing.js";
import { buildInvoice, netFromGross } from "../../lib/invoice-builder.js";
import { prepareJobInvoice, invoiceIdForJob } from "../../lib/job-invoice.js";
import { displayLineItemName } from "@autodeck/core";
import { fakeFirestore } from "./fake-firestore.js";

const pb = calculatePrice({ basePrice: 500000, vehicleCategory: "hatchback", vehicleCategoryPricing: [] });

function approval(id: string, name: string, unitPrice: number, quantity = 1, status = "approved") {
  return {
    id, tenantId: "t", jobId: "job1", serviceId: `svc-${id}`, serviceName: name,
    quantity, unitPrice, priceImpact: unitPrice * quantity, status, createdAt: `2026-10-10T0${id}:00:00Z`,
  };
}

function job(over: Record<string, unknown> = {}) {
  const extra = (over.additionalWorkDelta as number) ?? 0;
  return {
    id: "job1", tenantId: "t", studioId: "s", bookingId: "b1", customerId: "c1", vehicleId: "v1",
    serviceId: "svcA", priceBreakdown: pb, totalAmount: pb.total + extra, additionalWorkDelta: extra, ...over,
  } as never;
}

describe("netFromGross", () => {
  it("net + GST always reproduces the gross", () => {
    // gross values as calculatePrice produces them: net + round(18% of net)
    for (const n of [10000, 5000, 104625, 1, 84745, 1750000]) {
      const g = n + Math.round((n * 18) / 100);
      const net = netFromGross(g, 18);
      expect(net + Math.round((net * 18) / 100)).toBe(g);
    }
  });
});

describe("buildInvoice: one visit, several services", () => {
  it("combines base service and approved extras on ONE invoice that equals job.totalAmount", () => {
    const a1 = approval("1", "Engine Bay Clean", 118000);
    const a2 = approval("2", "Headlight Restore", 59000, 2);
    const inv = buildInvoice({
      invoiceId: "i", invoiceNumber: "INV-1", tenantId: "t", studioId: "s", jobId: "job1", bookingId: "b1",
      customerId: "c1", vehicleId: "v1", priceBreakdown: pb, paymentId: "p", serviceName: "Premium Wash",
      additionalWork: [a1, a2] as never,
    });
    const names = inv.lineItems.map((l) => l.description);
    expect(names).toEqual(["Premium Wash", "Engine Bay Clean", "Headlight Restore"]);
    expect(inv.lineItems[2]!.quantity).toBe(2);
    expect(inv.total).toBe(pb.total + 118000 + 118000);
    expect(inv.subtotal - inv.discount + inv.tax).toBe(inv.total);
    expect(inv.visitId).toBe("job1");
  });
  it("ignores unapproved requests and leaves single-service invoices identical", () => {
    const base = buildInvoice({
      invoiceId: "i", invoiceNumber: "n", tenantId: "t", studioId: "s", jobId: "job1", bookingId: null,
      customerId: "c1", vehicleId: "v1", priceBreakdown: pb, paymentId: "p", serviceName: "Wash",
      additionalWork: [approval("1", "X", 1000, 1, "rejected")] as never,
    });
    expect(base.lineItems).toHaveLength(1);
    expect(base.total).toBe(pb.total);
    expect(base.tax).toBe(pb.tax);
  });
});

describe("prepareJobInvoice: identity, idempotency, snapshots", () => {
  const seed = () => ({
    services: { svcA: { tenantId: "t", name: "Premium Wash" } },
    vehicles: { v1: { tenantId: "t", ownerId: "c1", registrationNumber: "GJ01AB1234", make: "Tata", model: "Nexon", year: 2022, color: "Blue", photoUrl: null } },
    customers: { c1: { tenantId: "t", name: "Asha" } },
    approvals: {
      a1: approval("1", "Engine Bay Clean", 118000),
      a2: { ...approval("2", "Other visit extra", 5000), jobId: "job2" },
      a3: approval("3", "Rejected extra", 7000, 1, "rejected"),
    },
  });

  it("uses a deterministic per-job id and snapshots name, vehicle and customer; only this job's approved extras", async () => {
    const { db } = fakeFirestore(seed() as never);
    const j = job({ additionalWorkDelta: 118000 });
    const r = await prepareJobInvoice(db, db.runTransaction ? ({ get: async (x: any) => x.get(), set() {}, } as never) : (null as never), j, "p1");
    expect(r.existing).toBe(false);
    if (r.existing) return;
    expect(r.invoice.id).toBe(invoiceIdForJob("job1"));
    expect(r.invoice.lineItems.map((l) => l.description)).toEqual(["Premium Wash", "Engine Bay Clean"]);
    expect(r.invoice.total).toBe((j as any).totalAmount);
    expect(r.invoice.vehicleSnapshot).toMatchObject({ registrationNumber: "GJ01AB1234", model: "Nexon" });
    expect(r.invoice.customerSnapshot).toEqual({ name: "Asha" });
  });

  it("returns the existing live invoice instead of making a second one; a voided one allows a new invoice", async () => {
    const s = seed() as any;
    s.invoices = { inv_job1: { tenantId: "t", jobId: "job1", status: "issued" } };
    const { db } = fakeFirestore(s);
    const tx = { get: async (x: any) => x.get(), set() {} } as never;
    const r = await prepareJobInvoice(db, tx, job(), "p2");
    expect(r).toEqual({ existing: true, invoiceId: "inv_job1" });

    s.invoices.inv_job1.status = "void";
    const f2 = fakeFirestore(s);
    const r2 = await prepareJobInvoice(f2.db, tx, job(), "p3");
    expect(r2.existing).toBe(false);
    if (!r2.existing) expect(r2.invoice.id).not.toBe("inv_job1");
  });

  it("different visits (jobs) of the same car on the same day get separate invoices", async () => {
    const { db } = fakeFirestore(seed() as never);
    const tx = { get: async (x: any) => x.get(), set() {} } as never;
    const a = await prepareJobInvoice(db, tx, job({ id: "jobA", scheduledDate: "2026-10-10" }), "p");
    const b = await prepareJobInvoice(db, tx, job({ id: "jobB", scheduledDate: "2026-10-10" }), "p");
    if (a.existing || b.existing) throw new Error("expected new");
    expect(a.invoice.id).not.toBe(b.invoice.id);
    expect(a.invoice.jobId).toBe("jobA");
    expect(b.invoice.lineItems).toHaveLength(1);
  });

  it("missing catalogue entry: generic name, never the raw id", async () => {
    const s = seed() as any;
    delete s.services.svcA;
    const { db } = fakeFirestore(s);
    const tx = { get: async (x: any) => x.get(), set() {} } as never;
    const r = await prepareJobInvoice(db, tx, job(), "p");
    if (r.existing) throw new Error("x");
    expect(r.invoice.lineItems[0]!.description).toBe("Service");
    expect(JSON.stringify(r.invoice.lineItems.map((l) => l.description))).not.toContain("svcA");
  });

  it("uses the job's vehicleSnapshot when the car record is already gone", async () => {
    const s = seed() as any;
    delete s.vehicles.v1;
    const { db } = fakeFirestore(s);
    const tx = { get: async (x: any) => x.get(), set() {} } as never;
    const snapshot = { registrationNumber: "GJ05ZZ9999", make: "Kia", model: "Seltos", year: 2021, color: "Red", photoUrl: null };
    const r = await prepareJobInvoice(db, tx, job({ vehicleSnapshot: snapshot }), "p");
    if (r.existing) throw new Error("x");
    expect(r.invoice.vehicleSnapshot).toEqual(snapshot);
  });
});

describe("displayLineItemName (older invoices)", () => {
  it("hides legacy raw-id labels, keeps real names", () => {
    expect(displayLineItemName("Service 4fK9aQ2xLmN0pR7sTuVw")).toBe("Service");
    expect(displayLineItemName("Service svc_12345")).toBe("Service");
    expect(displayLineItemName("4fK9aQ2xLmN0pR7sTuVw")).toBe("Service");
    expect(displayLineItemName("")).toBe("Service");
    expect(displayLineItemName(undefined)).toBe("Service");
    expect(displayLineItemName("Ceramic Coating")).toBe("Ceramic Coating");
    expect(displayLineItemName("Service Package")).toBe("Service Package");
  });
});
