// Gift a wash, client side. Off until the functions, index and payment keys are live (see docs/SERVER-DEPLOY-CHECKLIST.md).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GIFT_SERVICE_ID, type GiftState } from "@autodeck/core";

/** While false: no Home or drawer entry, no screen content, and no gift code is ever sent with a booking. */
export const GIFT_LIVE = true;

/** The gifted wash, as the recipient sees it. The price is never shown or computed here; the server sets it. */
export const GIFT_SERVICE_ROUTE = "/(tabs)/book/menu-wash-foam";

const PENDING_KEY = "ad.pendingGiftCode";
let pendingCode: string | null = null;
let pendingChanged=false;
let pendingServiceId = GIFT_SERVICE_ID;
// Hydrate from device storage on app start so a claimed code survives a reload.
// Device-local only (never in a link), so a claimed code is not left in history or logs.
void AsyncStorage.getItem(PENDING_KEY).then((v) => { if (v && !pendingChanged && !pendingCode) { try { const saved=JSON.parse(v); if(typeof saved.code==="string"&&typeof saved.serviceId==="string"){pendingCode=saved.code;pendingServiceId=saved.serviceId;} } catch {pendingCode=v;pendingServiceId=GIFT_SERVICE_ID;} } }).catch(() => undefined);
export const setPendingGiftCode = (code: string | null, serviceId=GIFT_SERVICE_ID): void => {
  pendingChanged=true;pendingCode = code;pendingServiceId=serviceId;
  void (code ? AsyncStorage.setItem(PENDING_KEY, JSON.stringify({code,serviceId})) : AsyncStorage.removeItem(PENDING_KEY)).catch(() => undefined);
};
export const takePendingGiftCode = (serviceId?:string): string | null => serviceId&&serviceId!==pendingServiceId?null:pendingCode;

export const GIFT_STATE_LABEL: Record<GiftState, string> = {
  pending: "Waiting for payment",
  unused: "Not used yet",
  redeemed: "Used",
  expired: "Expired",
  void: "Cancelled",
  refunded: "Refunded",
};
