# Local covered/gift cancellation and scope labels

Local demo/emulator only. No deployment, provider activation, live money, production writes or new policy. Combined review is still incomplete.

## Connected paths

- Admin Job > Original money review > Review benefit cancellation > note and exact checkbox > Confirm benefit cancellation.
- Covered path uses the original zero invoice and one verified consumed usage row. Restores one wash exactly once, preserving expired membership status, original invoice and historical usage.
- Gift path uses verified redemption and buyer funding privately. Explicit restore-original, keep-refunded or keep-void choice is determined from existing source rules. No recipient money, buyer refund, new gift identity, changed recipient or extended expiry.
- Exact persisted commands use the existing principal/tenant/visit/job journal and server reconciliation. Definitively rejected commands receive a transaction retirement fence also read by each original writer. Unknown failures remain held.
- All three apps read source-verified historical benefit summaries, stripped of private source identities. Later legitimate benefit use does not erase the original cancellation history.

## Scope correction

Studio grouped Job badge and payment headings explicitly say Service. Admin receipt zero-balance text says Active charges paid · Returns separate. The held online return and Accountant review remain visible, not whole-visit settlement.

## Evidence

Actual Auth, callable transactions and routed optimized apps: covered and gift before/confirm/cancelled at 320/390/1280, all three apps. Original money, invoices and sibling checked unchanged; benefits checked for exact restored counter/status/identity/expiry. Separate mixed-source rerun shows actual ₹240 returned and ₹960 online held, with corrected receipt wording. Local test fixtures only.

Routed outputs: /downloads/autodeck-operational-benefit-covered, /downloads/autodeck-operational-benefit-gift, /downloads/autodeck-operational-scope-mixed. Initial parallel Functions startup failed during read-only pre-confirm capture; serial emulator runtime completed. This is not a source-policy failure. Local telemetry endpoint is absent, causing unrelated recordWebVital CORS messages.

## Qualification

- Targeted emulator: 25 passed, 435 skipped, 460 collected. Includes existing covered/gift regressions and new operational benefit retry, stale-command retirement and corrupted cancelled-source checks.
- Full mounted: Admin 187, Studio 159, Customer 580, all passed.
- Shared bill parser: 26 passed, including benefit audience stripping, wrong-target/decision/money/duplicate rejection.
- Functions, Admin, Studio and Customer types passed.
- Optimized Admin build and fresh Customer/Studio native web exports passed. Actual covered/gift and mixed-source routes passed. Production Functions build restored afterward.
- Full Functions unit attempt was interrupted by command timeout before a final summary. Not a completed full-suite pass; previous 2025/1 skipped remains historical.

## Remaining whole outcome

General benefit extras, outstanding/unfunded retained obligation and collection/issuance, final-policy fee plus transport allocation/collection, registered/taxed invoice particulars, credential-free online integration proof, mixed-category physical work/bay and Accountant/report routed review. Provider activation/live tests remain held. Hosted combined review is unchanged and undelivered.
