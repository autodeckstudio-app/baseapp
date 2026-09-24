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

// Admin-only. Soft-deletes a staff member: demotes their account to customer,
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

  // Demote, don't disable. Staff sign in with their own Google account,
  // which may also be how they book as a customer. Deactivation drops the
  // account to customer claims and kills live sessions, so staff access
  // ends immediately (the admin session cookie is verified with
  // checkRevoked) while the person keeps their customer history. The role
  // resolver also re-checks the roster at every sign-in, so an inactive
  // entry can never grant staff claims again.
  const adminAuth = getAuth();
  if (existing.authUid) {
    await adminAuth.setCustomUserClaims(existing.authUid, {
      role: "customer",
      tenantId: existing.tenantId,
      studioId: null,
    });
    await adminAuth.revokeRefreshTokens(existing.authUid);
  }

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
