import { httpsCallable } from "firebase/functions";
import type { CarListingView } from "@autodeck/core";
import { functions } from "./firebase";

export async function getCarListings(mine = false): Promise<CarListingView[]> {
  const fn = httpsCallable<{ mine: boolean }, { listings: CarListingView[] }>(functions, "listCarListings");
  return (await fn({ mine })).data.listings;
}

export async function uploadListingPhoto(blob: Blob, contentType: string): Promise<string> {
  const issue = httpsCallable<{ contentType: string }, { uploadUrl: string; path: string; requiredHeaders: Record<string, string> }>(functions, "issueListingPhotoUploadUrl");
  const { uploadUrl, path, requiredHeaders } = (await issue({ contentType })).data;
  const res = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: blob });
  if (!res.ok) throw new Error("A photo did not upload. Try again.");
  return path;
}

export type SellInput = {
  listingId?: string; make: string; model: string; variant: string | null; year: number; kmDriven: number;
  fuel: "petrol" | "diesel" | "cng" | "electric" | "hybrid"; gearbox: "manual" | "automatic"; bodyType: "hatchback" | "sedan" | "suv" | "muv" | "coupe" | "other" | null; owners: number; colour: string; area: string;
  askingPrice: number; description: string | null; insuranceValidTill: string | null; photoPaths: string[];
  sellerName: string; sellerPhone: string; registrationNumber: string | null;
};
export async function submitMyListing(input: SellInput): Promise<void> {
  await httpsCallable<SellInput, { id: string }>(functions, "submitMyListing")(input);
}

export async function markListingSold(listingId: string): Promise<void> {
  await httpsCallable(functions, "markMyListingSold")({ listingId });
}

export async function sendCarLead(listingId: string, kind: "interest" | "report", phone?: string, note?: string): Promise<void> {
  await httpsCallable(functions, "expressInterest")({ listingId, kind, ...(phone ? { phone } : {}), ...(note ? { note } : {}) });
}

export const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
export const kmLabel = (km: number) => `${km.toLocaleString("en-IN")} km`;
