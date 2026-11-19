# Price-sidebar pilot qualification

## Final result, 19 November 2026, 14:38 IST

The approved single-service pilot passed through the actual Price List sidebar and production Admin. Vacuum & Polish was saved as an unpublished Rs251 draft, read back in the Admin editor, then discarded in Admin. No Publish action was taken. The sidebar was refreshed and returned to Rs250, version 0.

The entire live service document is unchanged from the preflight. All 18 preexisting actionable drafts retain their exact preflight update timestamps. Regular Wash's older draft was not touched. The actual Price List Washing row 10 remains Rs250. The public catalogue publication ID and hash remain unchanged. The save and discard audit records and operation receipt are retained.

## Approved scope

The original Regular Wash proposal was replaced before installation because that service already had an older draft. The owner approved Vacuum & Polish at Rs251 instead, keeping its source and customer price at Rs250. The original exclusions still apply: no publication, bookings, payment, customer notification, new hosting plan or raw-cell autosync. Existing-cloud usage remains metered.

The separate temporary account-wide Apps Script source-management permission was approved in the authenticated conversation after its breadth and removal plan were explained. It was used only to install and verify the actual Price List project. The temporary clasp grant was revoked and local token files removed. The Apps Script API setting was restored to its original OFF state. Final linked-apps inspection found no clasp entry. The ongoing bound-sidebar execution consent remains, limited to identity/email, sidebar UI and external requests. Google's unverified-app warning was disclosed before continuing.

## Active production boundary

- Only service svc_a68025c3e10bfbe17ef6560ded766f18 is enabled in the sidebar pilot.
- Sidebar saves a canonical versioned Admin draft. It never writes spreadsheet cells, formulas, costs, live services or the public catalogue.
- Review and Publish remain explicit Admin actions.
- A preexisting same-service actionable draft blocks loading/saving; the transaction checks again on save.
- Stale versions fail closed. Unknown-save recovery keeps the exact operation identity.
- Business identity validation checks verified email, exact token audience, Google-provider subject binding, current enabled Firebase Admin membership and the correct tenant.
- The bridge has minInstances 0, maxInstances 1 and concurrency 1. Transport invocation is available only with application authorization enforced. Anonymous GET and POST were denied.
- Existing save/get function bundles were patched narrowly from their current deployed archives. Other functions were not deployed. General index exports remain closed; isolated entrypoints define this deployment.
- Only Admin production was promoted. Customer and Studio production deployments were unchanged.

This is a one-service draft pilot, not a general release or spreadsheet-cell synchronization. Sidebar data does not live-refresh when another surface changes a draft. Reselecting the service or reopening the sidebar refreshes it.

## Connected proof

- Actual sidebar saved draft panel_cd562e0274ad034861e95d568086d0f95f6261ff at 14:31:13 IST, Rs251, version 1.
- Actual production Admin editor displayed that shared Rs251 draft while the live service card still showed Rs250.
- Admin discarded only that test draft at 14:35:10 IST. Terminal state is discarded, version 2; its historical payload is retained.
- Final Admin shows 18 saved drafts and the live Rs250 service. Final sidebar shows Rs250, version 0.
- Final independent backend read confirms all 18 older draft timestamps and the entire live service document unchanged.
- Retained audit actions: service.panel_draft_saved and service.catalogue_draft_discarded. One matching operation receipt remains.
- Public publication: catalogue_99b9fe8e6787fe954f9ec139d6ec6bbe39727b95.
- Public hash: 5b48fd9cf9d05ae41a51d324ff01c529d6edd0f939977cc85c6a9d71a50cd782.
- Publication timestamp remains 2026-11-18T09:45:32.824Z.

## Source and deployment

Qualified active source checkpoint: e3a258b0c8aa3cf8a8b5dabe6bd71a5e413a1dd4, based on production 5054dffd92d6997c853cf26e2d283c6c5465dc58. Admin's previous live tree was verified identical for the Admin scope before promotion. No broad older branch was released.

Backend revisions:
- savecataloguedraft-00006-kuf
- getcataloguedrafts-00006-ram
- cataloguesheetpanelbridge-00001-qoq

Admin production deployment: dpl_F395wL5eXcxuDuBXVzuacXy86TCB, READY and promoted to the production alias.

Actual workbook:
https://docs.google.com/spreadsheets/d/15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0/edit?gid=1817134917#gid=1817134917

Actual bound script:
https://script.google.com/u/0/home/projects/1gWWRlSMuaGWVH45GtG47Ze8W_Y0u7Xtp3dmxQTULXaPs-OjjRtfqReR4/edit

Admin:
https://admin.autodeck.in/services

## Test qualification

Backend and Admin typechecks passed. The active candidate passed 205 focused unit tests, 27 demo-local emulator checks and 9 Admin route tests. The static active-state assertion pins the exact approved service. The local emulator was shut down. These are targeted results, not a claim that the unrelated broad suite passed.
