# Signed service refund ingress, dormant local qualification

This adds a raw-body inspector and private event journal, not production routing.
The existing production webhook, provider factory and schedules do not import it.
No provider request, create, automatic reconcile, approval, reservation release,
returned projection, invoice or booking update occurs. A processed signed event
still returns reconciliation_required, not returned. No live action occurred.

Signature verification comes before parsing. The inspector keeps refund fields
separate from the paired payment. It requires the exact original vor_ receipt,
refund/payment entities, explicit INR and integer amounts, compatible event and
entity status, a captured payment with matching identity and sufficient amount.
Missing fields, auto-refunds on uncaptured money and contradictory entities stay
review-required. Only an explicit nonvisit receipt is unrelated. The header event
ID is validated; absent ID falls back to a hash of verified raw bytes, never an
untrusted body ID. Failed/pending events are hints, not release authority.

The event journal revalidates the original cancellation, approval, capture claim
and full billing proof before assigning a local tenant/studio/visit/job scope.
Known exact events remain independently-fetch-required. Events before committed
submit are marked separately. A conflicting amount/refund identity is a review,
not a replacement source. Missing or unknown reference remains unscoped/private.
Broken local source proof rejects the journal transaction and must not be
acknowledged as processed by any eventual HTTP route.

A replay with the same event identity and raw-body hash is retained as duplicate
review; different raw evidence cannot overwrite it. A first unbound event can
later acquire its proved scope; an already bound event cannot be reassigned.
Only hashes, routing IDs and finite hint fields are stored. No raw body, contact,
notes, acquirer data or exception text enters the journal. Direct client reads
and writes are denied for all tested roles by existing default-deny rules.

Official payload and raw signature contract inspected 15 November 2026:
https://razorpay.com/docs/webhooks/refunds
It documents refund.created, refund.processed, refund.failed, paired refund and
payment entities, auto-refund captured=false, and verification of raw bytes.

Qualification: 40 focused inspector/architecture units and11real-Firestore
journal cases pass. Connected cases include real HMAC failures, durable exact
review, duplicate/conflicting replay, uncertain prior submit, unknown/missing or
conflicting fields, unchanged original invoice, no actual-money identity and
corrupted original receipt rejection. Wider regression remains pending at this
checkpoint. Provider credentials/HTTP transport/factory and actual production
routing remain held and unfinished. This adds no UI or copy; the combined
actual-routed before/after owner preview is still required before live changes.

Follow-up regression: see current-local-checkpoint-2026-11-15.md. All329billing
cases and286connected/privacy/Accountant/legacy-owed cases pass on d732917.
Actual HTTP routing, journal resolution after independent fetched proof, and
unresolved-ingress report hold integration are still unfinished, not implied by
the journal's durable review status. Do not activate or report them as complete.

## Local independently verified resolution and report hold

A later local-only slice adds Admin-only exact-event resolution. It cannot call
a provider or create/project a return. The original request must already be
returned with independently fetched processed evidence, a verified source,
approval and capture identity. The exact event hint must agree with that request
and actual refund ID. Conflicting or missing evidence cannot be waived. Resolution
stores a hash binding the original event to that committed evidence and its
recognition date. Exact retry and exact signed replay preserve it.

Known scoped ingress rows now hold Daily Close, Office and Accountant reports
until resolution. Resolved proof is revalidated every time. Request event markers
and scoped rows are checked both directions, so a deleted row, moved tenant or
studio, missing marker, changed hint/evidence/date/hash or orphan cannot silently
remove a review. The marker changes request metadata only; original updatedAt
and actual recognition time, money, receipt and invoice remain unchanged. A
report recognizes no second refund when the event review is resolved.

Unknown/unscoped events still require a proved provider-account/tenant routing
boundary before production activation. This scoped report hold does not claim
that an unattributed event belongs to an arbitrary tenant. No production route
imports the journal or resolver. Credentialed transport, authenticated factory,
real HTTP routing/acknowledgement and reference-length acceptance remain held.

Focused qualification:24ingress and19protocol emulator cases pass, including13
new resolution/report-marker cases. Functions types pass. The prior329-case full
qualification applies to d732917; broader regression of this follow-up slice is
pending at this note. No actual provider or live data action occurred.
