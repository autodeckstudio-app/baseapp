"use client";

import { httpsCallable } from "firebase/functions";
import type { CarLead, CarListingView } from "@autodeck/core";
import { functions } from "./firebase";

export type AdminListing = CarListingView & {
  sellerName: string | null;
  sellerPhone: string | null;
  registrationNumber: string | null;
  reservePrice: number | null;
  adminNotes: string | null;
  photoPaths: string[];
  expiresAt: string | null;
};

export type ListingInput = {
  listingId?: string;
  status: "draft" | "live" | "reserved" | "sold";
  make: string; model: string; variant: string | null; year: number; kmDriven: number;
  fuel: "petrol" | "diesel" | "cng" | "electric" | "hybrid"; gearbox: "manual" | "automatic"; owners: number;
  colour: string; area: string; askingPrice: number; description: string | null; insuranceValidTill: string | null;
  photoPaths: string[];
  sellerName?: string | null; sellerPhone?: string | null; registrationNumber?: string | null; reservePrice?: number | null; adminNotes?: string | null;
};

export async function listAllListings(): Promise<AdminListing[]> {
  const fn = httpsCallable<{ includeAll: boolean }, { listings: AdminListing[] }>(functions, "listCarListings");
  return (await fn({ includeAll: true })).data.listings;
}
export async function listLeads(): Promise<CarLead[]> {
  const fn = httpsCallable<Record<string, never>, { leads: CarLead[] }>(functions, "listCarLeads");
  return (await fn({})).data.leads;
}
export async function uploadListingPhoto(file: File): Promise<string> {
  const issue = httpsCallable<{ contentType: string }, { uploadUrl: string; path: string; requiredHeaders: Record<string, string> }>(functions, "issueListingPhotoUploadUrl");
  const { uploadUrl, path, requiredHeaders } = (await issue({ contentType: file.type })).data;
  const put = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: file });
  if (!put.ok) throw new Error("A photo did not upload. Try again.");
  return path;
}
export async function saveListing(input: ListingInput): Promise<void> {
  await httpsCallable<ListingInput, { id: string }>(functions, "adminSaveListing")(input);
}
export async function reviewListing(listingId: string, decision: "approve" | "reject", reason?: string): Promise<void> {
  await httpsCallable(functions, "reviewListing")({ listingId, decision, ...(reason ? { reason } : {}) });
}
export async function setLeadStatus(leadId: string, status: "new" | "contacted" | "closed"): Promise<void> {
  await httpsCallable(functions, "setCarLeadStatus")({ leadId, status });
}
