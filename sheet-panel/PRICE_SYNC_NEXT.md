# Actual Price List pricing sync, inactive implementation preparation

## What is proven now

The installed one-service sidebar and shared Admin draft lifecycle passed. Nothing in this candidate changes that active boundary.

Fresh deployed publisher archives show that publishing currently writes an isolated public-content workbook, not the actual Price List. Its five columns contain identity, name, brand, description and visibility, with no selling price. The actual Price List has no named publisher writer. Its current anyone-with-link editor setting is not an authorization mechanism for this work and must not be used as one. The owner deferred sharing changes until the work is complete.

Fresh active service records, customer snapshot and isolated public projection each cover 74 active items. All 74 live base prices match the customer snapshot. The current deployed getServiceCatalogue also supports staffPublication and returns the same snapshot for that route. Preserve that newer deployed reader behavior when integrating; the earlier local baseline does not contain every current reader change.

## Actual-sheet coverage

The inactive JSON candidate contains 74 canonical identities:

- 62 fixed-price offerings have matching source and published values.
- Keramic PPC is mapped but requires reconciliation: Ceramic!I19 is 35,000 while live and customer publication are 40,000. The separate November 18 PPC proposal and owner's Yes establish 40,000 as the intended product price, not authorization for new source-writer access. Do not import 35,000 over it.
- 10 inspection-only offerings have no numeric customer-price source write. The figures in Modifications & Wraps cost cells are not customer prices.
- Standard PPS is live at 40,000 but has no source row in this candidate. A named PPS row must be added to the approved source layout, not silently placed into Ceramic or overwritten onto PPC.

Category inventory: Ceramic 17, PPF 16, Detailing 17, Washing 6, Garage 9, Modifications & Wraps 8, plus Standard PPS. Garware Plus has two source roll-size rows but one customer item at 95,000. The candidate selects only the existing 95,000 selling-price row and preserves the 90,000 internal roll variant.

The historical map contained 12 obsolete IDs. The candidate resolves each to a unique current canonical name/ID, and stores source identity anchors and current header labels. It is not approved for automatic activation. Before future writes, verify source labels, row identity, numeric types, formulas and the exact live service preimage again.

## User workflow

Keep one shared Review & Publish flow. Original November 14 instructions explicitly make Publish the approval and live boundary. The owner wants editing from Sheet or Admin to reach all apps; the one-service test does not narrow that end goal.

Recommended completed workflow:

1. The user edits a mapped selling-price cell or the Admin editor.
2. An explicit sheet action, Review sheet changes, reads the actual selling-price cells and stages only intended deltas into the same versioned Admin drafts. No raw onEdit publishing and no extra review columns.
3. One Admin review lists service, old price, new price and source. Held older drafts remain separate and unselected. Concurrent edits or mismatched identities block the affected item.
4. Publish freezes the exact reviewed versions, actual-source price targets, old values and binding hashes. An explicit short no-edit publish window is required for source writes.
5. The durable publisher verifies source-price writes and isolated content projection, then commits the shared live/customer snapshot. Customer and Staff read that same publication. Only after readback should the UI report Live.
6. Unknown or partial effects retain one operation identity and enter recovery. Do not retry blind, create another draft, roll back over a newer edit or report complete while a surface is unverified.

Sheet and Firestore cannot be committed as one atomic transaction. Google Sheets has no compare-and-swap. A last-moment read is useful but cannot prevent a simultaneous human edit. The exact rollout must describe this, serialize publisher operations and enforce the no-edit window operationally. Do not promise zero-duration atomicity across Sheets and all clients.

## Code prepared, not installed

- price-list-sync-plan.ts: pure three-way reconciliation from accepted baseline, current source and current Admin price; freezes exact price plan; blocks stale identities, formulas, invalid values, conflicting two-sided changes and held drafts.
- price-list-sheet-adapter.ts: injected-port exact numeric selling-price return with preimage checks, final check and readback. Accepts only mapped fixed-price targets and return plans. A fixed-file transport is prepared separately, but no auth/runtime endpoint is installed.
- price-list-import.ts: explicit shared-draft import through existing canonical version/receipt handling, with deterministic operation identity and partial-import recovery.
- price-list-google-sheets.ts: fixed actual-source transport with formula-aware reads, product/header/tab anchors, numeric RAW writes and exact Google acknowledgements. Its proposed dedicated identity is not created or granted access.
- Five focused test files: 64 passing tests. Full functions typecheck passes.
- price-list-bindings.candidate.json: all 74 current identities with explicit inactive state and the PPC/PPS exceptions.

There is no trigger, live allowlist expansion, deployment, source-cell mutation, sharing change or publication in this preparation. The general production exports are unchanged. Active one-service Code.gs and the bridge remain unchanged.

## Remaining implementation before a rollout proposal

1. Turn the candidate into a server-owned, versioned mapping with trusted header/identity reads. Initialize accepted baselines only from reconciled values. Reconcile PPC and choose an explicit PPS source row in the rollout manifest.
2. Compose the prepared fixed-file transport with a dedicated named writer identity, independent of the public-content writer. The file editor grant can technically edit cost/profit/formula cells too; code-only selling-cell limits are not Google-enforced range permissions. This needs explicit disclosure and approval. No account-wide Apps Script code grant is implied.
3. Wire the prepared explicit source import coordinator to a server-generated source plan and the sidebar action, with all-service identity validation and per-item recovery. Preserve held drafts. Review the existing positive-price-only editable guard so a genuine zero-price service is handled intentionally, not silently excluded or made paid.
4. Add review-bound source-price phases to the current deployed durable publisher and recovery readers. Bind source plan hashes to the same trusted review hash and final publication. Preserve newer staffPublication and all other live additions.
5. Add a source-change review action and all-service listing to the bound sidebar, with unknown-save recovery. This is a script source change; the prior temporary code-management permission was revoked and is not a standing grant to reinstall.
6. Run focused lifecycle/emulator tests, then prepare exact deployment/resource/access and real-data reconciliation manifest. No new synthetic production price is needed. A real intended correction, PPC returning to 40,000 in the source after approval of the source effect, is a better acceptance case.

## Live-effect approval boundary

The next proposal must cover the exact source workbook, writer identity and file-level access; allowed cells and formula/cost exclusions; PPC 35,000 -> 40,000 source reconciliation; PPS source row; shared-draft/import workflow and one Review & Publish; no-edit window and recovery behavior; source/script/backend deployment manifest and metered usage. It must not treat approval of PPC's app price or the earlier one-service unpublished test as approval of that new capability.

No further permission question is needed for local coding and testing. Actual access grants, source changes, rollout and publication stay held until their matching authority is established.
