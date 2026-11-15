# Compound partial-funded retained transport slice

Local dormant implementation. No production route/importer, deployment,
provider action, UI/copy application, real invoice or actual money handover.
All data used below are local emulator fixtures.

## Supported compound operation

`cancelPartialFundedRetainedVisitService` is a separate Admin/superadmin-only
transaction. It re-reads exact candidate/request/choice/current original money
and tenant scope before writing. Supported scope is deliberately narrow:

- The original service is only partially funded, but its retained trip has
  positive price and is fully covered by that service's original manual sources.
- Another service continues; computed policy fee is zero. This does not define
  final-cancellation fee policy. Existing category/windows remain unchanged.
- There is no original issued invoice or existing cancellation/retention/charge.
- The existing supported PDF boundary holds: zero-tax original and complete
  unregistered issuer. Underfunded trip, registered issuer, tax and final-fee
  allocation remain held. Online sources are not supported by this operation.

The same transaction creates the original-method cancellation review/plan,
original physical retention proof and a distinct issued retained-transport
snapshot with one invoice number. It claims the original legacy refund identity
for every completed job/booking payment to prevent independent double return.
The booking/job cancellation and visit revision change atomically. Existing
original request, completion stamps, fee, captured receipts/payments and sibling
work/funding are not rewritten. No refund is approved or performed. Audit records
carry the exact zero-fee/retained/return-review result. Exact concurrent replay
creates only one invoice number/record; another decision cannot reuse it.
The general fully funded cancellation export remains guarded and unchanged.

## Source and audience proof

`readRetainedTransportIssuedProof` is called after original cancellation/funding
validation. For partial retained cancellations it requires a reciprocal original
return marker and deterministic separate invoice identity, exact saved review/
request hash, original job price snapshot, saved retained legs and original
marginal tax basis. Retained applied funding must equal the charge, fee/due must
be zero, and sources must be manual. Missing marker/row or changed source/basis/
original price holds billing and replay rather than losing the trip charge.

`readScopedRetainedTransportInvoice` checks tenant/customer or staff studio
before full private billing proof. It revalidates customer identity, erasure,
original return/plan/invoice markers and funding, then returns the content-only
invoice projection. Wrong customer/tenant/studio and Accountant access are
rejected. This is an internal scoped reader, not a published endpoint or PDF URL.
The new collection is denied to every tested direct-client role, including Admin.

Finite report reads reconcile retained invoice rows and original return markers
both ways, then use the existing full original billing proof. Orphan or missing
rows/markers hold the entire report. The separate invoice adds no captured
receipt or revenue: original receipts remain gross, actual returns stay separate.
No invented taxable/net revenue or extra receipt is projected.

## Connected qualification

Twenty-one new billing emulator cases pass, including all-or-nothing unsupported
holds, concurrent replay, tamper/missing facts, private/scoped read access, later
surviving-service invoice and original-method actual return, report money and
orphan holds, and actual surviving-service work/QC/seal/handover then original
drop. The cancelled work stays cancelled, one original request stays one request,
and the exact retained invoice stays unchanged. The surviving final invoice
contains only its original240000paise service. After the actual return, the cash
expectation is243003paise; gross receipt revenue is not counted twice or silently
renamed net revenue. The separate retained charge is3003paise, not3000.

All390billing cases pass:21focused plus369other unique exact names in nine
batches (eight42and one33). Passing-name union/disjointness checked against the
complete collected set. All300connected/privacy/Accountant/legacy-owed cases
pass across10files, including176direct-client privacy cases. Functions types/
build pass. Full Functions1999pass,1skip,1same unchanged explicit staff-alert-
label failure. No app/core/UI source changed. No processes left running.

The actual committed emulator retained invoice was passed to the PDF renderer,
rendered to pixels and inspected: one readable house-layout page, Test Studio/
Test Customer/Test Car, pickup10.01plus drop20.02, totalINR30.03, no cancelled
service line, no overlap/clipping, complete footer. PDF+PNG transferred to parent
as fixture evidence only. This is not a real invoice, owner acceptance or actual
routed combined before/after evidence.

## Remaining limits

This is not general partial/unfunded transport completion. Outstanding retained
funding, final fee+trip allocation, online original sources and taxed/registered
issuer support remain held. Production entry/access/PDF-storage routes and
customer/staff screen integration are not added. Visible unused-leg closure and
the complete routed320/390/1280before/after owner preview remain unfinished.
Other final-fee/benefit-extra connected slices still need their own qualification.
No release or provider-money authority is implied. Hosted private r5 unchanged.
