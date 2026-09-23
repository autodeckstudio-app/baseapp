"use client";

import { useCallback, useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { Employee } from "@autodeck/core";
import { listStaff, addStaffMember, updateStaffRole, deactivateStaffMember } from "../../../lib/staff-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { TeamView } from "../../../experience/TeamView";

export default function StaffPage() {
  const { claims } = useAdminAuth();
  const [staff, setStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!claims) return;
    try {
      setStaff(await listStaff(claims.tenantId));
    } catch {
      setError("Couldn't load the team.");
    } finally {
      setLoading(false);
    }
  }, [claims]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // All three writes go through server callables that re-check the caller is
  // an admin; this page only collects intent.
  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
      await refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeamView
      staff={staff}
      loading={loading}
      error={error}
      message={message}
      busy={busy}
      onAdd={({ name, email, role }) =>
        void run(
          () => addStaffMember({ name, email, role, studioId: role === "studio" ? FIRST_STUDIO_ID : null }),
          `${name} can now sign in with Google as ${email}.`,
          "Couldn't add them.",
        )
      }
      onRole={(emp, role) =>
        void run(
          () => updateStaffRole(emp.id, role, role === "studio" ? (emp.studioId ?? FIRST_STUDIO_ID) : null),
          `${emp.name} now has ${role === "admin" ? "Office" : "Studio"} access.`,
          "Couldn't change their access.",
        )
      }
      onRemove={(emp) => void run(() => deactivateStaffMember(emp.id), `${emp.name} can no longer sign in.`, "Couldn't remove their access.")}
    />
  );
}
