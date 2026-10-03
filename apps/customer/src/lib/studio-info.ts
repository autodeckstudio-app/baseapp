// Public contact details shown on the Help screen. Fill these in once with the
// studio's real details; any empty value hides its button. No private data here.
export const STUDIO_INFO = {
  name: "AutoDeck",
  phone: "", // e.g. "+919800000000"
  whatsapp: "", // digits only with country code, e.g. "919800000000"
  address: "", // street address shown to the customer
  mapsUrl: "", // a Google Maps share link
  hours: "", // e.g. "Mon to Sat, 9 am to 7 pm"
} as const;

export const FAQ: { q: string; a: string }[] = [
  { q: "How do I book a service?", a: "Open Services, pick one, choose your car and a time, then confirm." },
  { q: "Can I change or cancel a booking?", a: "Yes. Open the booking from Bookings to reschedule or cancel." },
  { q: "How will I know my car is ready?", a: "Your booking page shows each step, and you get an update in Notifications." },
  { q: "Where do I find my invoice and warranty?", a: "Invoices are on the booking. Warranties and papers are under your car in Garage." },
  { q: "I need something not listed", a: "Use the call or WhatsApp button above and we will help." },
];
