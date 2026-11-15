# Verified service-return ledger and report integration, local only

The new read-only ledger revalidates original funding, cancellation, approval,
actual manual return and independently verified online processed evidence using
the existing private billing reader. Bounded scans cross-check cancelled job and
booking markers, roots, approvals, actual entries and provider identity facts.
Orphan, missing, duplicate, changed-scope or corrupted evidence holds the entire
report instead of returning a silently partial amount. Each queried source is
capped at 2000; provider refund identities have a tenant-wide cap because their
original schema does not store a studio. Reports hold on an over-cap source.

Daily Close and its live Office dashboard now deduct actual service cash returns
from expected drawer cash, once and on the recorded Asia/Kolkata handover day.
They do not deduct approval, reservation, uncertain submission, pending/failed
provider status, manual UPI, bank transfer or online returns from drawer cash.
A day's expected cash may be negative if an older receipt is returned that day.

Monthly Office and Accountant receive separate service-return totals, current
manual/online amounts still owed and finite actual-money rows. Original receipts,
payments, applied amounts, receipt counts and issued invoices remain gross and
unchanged. Actual service returns are not expenses or silently netted revenue.
Original legacy refundsOwed remains manual-only. The nested service manual due
is its verified overlapping subset, not an additional amount to sum again.
Online owed is separately named and never mislabeled as a manual handover.
No combined legacy-plus-service owed total is claimed.

The dedicated Accountant receives opaque event identities, methods, amounts,
recognition dates and the accounting-review flag. It receives no service/job,
visit, booking, customer, vehicle, provider, actor, note, source-entry, approval
or operation identities from this ledger. New Daily Close records and explicit
recloses store separate total/cash/online service-return amounts; existing close
records are not rewritten automatically.

This does not decide invoice/credit-note or tax treatment. Actual returns remain
accounting-review-needed. It changes no screen, component, label or layout. No
production route activates the dormant cancellation, manual confirmation or
provider-return runners. There is no live money action or deployment here.
The report response fields and cash calculation are local implementation only.

Initial qualification: 19 new real-Firestore ledger cases and six new connected
report cases pass. They cover missing/orphan/scope/amount/approval/source and
processed-online identity/date corruption; the cap; manual overlap and online
owed; approval versus actual return; lost provider response; one-submit
reconciliation; all three manual methods; exact retry; local midnight/month-end;
older receipt with current return; and stored Daily Close reconciliation.
All 19 focused pure totals cases pass, alongside 29 existing offline ledger
units. Functions types pass; broader current-tree regression is still pending
at this checkpoint. The known missing explicit staff-alert-label unit failure
is not hidden or changed by this work. Actual routed visual review and owner
preview remain required before live changes.

## Current qualification and live baseline distinction

At 7ff8679, all 299 billing-emulator cases, 273 connected/privacy/Accountant
cases, 518 core cases, all five type checks and the Functions build passed.
Full Functions units: 1881 passed, one skipped, one unchanged explicit staff
alert-label failure. The source-fixture repairs are separate from recovered
source. No deployment or provider-money activation occurred.

Read-only live baseline on 15 November 2026, about 08:00-08:05 IST:
- Admin > Money > Day close, https://admin.autodeck.in/daily-close
- Admin > Money > Reports, https://admin.autodeck.in/reports
Both displayed the existing owed-total-unavailable warning. Inspection of
loaded view data found no read error and loading=false. Reports had its 16
ordinary report fields but none of refundsOwedPaise, refundsOwedCount or
refundsOwedTruncated. Day close live data likewise had only its ten ordinary
money fields, without the three owed fields. This establishes missing fields
at the displayed response boundary, not which deployed backend version caused
the omission. It does not establish zero owed, a failed owed query, or malformed
legacy records. The deployed backend version and original response payload were
not independently recovered. Displayed gross revenue/net and expected drawer
cash are baseline observations, not reconciled actual-return totals.

The local contract distinguishes:
- Missing/non-finite owed amount/count: unavailable warning, never assumed zero.
- Successful finite aggregate with bad/capped legacy evidence: truncated=true,
  valid subtotal retained and a separate incomplete-evidence warning.
- Actual query failure: rejection, no fabricated zero or incomplete subtotal.
The dedicated service-return ledger is a separate proof with stricter whole-
report holds for missing, orphan or corrupted service-return evidence. Its
manual due overlaps legacy owed; it must not be added to that total twice.

Additional qualification: three pure legacy-read-state cases, five existing
and extended Admin copy cases, and six real-Firestore legacy owed/report cases
pass. The report-boundary case checks Daily Close, Office and Accountant with
finite incomplete evidence. Only tests and this note changed; no screen/copy,
backend behavior, live data or issued invoice changed. Actual routed combined
before/after preview remains unfinished. Current screenshots are before only.
