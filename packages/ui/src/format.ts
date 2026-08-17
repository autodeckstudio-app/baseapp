/** Formats an integer paise amount as an INR display string, e.g. 59000 → "₹590". */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Formats an ISO instant as a short India-locale date, e.g. "Tue, 18 Aug". */
export function formatDateShort(isoOrDate: string): string {
  const iso = isoOrDate.length === 10 ? `${isoOrDate}T12:00:00Z` : isoOrDate;
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Formats an ISO instant as an India-locale time, e.g. "10:30 AM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
