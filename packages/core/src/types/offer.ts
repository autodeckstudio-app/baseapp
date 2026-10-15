/**
 * A studio offer: one banner on the customer Home between a start and an end
 * time. The studio writes the words and picks the image; nothing is invented.
 * Media sits in Storage and is read through short-lived signed URLs from the
 * listOffers callable, so no storage rule change is involved.
 */
export type OfferLinkKind = "none" | "catalogue" | "membership" | "service";

export interface OfferLink {
  kind: OfferLinkKind;
  /** Only for kind "service". */
  serviceId: string | null;
}

export interface Offer {
  id: string;
  tenantId: string;
  studioId: string;
  headline: string;
  body: string | null;
  cta: string | null;
  imagePath: string;
  contentType: string;
  link: OfferLink;
  startsAt: string; // ISO
  endsAt: string; // ISO
  hidden: boolean;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** What the customer app receives: the offer plus a signed image URL. */
export interface OfferView {
  id: string;
  headline: string;
  body: string | null;
  cta: string | null;
  url: string;
  link: OfferLink;
  startsAt: string;
  endsAt: string;
  hidden: boolean;
}

/** Live means shown, started and not ended. One rule for the server and for tests. */
export function isOfferLive(o: { hidden: boolean; startsAt: string; endsAt: string }, now: number): boolean {
  return !o.hidden && Date.parse(o.startsAt) <= now && now < Date.parse(o.endsAt);
}
