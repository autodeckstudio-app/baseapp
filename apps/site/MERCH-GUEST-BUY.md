# Merch product pages and guest buy: preparation record (22 Oct 2026)

Status: design only. No code path can take an order or a payment. Nothing here is approved for sale. Local, not pushed.

## Request (Meet, 22 Oct 3:19 PM)
Each merchandise item is a product with a shop page on web and app. A customer can buy without onboarding as an app customer.

## What exists (checked)
- `src/data/shop.json`: `edition` null, `products` empty. `src/data/merch.json`: empty.
- The homepage merch wall shows owner-supplied concept reference images (4:16 AM, 22 Oct). They are not products: no name, price, size, stock or supplier is approved.
- 18 Oct candidate menu (8 items, public retail reference prices, not AutoDeck prices). Owner ruled out logo merchandise on 18 Oct. Range: perfumes, clothing, car accessories or mods. Owner said he will share the product list later.
- No order, cart or shop function exists in `functions/src/functions/*`. The Razorpay key is LIVE. Function changes are out of bounds for this batch.

## Guest buy meaning
No app-customer onboarding (no account, no profile setup, no tenant claim). The buyer is not anonymous: delivery needs contact details.

## Fields derived from the job (nothing else collected)
- Per line: product id, variant (size or format), quantity.
- Buyer: full name, mobile number (delivery and payment provider contact), email (optional, receipt), delivery address with 6-digit pincode, city, state.
- Order notes: none.
No account password, no marketing opt-in, no ID documents.

## Owner inputs the page cannot be built without (not found in any source)
Each product: name, department, description, photos, price (in rupees, tax-inclusive or not), variants, stock, made-or-selected provenance. Shop-wide: delivery area and charge, dispatch time, returns and exchange rules, who issues invoices, whether cash on delivery exists, who fulfils.
Do not copy the 18 Oct retail reference prices.

## Build plan once inputs exist
1. Schema: extend the `shop.json` validation with price (integer paise), variants, stock, and a hard rule that a product with no owner-supplied price cannot render a Buy action. Guard test, verified failing without the rule.
2. Product page `/shop/<slug>`, static from `shop.json`; the homepage wall tiles link to it only for real products.
3. Cart in the browser only (localStorage), no account.
4. Order creation and payment: a new backend function (server-priced from the product record, never from client amounts, as for bookings) creates the provider order; Razorpay Checkout collects payment. Needs a separate go-ahead for the function and for any payment testing. A test must not use the LIVE key for a real charge.
5. App: the same product records in a Shop screen, with buy and no sign-in.
6. Policy page (delivery, returns, privacy of buyer details) shown before payment, for owner review. Not written yet, to avoid inventing terms.

## Open decision for the owner (minimum)
Product list with price, sizes and stock, plus delivery and returns rules. Until then the wall stays a concept preview.

## Local skeleton added (22 Oct, evening). Not deployed, no payment, no function.
- `packages/core/src/shop-order.ts` + test: server-side pricing of a guest order (id, variant, quantity only; client amounts ignored). Not placeable without owner price, delivery rule, or stock; fixtures refused in production; idempotency key from the buyer's client key. Guard verified failing when the price rule is removed. No Firebase function wraps it yet.
- `apps/site/src/pages/shop/[slug].astro`: product page generated from `shop.json` (empty today, so no real pages). A labelled FIXTURE product renders in the dev server only; `scripts/shop-fixture-guard.mjs` (in `npm test`) fails the build if a fixture reaches dist (verified failing).
- No cart, no Buy button, no checkout yet. Still waiting on owner: product list, price, sizes, stock, delivery and returns.

## Fixture flow (local only, added 22 Oct 6:14 PM)
Run: `node --experimental-strip-types scripts/shop-dev-order-server.mjs` then `npx astro dev`. Product `/shop/fixture-tee` (dev only) adds to a localStorage cart; `/shop/cart` takes guest details and the local server prices the order with core `priceGuestOrder`. The total shown is the server's, a retry returns the same order, a bad pincode is refused. Nothing is stored, no payment. In a production build the cart page says "Ordering is not open yet", with no form, and the fixture guard fails the build if any fixture text ships. Production gates still needed before this can sell: owner catalogue, delivery and returns rules, a deployed order function with a durable idempotency store, payment (separate go-ahead, never the live key for tests).
