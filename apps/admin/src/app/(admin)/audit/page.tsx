"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../../../lib/firebase";
import type { AuditLog, Employee } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToAuditLog } from "../../../lib/audit-service";
import { listStaff } from "../../../lib/staff-service";
import { AuditView } from "../../../experience/OfficeViews";

export default function AuditPage() {
  const { claims } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    listStaff(claims.tenantId).then(setStaff).catch(() => setStaff([]));
    return listenToAuditLog(
      claims.tenantId,
      (data) => {
        setError(null);
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  useEffect(() => {
    if (!claims) return;
    void Promise.all(["customers", "vehicles", "bookings", "invoices", "jobs", "papers"].map(async (name) => {
      const snap = await getDocs(query(collection(db, name), where("tenantId", "==", claims.tenantId), limit(500)));
      return { name, docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    })).then((groups) => {
      const next: Record<string, string> = {};
      const people: Record<string, string> = {};
      const vehicles: Record<string, string> = {};
      for (const group of groups) for (const row of group.docs) {
        const r = row as Record<string, unknown>;
        if (group.name === COLLECTIONS.customers()) { people[String(r.authUid || r.id)] = String(r.name || "Customer"); next[`customer:${r.id}`] = String(r.name || "Customer"); }
        if (group.name === COLLECTIONS.vehicles()) { vehicles[String(r.id)] = String(r.registrationNumber || "Vehicle"); next[`vehicle:${r.id}`] = `${r.make ?? ""} ${r.model ?? ""} - ${r.registrationNumber ?? ""}`.trim(); }
      }
      for (const group of groups) for (const row of group.docs) {
        const r = row as Record<string, unknown>;
        const plate = vehicles[String(r.vehicleId)] || (r.vehicleSnapshot as Record<string, unknown> | undefined)?.registrationNumber || "";
        const person = people[String(r.customerId)] || "";
        if (group.name === COLLECTIONS.papers()) next[`paper:${r.id}`] = `${r.kind || "Document"} for ${plate || person || String(r.id).slice(0, 8)}`;
        if (group.name === COLLECTIONS.bookings()) next[`booking:${r.id}`] = `booking for ${plate || person || String(r.id).slice(0, 8)}`;
        if (group.name === COLLECTIONS.invoices()) next[`invoice:${r.id}`] = `invoice ${r.invoiceNumber || String(r.id).slice(0, 8)}${person ? ` for ${person}` : ""}`;
        if (group.name === COLLECTIONS.jobs()) { next[`job:${r.id}`] = `job for ${plate || person || String(r.id).slice(0, 8)}`; next[`servicejob:${r.id}`] = next[`job:${r.id}`] ?? "Job"; }
      }
      setLabels(next); setCustomers(people);
    }).catch(() => {});
  }, [claims]);

  // Show a person's name where the roster knows their account.
  const who = useMemo(() => {
    const m: Record<string, string> = { ...customers, system: "AutoDeck" };
    for (const s of staff) if (s.authUid) m[s.authUid] = s.name;
    return m;
  }, [staff, customers]);

  return <AuditView entries={entries} loading={loading} error={error} who={who} labels={labels} />;
}
