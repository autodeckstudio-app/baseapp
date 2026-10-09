import { HttpsError } from "firebase-functions/v2/https";

/**
 * Parses a staff-entered agreed date/time ("YYYY-MM-DD HH:mm" or the
 * datetime-local "YYYY-MM-DDTHH:mm") as STUDIO-LOCAL wall time and returns
 * the canonical UTC ISO instant. Staff agree the time with the customer on
 * a phone call in studio-local terms, so interpreting it in the studio's
 * configured timezone (not the server's) is what keeps the stored instant
 * honest.
 */
export function studioLocalToIso(value: string, timeZone: string, label: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) {
    throw new HttpsError("invalid-argument", `${label}: use the format YYYY-MM-DD HH:mm (studio local time), e.g. 2026-10-12 16:30.`);
  }
  const [, y, mo, d, h, mi] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59) {
    throw new HttpsError("invalid-argument", `${label} is not a valid date and time.`);
  }
  // Iterated timezone-offset resolution: the wall-clock target stays fixed
  // (wallUtc) while the guessed instant converges. Each pass measures the
  // zone's UTC offset AT the current guess and re-anchors to the target, so a
  // fixed-offset zone converges after one pass and stays put.
  const wallUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let guess = wallUtc;
  for (let i = 0; i < 3; i++) {
    const parts = fmt.formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess = wallUtc - (asUtc - guess);
  }
  return new Date(guess).toISOString();
}
