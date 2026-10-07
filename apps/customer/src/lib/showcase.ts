// Showcase copy for the Services screen and service pages.
//
// ALL COPY HERE IS DRAFT FOR OWNER REVIEW. It is written in plain words and makes no
// claims beyond what the catalogue data (brand, price, time, warranty label) already says.
// Warranty is never written here: pages read it from the service record only.
// "Studio pick" is an editorial tag the owner chooses, not a sales statistic.
import type { Service } from "@autodeck/core";

export interface Showcase {
  tagline: string;
  included: string[];
  benefits: string[];
  care: string[];
  studioPick?: boolean;
}

export const COPY_IS_DRAFT = false;
// Flip to true once real studio before and after photos are uploaded.
export const SHOW_BEFORE_AFTER = false;

const FAQ_COMMON: { q: string; a: string }[] = [
  { q: "How long will my car be with you?", a: "The time shown on the service is our estimate. We confirm it when you book." },
  { q: "Can I change or cancel my booking?", a: "Change or cancel from Bookings at least 24 hours before your slot. Within 24 hours, contact the studio. A missed slot stays valid that day during studio hours until studio close (7 pm Sunday, 9 pm other days); after that, unarrived bookings are auto-cancelled. Make a new booking when you are ready." },
  { q: "Will I see what was done?", a: "Yes. You can follow your car's progress in the app and see the bill once the work is done." },
];

export const FAQS: Record<string, { q: string; a: string }[]> = {
  washing: FAQ_COMMON,
  ceramic: [
    { q: "How long does the job take?", a: "Coating work is done carefully over several hours. The time on this page is our estimate." },
    { q: "When can I wash the car after?", a: "We tell you the exact care steps when you collect the car." },
    ...FAQ_COMMON.slice(1),
  ],
  coating: FAQ_COMMON,
  ppf: [
    { q: "How many days will the car stay?", a: "Film fitting takes days, not hours. The time on this page is our estimate and we confirm it when you book." },
    { q: "What does the warranty cover?", a: "It is the warranty shown on this page. Ask us for the written terms before you book." },
    ...FAQ_COMMON.slice(1),
  ],
};

const T: Record<string, Showcase> = {
  "regular wash": {
    tagline: "A clean car, inside and out, in under an hour.",
    included: ["Exterior hand wash", "Wheel and tyre clean", "Quick interior vacuum", "Dry and finish"],
    benefits: ["Quick turnaround", "Good for weekly upkeep"],
    care: ["Avoid parking under trees right after a wash."],
  },
  "premium wash": {
    tagline: "A deeper wash for when the car needs more than the basics.",
    included: ["Exterior hand wash", "Wheel, arch and tyre clean", "Interior vacuum and wipe-down", "Glass clean", "Dry and finish"],
    benefits: ["More thorough than a regular wash", "Interior gets attention too"],
    care: ["Keep a soft cloth in the car for dust between washes."],
    studioPick: true,
  },
  "detail spa": {
    tagline: "A slow, careful clean that brings the car back to its best.",
    included: ["Detailed exterior wash", "Interior deep clean", "Dashboard and panel care", "Glass clean", "Final check"],
    benefits: ["Fresh-car feel", "Good before a long drive or a sale"],
    care: ["Keep sunshades up in hot weather to protect the dashboard."],
  },
  "dry clean": {
    tagline: "A full interior clean using little water.",
    included: ["Seat and carpet clean", "Roof lining wipe", "Dashboard and door panels", "Vacuum and finish"],
    benefits: ["Good for stains and smells", "Interior is ready to use soon after"],
    care: ["Leave windows slightly open for an hour after the job if the cabin feels damp."],
  },
  "roof cleaning": {
    tagline: "The part of the car most people forget.",
    included: ["Roof and pillar clean", "Dry and finish"],
    benefits: ["Quick add-on", "Removes dust and marks you can't see from inside"],
    care: ["Wipe bird droppings off early."],
  },
  "headlight buffing": {
    tagline: "Clearer headlights, sharper look.",
    included: ["Headlight clean", "Buffing of the lens surface", "Final wipe"],
    benefits: ["Clearer lamps", "Quick job"],
    care: ["Wash the lamps with the rest of the car to keep them clear."],
  },
  teflon: {
    tagline: "A protective top coat for easy cleaning and a deeper shine.",
    included: ["Surface prep", "Teflon coat applied", "Final wipe and inspection"],
    benefits: ["Easier to clean", "Adds shine"],
    care: ["Use a gentle car shampoo.", "Follow the care steps we give you after the job."],
  },
  "glass coating": {
    tagline: "Helps rain slide off the windscreen.",
    included: ["Glass clean and prep", "Coating applied", "Final check"],
    benefits: ["Clearer view in the rain", "Easier to clean glass"],
    care: ["Avoid harsh glass cleaners."],
  },
  "maintenance coat": {
    tagline: "A top-up coat that keeps a protected car looking fresh.",
    included: ["Surface clean", "Maintenance coat applied", "Final check"],
    benefits: ["Keeps the finish fresh between big services"],
    care: ["Hand wash with a gentle shampoo."],
  },
  "kovalent prolong": {
    tagline: "Ceramic coating from Kovalent for long-lasting gloss.",
    included: ["Paint wash and decontamination", "Paint prep", "Kovalent Prolong applied", "Curing guidance and final inspection"],
    benefits: ["Deep gloss", "Water beads and rolls off", "Easier washing"],
    care: ["Hand wash with a gentle shampoo.", "We tell you when it is safe to wash the car first."],
    studioPick: true,
  },
  "graphene matrix": {
    tagline: "A graphene-infused ceramic coating for a slick, glossy finish.",
    included: ["Paint wash and decontamination", "Paint prep", "Coating applied", "Curing guidance and final inspection"],
    benefits: ["Strong water beading", "Glossy, easy-clean paint"],
    care: ["Hand wash with a gentle shampoo."],
  },
  borophene: {
    tagline: "The studio's premium coating tier.",
    included: ["Paint wash and decontamination", "Paint prep", "Coating applied", "Curing guidance and final inspection"],
    benefits: ["Premium-tier protection", "Deep gloss"],
    care: ["Hand wash with a gentle shampoo."],
  },
  "llumar gloss": {
    tagline: "Clear paint protection film from LLumar, full body.",
    included: ["Paint wash and prep", "Film fitted to the full body", "Edge finish and inspection", "Handover with care notes"],
    benefits: ["Helps guard paint against chips and scratches", "Keeps the glossy look"],
    care: ["Wait before the first wash; we tell you exactly how long.", "Avoid pressure washing the film edges."],
  },
  "llumar platinum": {
    tagline: "LLumar's Platinum film, full body, with longer cover.",
    included: ["Paint wash and prep", "Film fitted to the full body", "Edge finish and inspection", "Handover with care notes"],
    benefits: ["Helps guard paint against chips and scratches", "Longer warranty than the Gloss film"],
    care: ["Wait before the first wash; we tell you exactly how long."],
    studioPick: true,
  },
  "llumar valor": {
    tagline: "LLumar's top film in the studio range.",
    included: ["Paint wash and prep", "Film fitted to the full body", "Edge finish and inspection", "Handover with care notes"],
    benefits: ["Top of the LLumar range here", "Longest LLumar warranty we offer"],
    care: ["Wait before the first wash; we tell you exactly how long."],
  },
  "garware plus": {
    tagline: "Garware paint protection film for everyday protection.",
    included: ["Paint wash and prep", "Film fitted to the full body", "Edge finish and inspection", "Handover with care notes"],
    benefits: ["Helps guard paint against chips and scratches", "Good value entry to film"],
    care: ["Wait before the first wash; we tell you exactly how long."],
  },
  "garware premium": {
    tagline: "Garware Premium film with extended cover.",
    included: ["Paint wash and prep", "Film fitted to the full body", "Edge finish and inspection", "Handover with care notes"],
    benefits: ["Helps guard paint against chips and scratches", "Step up in cover from Plus"],
    care: ["Wait before the first wash; we tell you exactly how long."],
  },
  "garware platinum": {
    tagline: "Garware Platinum, the longest-cover film we fit.",
    included: ["Paint wash and prep", "Film fitted to the full body", "Edge finish and inspection", "Handover with care notes"],
    benefits: ["Top of the Garware range here"],
    care: ["Wait before the first wash; we tell you exactly how long."],
  },
};

const FALLBACK: Showcase = {
  tagline: "",
  included: [],
  benefits: [],
  care: [],
};

export function showcaseFor(s: Pick<Service, "name" | "description">): Showcase {
  const hit = T[s.name.toLowerCase()];
  return hit ?? { ...FALLBACK, tagline: s.description };
}

/** Brand blurbs: catalogue brands only. Draft. */
export const BRAND_NOTE: Record<string, string> = {
  LLumar: "Paint protection film",
  Garware: "Paint protection film",
  Kovalent: "Ceramic coatings",
};
