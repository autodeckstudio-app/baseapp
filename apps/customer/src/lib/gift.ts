// Gift a wash, client side. Off until the functions, index and payment keys are live (see docs/SERVER-DEPLOY-CHECKLIST.md).
import type { GiftState } from "@autodeck/core";

/** While false: no Home or drawer entry, no screen content, and no gift code is ever sent with a booking. */
export const GIFT_LIVE = true;

/** The gifted wash, as the recipient sees it. The price is never shown or computed here; the server sets it. */
export const GIFT_SERVICE_ROUTE = "/(tabs)/book/menu-wash-foam";

let pendingCode: string | null = null;
/** Held in memory only (never in a link), so a claimed code is not left in history or logs. */
export const setPendingGiftCode = (code: string | null): void => { pendingCode = code; };
export const takePendingGiftCode = (): string | null => pendingCode;

export const GIFT_STATE_LABEL: Record<GiftState, string> = {
  pending: "Waiting for payment",
  unused: "Not used yet",
  redeemed: "Used",
  expired: "Expired",
  void: "Cancelled",
  refunded: "Refunded",
};
