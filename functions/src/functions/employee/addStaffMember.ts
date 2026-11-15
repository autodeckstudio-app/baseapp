import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Employee } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { addStaffMemberSchema } from "../../schemas/employee.js";

// Admin-only. Adds a person to the staff roster by their Google account
// email, always scoped to the calling admin's own tenant (never
// client-specified, never cross-tenant).
//
// No Firebase Auth account or password is created here. The person signs in
// with Google; the role resolver (apps/admin/src/lib/role-resolver.ts, and
// resolveClaims once Functions are deployed) matches their VERIFIED email to
// this active roster entry and sets their claims. If an account with that
// email already exists (for example they booked as a customer first), it is
// linked and promoted right away.
//
// Role model (docs/19-multitenant-saas-architecture.md):
//   'admin'  = tenant admin, full access within tenantId, NOT studio-scoped.
//   'studio' = studio staff, scoped to a single studioId.
export const addStaffMember = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(addStaffMemberSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "employee.add");

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
  const adminAuth = getAuth();
  const tenantId = user.claims.tenantId; // server-derived — never from client
  const email = data.email.toLowerCase();

  const dup = await db
    .collection(COLLECTIONS.employees())
    .where("email", "==", email)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (!dup.empty) {
    throw new HttpsError("already-exists", "This email is already on the staff roster.");
  }

  const existingAccount = await adminAuth.getUserByEmail(email).catch(() => null);
  if (existingAccount?.customClaims?.["role"] === "superadmin") {
    throw new HttpsError("failed-precondition", "Platform accounts cannot be added as staff.");
  }

  const now = new Date().toISOString();
  const employeeRef = db.collection(COLLECTIONS.employees()).doc();
  const employee: Employee = {
    id: employeeRef.id,
    tenantId,
    studioId: data.studioId,
    authUid: existingAccount?.uid ?? "",
    email,
    name: data.name,
    phone: data.phone ?? "",
    role: data.role,
    active: true,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
  };

  await db.runTransaction(async (tx) => {
    tx.set(employeeRef, employee);
    writeAuditLog(tx, {
      action: "employee.created",
      entityType: "Employee",
      entityId: employeeRef.id,
      user,
      studioId: data.studioId,
      after: { name: data.name, email, role: data.role, studioId: data.studioId },
    });
  });

  // Promote an already-existing account now so the person does not need to
  // sign out and back in. Only a verified email is trusted, matching the
  // resolver. If this fails the roster entry still stands and the resolver
  // applies the same claims at next sign-in.
  if (existingAccount?.emailVerified) {
    await adminAuth
      .setCustomUserClaims(existingAccount.uid, { role: data.role, tenantId, studioId: data.studioId })
      .then(() => adminAuth.revokeRefreshTokens(existingAccount.uid))
      .catch(() => undefined);
  }

  return { employeeId: employeeRef.id };
});
