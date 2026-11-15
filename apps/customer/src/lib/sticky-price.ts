/** Text of the sticky bar on a service page. Every state matches the price block above it; it never asks for a size the car already has. */
export function stickyPriceLabel(
  s: { priceOnRequest: boolean; loading: boolean; total: number | null; from: boolean; needsCarType: boolean; hasCar: boolean; error: boolean },
  format: (paise: number) => string,
): string {
  if (s.priceOnRequest) return "Consult";
  if (s.loading) return "Checking price";
  if (s.total !== null) return `${s.from ? "From " : ""}${format(s.total)}`;
  if (s.needsCarType) return s.hasCar ? "Car type needed" : "Add your car";
  if (s.error) return "Price unavailable";
  return "Checking price";
}

/** The bar (price + Book now) shows only with a confirmed price, a quote service, or while the price is loading (Book disabled). Never with a missing car, car type or failed price. */
export function sheetBarVisible(s: { priceOnRequest: boolean; loading: boolean; hasTotal: boolean; needsCarType: boolean; error: boolean }): boolean {
  if (s.priceOnRequest) return true;
  if (s.needsCarType || s.error) return false;
  return s.hasTotal || s.loading;
}
