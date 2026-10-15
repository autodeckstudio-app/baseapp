import { httpsCallable } from "firebase/functions";
import type { OfferView } from "@autodeck/core";
import { functions } from "./firebase";
import type { Campaign } from "./campaign";

/** Live offers from the studio. Never throws: a banner is a bonus, not a blocker for Home. */
export async function getOffers(): Promise<OfferView[]> {
  try {
    const fn = httpsCallable<Record<string, never>, { offers: OfferView[] }>(functions, "listOffers");
    return (await fn({})).data.offers;
  } catch {
    return [];
  }
}

/** The one banner for Home: the newest live offer, opened where the studio chose. Null shows nothing. */
export function offerToCampaign(offers: OfferView[], go: (href: string) => void, now = Date.now()): Campaign | null {
  const o = offers.find((x) => !x.hidden && Date.parse(x.startsAt) <= now && now < Date.parse(x.endsAt));
  if (!o) return null;
  const href = o.link.kind === "catalogue" ? "/(tabs)/catalogue" : o.link.kind === "membership" ? "/(tabs)/membership" : o.link.kind === "service" && o.link.serviceId ? `/(tabs)/book/${o.link.serviceId}` : null;
  return { headline: o.headline, ...(o.body ? { body: o.body } : {}), ...(o.cta ? { cta: o.cta } : {}), imageUrl: o.url, onPress: () => { if (href) go(href); } };
}
