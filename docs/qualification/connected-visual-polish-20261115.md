# Connected visit visual polish

Base: 6bfc7849947e8a16c5cb59e54ffe8e1b4d747493. Local-only follow-up to the owner's compact-spacing, no-paragraph and no-redundancy feedback. No policy, server, provider, tax, money or production changes.

## Display changes

- Paid cancellation charge: remove repeated total/funded/balance/invoice from expanded review. Keep separate issued original and original-funding status. Nonzero-balance receipt review is unchanged.
- Admin grouped jobs: remove empty payment-navigation card.
- Studio grouped jobs: remove duplicate upper payment row, preserve the full service-payment safety/recovery card. Hide empty bay/schedule containers for cancelled/delivered services and empty history containers.
- Office request note and pickup guidance: concise labeled information.
- Customer original manual-return notice: structured amount/status/next-step rows. A linked visit return owns its notice, like the existing linked-return suppression for legacy provider notices. Preserve service price, original invoice, actual receipt and visit-bill distinctions.

## Route audit

Actual nested-scroll capture, not fullPage alone: Admin jobs/pickups/reports/accountant, Customer booking detail, Studio jobs/pickups. Routed scenarios include prearrival partial/final receipts, separate policy charge part/final receipts, work/QC/shared handover, compatible parallel work, scheduling, funded cancellation/approval/actual return, partial original funding with retained journey, covered/gift restoration, retained transport closure/history, expanded invoices and all-three-app separate PDF downloads. Captures include 320/390/1280 widths; overlapping full-scroll tiles at390. Earlier qualified baseline covers provider-failure/loading/recovery cases; no provider logic changed here.

Full-scroll pixel review retained financial distinctions: visit vs selected service, original vs new charge, received vs applied, approved vs actually returned. Empty list space is not filled with invented content. Form entry area and fixed navigation clearance remain intentional.

## Checks

Admin330, Studio153, Customer1143 unit tests pass. Customer586 render tests pass. All three typechecks pass. Admin optimized build and Customer/Studio web exports pass. Fresh routed scenarios pass locally; no live payment or deployment.

An initial Customer display-row removal was rejected by actual transport qualification because it removed the cancelled/return-review status. Restored before final qualification. An invalid benefit fixture label was corrected to covered/gift, then both actual scenarios passed. A bounded chained audit command timed out after the partial-original/PDF scenario had completed; its following debt run was not counted. Preview process and local compiled Functions bundle were cleaned up/restored.

Review publication is separate from product release. Native Studio rebuilt-device sharing and live provider operation remain unverified. GST remains off; keys unchanged; no production write authorized.
