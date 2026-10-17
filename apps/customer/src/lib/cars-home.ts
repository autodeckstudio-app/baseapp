import type { CarListingView } from "@autodeck/core";

/** The one car the Home card shows: a live listing with a real photo, studio stock first. Null hides the card. */
export function pickFeaturedCar(listings: CarListingView[] | null | undefined): CarListingView | null {
  const ok = (listings ?? []).filter((l) => l.status === "live" && !!l.photoUrls[0]);
  return ok.find((l) => l.source === "studio") ?? ok[0] ?? null;
}

/** A price is shown only when the server sent a real one. Missing or hidden means "ask the studio", never NaN and never filtered out. */
export const hasCarPrice = (l: Pick<CarListingView, "askingPrice" | "priceHidden">): boolean => !l.priceHidden && typeof l.askingPrice === "number" && Number.isFinite(l.askingPrice) && l.askingPrice > 0;
