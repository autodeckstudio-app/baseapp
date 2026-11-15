// Atomic invoice number generation via Firestore transaction.
// Guarantees uniqueness without race conditions.
// Format: INV-{YYYY}-{5-digit-zero-padded} e.g. "INV-2026-00001"
import type { Transaction, Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

interface CounterDoc {
  tenantId: string;
  nextNumber: number;
  year: number;
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
}

// Must be called inside an existing Firestore transaction.
// Returns the allocated invoice number and updates the counter within the transaction.
export async function allocateInvoiceNumber(
  tx: Transaction,
  db: Firestore,
  tenantId: string,
): Promise<string> {
  const counterRef = db.collection(COLLECTIONS.invoiceCounters()).doc(tenantId);
  const snap = await tx.get(counterRef);

  const now = new Date();
  const year = now.getUTCFullYear();

  let nextNumber = 1;

  if (snap.exists) {
    const data = snap.data() as CounterDoc;
    // Reset sequence on new calendar year
    nextNumber = data.year === year ? data.nextNumber : 1;
  }

  const invoiceNumber = formatInvoiceNumber(year, nextNumber);

  tx.set(counterRef, {
    tenantId,
    nextNumber: nextNumber + 1,
    year,
  });

  return invoiceNumber;
}
