# AutoDeck local preview

The current layout and verification record is in ONE-HOMEPAGE.md (18 October 2026). Header is Cars and Store only. Home includes services, app showcase, studio concepts and Visit. The old Services + app page now redirects to Home. Store remains at /shop. This supersedes the older page-map notes below.

# Previous redesign record

Local review only. Do not publish this design before Meet's visual approval and the preview image/product checks below.

## Run

From the repository root:

```sh
corepack enable
pnpm install
pnpm --filter @autodeck/site dev --host 0.0.0.0
```

Open the address printed by Astro, normally http://localhost:4321.

Production build preview:

```sh
pnpm --filter @autodeck/site build
pnpm --filter @autodeck/site preview --host 0.0.0.0
```

The new Home headline is "Good cars. Better care." Navigation reads Services + app, Cars, Shop, Visit. If those are absent, the old build is running.

## Page map

| Before | After |
| --- | --- |
| Home | Home: compact introduction, service index, studio concept strip, Shop link, Visit section |
| Services | Services + App, at /services |
| The App | Merged into /services#app; /app redirects |
| Cars | Cars: separate app doorway, no duplicate public listing feed |
| Gallery | Merged into Home #studio; /gallery redirects |
| Lounge | Replaced by /shop; /lounge redirects |
| Visit | Home #visit; /visit redirects |
| Privacy | Same text, new shared layout |
| Terms | Same text, new shared layout |

Six content pages, including two legal pages. Four legacy redirect fallback pages make Astro's build report ten routes. Vercel configuration specifies 301 for the removed landing pages. Astro's static fallback uses meta refresh plus destination canonical and noindex. HTTP status behavior must be checked after an approved deployment; nothing has been deployed by this task. /services is retained as the unified canonical, so it must not redirect to itself. The old /cars/:path* rule also matched the base website page: it is narrowed to /cars/:path+ so deeper app links still work and the Cars landing page can render.

## Design changes

New independent stylesheet and motion entry point. No inherited scroll-jacking scenes or full-screen background layer stack.

- Home display headline max 150px to 78px: 48% smaller.
- Inner page headlines max 72px to 64px: 11% smaller. Sections max 110px to 34px, 69% smaller.
- Regular section padding 104px to 48px per side: 54% tighter. Mobile 72px to 30px: 58% tighter.
- Hero is content-height instead of a forced full viewport.
- Removed the 420vh chapter scene and horizontal pinned gallery entirely. GSAP handles short reveals; no artificial scroll distance.
- Removed giant statistics, brand marquee, separate proof timeline, duplicate room promos and closing CTA block. App remains the primary action.
- Glass is reserved for the header, image captions and one app summary. Orange stays small.
- Covered-car WebGL is lazy-loaded by a separate module. The photograph remains visible until the model succeeds. Reduced-motion users get the photograph and visible text, not a blank hero.

## Shop

12 cards in Wear, Care, Drive and Everyday. Filter buttons operate locally. Three existing merch names are preserved: Studio Tee, Shield Cap and Care Kit. Other nine products are proposals. All card art is an original placeholder illustration. There are no amounts, checkout, cart, stock promises or purchase buttons. Product photos, specifications, range and pricing need Meet's confirmation. The T-shirt source image is a design concept, not a product photograph.

## Image checks before launch

Read STOCK-MANIFEST.md. Four Unsplash photographs are preview-only, visibly illustrative. Four Drive concept images are identified as design concepts. No renovation photo or stock image is described as completed AutoDeck work. Replace or approve all imagery and final product photography before going live. Source media was downloaded locally, not hotlinked.

## Verification

Build tested. All six content routes were checked at 1280, 390 and 320 pixels for horizontal overflow and image loading. Actual page screenshots were inspected. Home 3D readiness confirmed in Chrome; Shop Care filter returned exactly three cards. The portable old-URL redirects were checked locally; production HTTP redirects still require deployment verification. Existing legal text was preserved, not legally reviewed or recertified.
