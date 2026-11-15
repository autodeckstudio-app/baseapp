# Customer Home scene working review

Local implementation only. Not pushed or deployed. Based on main dffcb4797db612822b93805bbe67e2cc4cc2e7ca. Existing payment-choice release is not changed.

## Composition

One personal stage contains the canonical active vehicle and one state dock. Customer photo resolution/retry/privacy stays in CarThumb. A missing saved photo uses the existing visibly labelled category illustration, never the synthetic concept car as a customer's vehicle. Missing/unmapped categories keep the existing neutral fallback.

Stories retain the real viewer/groups in a smaller Home-only tray. Catalogue-backed wash imagery and the tall Ceramic tile with two smaller Garage/Inspection tiles follow. Club is open, with the exact single-line heading `Make care a habit`. The showroom uses actual listing photos/facts and disappears without eligible inventory. Studio hours/status/contact callbacks remain. The existing shared bottom navigation remains outside HomeView and is not replaced by preview-only text.

No decorative navigation arrows on Home. A service action opens its category choices rather than buying the cheapest product used by the catalogue projection. Missing offerings do not create invented service records.

## Routes and return paths

| Home control | Destination | Return path |
| --- | --- | --- |
| Menu | Existing side drawer or profile | Existing close/tab navigation |
| Bell | Notifications | Existing root Back to Home |
| Switch car | Garage tab | Select through the existing persisted active-vehicle flow, then Home tab |
| Car image / Garage & papers / Open car | Exact active car | Fixed Home origin, including error/not-found/refresh |
| Empty personal stage | Add car | Existing Garage/add stack fallback |
| Approval | Exact pending approval | Fixed Home origin in every rendered Screen |
| Issued invoice | Exact invoice ID | Fixed Home origin; readable invoice URL retains it |
| Active/ready visit or upcoming booking | Exact booking/track target | Fixed Home origin; Notifications origin unchanged |
| Idle paper reminder | Active car documents area | Fixed Home origin |
| Care/rebook | Existing exact book-service action | Existing book-stack cleanup and safe fallback |
| Wash / Ceramic / Garage / Inspection | Existing catalogue family/brand choices | Home entry/family/brand origin survives refresh |
| All services | Services tab | Shared tab navigation |
| Club | Membership | Fixed Home origin; purchase flow remains existing |
| Listing photo/identity | Exact listing | Existing Cars/Home fallback |
| Browse / sell | Existing Cars / sell routes | Existing stack/tab fallbacks |
| Studio | Studio page | Existing Home fallback |
| Call / WhatsApp / Directions / Channel / Instagram | Existing configured callback | External handoff only on user tap |

Active vehicle is never changed in local photo-only state. The adapter remains authoritative for vehicle-scoped jobs, papers, needs and approvals. Priority is pending approval, issued invoice, live/ready visit, next visit, then idle paper/care/rebook. The invoice branch closes an existing adapter mapping gap; no payment acceptance/provider action changed.

## Evidence and limits

TypeScript and customer unit/render suites are run separately. Local production-mode exports cover Web, iOS and Android bundling. Native bundles are not an installed-device or store build. Preview screenshots inspect real components at 320 and 390px in Day/Night; 1280px is only a bounded-width smoke check, not desktop design acceptance.

The interactive preview is a local synthetic component harness. Its controls exercise real component callbacks but deliberately do not send account/booking/quote/payment/contact effects. Route helpers and return-origin wiring are tested separately; authenticated live end-to-end navigation, provider acceptance, device gestures and real-record lifecycle transitions remain unverified. No claim that every possible application state is defect-free is made.

Preview: scripts/visual/customer-home-scene. Build with `node scripts/visual/customer-home-scene/build.mjs`; generated preview.js/index.html are excluded from source control. The delivered review ZIP includes a ready index.html, fonts, real component bundle and labelled sample inventory illustration for local review.


## Accepted brand correction and authenticated verification

The16:46:53 owner clarification keeps AutoDeck colors/fonts/theme;16:46:18 screenshot feedback requests fully rounded listing images. Corrected Day/Night previews were accepted16:53:09. HomeScene/HomeShowroom now consume existing experience colors, typography roles/weights and shared raised surfaces. Listing radius24 matches Ceramic on all corners. Global theme/font files are unchanged.

Authenticated verification used actual Expo Router/screens, Firebase SDKs, local Auth/Firestore/Functions/Storage, explicit demo-autodeck-home and synthetic fixtures. Endpoints were verified local; no copied real sessions/secrets. External browser requests, including the font stylesheet, were blocked. Functions sequential mode solved local parallel-worker memory pressure without changing app behavior. The suite/server have been stopped.

Passed: login and live Home reads; booking detail/Back; car/papers detail/Back; Club empty-plan/Back; Notifications/Back; four Home service entries/Back; shared Bookings/Services/Garage/You tabs; Switch car to Garage; Wash and Ceramic brand/product detail including refresh and return through choices; pending approval detail/Back; exact issued invoice and readable-number refresh/Back. No transaction, approval/decline, booking, payment, quote, upload or contact submission was exercised. Zero page exceptions in completed runs. Actual-router screenshots were inspected for invoice, approval and service detail.

The state test found one additional data gap: useCustomerHome listened for invoices but passed invoices:[] into the model. It now passes scoped live invoices and reprojects when only invoices change. A hook regression covers arrival/removal. Pending approvals still rank first.

Final checks: TypeScript;185 unit files/1087 tests;102 render files/362 tests; fresh Web, iOS and Android exports. Native bundle exports were run separately after a parallel export exceeded local memory. These are not device/store builds. Component visual checks at320/390 and bounded1280 passed without horizontal overflow or page exceptions.

Latest17:09:58 IST screenshot feedback also cleans up Garage Edit vehicle / Remove from garage: page-width shared glass group, aligned20px icons,56px full-row targets and clear destructive text. Existing edit callback and remove confirmation are unchanged. Day390/Night320 component crops were inspected; no real vehicle removal was tested.

Local verification is complete, with limits: production-account/backend/provider compatibility, installed-device acceptance and explicit push/deploy permission remain release gates. No push/PR/deploy/store build occurred. Source main dffcb479/payment PR26 and other contributors' files are preserved.


##17:13 page and payment-sheet spacing feedback

Review payment is CombinedPaymentSheet, distinct from the confirm-page CTA. Moved scroll geometry to PaymentSheetFrame: responsive page20px/compact16px outer gutters, bounded reading width, explicit inner16px wrapper,24px top breathing room and safe-area-aware bottom spacing. Heading, money rows/dividers and full-width Pay share the same inner line. AdvancePaymentSheet consumes the same geometry; only row spacing/wrapping and button alignment changed. Existing text, supplied amounts, callbacks and busy/disabled gating remain intact. No payment rules or checkout code changed.

Inspected real sheet component pixels at320/390 in both themes, including a long title and short568px viewport scrolling. Text/Pay bounds match:33px from either viewport edge at320;37px at390 (outer gutter +1px border +16px inner). No page exceptions or horizontal overflow. These are browser-component proofs, not installed-iOS acceptance. No payment was submitted.

Customer-page source audit:29 of34 route files directly use shared Screen; studio and invoice re-export existing Screen routes, two membership routes redirect, and cars composes CarsHub which uses Screen. Shared Screen keeps existing20px/compact16px gutters. Previously inspected actual-router Booking, Garage, Services, Membership, Notifications, Profile, Approval and Invoice pixels use that shared inset. No blanket global theme/gutter change was needed; deliberate Home image bleeds stay distinct from text. Not every document/content-length/device combination was visually audited.

Final after sheet addition: TypeScript passed; full render102 files/363 tests passed; existing unit185 files/1,087 tests passed before this presentation-only addition; final Web/Android/iOS bundle exports passed. Scope remains local implementation and review only, no remote changes or release.
