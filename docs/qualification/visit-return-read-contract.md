# Exact cancelled-service return read contract, local only

The connected Customer and staff bill readers now project the same short,
source-verified return summary from the private billing reader. This closes the
client parser conflict with a funded service cancellation while keeping its
original captured money and issued invoice intact.

Each summary binds one cancelled member and its exact original applied amount.
Paid equals retained plus return due; return due equals actual returned plus
manual and online amounts still owed. Awaiting Admin approval, approved,
partly returned and returned remain distinct. Accounting review is required
only when an actual return is recorded. A fully retained original charge may
legitimately have no money to return.

A cancelled funded line without this exact summary is still rejected. A missing,
duplicate, active-service or mismatched summary fails closed. Cancelled money
never enters the surviving services' total, funding or collectable balance.
Covered and gift zero cancellations remain zero, not fabricated refunds.

The public read projects only job identity, lifecycle and amount totals. It does
not expose provider payment/refund identity, internal source entries, operation
identity, approval records, notes, actors or review/plan tokens. The client parser
also copies only allowed summary fields. The server still checks scope before
reading the private evidence.

This changes no visible component, label or layout. It does not add a callable
writer, activate a provider, submit a real refund or deploy anything. Existing
cancellation holds remain until the later connected controls and actual routed
visual review are ready. Reports still need explicit return-ledger integration;
this contract alone is not a reporting completion claim.

Qualification on this tree:
- All 274 billing emulator cases passed in disjoint batches: 104 existing ordinary,
  139 other dormant and 25 online, plus six connected contract cases.
- Those six cover both Customer/staff exact funded reads, separate approval,
  actual manual return with online still owed, retained transport, fully returned
  mixed funding using an injected provider, covered zero and gift zero.
- All 518 core tests passed, including strict malformed return-summary cases.
- All five project types and Functions build passed.
- Full Functions units: 1862 passed, one skipped, one unchanged missing explicit
  staff alert-label failure. The visible label was not changed without preview.
- Private rules and the additional connected regression were last fully passed
  immediately before this slice (155 and 112 cases). No rules changed here.

No visual verification is claimed: there are no new pixels in this slice. The
complete before/after routed review, navigation steps and owner preview remain
required before any live change.

Follow-up source-fixture repair, separate from application behavior:
Two Customer source-string tests still expected the payment guard before the
recovered grouped-visit protection was added. The actual route already guarded
`!job?.visitId`. The tests now require that guard too, and evaluate that grouped
and cash-reconciliation-held work cannot use the individual pay path. No app
component or condition changed. The complete Customer source suite now passes
1137/1137; Studio146/146 and Admin326/326 source suites also pass.
Mounted interaction suites freshly pass Customer573, Studio148 and Admin162.
These prove mounted behavior, not live routed pixels or owner visual approval.
