// Referral: one place for the reward wording, the personal code and the share message every "Bring a friend" button uses.
/** The reward, as one value. Change it here and everywhere follows. */
export const REFERRAL_REWARD_TEXT = "Your friend's first wash is free";

/**
 * Stays false until the server can verify the code and redeem the reward (functions deploy is held). While false the
 * share message promises nothing, no code is shown and no code field appears, so nobody is told about a free wash the
 * studio system cannot give yet.
 */
export const REFERRAL_LIVE = false;

const BASE = "AutoDeck, car care studio in Ahmedabad. Book on https://app.autodeck.in";

// No 0, 1, I or O so a code read aloud or typed from a message is hard to get wrong.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_RE = /^AD[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/;

/** A stable personal code for one customer: "AD" plus five characters derived from their id. The server stores and checks it. */
export function referralCodeFor(uid: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < uid.length; i++) {
    const c = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    h2 ^= h2 >>> 13;
  }
  let n = (h1 ^ Math.imul(h2, 0x9e3779b1)) >>> 0;
  let out = "";
  for (let i = 0; i < 5; i++) { out += ALPHABET[n & 31]; n = (n >>> 5) | ((n & 31) << 27); n = Math.imul(n, 0x2545f491) >>> 0 || n; }
  return `AD${out}`;
}

/** Tidy what a customer typed: upper case, no spaces or dashes. Returns null when it cannot be a code. */
export function normaliseReferralCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(c) ? c : null;
}

/** The code to send with a booking: valid, and never the customer's own. */
export function referralCodeToSend(input: string, ownUid: string, live: boolean = REFERRAL_LIVE): string | null {
  if (!live) return null;
  const c = normaliseReferralCode(input);
  return c && c !== referralCodeFor(ownUid) ? c : null;
}

export function referralShareMessage(code?: string | null, live: boolean = REFERRAL_LIVE): string {
  return live && code ? `${BASE}\n${REFERRAL_REWARD_TEXT}. Use my code ${code} when you book.` : BASE;
}

export function referralSubtitle(code?: string | null, live: boolean = REFERRAL_LIVE): string {
  return live ? (code ? `Your code ${code}` : REFERRAL_REWARD_TEXT) : "Share AutoDeck";
}
