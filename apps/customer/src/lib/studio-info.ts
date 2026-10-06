// Public contact details shown on the Help screen. Fill these in once with the
// studio's real details; any empty value hides its button. No private data here.
export const STUDIO_INFO = {
  name: "AutoDeck",
  phone: "", // e.g. "+919800000000"
  whatsapp: "", // digits only with country code, e.g. "919800000000"
  address: "Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge, Ahmedabad, Gujarat 380006", // street address shown to the customer
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sunbeam+Complex%2C+Old+Sharda+Mandir+Rd%2C+Ellisbridge%2C+Ahmedabad%2C+Gujarat+380006", // opens Google Maps at the address
  hours: "Mon to Sat, 10 am to 9 pm. Sunday, 10 am to 7 pm", // shown on Help
} as const;

export const FAQ: { q: string; a: string }[] = [
  { q: "How do I book a service?", a: "Tap Services below, choose a service, then pick your car and a time. Review the details and request your booking." },
  { q: "Can I change or cancel a booking?", a: "Yes. Open the booking from Bookings to reschedule or cancel." },
  { q: "How will I know my car is ready?", a: "Your booking page shows each step, and you get an update in Notifications." },
  { q: "Where do I find my invoice and warranty?", a: "Invoices are on the booking. Warranties and papers are under your car in Garage." },
  { q: "I need something not listed", a: "Use the call or WhatsApp button above and we will help." },
];

// Live studio info from the same record the booking engine uses (read-only public subset).
export type LiveStudioInfo = { operatingHours: Array<{ dayOfWeek: number; open: string; close: string; closed: boolean }>; holidays: string[] };

function clock(t: string): string {
  const [hh = "0", mm = "0"] = t.split(":");
  const h = Number(hh);
  const m = Number(mm);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** "Mon to Sat, 10 am to 9 pm. Sun, 10 am to 7 pm." Groups neighbouring days with equal hours; lists closed days. */
export function formatHours(hours: LiveStudioInfo["operatingHours"]): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const parts: string[] = [];
  const closed: string[] = [];
  let i = 0;
  while (i < order.length) {
    const h = byDay.get(order[i]!);
    if (!h || h.closed) { if (h) closed.push(names[h.dayOfWeek]!); i++; continue; }
    let j = i;
    while (j + 1 < order.length) {
      const n = byDay.get(order[j + 1]!);
      if (n && !n.closed && n.open === h.open && n.close === h.close) j++; else break;
    }
    const a = names[order[i]!]!;
    const b = names[order[j]!]!;
    parts.push(`${j > i ? `${a} to ${b}` : a}, ${clock(h.open)} to ${clock(h.close)}`);
    i = j + 1;
  }
  if (closed.length) parts.push(`Closed ${closed.join(", ")}`);
  return parts.join(". ");
}
