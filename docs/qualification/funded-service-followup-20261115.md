# Funded lifecycle follow-up

Local/demo only, no production write, deployment, real money, provider activation or new policy. Extends the 12ac2ad/8864d64 checkpoint. The hosted review and lost-history qualification are unchanged.

## Actual routed outcomes

Six real authenticated three-app scenarios, captured at 320, 390 and 1280:

- Original cash with transport: Admin explicitly reviews which uncompleted legs are unused. Completed pickup is disabled. The cancellation review carries exact retained journey and unused leg amounts; confirmation cancels only work. Original request, fee, completion stamps, immutable source and sibling remain unchanged. Approval and actual manual return remain separate.
- Original manual UPI and bank transfer: each follows the actual Admin job route with separate cancellation, approval and actual original-method confirmation. Labels name the original method. Both Customer and Studio reach Returns recorded only after actual confirmation.
- Mixed cash/online: ₹1,200 return review, ₹240 actual original cash returned, ₹960 online still held. Surviving ₹2,400 remains funded. No online-return request, call or false completed refund is produced. This consumes a local injected-provider capture fixture, not a live capture/return.
- Definitive source rejection: stale reviewed cancellation cannot execute. Saved command survives reload. Check saved decision reaches the server, which fences the old command; only then does Review changed source offer a fresh read. No generic dismiss/reset. A late old writer reads the fence in its effects transaction, so it cannot race the new decision. Unknown/network/auth/scope/proof failures remain held. Exact already-completed commands reconcile without a new effect.
- Genuine scheduling: actual Studio Reschedule visit opens every service time and compatible bay, an explicit checkbox and Confirm visit times. The real whole-visit writer records one schedule receipt, moves both reservations to their checked future date/time and Wash Bay 1, and leaves money untouched. Cancellation then preserves the newly scheduled sibling. Separate schedule emulator coverage checks concurrency, capacity, overlap, stale review and permissions. This is not a relabeled unassigned fixture.

Studio's config read now distinguishes Checking bay, Bay unavailable, No bay assigned and Bay needs review from the exact named bay. It is scoped to studio/tenant and rejects stale read delivery. Read-only current-live before was inspected at Today > Regular Wash > Job, https://studio.autodeck.in/jobs/JDxWpy2O3yXrtL9UGi4O?id=JDxWpy2O3yXrtL9UGi4O . Production resolves Wash Bay 1. Existing shell remains unchanged. A truncated 320px scheduling button was shortened to Confirm visit times; no paragraphs were added.

## Evidence and limitations

Directories: `/downloads/autodeck-operational-funded-{transport,upi,bank,mixed,recovery,schedule}`. Actual route harness: `scripts/visual/retained-transport/run.mjs`. Local runtime telemetry may report an unavailable recordWebVital endpoint; that endpoint is deliberately absent from the preview and does not change lifecycle results. Failed early screenshots are not acceptance evidence.

- Full Functions units: 2025 passed, 1 skipped, before final transport-display and bay read-scope follow-up. Affected AppCheck/boundary: 206 passed earlier this stage.
- Affected billing emulator file: 134 passed, 321 skipped, 455 collected. That file completed before the combined command hit its time budget while beginning the separate schedule suite. Not a completed combined run. Its executed cases include the new exact retirement concurrency/source-restoration test and old manual/online/transport/cancellation coverage.
- Separate schedule emulator rerun: 14/14 passed, clean shutdown.
- Full mounted Admin 183 passed and Studio 159 passed before final transport-display/read-scope follow-up. Latest affected Admin money-control 11/11 and Studio job-detail 34/34 passed. Customer source unchanged since its 580-pass checkpoint.
- Functions/Admin/Studio types and optimized Admin/fresh Studio export passed during this stage. Production Functions build restored after routed work. Detailed logs retain the sequencing, not a claim that every suite ran at the final byte.

Remaining whole-outcome engineering is still listed in the combined inventory: operational benefit cancellation/extras, outstanding retained obligations/final-fee collection, registered/taxed issuance, credential-free testable online integration and whole-scope Accountant/report review. This checkpoint closes the identified transport choice, stale-decision recovery, noncash/mixed operational proof and real reservation source gaps within their qualified slices. It is not release approval or a complete whole-lifecycle acceptance.
