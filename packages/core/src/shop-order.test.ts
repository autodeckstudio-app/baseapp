import { describe, it, expect } from 'vitest';
import { priceGuestOrder, quoteCart, type ShopCatalogue, type GuestInput } from './shop-order';

// FIXTURE data only: labelled test values, not offers.
const cat = (over: Partial<ShopCatalogue> = {}): ShopCatalogue => ({
  productionLive: false, deliveryPaise: 0,
  products: [{ id: 'fixture-a', name: 'FIXTURE item', pricePaise: 1000, active: true, fixture: true, variants: [{ id: 'm', label: 'M', stock: 2 }] },
    { id: 'fixture-noprice', name: 'FIXTURE no price', active: true, fixture: true, variants: [{ id: 'm', label: 'M', stock: 5 }] }],
  ...over,
});
const guest: GuestInput = { name: 'Test Buyer', mobile: '9876543210', address: '12 Test Street', city: 'Pune', state: 'MH', pincode: '411001', clientKey: 'abcdefghijklmnop1234' };

describe('guest order pricing', () => {
  it('prices from the catalogue and ignores any client amount', () => {
    const r = priceGuestOrder(cat(), [{ productId: 'fixture-a', variantId: 'm', quantity: 2, unitPaise: 1 } as never], guest);
    expect(r.ok && r.totalPaise).toBe(2000);
  });
  it('is not placeable without an owner price', () => {
    const r = priceGuestOrder(cat(), [{ productId: 'fixture-noprice', variantId: 'm', quantity: 1 }], guest);
    expect(r).toMatchObject({ ok: false, code: 'not_for_sale' });
  });
  it('is not placeable without a delivery rule', () => {
    const r = priceGuestOrder(cat({ deliveryPaise: undefined }), [{ productId: 'fixture-a', variantId: 'm', quantity: 1 }], guest);
    expect(r).toMatchObject({ ok: false, code: 'no_delivery_rule' });
  });
  it('refuses fixtures in production', () => {
    const r = priceGuestOrder(cat({ productionLive: true }), [{ productId: 'fixture-a', variantId: 'm', quantity: 1 }], guest);
    expect(r).toMatchObject({ ok: false, code: 'fixture_in_production' });
  });
  it('rejects stock overrun, bad quantity, duplicates and bad guest data', () => {
    const l = { productId: 'fixture-a', variantId: 'm', quantity: 3 };
    expect(priceGuestOrder(cat(), [l], guest)).toMatchObject({ code: 'out_of_stock' });
    expect(priceGuestOrder(cat(), [{ ...l, quantity: 0 }], guest)).toMatchObject({ code: 'bad_quantity' });
    expect(priceGuestOrder(cat(), [{ ...l, quantity: 1 }, { ...l, quantity: 1 }], guest)).toMatchObject({ code: 'duplicate_line' });
    expect(priceGuestOrder(cat(), [{ ...l, quantity: 1 }], { ...guest, pincode: '12' })).toMatchObject({ code: 'bad_guest' });
  });
  it('retry with the same client key gives the same idempotency key', () => {
    const a = priceGuestOrder(cat(), [{ productId: 'fixture-a', variantId: 'm', quantity: 1 }], guest);
    const b = priceGuestOrder(cat(), [{ productId: 'fixture-a', variantId: 'm', quantity: 1 }], guest);
    expect(a.ok && b.ok && a.idempotencyKey === b.idempotencyKey).toBe(true);
  });
  it('quotes a cart with names and totals and no guest needed', () => {
    const r = quoteCart(cat(), [{ productId: 'fixture-a', variantId: 'm', quantity: 2 }]);
    expect(r.ok && r.lines[0]?.name).toBe('FIXTURE item');
    expect(r.ok && r.totalPaise).toBe(2000);
    expect(quoteCart(cat(), [{ productId: 'fixture-noprice', variantId: 'm', quantity: 1 }])).toMatchObject({ code: 'not_for_sale' });
  });
});
