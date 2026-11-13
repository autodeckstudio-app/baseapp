import {studioOpenStatus} from '@autodeck/core';
import { cancellationPolicySummary, CANCEL_SHORT, CANCEL_BIGGER } from "@autodeck/core";
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

export type FaqFact={label:string;detail:string};
export type FaqItem={q:string;a:string;facts:FaqFact[]};
const faq=(q:string,facts:FaqFact[],searchText?:string):FaqItem=>({q,facts,a:searchText??facts.map(f=>`${f.label}: ${f.detail}`).join(' ')});
export const FAQ:FaqItem[]=[
 faq("How do I book a service?",[{label:"Start",detail:"Services: choose the work."},{label:"Car & time",detail:"Pick your car and a time."},{label:"Review",detail:"Review. Request the booking."}]),
 faq("Change or cancel?",[
  {label:"Change options",detail:"Open booking for options."},
  {label:"Change approval",detail:"Wait for studio approval."},
  {label:"Short jobs: free cancel",detail:`Until ${CANCEL_SHORT.freeUntilHours} hours before.`},
  {label:"Short jobs: late fee",detail:`Rs ${CANCEL_SHORT.feePaise/100} inside that window.`},
  {label:"Bigger jobs: free cancel",detail:`Until ${CANCEL_BIGGER.freeUntilHours} hours before.`},
  {label:"Bigger jobs: late fee",detail:`${CANCEL_BIGGER.feePercent}% of service + GST.`},{label:"Transport fee basis",detail:"Unused pickup/drop excluded."},
  {label:"Missed slot",detail:"Valid that day in open hours."},
  {label:"At studio close",detail:"No arrival: auto-cancelled."},
  {label:"Next visit",detail:"Book again when ready."},
 ],`Open your booking to see the change options available for that service. Studio approval is required. ${cancellationPolicySummary(true)} A missed slot stays valid that day during studio hours. At close unarrived bookings auto-cancel. Book again when ready.`),
 faq("Is my car ready?",[{label:"Progress",detail:"See each step on your booking."},{label:"Updates",detail:"Check Notifications."}]),
 faq("Invoice and warranty?",[{label:"Invoice",detail:"Open the booking."},{label:"Warranty & papers",detail:"Open your car in Garage."}]),
 faq("Other services?",[{label:"Help",detail:"Call or WhatsApp above."}]),
];

// Live studio info from the same record the booking engine uses (read-only public subset).
export type LiveStudioInfo = { name?:string; timezone?:string; operatingHours: Array<{ dayOfWeek: number; open: string; close: string; closed: boolean }>; holidays: string[] };

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
export function isOpenNow(hours:LiveStudioInfo["operatingHours"]|null|undefined,now:Date,timezone?:string|null,holidays:string[]=[]):boolean|null{
 return studioOpenStatus(hours as Parameters<typeof studioOpenStatus>[0],holidays,timezone,now)?.open??null;
}
