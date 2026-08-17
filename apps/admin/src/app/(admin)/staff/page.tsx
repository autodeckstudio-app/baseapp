"use client";

import { useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { Employee } from "@autodeck/core";
import { listStaff, addStaffMember, updateStaffRole, deactivateStaffMember } from "../../../lib/staff-service";
import { useAdminAuth } from "../../../lib/auth-context";

export default function StaffPage() {
  const { claims } = useAdminAuth();
  const [staff, setStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"studio" | "admin">("studio");
  const [studioScoped, setStudioScoped] = useState(true);

  async function refresh() {
    if (!claims) return;
    setLoading(true);
    try {
      setStaff(await listStaff(claims.tenantId));
    } catch {
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [claims]);

  async function handleAdd() {
    setError(null);
    setStatus(null);
    try {
      await addStaffMember({
        name,
        email,
        password,
        role,
        studioId: role === "studio" && studioScoped ? FIRST_STUDIO_ID : null,
      });
      setStatus(`Staff member created. Share the temporary password (${password}) securely.`);
      setName("");
      setEmail("");
      setPassword("");
      await refresh();
    } catch {
      setError("Failed to add staff member. Email may already be in use.");
    }
  }

  async function handleRoleChange(emp: Employee, nextRole: "studio" | "admin") {
    setError(null);
    try {
      const studioId = nextRole === "studio" ? (emp.studioId ?? FIRST_STUDIO_ID) : null;
      await updateStaffRole(emp.id, nextRole, studioId);
      await refresh();
    } catch {
      setError("Failed to change role.");
    }
  }

  async function handleDeactivate(emp: Employee) {
    if (!window.confirm(`Deactivate ${emp.name}? Their login access will be revoked immediately.`)) return;
    setError(null);
    try {
      await deactivateStaffMember(emp.id);
      await refresh();
    } catch {
      setError("Failed to deactivate staff member.");
    }
  }

  return (
    <div>
      <h1>Staff</h1>
      {error && <p className="error">{error}</p>}
      {status && <p>{status}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Studio</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.name}</td>
                <td>
                  <select
                    value={emp.role}
                    disabled={!!emp.terminatedAt}
                    onChange={(e) => void handleRoleChange(emp, e.target.value as "studio" | "admin")}
                  >
                    <option value="studio">studio</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{emp.studioId ?? "— (tenant-wide)"}</td>
                <td>{emp.terminatedAt ? "Terminated" : emp.active ? "Active" : "Inactive"}</td>
                <td>
                  {!emp.terminatedAt && <button onClick={() => void handleDeactivate(emp)}>Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Add staff member</h2>
      <fieldset>
        <label>
          Name
          <br />
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Email
          <br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Temporary password
          <br />
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </fieldset>
      <fieldset>
        <label>
          Role
          <br />
          <select value={role} onChange={(e) => setRole(e.target.value as "studio" | "admin")}>
            <option value="studio">studio (operational staff)</option>
            <option value="admin">admin (tenant admin)</option>
          </select>
        </label>
        {role === "studio" && (
          <label>
            {" "}
            <input
              type="checkbox"
              checked={studioScoped}
              onChange={(e) => setStudioScoped(e.target.checked)}
            />{" "}
            Scope to {FIRST_STUDIO_ID}
          </label>
        )}
      </fieldset>
      <button onClick={() => void handleAdd()} disabled={!name || !email || password.length < 8}>
        Add staff member
      </button>
    </div>
  );
}
