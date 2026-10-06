# Imagery register (customer app)

Status key: TEST = placeholder for testing only (Meet, 2 Oct: brand permission is held for all brands, studio images will replace these once the app is complete end to end). STOCK-OK = Pexels licence (free for commercial use, no attribution).
BRAND-ASK rows below are TEST placeholders from the brand own sites; replace with studio photography before launch.
Replace any row with studio photography via src/lib/imagery.ts (serviceVisual).

## Brand product shots and brand photos (TEST placeholders, replace with studio images before launch)
| File | Used for | Source page / URL | Status |
| --- | --- | --- | --- |
| brands/kovalent-borophene.png | Kovalent Borophene | https://kovalentcoatings.com/wp-content/uploads/2026/02/borophene-coating-kovalent.jpg (from https://kovalentcoatings.com/products/borophene-coating/) | TEST (brand site) |
| brands/kovalent-graphene.png | Kovalent Graphene | https://kovalentcoatings.com/wp-content/uploads/2026/02/graphene-coating-kovalent.webp | TEST (brand site) |
| brands/kovalent-graphene-matrix.png | Graphene Matrix | https://kovalentcoatings.com/wp-content/uploads/2026/02/graphene-matrix-coating-kovalent.webp | TEST (brand site) |
| brands/kovalent-prolong.png | Prolong | https://kovalentcoatings.com/wp-content/uploads/2026/02/prolong-9h-ceramic-coating-kovalent.webp | TEST (brand site) |
| brands/kovalent-prolong-light.png | Prolong Light | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-prolong-light-ceramic-coating.webp | TEST (brand site) |
| brands/kovalent-powershield.png | PowerShield | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-powershield-ceramic-coating.webp | TEST (brand site) |
| brands/kovalent-restore.png | Restore | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-restore-ceramic-coating-prep.webp | TEST (brand site) |
| brands/kovalent-matte.png | Matte | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-matte-ceramic-coating.jpg | TEST (brand site) |
| brands/kovalent-fabric.png | Fabric | https://kovalentcoatings.com/wp-content/uploads/2026/02/automotive-fabric-ceramic-coating-kovalent.webp | TEST (brand site) |
| brands/kovalent-glass.png | Glass | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-glass-ceramic-coating.webp | TEST (brand site) |
| brands/kovalent-revive.png | Revive | https://kovalentcoatings.com/wp-content/uploads/2026/06/revive-ceramic-coating-kovalent.jpg | TEST (brand site) |
| brands/xpel-hero.jpg | XPEL products | https://www.xpel.com (og:image, brand.xpel.com transform URL) | TEST (brand site) |
| brands/garware-ppf.jpg | Garware PPF | https://www.garwarehitechfilms.com/front_assets/home/image/ppfnew2.webp (cropped to remove caption) | TEST (brand site) |
| brands/garware-suncontrol.jpg | Garware sun control / tint | https://www.garwarehitechfilms.com/front_assets/home/image/suncontrolnew31.webp (cropped) | TEST (brand site) |

Kovalent bottle images were cut out of the brand's product tiles (icon boxes removed, background made transparent). No LLumar, 3M or Fireball product shots yet: their sites blocked fetches or had no usable product imagery, so those services use topic photos below.

## Stock photos (Pexels)
| File | Used for | Pexels page | Status |
| --- | --- | --- | --- |
| stock/wash-suds.jpg | Washes | https://www.pexels.com/photo/modern-suv-in-car-wash-with-soap-suds-29504457/ | STOCK-OK |
| stock/wash-foam.jpg | Premium wash, roof | https://www.pexels.com/photo/luxury-car-being-washed-in-garage-28995187/ | STOCK-OK |
| stock/interior-detail.jpg | Dry clean, SPA, interior | https://www.pexels.com/photo/a-man-in-black-jacket-cleaning-the-seat-of-a-car-6873185/ | STOCK-OK |
| stock/headlight-polish.jpg | Headlight buffing | https://www.pexels.com/photo/photo-of-a-woman-with-pink-hair-brushing-the-headlight-of-a-black-car-6873080/ | STOCK-OK |
| stock/paint-polish.jpg | Polish, correction | https://www.pexels.com/photo/man-polishing-car-in-garage-with-buffer-37809559/ | STOCK-OK |
| stock/coating-water-beading.jpg | Coatings, teflon, ceramic | https://www.pexels.com/photo/water-droplets-on-gray-ferrari-car-hood-9784178/ (shows a Ferrari badge; swap if that is a concern) | STOCK-OK |
| stock/tint-install.jpg | Tinting | https://www.pexels.com/photo/man-with-dreadlocks-working-by-car-window-20522462/ | STOCK-OK |
| stock/ppf-install.jpg | PPF (other brands) | https://www.pexels.com/photo/men-holding-foil-in-garage-20051464/ | STOCK-OK |
| stock/ppf-hood-wrap.jpg | Stealth/matte PPF | https://www.pexels.com/photo/person-wrapping-car-hood-with-paper-10126661/ | STOCK-OK |
| stock/inspection.jpg | Inspection | https://www.pexels.com/photo/a-mechanic-checking-the-engine-of-the-car-9626877/ | STOCK-OK |

Older CC-BY placeholders (Flickr) are listed in ATTRIBUTION.md and still used for hero/membership/vehicle fallbacks and the category fallback.

## Distinct service photos (pool, TEST placeholders)
Files stock/x-*.jpg are Pexels photos (free licence), each taken from pexels.com/photo/<slug>-<id>/ where the id is in the pool list in src/lib/imagery.ts. Assigned one per service by primeVisuals(); replace with studio photos before launch.

## Curated white/orange visual system (Oct 7)
`curated/*.jpg` are edited derivatives of the reviewed, already licensed source files in this register. Warm-neutral grading, lower saturation and consistent 3:2 framing. Topic identity takes priority over uniqueness. Car/hero is a side profile without a visible plate; category images show service subjects rather than generic car ads. Brand packshots keep their original colors and labels on a uniform warm-white panel. Customer uploads, seller photos, Stories and document/evidence originals are not edited.
