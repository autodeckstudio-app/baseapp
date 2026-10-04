import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { COLLECTIONS } from "@autodeck/database";
import { purgeCustomerData } from "../../lib/purge-customer.js";

/**
 * Daily at 02:30 IST. Erases customers whose deletion request is past its 30 days and was not cancelled.
 * Invoices, payments, bookings, jobs and warranties are kept (8 years) and the customer record is anonymised.
 * Each request is handled on its own: one failure is recorded on that request and does not stop the rest.
 */
export const processAccountDeletionsScheduled = onSchedule(
  { schedule: "30 2 * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const db = getFirestore();
    const nowIso = new Date().toISOString();
    const due = await db.collection(COLLECTIONS.accountDeletionRequests()).where("status", "==", "REQUESTED").limit(200).get();
    for (const doc of due.docs) {
      const purgeAfter = doc.get("purgeAfter") as string | undefined;
      const tenantId = doc.get("tenantId") as string | undefined;
      const customerId = (doc.get("customerId") as string | undefined) ?? doc.id;
      if (!purgeAfter || purgeAfter > nowIso || !tenantId) continue;
      try {
        const summary = await purgeCustomerData(db, tenantId, customerId, nowIso);
        try {
          await getAuth().deleteUser(customerId);
        } catch (e) {
          if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
        }
        await doc.ref.update({ status: "COMPLETED", completedAt: nowIso, summary });
      } catch (e) {
        await doc.ref.update({ lastError: String((e as Error).message ?? e).slice(0, 300), lastErrorAt: nowIso });
      }
    }
  },
);
