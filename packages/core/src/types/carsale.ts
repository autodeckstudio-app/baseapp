/**
 * Cars for sale. Studio stock and customer submissions share one record.
 * Customer submissions start PENDING and show to others only once an admin approves.
 * Private fields never leave the callables: buyers get CarListingView only.
 */
export type CarListingStatus = "draft" | "pending" | "live" | "reserved" | "sold" | "rejected" | "expired";
export type CarFuel = "petrol" | "diesel" | "cng" | "electric" | "hybrid";
export type CarGearbox = "manual" | "automatic";
export type CarBodyType = "hatchback" | "sedan" | "suv" | "muv" | "coupe" | "other";

export interface CarListing {
  id: string;
  tenantId: string;
  studioId: string;
  source: "studio" | "customer";
  sellerId: string | null; // customer uid for customer submissions
  status: CarListingStatus;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  kmDriven: number;
  fuel: CarFuel;
  gearbox: CarGearbox;
  bodyType?: CarBodyType | null; // optional, older listings have none
  owners: number;
  colour: string;
  area: string; // area or city only, never a full address
  askingPrice: number; // paise, like service prices
  description: string | null;
  insuranceValidTill: string | null; // YYYY-MM-DD
  photoPaths: string[]; // first is the cover
  // Private, admin-only
  sellerName: string | null;
  sellerPhone: string | null;
  registrationNumber: string | null;
  reservePrice: number | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  expiresAt: string | null; // 60 days after approval
}

/** What buyers (and a seller looking at their own listing) receive: no private fields. */
export interface CarListingView {
  id: string;
  source: "studio" | "customer";
  status: CarListingStatus;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  kmDriven: number;
  fuel: CarFuel;
  gearbox: CarGearbox;
  bodyType?: CarBodyType | null;
  owners: number;
  colour: string;
  area: string;
  askingPrice: number;
  description: string | null;
  insuranceValidTill: string | null;
  photoUrls: string[];
  mine: boolean;
  rejectionReason: string | null;
  createdAt: string;
}

export type CarLeadKind = "interest" | "report";
export interface CarLead {
  id: string;
  tenantId: string;
  listingId: string;
  kind: CarLeadKind;
  buyerId: string;
  buyerName: string;
  buyerPhone: string | null;
  note: string | null;
  status: "new" | "contacted" | "closed";
  createdAt: string;
  updatedAt: string;
}
