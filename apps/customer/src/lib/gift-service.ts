import { httpsCallable } from "firebase/functions";
import type { GiftState } from "@autodeck/core";
import { functions } from "./firebase";

export interface GiftView { id: string; state: GiftState; tail: string; amountPaise: number; expiresAt: string | null; purchasedAt: string | null; redeemedAt: string | null; refundRequested: boolean; refundable: boolean }

export async function claimGift(code: string): Promise<GiftView> {
  return (await httpsCallable<{ code: string }, GiftView>(functions, "redeemGift")({ code })).data;
}
export async function listMyGifts(): Promise<GiftView[]> {
  return (await httpsCallable<Record<string, never>, { gifts: GiftView[] }>(functions, "listMyGifts")({})).data.gifts;
}
export async function cancelMyGift(giftId: string): Promise<void> {
  await httpsCallable<{ giftId: string }, { ok: boolean }>(functions, "cancelGift")({ giftId });
}
