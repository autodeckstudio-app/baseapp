# Pricing sync rollout candidate, not authority or an executable release

## Intended resources

- Existing actual Price List workbook: 15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0.
- Proposed new source worker identity: catalogue-price-source-writer@autodeck-studio.iam.gserviceaccount.com.
- Proposed private price worker: source-only transport, max instances 1, min instances 0, concurrency 1; exact HTTPS origin must be captured from deployment before wiring. No guessed endpoint.
- Invoker: catalogue-publish-controller@autodeck-studio.iam.gserviceaccount.com only, verified at IAM and Google ID-token level.
- Source identity gets file editor on this workbook, no app database role. File editor can technically change all cells. Numeric selling-cell limits are enforced by code, not a Google range restriction.
- Existing public-content writer remains separate, keeps only its isolated projection workbook access.
- Existing controller gets only invoke permission on the new source worker. No key creation, impersonation, broad project editor, domain-wide or account-wide grant.
- Reuse current durable publisher/recovery exports, sidebar bridge, authenticated Admin review and deployed shared publication readers. No unreviewed combined app release.

## Source effects that need their own approved scope

- Keramic PPC: Ceramic!I19, 35,000 to intended 40,000 after fresh product/formula/header/readback checks. Do not adopt or publish its older held draft.
- Standard PPS: propose a new PPS tab, A1:C2, headings Product / Description / Selling Price; row Standard PPS / existing approved description / 40,000. The new tab ID and identity hash must be captured after creation. This is a layout proposal, no current binding is invented.
- Other fixed-price mappings: 62 currently match; exact preimages must be recaptured before activation. Only mapped selling cells may be written. Garware Plus uses L24, not its internal roll row23.
- Ten inspection-only services: preserve quote behavior, no fabricated numeric source-cell return.
- Initialize accepted baselines only once PPC/PPS reconciliation and full 74-item validation are complete. Preserve all other drafts and app/source edits.

## Workflow and limitations to disclose

Sheet edit -> explicit Review sheet changes -> shared draft -> Admin Review and Publish. Admin edit uses the same draft. Publish requires the exact source review and a short no-sheet-edit window. Raw cell edits do not automatically publish. Source and Firestore are not one transaction; the source can temporarily lead apps. On unknown/partial effects, retain the same operation, inspect readback and do not blindly retry or roll back.

Private state collections: catalogueSourcePriceReviews, catalogueSourcePriceBaselines, catalogueSourcePriceImports. Direct-client access remains denied. Source import status stays read-only even after preview expiry.

## Deployment gate

No activation in this candidate. Still package from exact deployed archives, preserve the newer staffPublication reader, wire exports and full mapping selection, produce baseline dry-run, build all affected targets and freeze content hashes. Then seek approval for the exact identities/access, workbook changes, Apps Script replacement, affected backend/Admin deployments and metered use. Capture exact resource origins and artifact hashes from that packaging step. A prior temporary clasp grant was revoked and is not reused.

Cloud Run/Functions requests, build artifacts, Firestore reads/writes and Sheets API traffic can consume existing project quotas or paid usage. No spend cap or cost estimate is asserted here. Exact configured sizing/billing terms and owner spending scope remain to be verified for the final proposal. No new test-price publication is proposed.

After activation, verify actual source, Admin, Customer and Staff against the same intended publication; preserve current source sharing until the owner's deferred sharing-hardening follow-through. Any all-service rollout remains incomplete until this readback passes.
