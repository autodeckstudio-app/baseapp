# Website app mockups

Captures the current customer components with synthetic, read-only data. Does not
sign into Firebase or touch customer records. No app/runtime source is changed.

From repo root after installing dependencies:

```sh
node scripts/visual/site-mockups/build.mjs
node scripts/visual/site-mockups/capture.mjs
pnpm --filter @autodeck/site build
node scripts/visual/site-mockups/compose.mjs
```

Requires local headless Chrome. Captures land in `/tmp/site-mockups`. The generated
`preview.js` bundle is ignored. Day mode is pinned; the app canvas is 390x844,
including a 59px status strip and 34px home-indicator strip. Screens are captured
at 2x. The website overlays OS chrome without adding another safe-area inset.

To regenerate assets, convert the five PNGs to WebP at quality 86, preserving
780x1688 pixels. Map garage to garage-stories and cars to buysell. Update the
SHA-1 first 10 characters in home.html, app.html and redesign.ts. Run the site
test suite and visually inspect composed desktop/mobile pages. The compose
check also checks shell ratio, image alignment and horizontal overflow at
360, 390, 430 and 1440px widths on both pages.

All names, cars, bookings and listings are sample data. Existing app service
artwork is reused; the car-photo empty state is the real supported component,
not an invented owner photo. Writes are blocked or local no-ops.
