# Customer design qualification

19 November 2026, Asia/Kolkata. Customer-only source qualification. This document does not establish deployment or transaction acceptance.

## Design scope

The Customer design now extends beyond Home and Services into Account, Garage and the car room, Visits and populated visit tracking, booking and review, reschedule and coordination, additional-work approvals, invoices and inspection, membership purchase/history/usage, gifts, quotes, notifications, help, buy/sell, onboarding and sign-in/profile forms. Existing route wrappers and redirect routes keep their behavior. Shared loading, notice, modal, field, sheet, button and row surfaces follow Day and Night appearances.

Actual offerings, prices, policy text, booking eligibility, quote approval, payment sequencing, account/tenant scope checks and existing action handlers are retained. No backend, security rule, environment, flag, sibling app or business-policy change is included in this design continuation.

## Evidence

- Customer render suite: 136 files, 664 tests passed after the row-price regression test.
- Customer unit suite: 211 files, 1,239 tests passed.
- Customer TypeScript passes.
- Production-configured web export and production bundle guard pass with the existing autodeck-studio public configuration.
- Actual-component offline captures cover the rebuilt routes at 320 and 390 CSS pixels, Day and Night. Populated invoice, inspection, sale, approval, reschedule, history, usage and notification states are included. Approval and reschedule confirmation panes were inspected without submitting them.
- Pickup map actual-component pixels show real tile images and the custom CSS pin. The staged deployment serves the Leaflet stylesheet. Build diagnostics about Leaflet default PNGs concern unused default marker/layer-control assets, not the custom pin used by this surface.
- One Night issue found during populated usage review was fixed: primitive row trailing prices now use themed data text. Plan history and Usage and history use visible text controls rather than lone icons. Narrow concept-Shop cards use one column, and full car-budget filter labels wrap without changing their behavior.

## Live and deployment boundaries

The source branch is separate from main. Earlier partial Customer builds and this candidate must not be confused. Verify the exact current commit, Customer project, release configuration, deployed entry hash, excluded sibling builds and rollback deployment before promoting existing Customer aliases. Do not add domains or change sign-in settings to qualify an immutable deployment URL.

Read-only live checks on the existing app domain have opened Home, saved car, catalogue, booking times, booking review and pickup map. One initial review transition returned Home without an error; the same cold load and a repeated normal time-to-review transition succeeded and remained on review. No root-cause fix is claimed for that transient observation. Recheck the normal path on the final live candidate.

No real booking, hold, pickup request, approval decision, reschedule, payment, refund, account deletion, document upload or other record mutation was performed as acceptance testing. Offline fixture callbacks block writes. Installed iOS/Android acceptance and financial transaction acceptance remain separate. Passing behavior tests and representative pixel checks do not establish every possible production state or every deployed backend operation.
