// Dev preview only (the Garage screen reads this when __DEV__ and ?mock=1). Sample cars, no photos, no real customer data.
import type { Membership, ServiceJob, Vehicle } from "@autodeck/core";

const day = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

export function devGarage(o: { live: boolean; empty: boolean }) {
  const vehicles = (o.empty ? [] : [
    { id: "a", make: "BMW", model: "M340i", registrationNumber: "MH 40 AB 1234", category: "sedan", updatedAt: day(1) },
    { id: "b", make: "Mahindra", model: "Thar", registrationNumber: "MH 31 XY 5678", category: "suv", updatedAt: day(3) },
  ]) as unknown as Vehicle[];
  const jobs = [
    { id: "j1", vehicleId: "a", serviceId: "s1", status: "DELIVERED", createdAt: day(40), sealedAt: day(39) },
    ...(o.live ? [{ id: "j2", vehicleId: "a", serviceId: "s2", status: "IN_PROGRESS", createdAt: day(0), bookingId: "bk-sample", estimatedEndAt: new Date(Date.now() + 4 * 3_600_000).toISOString() }] : []),
  ] as unknown as ServiceJob[];
  const svcMap = { s1: { id: "s1", name: "Detail SPA", category: "washing" }, s2: { id: "s2", name: "Ceramic wash", category: "washing" } };
  const plan = { id: "m1", status: "active", washesTotal: 4, washesUsed: 1, tier: "silver", endDate: new Date(Date.now() + 20 * 86_400_000).toISOString() } as unknown as Membership;
  return { vehicles, jobs, svcMap, plan };
}
