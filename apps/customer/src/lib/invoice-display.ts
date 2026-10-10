// Customer re-export of the shared Horizon invoice document (packages/ui/src/invoice).
export * from "@autodeck/ui/invoice";
/** The one route every invoice entry point uses: the exact invoice by id. */
export function invoiceHref(invoiceId: string) {
  return { pathname: "/(tabs)/bookings/invoice" as const, params: { invoiceId } };
}
