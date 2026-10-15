import type { LiveStudioInfo } from "./studio-info";

type Hours = LiveStudioInfo["operatingHours"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mins = (t: string): number => { const [h = "0", m = "0"] = t.split(":"); return Number(h) * 60 + Number(m); };
function clock(t: string): string {
  const [hh = "0", mm = "0"] = t.split(":");
  const h = Number(hh), m = Number(mm), h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "Open now, until 9 pm" or "Closed, opens Mon 10 am". Null when hours are unknown (never guess). */
export function openStatus(hours: Hours | null | undefined, holidays: string[] = [], now: Date = new Date()): { open: boolean; text: string } | null {
  if (!hours || hours.length === 0) return null;
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const today = byDay.get(now.getDay());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const holidayToday = holidays.includes(ymd(now));
  if (today && !today.closed && !holidayToday && nowMin >= mins(today.open) && nowMin < mins(today.close)) return { open: true, text: `Open now, until ${clock(today.close)}` };
  if (today && !today.closed && !holidayToday && nowMin < mins(today.open)) return { open: false, text: `Closed, opens ${clock(today.open)}` };
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const h = byDay.get(d.getDay());
    if (h && !h.closed && !holidays.includes(ymd(d))) return { open: false, text: `Closed, opens ${i === 1 ? "tomorrow" : DAYS[d.getDay()]} ${clock(h.open)}` };
  }
  return { open: false, text: "Closed" };
}
