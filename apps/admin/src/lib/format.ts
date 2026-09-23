// Presentation-only formatting helpers, local to the admin web app.
// Not imported from @autodeck/ui (RN components there would pull
// react-native into the Next.js bundle) — kept intentionally tiny and
// duplicated rather than shared, per apps/customer|studio's format.ts.

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const value = iso.length === 10 ? `${iso}T12:00:00Z` : iso;
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "10:30 am" in studio time. */
export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s?(AM|PM)$/i, (m) => ` ${m.trim().toLowerCase()}`);
}

/** "Wednesday, 23 Sep" for a studio-day key "YYYY-MM-DD". */
export function formatDayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** Studio-day key shifted by whole days. */
export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/** Today's studio-day key (Asia/Kolkata). */
export function studioToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
