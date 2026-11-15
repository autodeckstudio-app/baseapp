/**
 * Merch guest order: pure pricing and validation. DESIGN SKELETON, 22 Oct 2026.
 * Not wired to any function, not deployed, takes no payment. There is no approved
 * product, price, stock, delivery charge or return rule: all of those come from
 * the owner's catalogue record. Nothing here invents one.
 *
 * Rules:
 *  - The client sends only product id, variant id and quantity. Amounts are never read from the client.
 *  - Price, stock and availability come from the server-side catalogue record.
 *  - A product without an owner-supplied integer price in paise cannot be bought.
 *  - Delivery charge is not modelled: the owner has not supplied one. A catalogue
 *    without a delivery rule makes the order not placeable.
 *  - The idempotency key is derived from the buyer's client key, so a retry returns the same order.
 */
export interface ShopVariant { id: string; label: string; stock: number }
export interface ShopProduct {
  id: string;
  name: string;
  /** Integer paise, set by the owner. Missing means not for sale. */
  pricePaise?: number;
  active: boolean;
  variants: ShopVariant[];
  /** True only for labelled test data. Never placeable in production. */
  fixture?: boolean;
}
export interface ShopCatalogue { products: ShopProduct[]; deliveryPaise?: number | undefined; productionLive: boolean }
export interface OrderLineInput { productId: string; variantId: string; quantity: number }
export interface GuestInput {
  name: string; mobile: string; email?: string;
  address: string; city: string; state: string; pincode: string;
  clientKey: string;
}
export interface PricedLine { productId: string; variantId: string; quantity: number; unitPaise: number; linePaise: number; name?: string; variantLabel?: string }
export type OrderResult =
  | { ok: true; lines: PricedLine[]; subtotalPaise: number; deliveryPaise: number; totalPaise: number; idempotencyKey: string }
  | { ok: false; code: OrderError; detail?: string };
export type OrderError =
  | 'empty' | 'too_many_lines' | 'bad_quantity' | 'unknown_product' | 'not_for_sale' | 'unknown_variant'
  | 'out_of_stock' | 'no_delivery_rule' | 'fixture_in_production' | 'bad_guest' | 'duplicate_line';

export const MAX_LINES = 10;
export const MAX_QTY = 10;

export function validateGuest(g: GuestInput): string | null {
  if (!g.name || g.name.trim().length < 2 || g.name.length > 80) return 'name';
  if (!/^[6-9]\d{9}$/.test(g.mobile.replace(/[\s+-]/g, '').replace(/^91/, ''))) return 'mobile';
  if (g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email)) return 'email';
  if (!g.address || g.address.trim().length < 6 || g.address.length > 300) return 'address';
  if (!g.city.trim() || !g.state.trim()) return 'city_state';
  if (!/^[1-9]\d{5}$/.test(g.pincode)) return 'pincode';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(g.clientKey)) return 'clientKey';
  return null;
}

/** Price a cart for display. No guest details needed, no idempotency key. Same rules as an order. */
export function quoteCart(cat: ShopCatalogue, input: OrderLineInput[]): OrderResult {
  return priceLines(cat, input, null);
}

export function priceGuestOrder(cat: ShopCatalogue, input: OrderLineInput[], guest: GuestInput): OrderResult {
  if (input.length) { const bad = validateGuest(guest); if (bad) return { ok: false, code: 'bad_guest', detail: bad }; }
  return priceLines(cat, input, guest);
}

function priceLines(cat: ShopCatalogue, input: OrderLineInput[], guest: GuestInput | null): OrderResult {
  if (!input.length) return { ok: false, code: 'empty' };
  if (input.length > MAX_LINES) return { ok: false, code: 'too_many_lines' };
  const seen = new Set<string>();
  const lines: PricedLine[] = [];
  for (const l of input) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QTY) return { ok: false, code: 'bad_quantity' };
    const k = `${l.productId}:${l.variantId}`;
    if (seen.has(k)) return { ok: false, code: 'duplicate_line' };
    seen.add(k);
    const p = cat.products.find(x => x.id === l.productId);
    if (!p) return { ok: false, code: 'unknown_product' };
    if (p.fixture && cat.productionLive) return { ok: false, code: 'fixture_in_production' };
    if (!p.active || p.pricePaise === undefined || !Number.isInteger(p.pricePaise) || p.pricePaise <= 0) return { ok: false, code: 'not_for_sale', detail: p.id };
    const v = p.variants.find(x => x.id === l.variantId);
    if (!v) return { ok: false, code: 'unknown_variant' };
    if (v.stock < l.quantity) return { ok: false, code: 'out_of_stock', detail: `${p.id}:${v.id}` };
    lines.push({ productId: p.id, variantId: v.id, quantity: l.quantity, unitPaise: p.pricePaise, linePaise: p.pricePaise * l.quantity, name: p.name, variantLabel: v.label });
  }
  if (cat.deliveryPaise === undefined || !Number.isInteger(cat.deliveryPaise) || cat.deliveryPaise < 0) return { ok: false, code: 'no_delivery_rule' };
  const subtotalPaise = lines.reduce((s, l) => s + l.linePaise, 0);
  return { ok: true, lines, subtotalPaise, deliveryPaise: cat.deliveryPaise, totalPaise: subtotalPaise + cat.deliveryPaise, idempotencyKey: guest ? `shop-${guest.clientKey}` : '' };
}
