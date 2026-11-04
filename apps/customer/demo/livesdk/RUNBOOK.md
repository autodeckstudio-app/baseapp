# Live-SDK identity journey (emulator suite, demo-autodeck only)

Proves the staff-first identity flow with the app's REAL code and REAL
Firebase JS SDK clients: sign-in, unclaimed resolver surface, the real claim
screen, token claims, canonical doc-id resolution, useAuth ready, the real
Bookings list keyed by the canonical id, and the real Track handler routing.
Device seams only: expo-router (captured), imagery assets, native kit shells,
push, Razorpay checkout, catalogue callable. No real project, no provider
calls; the fixture and firebase.ts both fail closed off the demo project.

## Preconditions (writer-owned emulator lifecycle)

- Suite running, project `demo-autodeck`, region `asia-south1`:
  Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8099`,
  Functions `127.0.0.1:5001`, Storage `127.0.0.1:9199`.
- Firestore rules: the merged repo `firestore.rules` (claimed-identity
  ownership delta included; fingerprint coordinated through Main). Do NOT run
  this against the pre-merge rules: the claimed customer is denied its own
  reads there by design and the journey must fail.
- Functions emulator serving the current compiled build (entrypoints
  `asia-south1`), incl. `claimCustomerRecord`, `setupCustomerProfile`,
  `getServiceCatalogue`.
- App Check stays OFF in the emulator suite (`shouldEnforceAppCheck` false);
  attestation is NOT proven here and stays on the release-gate list.

## Seed (from repo root)

    FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 \
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
    GCLOUD_PROJECT=demo-autodeck \
    node apps/customer/demo/livesdk/seed.mjs

Creates two verified users (livesdk.walkin@example.com /
livesdk.fresh@example.com, demo passwords livesdk-demo-pass-1/-2), the staged
unclaimed record `staged-livesdk-1` with active claim code `4820-1937`,
vehicle/service/booking `b-livesdk-1`/live job `j-livesdk-1`. Re-running
wipes and re-seeds the demo data.

## Run

    cd apps/customer && npx vitest run --config vitest.livesdk.config.ts

Expected: 1 file, 1 test, PASS. Debug tree dump: /tmp/livesdk-bookings-tree.json.

## Connection proof

The fixture asserts actual app `emulatorBackend === true`, including Storage.
Auth root URL accepts exactly the expected local URL with or without one trailing slash.
The claim resolver relies on merged rules permitting only an absent self-slot GET;
existing profiles still require stored ownership. No permission/network failure is
converted into a missing record. Self-serve setup refreshes the token before resolution.

## What this does NOT prove

Real Auth provider (Google), AsyncStorage on device, App Check attestation,
Storage, native/router engine, deployed rules, live backend. Those remain on
the final sweep list.
