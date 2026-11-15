import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Employee } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { AuthorizedUser } from "@autodeck/auth";

/**
 * Loads the caller's ACTIVE staff roster record, matched by auth uid.
 * Attendance and other staff-self-service callables resolve identity this
 * way — the client never supplies an employeeId for self-service actions.
 */
export async function rosterRecordFor(user: AuthorizedUser): Promise<Employee> {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTIONS.employees())
    .where("authUid", "==", user.uid)
    .where("tenantId", "==", user.claims.tenantId)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new HttpsError("permission-denied", "No active staff roster record for this account.");
  }
  const doc = snap.docs[0];
  if (!doc) {
    throw new HttpsError("permission-denied", "No active staff roster record for this account.");
  }
  return doc.data() as Employee;
}

/** Loads any employee roster record by id, tenant-checked against the caller. */
export async function rosterRecordById(user: AuthorizedUser, employeeId: string): Promise<Employee> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.employees()).doc(employeeId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Employee not found.");
  }
  const employee = snap.data() as Employee;
  if (user.claims.role !== "superadmin" && employee.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Access denied to this employee.");
  }
  return employee;
}
