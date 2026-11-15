// Showcase copy for the Services screen and service pages.
//
// Service scope is read from the current catalogue record. No extra deliverables
// or results are inferred from a product name.
// Warranty is never written here: pages read it from the service record only.
// "Studio pick" is an editorial tag the owner chooses, not a sales statistic.
import { cancellationPolicySummary, type Service } from "@autodeck/core";

export interface Showcase {
  tagline: string;
  included: string[];
  benefits: string[];
  studioPick?: boolean;
}

export const COPY_IS_DRAFT = false;
// Flip to true once real studio before and after photos are uploaded.
export const SHOW_BEFORE_AFTER = false;

const FAQ_COMMON: { q: string; a: string }[] = [
  { q: "How long will my car be with you?", a: "The time shown on the service is our estimate. We confirm it when you book." },
  { q: "Can I change or cancel my booking?", a: `Open your booking to see the change options available for that service. A change request is not confirmed until the studio approves it. ${cancellationPolicySummary()} A missed slot stays valid that day during studio hours until studio close (7 pm Sunday, 9 pm other days); after that, unarrived bookings are auto-cancelled. Make a new booking when you are ready.` },
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
    { q: "How many days will the car stay?", a: "The duration depends on the coverage and work needed. Use the estimate on this page and confirm the handover time with the studio." },
    { q: "What does the warranty cover?", a: "Warranty depends on the exact film and its written terms. Ask the studio to confirm the product, exclusions and registration requirements before booking." },
    ...FAQ_COMMON.slice(1),
  ],
};

/** Customer service scope comes from the current catalogue record, never a
 * name-matched marketing template. Admin changes therefore appear on every page. */
export function showcaseFor(s: Pick<Service, "name" | "description">): Showcase {
  const lines = (s.description ?? "").split(/\n+/).map(x => x.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
  return { tagline: lines[0] ?? "", included: [...new Set(lines)], benefits: [] };
}

/** Brand blurbs: catalogue brands only. Draft. */
export const BRAND_NOTE: Record<string, string> = {
  LLumar: "Paint protection film",
  Garware: "Paint protection film",
  Kovalent: "Ceramic coatings",
};
