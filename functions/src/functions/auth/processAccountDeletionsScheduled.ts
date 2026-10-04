import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";

/**
 * Daily check for deletion requests whose 30 day period is over.
 * DRY RUN ONLY in this release: it records which requests are due on the request itself
 * (dueForPurgeAt) and erases nothing. Actual erasure is switched on in a later release,
 * once the owner has signed off the exact list of data to remove and to anonymise
 * (invoices and warranty records are kept for 8 years with name and phone anonymised).
 */
export const processAccountDeletionsScheduled = onSchedule(
  { schedule: "30 2 * * *", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const db = getFirestore();
    const nowIso = new Date().toISOString();
    const due = await db
      .collection(COLLECTIONS.accountDeletionRequests())
      .where("status", "==", "REQUESTED")
      .limit(500)
      .get();
    for (const doc of due.docs) {
      if (doc.get("dueForPurgeAt")) continue;
      const purgeAfter = doc.get("purgeAfter") as string | undefined;
      if (!purgeAfter || purgeAfter > nowIso) continue;
      await doc.ref.update({ dueForPurgeAt: nowIso });
    }
  },
);
