// Gift a wash, client side. Off until the functions, index and payment keys are live (see docs/SERVER-DEPLOY-CHECKLIST.md).
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GiftState } from "@autodeck/core";

/** While false: no Home or drawer entry, no screen content, and no gift code is ever sent with a booking. */
export const GIFT_LIVE = true;

/** The gifted wash, as the recipient sees it. The price is never shown or computed here; the server sets it. */
export const GIFT_SERVICE_ROUTE = "/(tabs)/book/menu-wash-foam";

const PENDING_KEY = "ad.pendingGiftCode";
let pendingCode: string | null = null;
// Hydrate from device storage on app start so a claimed code survives a reload.
// Device-local only (never in a link), so a claimed code is not left in history or logs.
void AsyncStorage.getItem(PENDING_KEY).then((v) => { if (v && !pendingCode) pendingCode = v; }).catch(() => undefined);
export const setPendingGiftCode = (code: string | null): void => {
  pendingCode = code;
  void (code ? AsyncStorage.setItem(PENDING_KEY, code) : AsyncStorage.removeItem(PENDING_KEY)).catch(() => undefined);
};
export const takePendingGiftCode = (): string | null => pendingCode;

export const GIFT_STATE_LABEL: Record<GiftState, string> = {
  pending: "Waiting for payment",
  unused: "Not used yet",
  redeemed: "Used",
  expired: "Expired",
  void: "Cancelled",
  refunded: "Refunded",
};
