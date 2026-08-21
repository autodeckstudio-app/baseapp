import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Employee } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { deactivateStaffMemberSchema } from "../../schemas/employee.js";

// Admin-only. Soft-deletes a staff member: disables the Firebase Auth account,
// revokes any live sessions, and marks the Employee record terminated.
// Never a hard delete — historical job/audit references must stay resolvable.
export const deactivateStaffMember = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(deactivateStaffMemberSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "employee.deactivate");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.employees()).doc(data.employeeId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Employee not found.");

  const existing = snap.data() as Employee;
  assertTenant(user, existing.tenantId);

  if (existing.terminatedAt) {
    return { employeeId: data.employeeId, alreadyTerminated: true };
  }

  const adminAuth = getAuth();
  await adminAuth.updateUser(existing.authUid, { disabled: true });
  await adminAuth.revokeRefreshTokens(existing.authUid);

  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    tx.update(ref, { active: false, terminatedAt: now, updatedAt: now });
    writeAuditLog(tx, {
      action: "employee.deactivated",
      entityType: "Employee",
      entityId: data.employeeId,
      user,
      studioId: existing.studioId,
      before: { active: true },
      after: { active: false, terminatedAt: now },
    });
  });

  return { employeeId: data.employeeId, alreadyTerminated: false };
});
