import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { __params } from "expo-router";
import type { ServiceJob, Vehicle, Customer, Service } from "@autodeck/core";
import JobDetailScreen from "../src/app/(tabs)/jobs/[id]";

// Parent context: a real job at READY_FOR_DELIVERY, paid, so the REAL
// DeliveryConfirmPane mounts with its declaration UI.
const job: ServiceJob = {
  id: "j1", vehicleId: "v1", tenantId: "t", studioId: "s1", customerId: "c1", serviceId: "sv1",
  status: "READY_FOR_DELIVERY", paymentStatus: "paid", totalAmount: 10000, bookingId: null, bayId: "b1",
  estimatedDurationMinutes: 180, estimatedEndAt: "2026-10-31T13:00:00.000Z",
  scheduledAt: "2026-10-31T10:00:00.000Z",
  statusHistory: [{ status: "READY_FOR_DELIVERY", changedAt: "2026-10-31T11:45:00.000Z", by: "u1" }, { status: "IN_PROGRESS", changedAt: "2026-10-31T10:05:00.000Z", by: "u1" }],
  createdAt: "2026-10-31T09:30:00.000Z", updatedAt: "2026-10-31T11:45:00.000Z",
} as unknown as ServiceJob;
const vehicle: Vehicle = {
  id: "v1", tenantId: "t", ownerId: "c1", registrationNumber: "GJ01AB1234",
  make: "Honda", model: "City", year: "2022", color: "White", category: null,
  photoUrl: null, deletedAt: null, createdAt: "x", updatedAt: "x",
} as unknown as Vehicle;
const customer = { id: "c1", tenantId: "t", name: "Aarav Shah", phone: "+919000000000" } as unknown as Customer;
const service = { id: "sv1", tenantId: "t", name: "PPF - Full Body", requiredBayType: null } as unknown as Service;

const g = globalThis as Record<string, unknown>;
g.__pixelJob = job;
g.__pixelVehicle = vehicle;
g.__pixelCustomer = customer;
g.__pixelService = service;
g.__pixelProtections = [];
__params.current = { id: "j1" };

const root = createRoot(document.getElementById("root")!);
root.render(createElement(JobDetailScreen));
g.__pixelReady = true;
