# Customer correction batch, 12 November 2026

Prepared locally after the Customer 03c929b release. This document is not a production completion claim or deployment authority.

## Customer UI

- Garage filters group by normalized vehicle make, not make + model, and retain every same-brand model/year. Unknown makes use an explicit Other group.
- The mounted Garage screen uses a measured horizontal car browser with real touch scrolling, settling to a card, Previous/Next keyboard-accessible controls, and the existing tap-to-preview action. A brand's service-history action follows the focused car; All retains the all-car history route.
- Car Story recognizes delivered-job records with visit milestones: First Spark (1), Care Regular (3), Garage Insider (5), AutoDeck Legend (10). Future badges are visibly unearned. The first-visit date still comes only from sealed delivered visits. No points, discounts, cash value, new sharing audience or invented history.
- Progress and badge entrance run once and respect Reduce Motion. Both themes retain readable states.
- Home removes only the redundant Search services bar. The existing global service/search navigation and official tagline are unchanged. The hero is shorter with less space above its greeting, including tablet widths.
- A returned paper id plus uploaded bytes is not a failed add. If finalization fails, the UI says the document is saved but checks unfinished, and tells the owner not to add it again. No verification status is fabricated.

## Actual document incident

A real Customer submit returned HTTP 200 and stored the paper/photo, then finalizeMyPaper returned HTTP 500. The deployed Tesseract worker could not parse wasm-feature-detect 1.10.0's CommonJS import.source syntax under Node 22.23.4. The repository's pnpm lock selected 1.9.0, but the deployed Functions source had no npm lock and the dependency range could float independently.

The compatibility fix pins wasm-feature-detect 1.9.0 in both pnpm and Functions' own npm override. A regression checks both pins, and actual offline OCR checks valid synthetic image bytes and malformed bytes without worker crashes. This is not an OCR bypass and sends no document to an outside OCR service.

## Narrow backend artifact, held separately

For a dependency-only server repair, use the actual deployed finalizeMyPaper source, not a freshly rebuilt current entrypoint containing other newer server code. The recovered deployed lib/index.js is unchanged, SHA-256 `18f6aab9d28ad8c91611cf9fb072c9927f33e12df0e939ed9414338df82bf4e7`.

The prepared source ZIP changes only package metadata/resolution relative to that deployed source: exact wasm-feature-detect 1.9.0 override plus a reviewed npm lock. All lib files/assets remain identical. The artifact is separately inventoried in the internal execution handoff. It is not auto-deployed by this repository push.

Only finalizeMyPaper may eventually be updated after the specific deployment hold is resolved. Node 22, region, service account, runtime environment/resources, auth/tenant/owner/object-generation/OCR decision checks and all IAM remain unchanged. No other function, staff-document activation, rules, PDF, accountant, pickup, refund, payment gate or native release is included. The already saved incident paper is not retried, finalized, verified, replaced or deleted by preparing or deploying this fix.

## Qualification boundaries

Responsive and touch checks use the actual mounted Customer components with explicit synthetic local data and substituted read-only service sources. They are browser checks, not actual iOS Safari or Android device acceptance. Real Google/Home success was reported by the owner on the preceding release. Existing pending paper/photo were confirmed read-only; no further production document action was used for qualification.

## Latest visual corrections

- Services navigation uses a plain four-tile menu icon, not the rejected sparkle motif. Shared ceramic is a shield/check; detailing keeps its spray-bottle identity without its decorative sparkle. Ordinary rating stars and functional icons stay intact. Shared-source changes are prepared but Admin/Studio/Site deployment remains excluded and pending separate qualification.
- Ceramic gets its own dedicated 640x480 hand-applied coating illustration in the same dark-car, warm-studio photographic style as PPF/PPS. It does not reuse film/spray imagery and is not real customer/studio proof.
- Official Gtechniq logo recovered privately from https://www.gtechniq.co.uk/wp-content/uploads/2020/03/Gtechniq-Logo.svg, referenced by https://www.gtechniq.co.uk/. Public wiring held until the brand usage restriction is resolved. Owner's 4 Nov lineup names Gtechnic as special order, not proof of formal accreditation or logo permission.

## Detailing coverage and ordinary-service checklist

The checked-in canonical catalogue, local sanitized sample and reference ranges cover ten detailing families. Fabric, Leather, Glass, Wheels & trim and Trim restoration keep their existing service-specific images. Maintenance now maps to its existing maintenance illustration. Paint sealant, Film aftercare, Lights & plastics and Tyres & rubber have dedicated matching photographic service illustrations. This source audit is not a live catalogue completeness guarantee.

Ordinary-service scope uses conservative checklist presentation. The inspection's six parts each retain `checked and reported`; no repairs/replacements are implied. Known exact catalogue sentences can be separated without adding work, while unknown/conditional scope stays exact. Ceramic/PPF/coating product disclosures remain unchanged.

## Reference product template

Published ceramic, PPF and detailing products already share ServiceDetailView. The older brand/range reference route now uses the same compact header, 16:9 image area, source-authored scope, at-a-glance facts, price section and quote action construction. Unknown product, work/coverage, stock and time stay explicitly to confirm; no warranty, specifications, price or bookability are invented. Brand references with no exact product photograph show a labeled service illustration rather than an empty product-photo hero. GSWF is verified as a brand-level reference, not an immediately bookable SKU.

### Owner preview correction
Remove decorative service/page heading icons and their containers, including reference pages, service benefits/facts and milestone badges. Keep rating inputs, checklist checks, functional navigation, service imagery and titles. Home greeting is exactly the existing profile-derived time-of-day greeting, without selected vehicle title. Earlier icon-substitution previews are superseded.

Removed duplicate At a glance from published and reference service pages. Published unique duration/brand/warranty remain as plain text in existing price section; reference time and brand remain in existing Scope to confirm rows. No new summary block or policy.

Owner spacing correction: top-level Paint Protection/Detailing (and other filters) use the same AutoDeck care/title header geometry as All, without an extra 44px breadcrumb row. Breadcrumbs stay inside family/product drilldowns; filters and back navigation stay.

Owner explicitly chose official Gtechniq mark after usage-terms warning. Original SVG unchanged from https://www.gtechniq.co.uk/wp-content/uploads/2020/03/Gtechniq-Logo.svg, PNG lossless native-compatible rendering shown contained, no recolouring/cropping. No assertion of authorization, stockist status or formal affiliation.
