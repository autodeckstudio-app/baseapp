# Original transport cancellation review, local and dormant

No production route imports this read-only review. It does not remove a leg,
move a physical transport anchor, change an obligation, restore a benefit, cancel
service work or approve/submit a refund. The existing transport-anchor hold stays.

The review reads the complete current visit bill, exact physical request and
original prices inside one transaction. Another physical request, changed owner,
unknown fee, fee not billed, benefit, pending work approval, original price/quote
mismatch or active handover fails closed. Original quote legs are not guessed
from half the combined fee. Asymmetric and odd-paise stored legs stay exact.

Retained transport stays on its original obligation with zero new transport
charge. The review names the continuing services and completed legs. The caller
must name proposed unused legs explicitly; a missing completion stamp is not
permission to delete or refund a leg. DONE requests count as used even when old
records lack per-leg timestamps. No completed leg can be proposed unused. With no
continuing service, an uncompleted retained leg needs a separate explicit choice.

Tax decomposition follows the original service, pickup, drop calculation order.
Marginal tax differences sum to the original invoice tax. Independently rounding
each leg would lose or invent a paise at some boundaries. The original whole-
invoice round-off stays on the service component and is never charged once per
leg. These are review components, not replacement issued-invoice amounts.

Still required: bind this exact review into the retained/unused transport writer,
keep retained transport usable after its original service is cancelled, collect
only its original unpaid obligation, and preserve the existing Admin original-
method refund approval before any unused-leg return. No execution is claimed by
this checkpoint. Full routed before/after visual review and owner approval remain
required before any live change.

Current local verification: Functions types/build pass; all 187 real-Firestore
billing tests pass, including 17 new transport-review cases. Twelve unit tests
also cover original-tax conservation at thousands of integer-rounding boundaries.
