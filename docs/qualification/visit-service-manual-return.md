# Service return approval and actual manual return, local and dormant

No production route imports these functions. They do not submit a provider
refund or move money. The existing visible holds and release gate stay in place.

Cancellation is not approval. An Admin must separately confirm the current exact
original-method return, with a note. Approval creates one private immutable
approval fact and reports zero returned. A stale token, wrong role, tenant,
changed amount or changed original funding fails before a write.

Cash, manual UPI and bank transfer then require a separate actual-return
confirmation for the exact original source entry. One deterministic immutable
record binds the approved source, amount, method, original receipt/payment,
Admin and note. Retried or simultaneous confirmations cannot double the money.
These functions record an Admin's confirmation that a handover happened; they do
not perform a cash handover or initiate a bank/UPI transfer.

For mixed funding, returning the manual share does not return the online share.
Online remains separately owed and unsubmitted. The original global online
capture identity and each service application remain unchanged. No legacy refund
request, fabricated booking payment or provider submission is created.

Original captured payments, receipts, receipt applications and issued invoices
are immutable. The cancelled service's booking projection must match the verified
approval and actual-return ledger. Actual returns flag accounting review needed;
this is not an accountant-approved invoice/credit-note/tax treatment. Sibling
balances remain based only on their own original obligations and money.

A cancellation also claims each original legacy payment's existing refund
identity. Older single-payment manual, external-return and provider-reservation
paths cannot return the same funding outside this approved service ledger. The
billing reader requires those claims to remain intact and exactly bound.

Still required before a connected release: online original-capture return
reservation/submission/discovery/reconciliation, retained/unused physical
transport execution and logistics, benefit/gift cancellation, outstanding-fee
settlement, reporting/visible controls and the full actual routed visual review
with owner approval. No UI/layout/copy is changed by this slice.

Current local verification: all 200 real-Firestore billing tests pass, including
13 new approval/actual-return and cross-path guard cases. All 99 private-money
rules, 506 core tests, Functions types and build pass. These checks do not prove
the visible routed experience; no new pixels are claimed.
