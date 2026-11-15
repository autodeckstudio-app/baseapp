// Gift a wash: the rules in one place. A gift is a paid, single-use code for one fixed wash, bound to the first
// account that redeems it. These pure rules are shared by the server (which enforces them) and the app (which explains them).

/** The one wash that can be gifted. The price is read from the server catalogue at purchase, never typed by a client. */
export const GIFT_SERVICE_ID = "menu-wash-foam";
/** One flat price for any car: the SUV rate of the gifted wash, read from the catalogue. */
export const GIFT_PRICE_CATEGORY = "suv";
/** A gift is valid for 60 days from the verified payment. Shown on the buy screen, the gift card and the redeem screen. */
export const GIFT_VALID_DAYS = 60;
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

/** Expiry: exactly 60 days after the verified payment. */
export function giftExpiry(purchasedAtIso: string): string {
  return new Date(Date.parse(purchasedAtIso) + GIFT_VALID_DAYS * 86_400_000).toISOString();
}

/** Whole days left, rounded up, never below 0. */
export function giftDaysLeft(expiresAtIso: string | null, now: number): number {
  if (!expiresAtIso) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAtIso) - now) / 86_400_000));
}

const istDate = (iso: string): string => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** The terms, in one place so the buy screen, the card, the redeem screen and the share message cannot drift apart. */
export const GIFT_TERMS = {
  validity: `Valid for ${GIFT_VALID_DAYS} days from the day you buy it. It expires after that and cannot be extended.`,
  nonRefundable: "Gifts cannot be refunded, exchanged for cash or transferred after payment.",
  oneWash: "One foam wash for any car. One use only.",
} as const;

/** Redeem-screen line: the date, and how long is left. */
export function giftValidityLine(expiresAtIso: string, now: number): string {
  const d = giftDaysLeft(expiresAtIso, now);
  return `Use it by ${istDate(expiresAtIso)} (${d} ${d === 1 ? "day" : "days"} left). It expires after that.`;
}

/** Reminder copy: 7 days before it ends, and on its last day. Plain, no offer. */
export function giftReminderText(daysLeft: 7 | 0): { title: string; body: string } {
  if (daysLeft === 0) return { title: "Your gift wash ends today", body: "Your gift wash expires today. Book it now or it will be lost." };
  return { title: "Your gift wash ends in 7 days", body: "Your gift wash expires in 7 days. Open the app and book it before it ends." };
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

/** Gifts are not refundable. Kept as a function so a screen or a function that asks always gets no. */
export const giftRefundable = (_g: Pick<Gift, "status" | "expiresAt">, _now: number): boolean => false;

/** The message the buyer shares. First name only, studio name, code and expiry. No phone numbers or private details. */
export function giftShareMessage(args: { buyerFirstName: string | null; code: string; expiresAt: string; studioName: string }): string {
  const who = args.buyerFirstName ? `${args.buyerFirstName} has gifted you` : "You have been gifted";
  const until = new Date(args.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${who} a car wash at ${args.studioName}. Your code: ${formatGiftCode(args.code)}. Valid until ${until} (${GIFT_VALID_DAYS} days from purchase, then it expires). Redeem it in the app: https://app.autodeck.in`;
}
