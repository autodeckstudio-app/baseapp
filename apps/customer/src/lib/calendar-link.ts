// Add a booking to the customer's own calendar. Times are studio local time (India), so the link carries the zone.
import { STUDIO_INFO } from "./studio-info";

export interface CalendarBooking {
  id: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  estimatedEndDate: string;
  estimatedEndTime: string;
}

const stamp = (date: string, time: string): string => `${date.replace(/-/g, "")}T${time.replace(":", "").padEnd(4, "0")}00`;

function span(b: CalendarBooking): { start: string; end: string } {
  const start = stamp(b.scheduledDate, b.scheduledTime);
  const end = stamp(b.estimatedEndDate || b.scheduledDate, b.estimatedEndTime || b.scheduledTime);
  // A missing or backwards end falls back to a one hour slot so the event is never negative.
  if (end <= start) {
    const hh = Math.min(23, Number(b.scheduledTime.slice(0, 2)) + 1);
    return { start, end: stamp(b.scheduledDate, `${String(hh).padStart(2, "0")}:${b.scheduledTime.slice(3, 5)}`) };
  }
  return { start, end };
}

export function calendarTitle(serviceName: string): string {
  return `${serviceName} at ${STUDIO_INFO.name}`;
}

export function googleCalendarUrl(b: CalendarBooking, serviceName: string): string {
  const { start, end } = span(b);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(serviceName),
    dates: `${start}/${end}`,
    ctz: "Asia/Kolkata",
    location: STUDIO_INFO.address,
    details: "Booked on AutoDeck. Bring your car at the booked time.",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** An .ics file for Apple Calendar, Outlook and others. */
export function icsFor(b: CalendarBooking, serviceName: string, now = new Date()): string {
  const { start, end } = span(b);
  const dt = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoDeck//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@autodeck.in`,
    `DTSTAMP:${dt}`,
    `DTSTART;TZID=Asia/Kolkata:${start}`,
    `DTEND;TZID=Asia/Kolkata:${end}`,
    `SUMMARY:${esc(calendarTitle(serviceName))}`,
    `LOCATION:${esc(STUDIO_INFO.address)}`,
    "DESCRIPTION:Booked on AutoDeck. Bring your car at the booked time.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
