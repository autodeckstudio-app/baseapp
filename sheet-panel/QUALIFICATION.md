# Price-sidebar additive pilot qualification

## Current state, 19 November 2026

Local additive patch on production baseline5054dffd92d6997c853cf26e2d283c6c5465dc58. Not deployed, installed, pushed or activated. No production draft was created or discarded.

The owner approved a limited Regular Wash Rs601 unpublished-draft/readback/discard test at13:07IST after seeing the sidebar preview. Current source/customer price was to remainRs600, existing drafts untouched and audit history retained. No publication, bookings, payments, customer notifications or new hosting plan. Existing-cloud usage remains metered. Raw-cell autosync is excluded.

Live preflight then found existing Regular Wash draftJ9Uvdm2Ckk78bKAPywe0 for exact service svc-wash-regular, version1, draft state. That triggers the explicit stop condition. The old draft remains untouched. No installation/deployment was started.

Read-only replacement research found Vacuum & Polish, svc_a68025c3e10bfbe17ef6560ded766f18, acceptedRs250 in Admin and Price List Washing!B10/F10, no matching draft in the current18-draft actionable feed. Proposed testRs251 requires separate approval; no replacement is activated by this record.

## Data boundaries

- Sidebar edits selling price in a canonical versioned Admin draft only.
- Admin retains explicit Review and Publish. Panel save never publishes.
- Source spreadsheet cells/formulas/costs and live service/customer snapshot rows are never written by the panel.
- Preexisting same-service actionable drafts block loading/saving. A transaction query checks this again on save.
- Stale versions fail closed. Unknown saves retain their exact operation identity for status checks; absent status ends that identity so delayed saves cannot start.
- Business Google token must have verified email, exact audience, current bound Google-provider subject, current enabled Firebase Admin account, correct tenant and pilot email.

## Hard-off rollout gates

CATALOGUE_PANEL_QUALIFIED=false; PANEL_ACTIVE=false; effective service allowlist empty. New functions are not exported. Source pins only svc-wash-regular for the approved but blocked pilot. Apps Script pins actual Price List workbook15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0 and exact bridge endpoint; no installation or OAuth audience is configured. Bridge candidate uses minInstances0/maxInstances1/concurrency1.

## Local evidence on this additive baseline

- Backend and Admin typecheck pass.
-205focused unit tests pass, identity/AppCheck.
-9actual Admin route interaction tests pass.
-27local demo-project emulator checks pass:14transaction/lifecycle checks and13direct-client rules-denial checks. Includes refusal of an old or concurrent same-service draft without a receipt or source change.
- Actual sidebar screenshots inspected at300/390px: successful unpublished save, stale response and unknown-response recovery, no horizontal overflow. Fixtures only, explicitly marked local and not connected.
- New Admin behavior reuses existing editor/history design; route tests prove canonical draft opening without automatic Publish selection. No assertion of new connected Admin visual acceptance.

This is targeted source qualification, not a full-suite or real identity/installation round-trip claim. Earlier broad suite totals from the old branch do not qualify this additive branch.

## Remaining before activation

Recover approval for exact replacement service/value or an explicit resolution of the blocked original pilot. Re-read live service, draft feed and source cells immediately before any effects. Preserve current deployment ancestry. Qualify actual Apps Script OAuth audience and consent; stop if wider than the approved identity/email/sidebar/external-request scope. Do not resume unrelated Cloud verification. Deploy only reviewed additive resources, never the older full candidate. Retain audit/operation/discard history. Report connected result and re-read service/source price/publication after the exact authorized test.
