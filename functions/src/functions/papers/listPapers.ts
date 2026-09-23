import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { PaperVerification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listPapersSchema } from "../../schemas/paper.js";
import { utcToLocalDate } from "../../lib/schedule.js";

// Studio-and-above read: papers for one studio with expiry flags computed
// server-side (expired / expiring within 30 days, Asia/Kolkata today).
export const listPapers = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(listPapersSchema, request.data);
  assertStudio(user, data.studioId, "Paper");
  await enforceRateLimit(subjectFrom(user), "paper.read");

  const db = getFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.papers())
    .where("tenantId", "==", user.claims.tenantId)
    .where("studioId", "==", data.studioId);
  if (data.vehicleId) query = query.where("vehicleId", "==", data.vehicleId);
  if (data.status) query = query.where("status", "==", data.status);
  query = query.orderBy("createdAt", "desc").limit(500);

  const snap = await query.get();
  const today = utcToLocalDate(new Date(), "Asia/Kolkata");
  const in30 = new Date(`${today}T00:00:00Z`);
  in30.setUTCDate(in30.getUTCDate() + 30);
  const soon = in30.toISOString().slice(0, 10);

  const papers = snap.docs.map((d) => {
    const p = d.data() as PaperVerification;
    return {
      ...p,
      expired: p.expiresOn !== null && p.expiresOn < today,
      expiringSoon: p.expiresOn !== null && p.expiresOn >= today && p.expiresOn <= soon,
    };
  });
  return { papers, pendingCount: papers.filter((p) => p.status === "PENDING").length };
});
