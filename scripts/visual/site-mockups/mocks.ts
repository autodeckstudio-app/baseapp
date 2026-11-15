// Synthetic data only. Every write throws: this harness is read-only by construction.
import type { Booking, ServiceJob, Vehicle } from "@autodeck/core";
const ro = () => { throw new Error("LOCAL READ ONLY"); };

export const db = {}, functions = {}, auth = {}, storage = {};

const user = { uid: "sample-auth", displayName: "Alex Morgan", email: "alex@example.com" };
export const useAuth = () => ({ status: "ready", user, customerDocId: "sample-owner", customerDocResolution: "resolved", claims: { tenantId: "sample", role: "customer" } });

export const CARS: Vehicle[] = [
  { id: "car-a", make: "Kia", model: "Seltos", year: 2023, registrationNumber: "SAMPLE A", tenantId: "sample", ownerId: "sample-owner", category: "suv", photoUrl: null, deletedAt: null, createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-11-10T10:00:00Z" } as unknown as Vehicle,
  { id: "car-b", make: "BMW", model: "X1", year: 2021, registrationNumber: "SAMPLE B", tenantId: "sample", ownerId: "sample-owner", category: "suv", photoUrl: null, deletedAt: null, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-11-09T10:00:00Z" } as unknown as Vehicle,
];

export const listenToMyVehicles = (_o: any, _t: any, cb: any) => { cb(CARS); return () => {}; };
export const listenToMyArchivedVehicles = () => () => {};
export const setActiveVehicle = async () => {};
export const deleteVehiclePermanently = ro, restoreVehicle = ro, uploadLicensePhoto = ro;
export const resolveVehiclePhotoUrl = async (p: string) => (p.startsWith("data:image/") ? p : null);
export const listenToVehiclePapers = (_v: any, _t: any, _u: any, cb: any) => { cb([]); return () => {}; };
export const daysUntil = () => null;

export const listenToMyJobs = (_t: any, _o: any, cb: any) => { cb([] as ServiceJob[]); return () => {}; };
export const listenToMyMemberships = (_t: any, _o: any, cb: any) => { cb([]); return () => {}; };
export const getServiceCatalogue = async () => [
  { id: "svc-wash", name: "Regular wash", category: "washing" },
  { id: "svc-ceramic", name: "Ceramic coating", category: "ceramic" },
];

const price = { vehicleCategory: "suv", basePrice: 50000, scopeAdjustment: 0, addOns: [], subtotal: 50000, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 9000, total: 59000, currency: "INR" } as any;
const BOOKINGS: Booking[] = [
  { id: "bk-1", tenantId: "sample", studioId: "sample", customerId: "sample-owner", vehicleId: "car-a", serviceId: "svc-wash", vehicleCategory: "suv", scheduledAt: "2026-11-16T05:30:00.000Z", scheduledDate: "2026-11-16", scheduledTime: "11:00", status: "CONFIRMED", priceBreakdown: price, createdAt: "2026-11-12T10:00:00Z", updatedAt: "2026-11-12T10:00:00Z" } as unknown as Booking,
  { id: "bk-2", tenantId: "sample", studioId: "sample", customerId: "sample-owner", vehicleId: "car-b", serviceId: "svc-ceramic", vehicleCategory: "suv", scheduledAt: "2026-10-20T04:30:00.000Z", scheduledDate: "2026-10-20", scheduledTime: "10:00", status: "COMPLETED", priceBreakdown: price, createdAt: "2026-10-18T10:00:00Z", updatedAt: "2026-10-20T12:00:00Z" } as unknown as Booking,
];
export const getMyBookings = async () => BOOKINGS;
export const cancelBooking = ro;

export const listenToMyNotifications = (_t: any, _u: any, cb: any) => { cb([]); return () => {}; };
export const listenToMyInvoices = (_t: any, _o: any, cb: any) => { cb([]); return () => {}; };
export const listenToApprovalsForJob = (_j: any, _t: any, _o: any, cb: any) => { cb([]); return () => {}; };
export const loadServiceNames = async () => ({});
export const missingNameIds = () => [] as string[];

export const devGarage = null, devGarageDetail = null;
export const devCatalogue = null;

export const signOut = ro;
export const cancelAccountDeletion = ro, requestAccountDeletion = ro;

export const updateProfile = async () => {};
export const doc = () => ({}), updateDoc = async () => {};

export const useSavedLicensePhoto = () => ({ url: null, state: "missing", retry: () => undefined });
export const SavedLicensePhoto = () => null;
export const SavedLicensePhotoView = () => null;

export const useLang = () => ({ lang: "en", t: (x: string) => x });
export const bookingFromJob = (j: any) => j;
export const translate = (_l: string, x: string) => x;
export const priceLabel = () => "";

const AsyncStorageMock = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
export default AsyncStorageMock;
