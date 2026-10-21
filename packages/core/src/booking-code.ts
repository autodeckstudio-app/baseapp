/**
 * A short code a customer can read out on the phone, derived from the booking id.
 * Display only: nothing is stored, so every old and new booking has one and it never changes.
 * Letters and digits avoid look-alikes (no 0, O, 1, I, L). 6 characters, about a billion codes.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function bookingCode(bookingId: string): string {
  let h = 2166136261;
  for (let i = 0; i < bookingId.length; i++) { h ^= bookingId.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let h2 = 5381;
  for (let i = bookingId.length - 1; i >= 0; i--) h2 = (Math.imul(h2, 33) ^ bookingId.charCodeAt(i)) >>> 0;
  let n = (h ^ Math.imul(h2, 2654435761)) >>> 0;
  let out = "";
  for (let i = 0; i < 6; i++) { out += ALPHABET[n % ALPHABET.length]; n = Math.floor(n / ALPHABET.length) || ((n ^ h2) >>> 0); }
  return `AD-${out}`;
}
