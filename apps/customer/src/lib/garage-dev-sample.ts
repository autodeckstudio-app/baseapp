// Dev preview only (the Garage screen reads this when __DEV__ and ?mock=1). Sample cars, no photos, no real customer data.
import type { Booking, Membership, Protection, ServiceJob, Vehicle, Warranty } from "@autodeck/core";
import type { MyPaper } from "./paper-service";

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

// Dev preview only (?mock=1 on the detail screen): one rich car room - reported and
// studio protections, documents, history, a live warranty certificate, an upcoming
// booking. No photos, no real customer data, never bundled into production.
export function devGarageDetail(vehicleId: string) {
  const uid = "dev-customer";
  const vehicle = { id: vehicleId, tenantId: "dev", ownerId: uid, registrationNumber: "SAMPLE 01", make: "BMW", model: "M340i", year: "2023", color: "Black", category: "sedan", odometer: 18450, photoUrl: null, deletedAt: null, createdAt: day(400), updatedAt: day(1) } as unknown as Vehicle;
  const jobs = [
    { id: "dj1", vehicleId, serviceId: "menu-coat-autodeck-1", status: "DELIVERED", createdAt: day(60), sealedAt: day(59) },
    { id: "dj2", vehicleId, serviceId: "menu-wash-foam", status: "DELIVERED", createdAt: day(20), sealedAt: day(20) },
    { id: "dj3", vehicleId, serviceId: "menu-wash-interior", status: "DELIVERED", createdAt: day(5), sealedAt: day(5) },
  ] as unknown as ServiceJob[];
  const protections = [
    { id: "dp1", tenantId: "dev", vehicleId, customerId: uid, kind: "ppf", status: "unverified", source: "customer", provider: "XPEL", warrantyYears: 5, startDate: day(200).slice(0, 10), notes: null, revision: 1, createdAt: day(200), updatedAt: day(200) },
    { id: "dp2", tenantId: "dev", vehicleId, customerId: uid, kind: "ceramic", status: "verified", source: "studio", provider: "AutoDeck Care", warrantyYears: 1, startDate: day(59).slice(0, 10), notes: null, revision: 1, jobId: "dj1", createdAt: day(59), updatedAt: day(59) },
    { id: "dp3", tenantId: "dev", vehicleId, customerId: uid, kind: "ppf", status: "verified", source: "studio", provider: "3M", warrantyYears: 3, startDate: day(400).slice(0, 10), notes: null, revision: 2, lifecycle: "superseded", lifecycleAt: day(59).slice(0, 10), supersededByJobId: "dj1", createdAt: day(400), updatedAt: day(59) },
  ] as unknown as Protection[];
  const papers = [
    { id: "dc1", vehicleId, customerId: uid, kind: "RC", reference: "RC-SAMPLE-1", title: "Registration Certificate", expiresOn: null, createdAt: day(400), updatedAt: day(400) },
    { id: "dc2", vehicleId, customerId: uid, kind: "INSURANCE", reference: "POL-882134", title: "Insurance", expiresOn: day(-40).slice(0, 10), createdAt: day(300), updatedAt: day(300) },
    { id: "dc3", vehicleId, customerId: uid, kind: "PUC", reference: "PUC-551200", title: "PUC", expiresOn: day(10).slice(0, 10), createdAt: day(180), updatedAt: day(180) },
  ] as unknown as MyPaper[];
  const warranties = [
    { id: "dw1", tenantId: "dev", vehicleId, customerId: uid, jobId: "dj1", warrantyLabel: "1-year coating warranty", serviceName: "AutoDeck Care Ceramic 1-year", startDate: day(59).slice(0, 10), endDate: day(-306).slice(0, 10), revokedAt: null, coverageTerms: null, createdAt: day(59), updatedAt: day(59) },
  ] as unknown as Warranty[];
  const upcomingBooking = { id: "db1", vehicleId, status: "CONFIRMED", scheduledAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), scheduledDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), scheduledTime: "10:00", lines: [{ serviceId: "menu-wash-full", name: "Full detail wash", price: 575000, durationMinutes: 300 }], createdAt: day(1), updatedAt: day(1) } as unknown as Booking;
  return { uid, vehicle, jobs, protections, papers, allPapers: papers, warranties, invoices: [], upcomingBooking };
}
