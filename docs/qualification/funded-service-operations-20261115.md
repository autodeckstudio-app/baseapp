# Funded service operational preview

Local/demo only. No deployment, production write, provider activation, live money or policy change. Separate preview entrypoint only; original billing, cancellation, approval and actual-return transaction writers remain authoritative.

## Actual routed proof

Admin `/jobs/wash`: Review original money > Review funded cancellation > note > selected-service checkbox > confirm. This cancels wash only, preserves interior, creates no approval and returns no money. Review again > Review return approval > separate note and confirmation. This approves only. Review again > Record returned cash > actual original-method confirmation. The source then records the original cash return, with Accountant review needed.

Original immutable synthetic cash payment/invoice: ₹1,200. Surviving interior service: ₹2,400, unpaid throughout. Return review stays ₹1,200. Actually returned is ₹0 after cancellation and approval, ₹1,200 only after manual confirmation. Original payment, invoice and sibling job are byte-equal to their source fixture after the sequence. No refund request or provider call.

Actual Auth, Admin session cookie exchange, Firestore and Functions emulators, optimized Admin app and exported Customer/Studio routes. All three apps captured at 320, 390 and 1280 for five phases. Final run log `/tmp/ad-funded-routed-final.log`. Pixels inspected include narrow actual-return and approval confirmations, Customer cancelled/returned charge rows and Studio returned rows. All retain existing shells and short status lines. No test card, fake control, DOM-injected lifecycle or source-mutating trigger.

Pixel inspection caught an inadequate fixture, then a real Customer stale-visit read and misleading generic processed-by-Razorpay notice for this manual path. Customer and Studio now invalidate the visit read on the booking update marker, return rows use the existing source-verified bill projection, and the generic provider notice excludes visit-owned return records. These are local source changes, not published UI. The Customer test banner remains visible. Studio's fixture has no assigned bay, so its existing Loading bay label remains; this is not bay qualification.

## Recovery and guardrails

Admin, demo build and actual loopback Auth/Firestore/Functions targets required. Production index has no new wrapper exports. Each command is saved before dispatch, scoped to principal/tenant/visit/job; unknown response and reload replay the exact original command. No new command while saved. Malformed/unreadable storage holds controls. Review content and saved command are validated; stale principal responses ignored. Server rechecks exact source tokens, scope and separate confirmations. Provider IDs/private evidence are not projected.

Remaining recovery limitation: saved decisions with a definitive source/permission rejection currently remain held for review rather than offering a safe explicit resolution. This is not a complete conflict-recovery UX. Original-method manual paths exist; only cash has actual routed qualification. Manual UPI/bank, mixed source and transport choices need additional operational fixtures and routed proof.

## Qualification counts

- New transaction-wrapper emulator: 2 passed, 446 skipped, 448 collected. Includes full cancellation/approval/actual return exact replay and negative cross-tenant/missing member/stale token without effects. This is not a full 448 pass.
- Full Functions unit suite: 2025 passed, 1 skipped, before final read-label/invalidation and fixture follow-up. Production Functions build restored after final preview run.
- Admin full mounted suite: 180 passed before final VisitCharges row follow-up; 8 new money-control interactions included.
- Customer full mounted suite: 580 passed after final source edits, including new verified return progress rows.
- Studio full mounted suite: 158 passed after final source edits.
- Functions, Admin, Customer and Studio typechecks passed during this stage. Admin optimized build and both fresh native web exports passed; actual final routed run completed.

## Still missing or held

Transport-funded cancellation review needs exact unused-leg choice wiring. Benefit-funded cancellation, underfunded retained receivables/final fee allocation, registered/taxed issuance and testable provider-return integration remain separate unfinished engineering. Online execution and all live activation remain held. Original lost history remains unrecovered, v7 custody qualification unchanged. Hosted combined review is not updated or delivered by this checkpoint.
