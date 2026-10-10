// One visit == one job == one invoice.
// Every payment path (confirmManualPayment, recordManualPayment, confirmPaymentMock)
// issues its invoice through here so they all agree on identity, line items and snapshots.
// Separate jobs (separate visits) never share an invoice, even for the same car or day;
// services added to the SAME job via approved additional-work requests become extra
// line items on that job's single invoice.
import type { Firestore, Transaction, DocumentReference } from "firebase-admin/firestore";
import type { ApprovalRequest, Customer, Invoice, ServiceJob, Vehicle, VehicleSnapshot } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { allocateInvoiceNumber } from "./invoice-counter.js";
import { buildInvoice } from "./invoice-builder.js";
import { resolveServiceName } from "./service-name.js";

export function invoiceIdForJob(jobId: string): string {
  return `inv_${jobId}`;
}

export function snapshotVehicle(v: Vehicle): VehicleSnapshot {
  return {
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model,
    year: v.year,
    color: v.color,
    photoUrl: v.photoUrl ?? null,
  };
}

export type PreparedJobInvoice =
  | { existing: true; invoiceId: string }
  | { existing: false; invoiceRef: DocumentReference; invoice: Invoice };

// Must run inside a transaction BEFORE any write in that transaction (it reads, then
// allocates the invoice number, which writes the counter). Returns the existing live
// invoice for the job when there is one, so callers never create a second.
export async function prepareJobInvoice(
  db: Firestore,
  tx: Transaction,
  job: ServiceJob,
  paymentId: string | null,
): Promise<PreparedJobInvoice> {
  const invoices = db.collection(COLLECTIONS.invoices());

  const [priorSnap, approvalsSnap, vehicleSnap, customerSnap, fixedSnap] = await Promise.all([
    tx.get(invoices.where("jobId", "==", job.id).where("tenantId", "==", job.tenantId)),
    tx.get(
      db
        .collection(COLLECTIONS.approvals())
        .where("jobId", "==", job.id)
        .where("status", "==", "approved"),
    ),
    tx.get(db.collection(COLLECTIONS.vehicles()).doc(job.vehicleId)),
    tx.get(db.collection(COLLECTIONS.customers()).doc(job.customerId)),
    tx.get(invoices.doc(invoiceIdForJob(job.id))),
  ]);

  const live = priorSnap.docs.find((d) => (d.data() as Invoice).status !== "void");
  if (live) return { existing: true, invoiceId: live.id };

  const additionalWork = approvalsSnap.docs
    .map((d) => d.data() as ApprovalRequest)
    .filter((a) => a.tenantId === job.tenantId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const serviceName = await resolveServiceName(db, tx, job.tenantId, job.serviceId);

  const vehicle = vehicleSnap.exists ? (vehicleSnap.data() as Vehicle) : null;
  const vehicleSnapshot =
    vehicle && vehicle.tenantId === job.tenantId ? snapshotVehicle(vehicle) : job.vehicleSnapshot;
  const customer = customerSnap.exists ? (customerSnap.data() as Customer) : null;
  const customerSnapshot =
    customer && customer.tenantId === job.tenantId && customer.name ? { name: customer.name } : undefined;

  // Deterministic id for the first invoice of a job; a later one (after a void) gets an auto id.
  const invoiceRef = fixedSnap.exists ? invoices.doc() : invoices.doc(invoiceIdForJob(job.id));
  const invoiceNumber = await allocateInvoiceNumber(tx, db, job.tenantId);
  const invoice = buildInvoice({
    invoiceId: invoiceRef.id,
    invoiceNumber,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
    customerId: job.customerId,
    vehicleId: job.vehicleId,
    priceBreakdown: job.priceBreakdown,
    paymentId,
    serviceName,
    serviceId: job.serviceId,
    additionalWork,
    ...(vehicleSnapshot ? { vehicleSnapshot } : {}),
    ...(customerSnapshot ? { customerSnapshot } : {}),
  });
  return { existing: false, invoiceRef, invoice };
}
