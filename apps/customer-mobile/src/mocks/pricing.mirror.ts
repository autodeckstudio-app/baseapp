/**
 * MIRROR OF `packages/domain/src/pricing.ts` — NOT A NEW BUSINESS DECISION.
 *
 * `@autodeck/domain` (which owns `computePriceSnapshot`, the real,
 * server-authoritative pricing function) is not yet a dependency of
 * `apps/customer-mobile` — adding it mid-UI-pass would mean editing
 * `package.json` and re-linking the workspace, exactly the kind of
 * dependency-graph change that caused the duplicate-React Metro issue
 * fixed earlier this session. This file duplicates the constants and pure
 * calculation ONLY so the Booking Review screen can preview realistic
 * numbers against mock services, using the exact approved thresholds.
 *
 * FUTURE SCHEMA DEPENDENCY: once a customer-facing backend endpoint exists
 * (see the approved backend-architecture gate), the Booking flow must call
 * the server's price snapshot, and this file should be deleted in favour
 * of importing `computePriceSnapshot` from `@autodeck/domain` directly —
 * never both at once.
 */

export const ADVANCE_THRESHOLD_PAISE = 1_000_000; // ₹10,000 — mirrors packages/domain exactly
export const ADVANCE_PERCENTAGE = 0.4; // 40% — mirrors packages/domain exactly

export interface MockPriceLineItem {
  serviceId: string;
  price: number;
}

export interface MockPriceSnapshot {
  lineItems: MockPriceLineItem[];
  subtotal: number;
  total: number;
  advanceRequired: boolean;
  advanceAmount: number;
}

export function computeMockPriceSnapshot(
  selectedServices: ReadonlyArray<{ serviceId: string; basePrice: number }>
): MockPriceSnapshot {
  const lineItems = selectedServices.map((service) => ({ serviceId: service.serviceId, price: service.basePrice }));
  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal;
  const advanceRequired = total > ADVANCE_THRESHOLD_PAISE;
  const advanceAmount = advanceRequired ? Math.round(total * ADVANCE_PERCENTAGE) : 0;

  return { lineItems, subtotal, total, advanceRequired, advanceAmount };
}

/** ₹ display helper — paise to a tabular-figure-ready rupee string. */
export function formatPaiseAsRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
