import { httpsCallable } from "firebase/functions";
import type { GiftState } from "@autodeck/core";
import { functions } from "./firebase";

export interface GiftView { id: string; state: GiftState; tail: string; amountPaise: number; expiresAt: string | null; purchasedAt: string | null; redeemedAt: string | null; refundRequested: boolean; refundable: boolean }
/** What a gift costs today. Set by the server; the app only shows it. */
export interface GiftOffer { amountPaise: number }

export async function claimGift(code: string): Promise<GiftView> {
  return (await httpsCallable<{ code: string }, GiftView>(functions, "redeemGift")({ code })).data;
}
export async function listMyGifts(): Promise<{ gifts: GiftView[]; offer: GiftOffer | null }> {
  const d = (await httpsCallable<Record<string, never>, { gifts: GiftView[]; offer: GiftOffer | null }>(functions, "listMyGifts")({})).data;
  return { gifts: d.gifts, offer: d.offer ?? null };
}
/** Starts a purchase: the server makes the unpaid gift and its payment. Pay it with payWithCheckout(paymentId). */
export async function startGiftPurchase(): Promise<{ giftId: string; paymentId: string; amountPaise: number }> {
  return (await httpsCallable<Record<string, never>, { giftId: string; paymentId: string; amountPaise: number }>(functions, "createGift")({})).data;
}
/** The code of a gift you bought. The server only returns it after the payment is verified. */
export async function fetchGiftCode(giftId: string): Promise<{ code: string; expiresAt: string | null }> {
  return (await httpsCallable<{ giftId: string }, { code: string; expiresAt: string | null }>(functions, "getGiftCode")({ giftId })).data;
}
