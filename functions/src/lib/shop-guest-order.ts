/**
 * Guest shop order handler. Pure logic with an injected store, so the durable
 * idempotency rule is tested without Firestore. NOT exported from index.ts, so it
 * is not deployed. No payment. Real ordering stays off: an empty catalogue or
 * productionLive=false refuses every order (core priceGuestOrder rules).
 */
import { priceGuestOrder, type GuestInput, type OrderLineInput, type ShopCatalogue } from "@autodeck/core";

export interface OrderStore {
  /** Create the order doc keyed by idempotencyKey. Must return created=false and the stored record when the key already exists (Firestore create() ALREADY_EXISTS). */
  createOnce(key: string, record: Record<string, unknown>): Promise<{ created: boolean; record: Record<string, unknown> }>;
}

export type ShopOrderOutcome =
  | { ok: true; replay: boolean; orderKey: string; totalPaise: number }
  | { ok: false; code: string; detail?: string | undefined };

export async function placeGuestShopOrder(
  deps: { catalogue: ShopCatalogue; store: OrderStore; now: () => string },
  lines: OrderLineInput[],
  guest: GuestInput,
): Promise<ShopOrderOutcome> {
  // Only ids and quantities from the client are used; amounts are always recomputed here.
  const safeLines = (Array.isArray(lines) ? lines : []).map((l) => ({ productId: String(l?.productId), variantId: String(l?.variantId), quantity: Number(l?.quantity) }));
  const r = priceGuestOrder(deps.catalogue, safeLines, guest);
  if (!r.ok) return { ok: false, code: r.code, detail: r.detail };
  const { created, record } = await deps.store.createOnce(r.idempotencyKey, {
    status: "received_unpaid", lines: r.lines, subtotalPaise: r.subtotalPaise, deliveryPaise: r.deliveryPaise, totalPaise: r.totalPaise,
    guest: { name: guest.name, mobile: guest.mobile, address: guest.address, city: guest.city, state: guest.state, pincode: guest.pincode },
    createdAt: deps.now(),
  });
  return { ok: true, replay: !created, orderKey: r.idempotencyKey, totalPaise: Number((record as { totalPaise: number }).totalPaise) };
}
