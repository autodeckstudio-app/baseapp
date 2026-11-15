import { createHash, randomBytes } from "node:crypto";

/**
 * Staff-first claim codes. The code is a shared secret shown ONCE to staff at
 * the counter (and confirmed in person); only its SHA-256 hash is stored, in
 * the server-only claimChallenges collection. It is never written to the
 * customer doc, never logged, never returned after the issuing call.
 *
 * Format: 8 chars of Crockford base32 (40 bits), displayed as XXXX-XXXX.
 * Bound to a studio-confirmed email at issue time; claiming additionally
 * requires a Google-verified matching email on the caller's Auth token, so
 * the code alone never grants anything (something you have AND an account
 * you own). 5 failed attempts lock the challenge; reissue is capped and
 * audited (see issueClaimCode).
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U

export const CLAIM_CODE_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days, per owner decision
export const CLAIM_MAX_ATTEMPTS = 5;
export const CLAIM_MAX_ISSUES = 3; // first issue + 2 reissues, then a manager review

export function generateClaimCode(): string {
  const bytes = randomBytes(5); // 40 bits
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[Number(value & 31n)] + out;
    value >>= 5n;
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Display input is messy: dashes, spaces, lowercase, and 0/O 1/I confusion. */
export function normalizeClaimCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function hashClaimCode(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Deterministic idempotency key shared by counter intake and self-serve
 * signup: at most one customer identity per (tenant, email) can be created. */
export function walkinEmailKeyId(tenantId: string, email: string): string {
  return createHash("sha256").update(`${tenantId}\n${email}`, "utf8").digest("hex");
}
