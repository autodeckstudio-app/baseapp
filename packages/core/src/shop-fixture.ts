import type { ShopCatalogue } from "./shop-order";
/** FIXTURE catalogue for layout and flow tests. Not an offer. Same product id and values as apps/site/src/data/shop-fixture.json (guarded by test). */
export const SHOP_FIXTURE: ShopCatalogue = {
  productionLive: false,
  deliveryPaise: 0,
  products: [{ id: "fixture-tee", name: "FIXTURE product (not for sale)", pricePaise: 1000, active: true, fixture: true, variants: [{ id: "m", label: "M", stock: 5 }, { id: "l", label: "L", stock: 0 }] }],
};
