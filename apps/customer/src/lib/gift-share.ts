import { giftShareMessage } from "@autodeck/core";
import { whatsappShareUrl } from "./invoice-share";

export const GIFT_STUDIO_NAME = "AutoDeck Studio";

type Nav = { share?: (d: { text: string }) => Promise<void>; clipboard?: { writeText: (t: string) => Promise<void> } };

export function giftMessage(args: { code: string; expiresAt: string; buyerName: string | null }): string {
  const first = args.buyerName?.trim().split(/\s+/)[0] || null;
  return giftShareMessage({ buyerFirstName: first, code: args.code, expiresAt: args.expiresAt, studioName: GIFT_STUDIO_NAME });
}

/** Share sheet if the browser has one, else copy the message. The message has a first name, the studio, the code and the date only. */
export async function shareGift(text: string): Promise<"shared" | "copied" | "failed"> {
  const nav = (globalThis as unknown as { navigator?: Nav }).navigator;
  try {
    if (nav?.share) { await nav.share({ text }); return "shared"; }
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return "failed";
  }
  try {
    if (nav?.clipboard) { await nav.clipboard.writeText(text); return "copied"; }
  } catch { /* fall through */ }
  return "failed";
}
export const giftWhatsappUrl = whatsappShareUrl;
