// Gift codes: random, shown once, stored only as a hash. Never sequential or guessable.
import { createHash, randomInt } from "node:crypto";
import { GIFT_ALPHABET, normaliseGiftCode } from "@autodeck/core";

export function generateGiftCode(): string {
  let out = "GW";
  for (let i = 0; i < 8; i++) out += GIFT_ALPHABET[randomInt(GIFT_ALPHABET.length)];
  return out;
}

/** SHA-256 of the normalised code. Returns null for a malformed code so callers fail without touching the database. */
export function hashGiftCode(input: string): string | null {
  const c = normaliseGiftCode(input);
  return c ? createHash("sha256").update(c).digest("hex") : null;
}
