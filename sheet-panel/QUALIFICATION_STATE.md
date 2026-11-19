# Private pricing-sync qualification, November 19

This is an internal implementation record, not owner permission or a user deliverable.

## Implemented and exercised

- Pure three-way reconciliation and strict selling-price transport.
- Server-owned source preview to shared draft import, with durable per-item receipts and read-only status after preview expiry.
- One shared Admin/sidebar draft and exact versions across editors; older held drafts are not adopted or preselected.
- Admin source review and no-sheet-edit confirmation before Publish.
- Dedicated authenticated source-worker factories, fixed origins, named identities and no client coordinates.
- Source review binding, reserved source phases, verified source readback before app promotion, recovery of partial or unknown outcomes.
- Accepted price baseline commit with app publication; separate create-only initial baseline helper with fresh read-only plan, full74 coverage and no-edit window.
- False-by-default source activation. Missing PPS source identity makes full activation fail even if the flag were changed alone.
- Managed controller, bridge and all-fixed Admin save/discovery wiring behind that gate. Ten inspection offerings retain no numeric source return.
- Source-worker candidate omitted from the production index. Scoped inactive packaging exposes only the ten intended pricing functions.
- Existing getServiceCatalogue archive behavior preserved in local source. Compiled candidate reader versus deployed00010-yov archive passes staff/customer parity tests. The release target list does not deploy this reader, public reader, public-content worker, Customer or Studio apps at all.

## Read evidence and freshness

At16:19 IST, actual Price List metadata and six tabs were read through the connected business Sheets account, formula-aware. All63 fixed source row identities, header labels, tab IDs and numeric values match the earlier mapping capture. No fixed selling-price formula was found. PPC remains35000. No PPS tab exists. This is a read, not a source change.

Source URL: https://docs.google.com/spreadsheets/d/15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0/edit?authuser=autodeckstudio%40gmail.com

The full74 live-app/private-snapshot comparison remains the14:42 capture, not a new16:19 app-state read. Its offline qualification gives62 matching fixed prices,10 inspection items and2 explicit source exceptions: PPC and PPS. Initial baseline anchors matching live/source values without adopting held draft values. The import coordinator still blocks existing same-service drafts independently. All external preimages must be recaptured before approved live execution.

## Verification

-84 focused pricing unit checks pass.
-Full functions suite:2258 passed,11 skipped. Backend bundle builds.
-88 emulator checks pass, including source publish/recovery, full74 synthetic baseline create-only migration, direct-client deny rules and7 compiled archive-reader parity checks.
-Latest full Admin sweeps:356 units and224 mounted checks passed. Revised copy and source-review ordering tests pass. Latest Admin production-mode build passes using clearly synthetic offline Firebase configuration, not deployable credentials.
-Backend and Admin typechecks pass.
-Actual component harness previews were visually inspected at desktop/mobile Admin and320px sidebar. They use fixture data/mock callbacks and are not a whole live Admin screen.

## Packaging and remaining owner-dependent steps

Run node sheet-panel/build-price-release.mjs to reproduce the scoped inactive bundle and manifest. It preserves exact current library versions from installed dependencies, records hashes and exports ten pricing targets. This artifact is deliberately inactive and not an executable release.

The final active artifact cannot be frozen until PPS layout is decided, a real new tab ID/identity is captured if approved, source mapping and baseline preimages are requalified, and exact new worker origin/IAM is provisioned under matching authority. No code bypass uses a guessed tab ID or worker URL. The new source writer is not created or shared yet.

Remaining review scope: dedicated source writer/file-editor access and narrow invocation; PPC source35000 to intended40000 while preserving held draft; proposed PPS A1:C2 layout with current description and40000; source/backend/Admin/Apps Script replacement and explicit Publish/no-edit/recovery workflow; metered operation scope. Workbook sharing remains unchanged pending the deferred follow-through. No new production test price or automatic onEdit publication is proposed.

Operational costs: Sheets currently documents standard usage at no additional cost but notes possible charges for exceeding quota later in2026. Per-identity quotas are60 reads and60 writes per minute, project quotas300 each. Source-worker reads are conservatively spaced1.1seconds within a warm instance; source worker concurrency and maxInstances are1. Cold restarts do not retain quota history.429 or unknown write still fails closed, no blind retry. Do not promise unlimited free API usage.

The proposed source worker uses1vCPU/256MiB, min0/max1,60second request timeout. Cloud Run, build artifacts and Firestore use can be billed under the existing project. Regional rates, existing free-tier consumption and total user-triggered volume govern the bill; no zero-cost or fixed-total promise is made. No standing poller or new recurring workload is installed.

Official operating sources read November19:
- https://developers.google.com/workspace/sheets/api/limits
- https://cloud.google.com/run/pricing
