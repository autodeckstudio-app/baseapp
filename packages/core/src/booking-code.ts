/**
 * A short code a customer can read out on the phone, derived from the booking id.
 *
 * Display and lookup aid only. The full booking id stays the authority: never act on a booking
 * from this code alone. It is NOT guaranteed unique. 8 characters is about 39 bits, so with
 * 100,000 bookings the chance that any two share a code is roughly 0.5%. Search must therefore
 * treat a code as "these bookings", and show every match (see matchBookingCode).
 * Nothing is stored, so every old and new booking has one and it never changes.
 * Characters avoid look-alikes (no 0, O, 1, I, L).
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

// cyrb53: a fast 53-bit string hash with good mixing.
function cyrb53(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function bookingCode(bookingId: string): string {
  let n = cyrb53(bookingId);
  let out = "";
  for (let i = 0; i < 8; i++) { out += ALPHABET[n % ALPHABET.length]; n = Math.floor(n / ALPHABET.length); }
  return `AD-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Normalise what a person typed ("ad 7k2m 9xqp", "AD-7K2M9XQP") to the canonical form, or null if it is not a code. */
export function parseBookingCode(input: string): string | null {
  const t = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^AD([2-9A-HJKMN-Z]{8})$/.exec(t);
  return m ? `AD-${m[1]!.slice(0, 4)}-${m[1]!.slice(4)}` : null;
}

/** Every booking with this code. More than one means the code is ambiguous: show all and make the person confirm with the name or plate. */
export function matchBookingCode<T extends { id: string }>(bookings: T[], input: string): { matches: T[]; ambiguous: boolean } | null {
  const code = parseBookingCode(input);
  if (!code) return null;
  const matches = bookings.filter((b) => bookingCode(b.id) === code);
  return { matches, ambiguous: matches.length > 1 };
}
