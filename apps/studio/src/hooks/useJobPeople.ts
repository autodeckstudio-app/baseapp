import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob } from "@autodeck/core";
import { db } from "../lib/firebase";
import { jobCar, type VehicleLite } from "../lib/job-people";

const vehicleCache = new Map<string, VehicleLite | null>();
const customerCache = new Map<string, string | null>();

/** Car and customer names for a list of jobs, so job cards say who and what. */
export function useJobPeople(jobs: ServiceJob[]): { car: (j: ServiceJob) => string | undefined; customer: (j: ServiceJob) => string | undefined } {
  const [, bump] = useState(0);
  const key = jobs.map((j) => `${j.vehicleId}|${j.customerId}`).join(",");
  useEffect(() => {
    let alive = true;
    const work: Promise<unknown>[] = [];
    for (const j of jobs) {
      if (j.vehicleId && !vehicleCache.has(j.vehicleId)) {
        vehicleCache.set(j.vehicleId, null);
        work.push(getDoc(doc(db, COLLECTIONS.vehicles(), j.vehicleId)).then((s) => { vehicleCache.set(j.vehicleId, s.exists() ? (s.data() as VehicleLite) : null); }).catch(() => { vehicleCache.delete(j.vehicleId); }));
      }
      if (j.customerId && !customerCache.has(j.customerId)) {
        customerCache.set(j.customerId, null);
        work.push(getDoc(doc(db, COLLECTIONS.customers(), j.customerId)).then((s) => { customerCache.set(j.customerId, s.exists() ? ((s.data() as { name?: string }).name ?? null) : null); }).catch(() => { customerCache.delete(j.customerId); }));
      }
    }
    if (work.length) void Promise.all(work).then(() => { if (alive) bump((n) => n + 1); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return {
    car: (j) => jobCar(j, Object.fromEntries([...vehicleCache].map(([k, v]) => [k, v ?? undefined]))),
    customer: (j) => customerCache.get(j.customerId) ?? undefined,
  };
}
