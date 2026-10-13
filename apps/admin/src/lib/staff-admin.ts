// Server-only staff roster management for the admin app's Route Handlers.
//
// Mirrors functions/src/functions/employee/{addStaffMember,updateStaffRole,
// deactivateStaffMember}.ts so the roster can be managed on the Spark plan,
// before Cloud Functions are deployed. Same rules: admin-only, tenant taken
// from the caller's verified claims, audit entry written in the same
// transaction as the change, and deactivation demotes rather than disables.
import type { Auth } from "firebase-admin/auth";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { AuditAction, AuditLog, Employee } from "@autodeck/core";
import type { AuthorizedUser } from "@autodeck/auth";

export class StaffError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StaffRole = "studio" | "admin";

function parseRole(v: unknown): StaffRole {
  if (v === "studio" || v === "admin") return v;
  throw new StaffError(400, "invalid-argument", "role must be 'studio' or 'admin'.");
}

function parseStudio(role: StaffRole, v: unknown): string | null {
  const studioId = v === null || v === undefined ? null : typeof v === "string" && v.trim() ? v.trim() : undefined;
  if (studioId === undefined) throw new StaffError(400, "invalid-argument", "studioId must be a string or null.");
  if (role === "admin" && studioId !== null) {
    throw new StaffError(400, "invalid-argument", "Tenant admins are not studio-scoped - studioId must be null for role 'admin'.");
  }
  if (role === "studio" && studioId === null) {
    throw new StaffError(400, "invalid-argument", "Studio staff require a studioId.");
  }
  return studioId;
}

export interface AddStaffInput {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  studioId: string | null;
}

export function parseAddStaff(body: unknown): AddStaffInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b["name"] === "string" ? b["name"].trim() : "";
  if (name.length < 2 || name.length > 100) throw new StaffError(400, "invalid-argument", "Name must be 2-100 characters.");
  const email = typeof b["email"] === "string" ? b["email"].trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) throw new StaffError(400, "invalid-argument", "Enter a valid Google email.");
  const phone = typeof b["phone"] === "string" ? b["phone"].trim().slice(0, 20) : "";
  const role = parseRole(b["role"]);
  return { name, email, phone, role, studioId: parseStudio(role, b["studioId"]) };
}

export function parseRoleChange(body: unknown): { employeeId: string; role: StaffRole; studioId: string | null } {
  const b = (body ?? {}) as Record<string, unknown>;
  const employeeId = typeof b["employeeId"] === "string" ? b["employeeId"] : "";
  if (!employeeId) throw new StaffError(400, "invalid-argument", "employeeId is required.");
  const role = parseRole(b["role"]);
  return { employeeId, role, studioId: parseStudio(role, b["studioId"]) };
}

function audit(
  db: Firestore,
  tx: Transaction,
  user: AuthorizedUser,
  action: AuditAction,
  entityId: string,
  studioId: string | null,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): void {
  const ref = db.collection("auditLog").doc();
  const entry: AuditLog = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId,
    action,
    entityType: "Employee",
    entityId,
    performedBy: user.uid,
    performedByRole: user.claims.role,
    before,
    after,
    metadata: { via: "admin-route" },
    createdAt: new Date().toISOString(),
  };
  tx.set(ref, entry);
}

async function loadInTenant(db: Firestore, user: AuthorizedUser, employeeId: string) {
  const ref = db.collection("employees").doc(employeeId);
  const snap = await ref.get();
  if (!snap.exists) throw new StaffError(404, "not-found", "Employee not found.");
  const existing = snap.data() as Employee;
  if (user.claims.role !== "superadmin" && existing.tenantId !== user.claims.tenantId) {
    throw new StaffError(404, "not-found", "Employee not found.");
  }
  return { ref, existing };
}

export async function addStaff(auth: Auth, db: Firestore, user: AuthorizedUser, input: AddStaffInput) {
  const tenantId = user.claims.tenantId;
  const dup = await db
    .collection("employees")
    .where("email", "==", input.email)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (!dup.empty) throw new StaffError(409, "already-exists", "This email is already on the staff roster.");

  const account = await auth.getUserByEmail(input.email).catch(() => null);
  if (account?.customClaims?.["role"] === "superadmin") {
    throw new StaffError(409, "failed-precondition", "Platform accounts cannot be added as staff.");
  }

  const now = new Date().toISOString();
  const ref = db.collection("employees").doc();
  const employee: Employee = {
    id: ref.id,
    tenantId,
    studioId: input.studioId,
    authUid: account?.uid ?? "",
    email: input.email,
    name: input.name,
    phone: input.phone,
    role: input.role,
    active: true,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
  };
  await db.runTransaction(async (tx) => {
    tx.set(ref, employee);
    audit(db, tx, user, "employee.created", ref.id, input.studioId, null, {
      name: input.name,
      email: input.email,
      role: input.role,
      studioId: input.studioId,
    });
  });
  if (account?.emailVerified) {
    await auth
      .setCustomUserClaims(account.uid, { role: input.role, tenantId, studioId: input.studioId })
      .then(() => auth.revokeRefreshTokens(account.uid))
      .catch(() => undefined);
  }
  return { employeeId: ref.id };
}

export async function changeRole(
  auth: Auth,
  db: Firestore,
  user: AuthorizedUser,
  input: { employeeId: string; role: StaffRole; studioId: string | null },
) {
  const { ref, existing } = await loadInTenant(db, user, input.employeeId);
  if (existing.terminatedAt) {
    throw new StaffError(409, "failed-precondition", "Cannot change role of a terminated employee.");
  }
  const linked = existing.authUid !== "";
  if (linked) {
    await auth.setCustomUserClaims(existing.authUid, {
      role: input.role,
      tenantId: existing.tenantId,
      studioId: input.studioId,
    });
  }
  const now = new Date().toISOString();
  try {
    await db.runTransaction(async (tx) => {
      tx.update(ref, { role: input.role, studioId: input.studioId, updatedAt: now });
      audit(db, tx, user, "employee.role_changed", input.employeeId, input.studioId,
        { role: existing.role, studioId: existing.studioId },
        { role: input.role, studioId: input.studioId });
    });
  } catch (err) {
    if (linked) {
      await auth
        .setCustomUserClaims(existing.authUid, {
          role: existing.role,
          tenantId: existing.tenantId,
          studioId: existing.studioId,
        })
        .catch(() => undefined);
    }
    throw err;
  }
  return { employeeId: input.employeeId, role: input.role };
}

export async function deactivate(auth: Auth, db: Firestore, user: AuthorizedUser, employeeId: string) {
  const { ref, existing } = await loadInTenant(db, user, employeeId);
  if (existing.terminatedAt) return { employeeId, alreadyTerminated: true };
  if (existing.authUid) {
    await auth.setCustomUserClaims(existing.authUid, {
      role: "customer",
      tenantId: existing.tenantId,
      studioId: null,
    });
    await auth.revokeRefreshTokens(existing.authUid);
  }
  const now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    tx.update(ref, { active: false, terminatedAt: now, updatedAt: now });
    audit(db, tx, user, "employee.deactivated", employeeId, existing.studioId,
      { active: true }, { active: false, terminatedAt: now });
  });
  return { employeeId, alreadyTerminated: false };
}

export interface DecideAccessInput {
  uid: string;
  decision: "approve" | "reject";
  role: StaffRole;
  note: string | null;
}

export function parseDecideAccess(body: unknown): DecideAccessInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const uid = typeof b["uid"] === "string" ? b["uid"] : "";
  if (!uid) throw new StaffError(400, "invalid-argument", "uid is required.");
  const decision = b["decision"];
  if (decision !== "approve" && decision !== "reject") throw new StaffError(400, "invalid-argument", "decision must be approve or reject.");
  const role = b["role"] === undefined ? "studio" : parseRole(b["role"]);
  const note = typeof b["note"] === "string" && b["note"].trim() ? b["note"].trim().slice(0, 200) : null;
  return { uid, decision, role, note };
}

/**
 * Approve or decline a studio access request. Approval adds the person to the
 * roster (same rules as addStaff) using the name and email they submitted, then
 * marks the request approved. The tenant always comes from the admin's claims.
 */
export async function decideAccessRequest(auth: Auth, db: Firestore, user: AuthorizedUser, input: DecideAccessInput, studioId: string) {
  const ref = db.collection("staffAccessRequests").doc(input.uid);
  const snap = await ref.get();
  if (!snap.exists) throw new StaffError(404, "not-found", "Request not found.");
  const req = snap.data() as { tenantId: string; email: string; name: string; phone: string; status: string };
  if (user.claims.role !== "superadmin" && req.tenantId !== user.claims.tenantId) throw new StaffError(404, "not-found", "Request not found.");
  if (req.status !== "pending") throw new StaffError(409, "failed-precondition", "This request was already handled.");
  const now = new Date().toISOString();
  if (input.decision === "approve") {
    await addStaff(auth, db, user, {
      name: req.name, email: req.email.toLowerCase(), phone: req.phone ?? "",
      role: input.role, studioId: input.role === "studio" ? studioId : null,
    });
    // The person asked with this uid: link and promote that exact account now.
    const emp = await db.collection("employees").where("email", "==", req.email.toLowerCase()).where("active", "==", true).limit(1).get();
    const doc = emp.docs[0];
    if (doc && !(doc.data() as Employee).authUid) {
      await doc.ref.update({ authUid: input.uid, updatedAt: now });
      await auth
        .setCustomUserClaims(input.uid, { role: input.role, tenantId: user.claims.tenantId, studioId: input.role === "studio" ? studioId : null })
        .then(() => auth.revokeRefreshTokens(input.uid))
        .catch(() => undefined);
    }
  }
  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: input.decision === "approve" ? "approved" : "rejected", decidedAt: now, decidedBy: user.uid, decisionNote: input.note, updatedAt: now });
    audit(db, tx, user, input.decision === "approve" ? "staffAccess.approved" : "staffAccess.rejected", input.uid, null, { status: "pending" }, { status: input.decision, email: req.email });
  });
  return { uid: input.uid, status: input.decision === "approve" ? "approved" : "rejected" };
}
