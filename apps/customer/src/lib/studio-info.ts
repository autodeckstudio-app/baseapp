// Public contact details shown on the Help screen. Fill these in once with the
// studio's real details; any empty value hides its button. No private data here.
export const STUDIO_INFO = {
  name: "AutoDeck",
  phone: "+919898679711", // e.g. "+919800000000"
  whatsapp: "919898679711", // digits only with country code, e.g. "919800000000"
  address: "Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge, Ahmedabad, Gujarat 380006", // street address shown to the customer
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sunbeam+Complex%2C+Old+Sharda+Mandir+Rd%2C+Ellisbridge%2C+Ahmedabad%2C+Gujarat+380006", // opens Google Maps at the address
  hours: "Mon to Sat, 10 am to 9 pm. Sunday, 10 am to 7 pm", // shown on Help
} as const;

export const FAQ: { q: string; a: string }[] = [
  { q: "How do I book a service?", a: "Tap Services below, choose a service, then pick your car and a time. Review the details and request your booking." },
  { q: "Can I change or cancel a booking?", a: "Open your booking to change or cancel it at least 24 hours before the slot. You can reschedule up to three times. Within 24 hours, contact the studio. If you miss your slot, the booking stays valid that day during studio hours. At close (7 pm Sunday, 9 pm other days), unarrived bookings are auto-cancelled. Make a new booking when you are ready." },
  { q: "How will I know my car is ready?", a: "Your booking page shows each step, and you get an update in Notifications." },
  { q: "Where do I find my invoice and warranty?", a: "Invoices are on the booking. Warranties and papers are under your car in Garage." },
  { q: "I need something not listed", a: "Call or message us on WhatsApp above and we will help." },
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

/** The studio's Google review link. Empty hides the "Review us on Google" button; set it once the link exists. */
export const GOOGLE_REVIEW_URL = "https://g.page/r/CXUDwXSsnhcxEBM/review";

/** Privacy policy and Terms pages. Empty hides the links; set them once the pages exist. */
export const PRIVACY_POLICY_URL = "https://www.autodeck.in/privacy";
export const TERMS_URL = "https://www.autodeck.in/terms";

/** Social links. Empty hides the row. */
export const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb90oya8aKvHK2DjRt2k";
export const INSTAGRAM_HANDLE = "autodeck.studio";
export const INSTAGRAM_URL = INSTAGRAM_HANDLE ? `https://www.instagram.com/${INSTAGRAM_HANDLE}/` : "";

/** "Open now" only when live hours are known. Returns null when unknown so the screen shows nothing rather than guess. */
export function isOpenNow(hours: LiveStudioInfo["operatingHours"] | null | undefined, now: Date): boolean | null {
  if (!hours?.length) return null;
  const today = hours.find((h) => h.dayOfWeek === now.getDay());
  if (!today) return null;
  if (today.closed) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh = "0", om = "0"] = today.open.split(":");
  const [ch = "0", cm = "0"] = today.close.split(":");
  return mins >= Number(oh) * 60 + Number(om) && mins < Number(ch) * 60 + Number(cm);
}
