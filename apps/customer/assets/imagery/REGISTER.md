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

## Garage, mods, pickup and membership placeholders (Pexels licence, free for commercial use)
All rows are PLACEHOLDER: replace with studio shoot photos.
| File | Used for | Source page | Status |
| --- | --- | --- | --- |
| stock/g-inspection.jpg | Multi-point inspection, Book an inspection | https://www.pexels.com/photo/a-man-inspecting-the-car-s-under-chassis-8986036/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-alignment.jpg | Wheel alignment and balancing | https://www.pexels.com/photo/3806280/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-ac.jpg | AC check | https://www.pexels.com/photo/air-conditioning-vent-on-a-car-10508830/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-battery.jpg | Battery check | https://www.pexels.com/photo/close-up-photo-of-car-s-battery-4374843/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-repairs.jpg | Repairs | https://www.pexels.com/photo/mechanic-working-on-car-engine-in-garage-3441895/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-wrap.jpg | Vinyl wraps and colour change | https://www.pexels.com/photo/a-man-wrapping-a-car-hood-10126665/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-styling.jpg | Accessories and styling, membership scene | https://www.pexels.com/photo/steering-wheel-in-car-interior-8723324/ | STOCK-OK, placeholder, replace with shoot |
| stock/g-pickup.jpg | Pickup and drop | https://www.pexels.com/photo/person-in-grey-shirt-handing-keys-97079/ | STOCK-OK, placeholder, replace with shoot |

## Replace with shoot photos
Every file under stock/ and curated/ is a placeholder until the studio shoot. Priority: the g-* files above, then every STOCK-OK and TEST row.

## Earlier stock files (Pexels licence, page URLs not recorded)
| File | Source | Status |
| --- | --- | --- |
| stock/x-bentley-hose.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-black-reflect.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-black-sunlight.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-buff-rear.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-buff-roof.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-car-window.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-cleaner-sponge.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-damage-check.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-detail-workshop.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-engine-bay.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-engine-filter.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-engine-red.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-engine-turbo.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-film-window.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-foam-street.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-foil-garage.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-glossy-black.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-headlight-black.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-headlight-grille.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-polish-door.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-polish-garage.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-polish-red.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-rim-clean.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-seat-clean.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-showroom.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-spray-bonnet.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-spray-booth.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-suv-rinse.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-suv-suds.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-tan-leather.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-tyre-clean.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-underbody-a.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-underbody-b.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-vacuum-white.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-vintage-interior.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-vintage-soap.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-wet-black.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-wheel-spray.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-white-garage.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-white-seats.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-window-clean.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |
| stock/x-wipe-gloss.jpg | Pexels, page URL not recorded | STOCK-OK, placeholder, replace with shoot |

## Category photographs (approved by the owner, 19 Oct)
Six studio-style category images in category/ (also copied to the site as service-*.jpg): paint-protection, ceramic-coating, detailing, wash-and-care, garage, modifications. Used for the matching service categories. Tinting and inspection keep their earlier photos until the owner says otherwise.

## Generated studio-style images (approved by Meet, 20 Oct 2026)
Made with a free image generator using Meet's six category photos as style references. Not stock, not brand art. Replace with real studio photos when available.
| File | Used for |
| --- | --- |
| generated/pickup.jpg | Pickup and drop (key handover) |
| generated/coating.jpg | Coating category |
| generated/garage-ac.jpg, garage-battery.jpg, garage-inspection.jpg, garage-alignment.jpg, garage-repairs.jpg | Garage services |
| generated/mods-tint.jpg, mods-wrap.jpg, mods-accessories.jpg | Modification services |

## AI service images, 22 Oct 2026 (LOCAL, not pushed, not yet reviewed by the owner)
Same AI theme as the site: black car, dark studio, vertical strip lights, one technician in black. Illustrative AI imagery, not an AutoDeck car or work. Some cars resemble real models by shape or grille, they are not identified. Mapped in src/lib/imagery.ts to the services that need them.
| File | Used for |
| --- | --- |
| generated/ai-wash-foam.jpg, ai-wash-hand.jpg, ai-wash-rinse.jpg | Wash services |
| generated/ai-polish.jpg, ai-polish-wing.jpg | Polish and paint correction |
| generated/ai-coat-apply.jpg | Coating application |
| generated/ai-ppf-film.jpg | Paint protection film |
| generated/ai-headlight.jpg, ai-roof.jpg, ai-wheel.jpg, ai-engine.jpg, ai-underbody.jpg | Headlight, roof, wheel, engine and underbody services |
| generated/ai-interior.jpg, ai-interior-wheel.jpg, ai-interior-rear.jpg | Interior services |
| generated/ai-tint-apply.jpg, ai-tint-done.jpg | Tint |
