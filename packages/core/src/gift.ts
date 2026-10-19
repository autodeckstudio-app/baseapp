// Gift a wash: the rules in one place. A gift is a paid, single-use code for one fixed wash, bound to the first
// account that redeems it. These pure rules are shared by the server (which enforces them) and the app (which explains them).

/** The one wash that can be gifted. The price is read from the server catalogue at purchase, never typed by a client. */
export const GIFT_SERVICE_ID = "menu-wash-foam";
/** One flat price for any car: the SUV rate of the gifted wash, read from the catalogue. */
export const GIFT_PRICE_CATEGORY = "suv";
export const GIFT_VALID_MONTHS = 12;
export const GIFT_MAX_FAILED_ATTEMPTS = 5;
export const GIFT_LOCK_MINUTES = 15;

export type GiftStatus = "PENDING_PAYMENT" | "ACTIVE" | "REDEEMED" | "VOID" | "REFUNDED";

export interface Gift {
  id: string;
  tenantId: string;
  buyerId: string;
  serviceId: string;
  /** Paise, from the server catalogue at purchase. */
  amountPaise: number;
  /** Hash of the code. The code itself is shown once to the buyer and never stored. */
  codeHash: string;
  /** Last 4 characters, so the buyer and the studio can tell gifts apart. */
  codeTail: string;
  status: GiftStatus;
  createdAt: string;
  purchasedAt: string | null;
  expiresAt: string | null;
  /** The account the code is bound to once claimed. Only that account can book it. */
  claimedBy: string | null;
  /** The account that used it for a booking. */
  redeemedBy: string | null;
  refundRequested: boolean;
  paymentId: string | null;
  redeemedAt: string | null;
  bookingId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

/** What a person sees for a gift. EXPIRED is derived from the date, never stored. */
export type GiftState = "pending" | "unused" | "redeemed" | "expired" | "void" | "refunded";

export function giftState(g: Pick<Gift, "status" | "expiresAt">, now: number): GiftState {
  if (g.status === "PENDING_PAYMENT") return "pending";
  if (g.status === "REDEEMED") return "redeemed";
  if (g.status === "VOID") return "void";
  if (g.status === "REFUNDED") return "refunded";
  if (!g.expiresAt || Date.parse(g.expiresAt) <= now) return "expired";
  return "unused";
}

/** Expiry: the same calendar day, 12 months later (a 29 Feb gift ends 28 Feb). */
export function giftExpiry(purchasedAtIso: string): string {
  const d = new Date(purchasedAtIso);
  const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + GIFT_VALID_MONTHS) / 12);
  const m = (d.getUTCMonth() + GIFT_VALID_MONTHS) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())).toISOString();
}

// No 0, 1, I or O, so a code typed from a message is hard to get wrong. Format: GW-XXXX-XXXX (8 characters).
export const GIFT_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_RE = /^GW[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

/** Tidy what a person typed. Null when it cannot be a gift code. */
export function normaliseGiftCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(c) ? c : null;
}
export const formatGiftCode = (c: string): string => `${c.slice(0, 2)}-${c.slice(2, 6)}-${c.slice(6, 10)}`;

/** Failed redemption attempts: locked after 5 within the lock window. Pure, so the server and tests agree. */
export function giftLockedUntil(failedAtIso: string[], now: number): number | null {
  const windowMs = GIFT_LOCK_MINUTES * 60_000;
  const recent = failedAtIso.map(Date.parse).filter((t) => !Number.isNaN(t) && now - t < windowMs).sort((a, b) => a - b);
  if (recent.length < GIFT_MAX_FAILED_ATTEMPTS) return null;
  return (recent[recent.length - GIFT_MAX_FAILED_ATTEMPTS] ?? 0) + windowMs;
}

/** Can the buyer cancel for a refund? Only while unused. */
export const giftRefundable = (g: Pick<Gift, "status" | "expiresAt">, now: number): boolean => giftState(g, now) === "unused";

/** The message the buyer shares. First name only, studio name, code and expiry. No phone numbers or private details. */
export function giftShareMessage(args: { buyerFirstName: string | null; code: string; expiresAt: string; studioName: string }): string {
  const who = args.buyerFirstName ? `${args.buyerFirstName} has gifted you` : "You have been gifted";
  const until = new Date(args.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${who} a car wash at ${args.studioName}. Your code: ${formatGiftCode(args.code)}. Valid until ${until}. Redeem it in the app: https://app.autodeck.in`;
}
