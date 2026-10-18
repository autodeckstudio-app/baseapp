# Public Cars showcase

18 October 2026. Request: explain AutoDeck buys and sells cars; show held cars without plates, owner info or public prices. Previous page had no actual inventory: only an illustrative stock-water.jpg and app link. Removed the stock photo, added buy/sell paths and a safe inventory shell. No invented cars, buying guarantees, inspection certification, financing or sales terms. Current cars.json is empty and the page says no cars are listed here yet, not that AutoDeck holds zero cars.

## Public data contract
`src/data/cars.json` accepts only id (non-registration slug), make, model, optional variant, year, kilometres, fuel, transmission, bodyStyle, photo, photoAlt and publicPhotoApproved. Build-time validation rejects every other key, including price, askingPrice, plate, registrationNumber, owner(s), seller/contact information, descriptions, notes and raw photo URLs. Text values are short strings and obvious plate/contact identifiers fail. All imagery must be local under /assets/inventory/, already plate-redacted (including reflections and documents), metadata stripped and visually checked. publicPhotoApproved must be true. This flag is a human-review gate, not automatic image redaction or a privacy guarantee. Do not place original photos in the public directory. Do not use private names, phone numbers, plates or prices in filenames, alt text or public slugs.

No raw app/backend listings are fetched. No public price data or CSS-hidden sensitive content. The static website does not check app sessions. App links use the existing verified app root. Intended path is sign in and enquire there, not automatic price unlock on the website. No fabricated deep link or session token exchange.

## Required before real inventory can go public
Approved held-car list and ongoing stock/removal owner; safe photos with proof of publication permission; verified make/model/variant/year/odometer/fuel/transmission; per-car app mapping and confirmed price/detail sign-in path. Confirm whether owner count should be shown at all; this site excludes it under the user's owner-info restriction. Confirm how reserved/sold/withdrawn cars are removed before adding a status feed.

Earlier app code returned original photo URLs, owner count and description to anonymous visitors. Builder commit 2d86b7e, fetched before this site commit, replaces that anonymous projection with an explicit allowlist and photoUrls empty. Source correction verified; deployment/live response is outside this site's verification. Signed-in customer prices still use an interest-request gate, rather than sign-in alone. This site does not consume the app endpoint and neither fixes nor certifies its separate live flow.

## Verification
Site production build and nine site tests passed. Actual pixels inspected at 320, 390, 820 and 1280 plus reduced motion mobile; no overflow, no inventory cards, no main-content images, all app actions point to app.autodeck.in. Public data tests reject private keys, external/unapproved photos and plate-like identifiers. Real populated inventory cards, photos and app price access cannot be verified until actual inventory is supplied. No deploy.
