import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Employee } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { addStaffMemberSchema } from "../../schemas/employee.js";

// Admin-only. Provisions a new staff account: creates the Firebase Auth user,
// sets custom claims, and writes the Employee record — always scoped to the
// calling admin's own tenant (never client-specified, never cross-tenant).
//
// Role model (approved — see docs/19-multitenant-saas-architecture.md):
//   'admin'  = tenant admin, full access within tenantId, NOT studio-scoped.
//   'studio' = studio staff, scoped to a single studioId.
// There is no separate "studio admin" role — do not invent one here.
export const addStaffMember = onCall({ region: "asia-south1" }, async (request) => {
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

  const existing = await adminAuth.getUserByEmail(data.email).catch(() => null);
  if (existing) {
    throw new HttpsError("already-exists", "An account with this email already exists.");
  }

  const authUser = await adminAuth.createUser({
    email: data.email,
    password: data.password,
    displayName: data.name,
    emailVerified: false,
  });

  await adminAuth.setCustomUserClaims(authUser.uid, {
    role: data.role,
    tenantId,
    studioId: data.studioId,
  });

  const now = new Date().toISOString();
  const employeeRef = db.collection(COLLECTIONS.employees()).doc(authUser.uid);
  const employee: Employee = {
    id: authUser.uid,
    tenantId,
    studioId: data.studioId,
    authUid: authUser.uid,
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
      entityId: authUser.uid,
      user,
      studioId: data.studioId,
      after: { name: data.name, role: data.role, studioId: data.studioId },
    });
  });

  return { employeeId: authUser.uid };
});
