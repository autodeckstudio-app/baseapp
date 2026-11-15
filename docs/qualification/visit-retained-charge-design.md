# Partial retained transport charge: bounded design qualification

Local only. This work does not relax cancellation/funding guards, issue an
invoice, allocate receipts, create a receivable, or change any screen or route.

## Why a separate obligation is needed

`visit-invoice.ts` skips cancelled jobs. `visit-billing.ts` verifies every issued
shared component against the original full job breakdown/total and its settled
receipt. `visit-invoice-settlement.ts` also requires that exact full settlement.
A smaller retained-trip component under the same job-invoice identity would
violate those correct proofs. Merely removing the partial-funding cancellation
guard would omit the retained trip when later invoicing the surviving work.
Existing issued invoices cannot be rewritten to make the partial case fit.

The next implementation must keep the original anchor and full-price snapshot,
but represent the retained transport as a distinct obligation. Its identity
must bind the exact saved cancellation plan, original request, saved retained
legs, original price hash and scope, with reciprocal markers. Existing issued
originals must block duplicate issuance. All later partial receipts must apply
to this distinct obligation, never set the cancelled job's full total to paid or
reuse a sibling application. Zero-price retained legs create no positive charge.
Original-method return allocation must continue to exclude exactly the retained
funding, with missing funding remaining due rather than fabricated collection.

## Arithmetic candidate, qualified independently

`visit-retained-transport-charge-basis.ts` is a pure, dormant arithmetic helper,
not the obligation writer. It derives only retained pickup/drop rows using the
existing original marginal service/pickup/drop tax decomposition. It includes
no cancelled-service line, transport discount, service round-off, fake invoice
identity or paid status. It keeps the original breakdown hash, tax allocation
method and explicit `original_transport_component_no_reround` policy.

The18% fixture gives pickup1001+180=1181paise and drop2002+361=2363paise,
together3544paise, not a newly rounded3500paise. A three-paise original with
service/pickup/drop each1paise at18% puts its one tax paise on drop by the saved
pipeline, even though independently taxing the drop would round to zero. The
helper preserves this instead of losing or inventing tax. Service discount and
original positive/negative round-off remain on the excluded service component.

Sixteen unit cases pass, including300 deterministic conservation examples,
choice order, zero-tax/free legs, one-paise marginal tax, duplicate/invalid choice
and malformed original totals/tax/round-off. Functions types/build pass. This
does not prove issued invoices, own/staff reads, PDF, tax compliance, accounting,
partial funding or cancellation execution. No current financial guard changed.

## Remaining integration and PDF gate

A separate typed issued-charge shape must explicitly distinguish retained
transport from a full service obligation. Own-customer/staff reads need exact
scope and issuer snapshots plus a strict parser; the current invoice-ID parser
and components cannot be silently broadened. Bounded Accountant reads must
reconcile obligation/issued/receipt markers both ways and avoid counting the
same gross receipt twice or calling original gross receipts net revenue.

PDF currently rejects all registered issuers for Accountant review; for an
unregistered issuer it rejects any tax/nonzero rate/GST description. It also
assumes a whole-invoice nearest-rupee policy when roundOffPaise is present. The
new retained basis must not be fed to that validator under a false rounding
policy, and the18% fixture cannot be made renderable by changing identity or
zeroing tax. A retained-charge PDF needs its explicit no-reround snapshot rule,
and actual tax support remains separately unresolved. Any new document must be
rendered and visually checked before qualification, then included in the owner
before/after preview. None was generated or represented as ready here.

Full Functions regression after this helper:1985pass,1skip,1same unchanged
explicit staff-alert-label failure. Existing billing/connected emulator results
are fromf401985/1bb842a, not rerun for this unimported arithmetic-only addition.

## Source-grounded candidate review follow-up

`readVisitRetainedTransportChargeCandidate` now derives the candidate from the
current verified visit, original request, explicit unused-leg choice, original
funding and issued history. It includes the exact original money/request/source
tokens and charge basis. No record is saved. Already-issued originals select
`already_issued_original`, never a new transport issue. In a transport-only
retention (another service continues), the exact applied/due transport paise are
shown without using any sibling funding. With a final-service policy fee too,
individual fee-versus-trip funding stays unallocated/null; no unapproved
priority is invented. The total retained funding and total still due remain
explicit. Final cancellation still invokes the existing category/time window.

The existing executable cancellation-review export retains its fully funded
transport guard. The partial candidate uses an internal read-only branch, never
an option a cancellation command can pass. A test feeds the candidate's review
back to the saved executable plan and confirms rejection with no saved plan or
cancellation. No return writer, billing proof or invoice invariant was relaxed.
The private candidate reader has no callable/route, authentication or disclosure
surface; a future caller must validate user/tenant ownership before reading it.
It is not an approved receivable, invoice, cancellation or refund.

Ten new emulator cases cover partial cash/manual UPI/bank, zero/underfunded,
unused drop, already-issued duplicate hold, stale request, blocked executable
plan and explicitly unallocated final-fee funding. All369billing cases pass:
39focused plus330other exact unique names in seven disjoint batches48six times
and42once. Combined passing-name union checked against collected names.
Connected/privacy/Accountant/legacy-owed293cases pass on this tree. Functions
types/build pass; full units1985pass,1skip,1same explicit staff-alert-label fail.
No app/core/UI source changed. The remaining issued-charge/funding/own-staff/
PDF/Accountant integration and partial-cancellation execution are not finished.
