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
