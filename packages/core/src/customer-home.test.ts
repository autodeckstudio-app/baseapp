import { describe, expect, it } from "vitest";
import type { Booking, Vehicle, ServiceJob, ApprovalRequest, Invoice, Protection, Membership } from "./index.js";
import { projectCustomerHome, sanitizeFirstName, greetingFor, pickActiveVehicle, type CustomerHomeInput } from "./customer-home.js";

const now = new Date("2026-09-24T10:00:00+05:30");
const car = (id: string, updatedAt = "2026-01-01T00:00:00Z", extra: Partial<Vehicle> = {}): Vehicle =>
  ({ id, tenantId: "t", ownerId: "c", registrationNumber: "GJ01AB1234", make: "Honda", model: "City", year: 2022, color: "Grey", category: "sedan", photoUrl: null, odometer: null, createdAt: updatedAt, updatedAt, deletedAt: null, ...extra }) as Vehicle;
const booking = (status: Booking["status"], scheduledAt = "2026-09-26T05:00:00Z", vehicleId = "v1"): Booking =>
  ({ id: `b-${status}`, vehicleId, status, scheduledAt }) as Booking;
const job = (status: ServiceJob["status"], vehicleId = "v1", scheduledAt = "2026-09-24T03:00:00Z"): ServiceJob =>
  ({ id: `j-${status}`, bookingId: `b-${status}`, vehicleId, status, scheduledAt }) as ServiceJob;
const approval = (status: ApprovalRequest["status"], expiresAt = "2026-09-25T00:00:00Z"): ApprovalRequest =>
  ({ id: `a-${status}`, vehicleId: "v1", status, expiresAt }) as ApprovalRequest;
const invoice = (status: Invoice["status"]): Invoice =>
  ({ id: `i-${status}`, vehicleId: "v1", status, issuedAt: "2026-09-23T00:00:00Z", createdAt: "2026-09-23T00:00:00Z" }) as Invoice;
const protection = (expiryDate: string | null, status: Protection["status"] = "verified"): Protection =>
  ({ id: `p-${expiryDate}`, vehicleId: "v1", kind: "insurance", expiryDate, status }) as Protection;

const input = (over: Partial<CustomerHomeInput> = {}): CustomerHomeInput => ({
  firstName: "Meet Sheth", vehicles: [car("v1")], bookings: [], jobs: [], approvals: [], invoices: [], protections: [], memberships: [], now, ...over,
});

describe("projectCustomerHome priority", () => {
  const cases: Array<[string, Partial<CustomerHomeInput>, string, string]> = [
    ["no car", { vehicles: [] }, "empty", "addVehicle"],
    ["nothing going on", {}, "idle", "book"],
    ["upcoming booking", { bookings: [booking("CONFIRMED")] }, "booked", "viewBooking"],
    ["past pending booking is not upcoming", { bookings: [booking("PENDING", "2026-09-01T00:00:00Z")] }, "idle", "book"],
    ["ready for pickup beats booking", { bookings: [booking("CONFIRMED")], jobs: [job("READY_FOR_DELIVERY")] }, "ready", "followVisit"],
    ["in service beats ready", { jobs: [job("READY_FOR_DELIVERY"), job("IN_PROGRESS")] }, "inService", "followVisit"],
    ["payment due beats in service", { jobs: [job("IN_PROGRESS")], invoices: [invoice("issued")] }, "paymentDue", "payInvoice"],
    ["approval beats payment", { invoices: [invoice("issued")], approvals: [approval("pending")] }, "awaitingApproval", "reviewApproval"],
    ["expired approval ignored", { approvals: [approval("pending", "2026-09-01T00:00:00Z")] }, "idle", "book"],
    ["paid invoice ignored", { invoices: [invoice("paid")] }, "idle", "book"],
    ["protection expiring soon", { protections: [protection("2026-10-05")] }, "idle", "reviewProtection"],
    ["protection far off", { protections: [protection("2027-06-01")] }, "idle", "book"],
    ["booking beats protection", { bookings: [booking("CONFIRMED")], protections: [protection("2026-09-20")] }, "booked", "viewBooking"],
    ["other car's approval does not lead", { approvals: [{ ...approval("pending"), vehicleId: "v2" }] }, "idle", "book"],
  ];
  it.each(cases)("%s", (_n, over, hero, action) => {
    const m = projectCustomerHome(input(over));
    expect(m.heroState).toBe(hero);
    expect(m.primaryAction.kind).toBe(action);
  });
});

describe("active vehicle", () => {
  it("honours an owned preference", () => {
    expect(pickActiveVehicle([car("v1"), car("v2")], "v2", [], [])?.id).toBe("v2");
  });
  it("ignores a preference for a removed car and falls back to most recent activity", () => {
    const vs = [car("v1", "2026-01-01T00:00:00Z"), car("v2", "2026-02-01T00:00:00Z", { deletedAt: "2026-03-01" }), car("v3", "2026-01-05T00:00:00Z")];
    expect(pickActiveVehicle(vs, "v2", [booking("CONFIRMED", "2026-09-30T00:00:00Z", "v1")], [])?.id).toBe("v1");
  });
  it("lists the rest as other vehicles", () => {
    const m = projectCustomerHome(input({ vehicles: [car("v1"), car("v2")], preferredVehicleId: "v1" }));
    expect(m.otherVehicles.map((v) => v.id)).toEqual(["v2"]);
  });
});

describe("greeting", () => {
  it("never renders undefined", () => {
    expect(sanitizeFirstName(undefined)).toBeUndefined();
    expect(sanitizeFirstName("   ")).toBeUndefined();
    expect(sanitizeFirstName("<script>")).toBe("script");
    expect(greetingFor(new Date("2026-09-24T09:00:00"), undefined)).toBe("Good morning");
    expect(greetingFor(new Date("2026-09-24T15:00:00"), "Meet")).toBe("Good afternoon, Meet");
  });
  it("uses only the first name", () => {
    expect(projectCustomerHome(input()).customer.firstName).toBe("Meet");
  });
});

describe("membership", () => {
  it("surfaces only an active plan", () => {
    const ms = [{ id: "m1", status: "expired", endDate: "2026-12-01" }, { id: "m2", status: "active", endDate: "2026-11-01" }] as Membership[];
    expect(projectCustomerHome(input({ memberships: ms })).membership?.id).toBe("m2");
  });
});
