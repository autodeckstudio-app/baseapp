// Schedule and timezone utilities for the booking engine.
// All slot times are expressed in studio-local time (Asia/Kolkata by default).

// Returns the UTC offset in minutes for a given timezone at a specific UTC instant.
// Uses Intl.DateTimeFormat.formatToParts for DST-safe offset computation.
// For IST (Asia/Kolkata) there is no DST — the offset is always +330.
export function getTZOffsetMinutes(timezone: string, atUTC: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(atUTC);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  // Build a UTC instant that "looks like" the local time in UTC coordinates
  const localAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((localAsUTC - atUTC.getTime()) / 60000);
}

// Converts a local date+time ("YYYY-MM-DD", "HH:mm") to a UTC Date.
export function localToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number) as [number, number, number];
  const [hour, minute] = timeStr.split(":").map(Number) as [number, number];
  // Treat local time as UTC initially, then correct for the offset.
  const approxUTC = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getTZOffsetMinutes(timezone, approxUTC);
  return new Date(approxUTC.getTime() - offset * 60000);
}

// Converts a UTC Date to local "HH:mm" in the given timezone.
export function utcToLocalTime(utcDate: Date, timezone: string): string {
  return utcDate.toLocaleString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Converts a UTC Date to a local "YYYY-MM-DD" date string.
export function utcToLocalDate(utcDate: Date, timezone: string): string {
  return utcDate.toLocaleDateString("en-CA", { timeZone: timezone });
}

// Parses "HH:mm" into minutes since midnight.
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

// Converts minutes since midnight to "HH:mm".
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Returns "YYYY-MM-DD" for N days after the given local date string.
export function addDays(dateStr: string, days: number): string {
  // Use noon UTC to avoid date-boundary issues near midnight.
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns the UTC day-of-week (0=Sunday) for a local "YYYY-MM-DD" date string.
// Using noon UTC avoids timezone-crossing issues.
export function getDayOfWeek(localDateStr: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const d = new Date(`${localDateStr}T12:00:00Z`);
  return d.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

// Returns true if the given local date string is a holiday.
export function isHoliday(dateStr: string, holidays: string[]): boolean {
  return holidays.includes(dateStr);
}
