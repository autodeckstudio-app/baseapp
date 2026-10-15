// Text chat on a job. The customer writes on their own job; studio or admin staff reply. Text only, 500 characters.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { canMessageJob, cleanJobMessage, type Employee, type JobMessage, type Notification, type ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

const schema = z.object({ jobId: z.string().min(1), text: z.string().max(2000) }).strict();

export const sendJobMessage = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "jobMessage.send");
  const clean = cleanJobMessage(data.text);
  if (!clean.ok) throw new HttpsError("invalid-argument", clean.error);

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;
  assertTenant(user, job.tenantId);
  const customer = user.claims.role === "customer";
  if (customer) {
    if (job.customerId !== user.uid) throw new HttpsError("permission-denied", "That is not your visit.");
  } else {
    assertStudio(user, job.studioId, "Job");
  }
  if (!canMessageJob(job, Date.now())) throw new HttpsError("failed-precondition", "Messages are closed for this visit. Please call the studio.");

  const ref = db.collection(COLLECTIONS.jobMessages()).doc();
  const now = new Date().toISOString();
  const msg: JobMessage = { id: ref.id, tenantId: job.tenantId, studioId: job.studioId, jobId: job.id, customerId: job.customerId, sender: customer ? "customer" : "studio", senderName: customer ? null : "The studio", text: clean.text, createdAt: now };
  await db.runTransaction(async (tx) => {
    tx.create(ref, msg);
    if (!customer && job.bookingId) {
      const n: Notification = { id: `job-message-${ref.id}`, tenantId: job.tenantId, userId: job.customerId, auditLogId: ref.id, type: "job_message", title: "Message from the studio", body: clean.text.length > 120 ? `${clean.text.slice(0, 117)}...` : clean.text, entityType: "Booking", entityId: job.bookingId, createdAt: now, readAt: null };
      tx.create(db.collection(COLLECTIONS.notifications()).doc(n.id), n);
    }
  });
  if (customer) await notifyStaff(db, job, ref.id, clean.text, now);
  return { id: ref.id };
});

/** Push to the studio's active staff (all admins, and studio staff of this studio). One alert per job per person per 5 minutes, so a burst of messages is one buzz. */
async function notifyStaff(db: FirebaseFirestore.Firestore, job: ServiceJob, messageId: string, text: string, nowIso: string): Promise<void> {
  const staff = await db.collection(COLLECTIONS.employees()).where("tenantId", "==", job.tenantId).where("active", "==", true).get();
  const bucket = Math.floor(Date.parse(nowIso) / (5 * 60_000));
  for (const d of staff.docs) {
    const e = d.data() as Employee;
    if (!e.authUid || e.terminatedAt) continue;
    if (e.role === "studio" && e.studioId !== job.studioId) continue;
    const id = `job-message-staff-${job.id}-${e.authUid}-${bucket}`;
    const n: Notification = { id, tenantId: job.tenantId, userId: e.authUid, auditLogId: messageId, type: "job_message_staff", title: "Customer message", body: text.length > 120 ? `${text.slice(0, 117)}...` : text, entityType: "Job", entityId: job.id, createdAt: nowIso, readAt: null };
    try { await db.collection(COLLECTIONS.notifications()).doc(id).create(n); } catch (err) { if ((err as { code?: number }).code !== 6) throw err; }
  }
}
