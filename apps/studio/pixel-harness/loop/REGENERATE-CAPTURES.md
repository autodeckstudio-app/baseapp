# Website mockup regeneration handoff (2026-10-31 13:30 IST)
Candidate worktree: /tmp/site-release (c685fa0b + 15 apps/site text files from master).
STATUS: typecheck PASS, astro build PASS (20 pages), guards 6/7 PASS, 28/28 tests PASS.
Only mockup-asset-version-guard blocked: 7 binaries lost (snapshot dropped binaries, all bundle/PNG bytes confirmed GONE by main 13:29).

## Needed binaries + pins (references already in candidate text)
- home.webp b28b4c180f, bookings.webp 3edbc6d836, garage-stories.webp 242fcb883f,
  buysell.webp 4473969c61, profile.webp 90ed4133d5  (all must be 390x933; guard enforces)
- hero-motion.webp a50c6d821f (animated, 247 ANMF, 1280x720, loop 0) - regenerate from upstream
  apps/site/public/assets/hero/hero-loop.mp4 via ffmpeg loop-wrap; then frame-verify.
- rover-poster.png 4ebce7b361 - else revert pins in home.html + services.json to live 5683da12fa.

## Capture route (accepted lineage: former writer agent-01M650B3MMKHNMWMFDRQ8F53SN, v10 captures 05:02)
- expo web dev server (apps/customer, port 8081) + firebase emulators (testPhoneNumbers
  +919876543210/123456 already in firebase.json); real phone-OTP UI sign-in.
- localStorage autodeck.theme = "light" (packages/ui/src/theme/autoMode.ts PREF_KEY) pins Day.
- Dismiss install sheet via real "Not now" (src/ui/InstallPrompt.tsx).
- CDP Emulation.setDeviceMetricsOverride 390x933; capture tabs: / (home), /bookings,
  /garage, /cars, /profile. Convert PNG->WEBP q92 (PIL 12.3.0 on box).
- Memory preflight: pkill functionsEmulatorRunti workers, JAVA_TOOL_OPTIONS -Xmx320m, require >=600MB.
## Seed data (v10-accepted content)
- Identity: Alex Morgan <alex@example.com>, phone +919876543210 (fictional, accepted).
- Vehicle "Sample car" (truthful NO PHOTO YET on garage card).
- Booking in studio: "Your car is in the studio", Active tab, IN THE STUDIO / Ready for pickup /
  "Come by any time before closing", progress bar, Track button.
- Cars: 3 sample listings - Sample SUV (2023 Diesel 24,000 km, Ask price), Sample hatchback,
  Sample crossover; disclaimer "AutoDeck lists cars to help buyers and sellers meet."
- Profile: Driving licence + Help rows static; APPEARANCE Day SELECTED visible.
- Schemas: packages/core/src/types/carsale.ts (CarListing), booking.ts, customer-home.ts
  (projectCustomerHome drives Home tab). seed3-loop.mjs pattern for auth/users/claims.

## 13:49 IST update - capture route state
- ALL 7 assets verified recoverable from upstream c685fa0b itself (hashes match live exactly).
  hero-motion + rover-poster: explicit REVERSION to live hashes (re-encode/poster-update dropped from release).
  5 mockups: regenerated fresh (390x933), re-pinned to new hashes.
- Capture stack persisted: seed-captures.mjs (seed: uid/tenant see below), capture-mockups.mjs (CDP driver).
- CORRECT seed identity: uid 4N6r9GE8AQ7w1sLW2N7nja55qHeO (emulator dev sign-in links by email),
  tenant "automodz" (FIRST_TENANT_ID), studio "studio-ahmedabad". Claims must be {role:customer,tenantId:automodz}
  (set via admin; fix script at /tmp/fix-claims.mjs - recreate if gone, steps in git status below).
- EXPO env: EXPO_PUBLIC_USE_FIREBASE_EMULATOR MUST be literal "true" (=1 silently uses LIVE backend!).
  Ports: firestore 8099, functions 5001, auth 9099. Start expo with --clear after restoring assets.
- shop-fixture.jpg restored from upstream (apps/customer/assets/dev/). Do not delete.
- NEXT: verify claims landed (admin listUsers), reseed, rerun capture-mockups.mjs, crop 500px->390px (x=0),
  PNG->WEBP q92, place in /tmp/site-release/apps/site/public/assets/redesign/, re-pin 5 hashes in
  home.html/app.html/redesign.ts, revert 2 pins (a50c6d821f->1d364ae76d, 4ebce7b361->5683da12fa),
  rerun FULL site suite + mockup guard, pixel-inspect every capture, send candidate to reviewer via main.
