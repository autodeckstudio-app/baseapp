import type { CarListingView } from "@autodeck/core";

/** Every live listing with a real photo, studio stock first (order otherwise unchanged). Empty hides the Home section. */
export function homeCars(listings: CarListingView[] | null | undefined): CarListingView[] {
  const ok = (listings ?? []).filter((l) => l.status === "live" && !!l.photoUrls[0]);
  return [...ok.filter((l) => l.source === "studio"), ...ok.filter((l) => l.source !== "studio")];
}

/** A price is shown only when the server sent a real one. Missing or hidden means "ask the studio", never NaN and never filtered out. */
export const hasCarPrice = (l: Pick<CarListingView, "askingPrice" | "priceHidden">): boolean => !l.priceHidden && typeof l.askingPrice === "number" && Number.isFinite(l.askingPrice) && l.askingPrice > 0;
