# AutoDeck customer Glacier implementation qualification

19 November 2026, Asia/Kolkata. Local source candidate, not deployed.

## Implemented

- Customer-only day and night material across shared panes, controls and screens.
- Home retains the official identity, Stories immediately below Welcome, photographic services hero, canonical persisted car selection, one prioritized live action, existing membership, listing and contact callbacks, and whole-frontage studio promotional image.
- Five category shortcuts open existing catalogue areas. Existing Home-return behavior is retained.
- Services root adopts pale image-right cards. Narrow cards reserve space for headings rather than letting headings run into images.
- Garage retains its existing car list, archive, history and detail flows. Empty-photo cards now follow day/night material instead of staying dark in day mode.
- Account material follows the same theme; narrow identity stacks so an email is not split mid-address.
- Official AD bottom navigation remains, with short labels and distinct service-area icons.
- Shared primary buttons use dark day and pale night fills. Existing selection, payment, confirmation and safety callbacks remain.
- Auth setup, claim and staff explanation screens use the same local ground.

## Passed

- Customer: 210 unit files, 1,236 tests.
- Customer render: 136 files, 662 tests.
- Customer TypeScript: no errors.
- Core: 62 files, 595 tests.
- Functions unit: 168 files, 2,106 tests passed, one skipped.
- 32 added AA contrast checks cover primary, secondary, tertiary and accent text on actual day/night canvas and card surfaces.
- Compile-only iOS and Android Hermes exports pass, with inert demo config. These are not installed-app acceptance.
- Compile-only production-mode web export and preview/fixture/hashed-asset guard pass, with inert demo config.
- Catalogue source guard passes. It checks local source, not live publication.
- Actual-component captures cover Home at 320/390/430 day/night; Garage, account and empty bookings at 320/390/430 day/night; service roots and Ceramic/brand/PPF/PPS/wash states at 320/390; payment review at 320/390 day/night. No horizontal overflow or missing images in these captures. Decisive pixels were inspected, not only layout metadata.

## Backend coverage follow-through

A separate source audit reported 86 customer callable references resolving among 242 backend exports. Remaining exports were staff/admin-only, redundant or intentionally gated. Referral redemption and shop ordering remain gated. This is source coverage, not proof that every endpoint is deployed or every live workflow accepted.

Web sign-in source routes profile setup through setupCustomerProfile, retains its returned customer document ID and refreshes claims. No extra resolveClaims call was introduced.

Read-only live studio config checked at 04:04 IST: studio-ahmedabad, Asia/Kolkata, Mon-Sat 10:00-21:00, Sunday 10:00-19:00, no configured holidays. Phone/address constants match the current public https://www.autodeck.in page. getStudioInfo intentionally returns hours/timezone, not phone/address; no change was made to contact facts.

## Not qualified by this work

- Nothing deployed or pushed. The compile artifact is deliberately demo-configured, not suitable to publish.
- No real sign-in/profile mutation, booking, payment, refund, invoice, document upload/download or native installed-app acceptance performed.
- Not every populated detail route/state has been visually accepted. Existing render suites cover many functional states, but they are not live transaction evidence.
- Existing backend feature gates, pricing, payment/refund policies and release flags were not activated or changed.
- No paid resource, purchase or account change.
- Historical release records were used only to locate code and prior setup, never as authority for a new deployment.

## Release continuation

Use the connected source candidate, not the standalone preview. Reconcile the candidate against any newer owner work before assembling a production-configured artifact. Validate destination, active feature flags, public configuration and artifact hash, and obtain any still-needed authority before a deployment. Preserve the unresolved transaction/native acceptance gaps rather than reporting them as complete.
