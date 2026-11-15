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
