import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

export const ANONYMISED_NAME = "Deleted customer";

export interface PurgeSummary {
  notificationsDeleted: number;
  pushTokenDeleted: boolean;
  vehiclesCleared: number;
  customerAnonymised: boolean;
}

/**
 * Erases one customer's personal data after the retention rules the owner set:
 * - kept (untouched, except the customer name copy on invoices is anonymised): invoices, payments, bookings, jobs, warranties, inspections. They only point at the customer id and stay valid for 8 years.
 * - anonymised: the customer record (name, phone, email removed) so those records no longer identify a person.
 * - deleted: notifications, the push token, vehicle photos. Plates stay on the vehicle record for warranty.
 * Idempotent: running it again changes nothing. The Auth user is removed by the caller.
 */
export async function purgeCustomerData(db: Firestore, tenantId: string, customerId: string, nowIso: string): Promise<PurgeSummary> {
  const summary: PurgeSummary = { notificationsDeleted: 0, pushTokenDeleted: false, vehiclesCleared: 0, customerAnonymised: false };

  const notes = await db.collection(COLLECTIONS.notifications()).where("userId", "==", customerId).get();
  for (const d of notes.docs) {
    if (d.get("tenantId") && d.get("tenantId") !== tenantId) continue;
    await d.ref.delete();
    summary.notificationsDeleted += 1;
  }

  const tokenRef = db.collection("pushTokens").doc(customerId);
  if ((await tokenRef.get()).exists) {
    await tokenRef.delete();
    summary.pushTokenDeleted = true;
  }

  const cars = await db.collection(COLLECTIONS.vehicles()).where("ownerId", "==", customerId).get();
  for (const d of cars.docs) {
    if (d.get("tenantId") !== tenantId) continue;
    if (d.get("photoUrl")) {
      await d.ref.update({ photoUrl: null, updatedAt: nowIso });
      summary.vehiclesCleared += 1;
    }
  }

  // Invoices stay (retention), but the customer name copied onto them is anonymised too.
  const invs = await db.collection(COLLECTIONS.invoices()).where("customerId", "==", customerId).get();
  for (const d of invs.docs) {
    if (d.get("tenantId") !== tenantId) continue;
    if (d.get("customerSnapshot") && d.get("customerSnapshot").name !== ANONYMISED_NAME) {
      await d.ref.update({ customerSnapshot: { name: ANONYMISED_NAME } });
    }
  }

  const custRef = db.collection(COLLECTIONS.customers()).doc(customerId);
  const cust = await custRef.get();
  if (cust.exists && cust.get("tenantId") === tenantId) {
    await custRef.update({ name: ANONYMISED_NAME, phone: "", email: null, deletedAt: nowIso, anonymisedAt: nowIso, updatedAt: nowIso });
    summary.customerAnonymised = true;
  }
  return summary;
}
