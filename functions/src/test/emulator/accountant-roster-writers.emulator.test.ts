/**
 * TEST. Roster write audit for the "accountant" role (real Firestore emulator, fixture roster doc, no real person).
 * Writers: addStaffMember, updateStaffRole, deactivateStaffMember (callables). Rules already deny every client write to /employees.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { addStaffMember } from "../../functions/employee/addStaffMember.js";
import { updateStaffRole } from "../../functions/employee/updateStaffRole.js";
import { addStaffMemberSchema, updateStaffRoleSchema } from "../../schemas/employee.js";

const db = getFirestore();
const T = "roster-t";
const tok = (role: string, email = "someone@example.com") => ({ uid: `u-${role}`, token: { role, tenantId: T, studioId: null, email, email_verified: true }, rawToken: "x" });
const run = (fn: unknown, auth: unknown, data: unknown) => (fn as { run: (r: unknown) => Promise<unknown> }).run({ auth, data });

beforeAll(async () => {
  await db.collection("employees").doc("acc1").set({ id: "acc1", tenantId: T, studioId: null, authUid: "", email: "ca@example.com", name: "Fixture CA", phone: "", role: "accountant", active: true, createdAt: "x", updatedAt: "x", terminatedAt: null });
});

describe("accountant roster writers", () => {
  it("no schema accepts accountant as an assignable role", () => {
    expect(addStaffMemberSchema.safeParse({ name: "Nina Rao", email: "n@example.com", role: "accountant", studioId: null }).success).toBe(false);
    expect(updateStaffRoleSchema.safeParse({ employeeId: "e", role: "accountant", studioId: null }).success).toBe(false);
  });
  it("addStaffMember with role accountant is rejected for admin and superadmin alike", async () => {
    for (const r of ["admin", "superadmin"]) await expect(run(addStaffMember, tok(r), { name: "Nina Rao", email: "n@example.com", role: "accountant", studioId: null })).rejects.toBeTruthy();
  });
  it("an ordinary admin cannot edit an accountant entry; the roster doc is unchanged", async () => {
    await expect(run(updateStaffRole, tok("admin"), { employeeId: "acc1", role: "admin", studioId: null })).rejects.toThrow(/owner or a platform operator/);
    expect((await db.collection("employees").doc("acc1").get()).data()!["role"]).toBe("accountant");
  });
  it("a studio token cannot edit it either", async () => {
    await expect(run(updateStaffRole, tok("studio"), { employeeId: "acc1", role: "admin", studioId: null })).rejects.toBeTruthy();
  });
});
