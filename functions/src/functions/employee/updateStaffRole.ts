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
import { updateStaffRoleSchema } from "../../schemas/employee.js";

// Admin-only. Changes a staff member's role/studio scope. Custom claims and the
// Employee record are updated together so they never drift out of sync.
export const updateStaffRole = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(updateStaffRoleSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "employee.updateRole");

  if (data.role === "admin" && data.studioId !== null) {
    throw new HttpsError(
      "invalid-argument",
      "Tenant admins are not studio-scoped — studioId must be null for role 'admin'.",
    );
  }
  if (data.role === "studio" && data.studioId === null) {
    throw new HttpsError("invalid-argument", "Studio staff require a studioId.");
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.employees()).doc(data.employeeId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Employee not found.");

  const existing = snap.data() as Employee;
  assertTenant(user, existing.tenantId);

  if (existing.terminatedAt) {
    throw new HttpsError("failed-precondition", "Cannot change role of a terminated employee.");
  }

  const adminAuth = getAuth();
  await adminAuth.setCustomUserClaims(existing.authUid, {
    role: data.role,
    tenantId: existing.tenantId,
    studioId: data.studioId,
  });

  const now = new Date().toISOString();

  // Phase 5B P2-2 fix: if the Firestore write below fails after the claims
  // write above already succeeded (transient error), Auth and Firestore
  // would drift apart — exactly what this function's own header comment
  // says it exists to prevent. Same compensating pattern as
  // addStaffMember.ts's orphan fix (P1-6): on failure, roll the claims back
  // to their pre-change values so Auth and Firestore stay consistent with
  // each other (both showing the OLD role) instead of drifting. Unlike
  // addStaffMember, reordering (Firestore first) isn't strictly safer here —
  // it would just move the same drift risk to the other direction — so
  // compensation is the right fix, not reordering.
  try {
    await db.runTransaction(async (tx) => {
      tx.update(ref, { role: data.role, studioId: data.studioId, updatedAt: now });
      writeAuditLog(tx, {
        action: "employee.role_changed",
        entityType: "Employee",
        entityId: data.employeeId,
        user,
        studioId: data.studioId,
        before: { role: existing.role, studioId: existing.studioId },
        after: { role: data.role, studioId: data.studioId },
      });
    });
  } catch (err) {
    await adminAuth
      .setCustomUserClaims(existing.authUid, {
        role: existing.role,
        tenantId: existing.tenantId,
        studioId: existing.studioId,
      })
      .catch(() => undefined);
    throw err;
  }

  return { employeeId: data.employeeId, role: data.role };
});
