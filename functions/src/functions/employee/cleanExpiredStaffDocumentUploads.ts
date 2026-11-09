import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
/** Remove expired unsubmitted uploads and superseded copies, never the current employee submission. */
export const cleanExpiredStaffDocumentUploads = onSchedule(
  { region: "asia-south1", schedule: "every 60 minutes" },
  async () => {
    const db = getFirestore(),
      now = new Date().toISOString();
    let cursor: any = null;
    while (true) {
      let q = db
        .collection("staffDocumentUploads")
        .where("expiresAt", "<=", now)
        .orderBy("expiresAt")
        .limit(100);
      if (cursor) q = q.startAfter(cursor);
      const candidates = await q.get();
      if (candidates.empty) break;
      for (const candidate of candidates.docs) {
        const path = await db.runTransaction(async (tx) => {
          const intent = await tx.get(candidate.ref),
            u = intent.data();
          if (
            !u ||
            Date.parse(u.expiresAt) > Date.now() ||
            !u.employeeId ||
            !u.tenantId
          )
            return null;
          const current = await tx.get(
            db.collection("staffDocuments").doc(u.employeeId),
          );
          if (current.data()?.revision === candidate.id) return null;
          const prefix = `${u.tenantId}/staffPrivate/${u.employeeId}/`;
          if (
            typeof u.path !== "string" ||
            !u.path.startsWith(prefix) ||
            u.path.slice(prefix.length).includes("/") ||
            u.path.includes("..")
          )
            throw Error("Invalid private document cleanup scope.");
          tx.update(candidate.ref, { cleanupClaimed: true });
          return u.path as string;
        });
        if (path) {
          await getStorage()
            .bucket()
            .file(path)
            .delete({ ignoreNotFound: true });
          await candidate.ref.delete();
        }
      }
      cursor = candidates.docs.at(-1);
      if (candidates.size < 100) break;
    }
  },
);
