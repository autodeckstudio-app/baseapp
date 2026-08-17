"use client";

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export async function getStudioConfig(studioId: string): Promise<StudioConfig | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.studioConfig(), studioId));
  return snap.exists() ? (snap.data() as StudioConfig) : null;
}

interface UpdateStudioSettingsInput {
  studioId: string;
  name?: string;
  timezone?: string;
  operatingHours?: StudioConfig["operatingHours"];
  taxRatePercent?: number;
  taxDescription?: string;
}

export async function updateStudioSettings(input: UpdateStudioSettingsInput): Promise<void> {
  const fn = httpsCallable<UpdateStudioSettingsInput, { studioId: string }>(
    functions,
    "updateStudioSettings",
  );
  await fn(input);
}

export async function addHoliday(studioId: string, date: string, reason?: string): Promise<void> {
  const fn = httpsCallable(functions, "addHoliday");
  await fn({ studioId, date, reason });
}

export async function removeHoliday(studioId: string, date: string): Promise<void> {
  const fn = httpsCallable(functions, "removeHoliday");
  await fn({ studioId, date });
}

interface UpsertBayInput {
  studioId: string;
  bayId?: string;
  name: string;
  bayType: "wash" | "protection" | "general";
  active: boolean;
}

export async function upsertBay(input: UpsertBayInput): Promise<{ bayId: string }> {
  const fn = httpsCallable<UpsertBayInput, { studioId: string; bayId: string }>(
    functions,
    "upsertBay",
  );
  const result = await fn(input);
  return { bayId: result.data.bayId };
}
