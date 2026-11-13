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
