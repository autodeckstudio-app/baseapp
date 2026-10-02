# Imagery register (customer app)

Status key: STOCK-OK = Pexels licence (free for commercial use, no attribution required, no resale of the photo alone).
BRAND-ASK = taken from the brand's own website for PREVIEW; ask the brand for written permission (or swap) before public launch.
Replace any row with studio photography via src/lib/imagery.ts (serviceVisual).

## Brand product shots and brand photos
| File | Used for | Source page / URL | Status |
| --- | --- | --- | --- |
| brands/kovalent-borophene.png | Kovalent Borophene | https://kovalentcoatings.com/wp-content/uploads/2026/02/borophene-coating-kovalent.jpg (from https://kovalentcoatings.com/products/borophene-coating/) | BRAND-ASK |
| brands/kovalent-graphene.png | Kovalent Graphene | https://kovalentcoatings.com/wp-content/uploads/2026/02/graphene-coating-kovalent.webp | BRAND-ASK |
| brands/kovalent-graphene-matrix.png | Graphene Matrix | https://kovalentcoatings.com/wp-content/uploads/2026/02/graphene-matrix-coating-kovalent.webp | BRAND-ASK |
| brands/kovalent-prolong.png | Prolong | https://kovalentcoatings.com/wp-content/uploads/2026/02/prolong-9h-ceramic-coating-kovalent.webp | BRAND-ASK |
| brands/kovalent-prolong-light.png | Prolong Light | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-prolong-light-ceramic-coating.webp | BRAND-ASK |
| brands/kovalent-powershield.png | PowerShield | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-powershield-ceramic-coating.webp | BRAND-ASK |
| brands/kovalent-restore.png | Restore | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-restore-ceramic-coating-prep.webp | BRAND-ASK |
| brands/kovalent-matte.png | Matte | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-matte-ceramic-coating.jpg | BRAND-ASK |
| brands/kovalent-fabric.png | Fabric | https://kovalentcoatings.com/wp-content/uploads/2026/02/automotive-fabric-ceramic-coating-kovalent.webp | BRAND-ASK |
| brands/kovalent-glass.png | Glass | https://kovalentcoatings.com/wp-content/uploads/2026/02/kovalent-glass-ceramic-coating.webp | BRAND-ASK |
| brands/kovalent-revive.png | Revive | https://kovalentcoatings.com/wp-content/uploads/2026/06/revive-ceramic-coating-kovalent.jpg | BRAND-ASK |
| brands/xpel-hero.jpg | XPEL products | https://www.xpel.com (og:image, brand.xpel.com transform URL) | BRAND-ASK |
| brands/garware-ppf.jpg | Garware PPF | https://www.garwarehitechfilms.com/front_assets/home/image/ppfnew2.webp (cropped to remove caption) | BRAND-ASK |
| brands/garware-suncontrol.jpg | Garware sun control / tint | https://www.garwarehitechfilms.com/front_assets/home/image/suncontrolnew31.webp (cropped) | BRAND-ASK |

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
