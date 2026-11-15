# Original online service return, local qualification only

No production route, scheduler, webhook or credential transport imports this
writer/runner. All provider work below uses an injected qualification port, not
the user's real payment account. No real refund is performed by this checkpoint.

A separate Admin original-method approval is required before reservation. The
reservation binds one cancelled service's exact original online application,
provider capture, amount and approval. Shared online receipts remain shared;
there is no fabricated single-booking payment. A global capture claim serializes
service reservations and caps their sum at the original captured amount. A
legacy payment alias for a shared capture is rejected. Original individual
payments retain the cancellation's legacy refund identity claim.

The runner commits `submitting` before the only create call. A lost response,
exception, crash, incomplete lookup, absent result, duplicate discovery,
provider-pending or provider-failed result never releases that amount or permits
a second create. Discovery can recover one exact reference match, then requires
an independent direct fetch of that refund. The actual fetched payment, amount,
currency, reference, refund ID and processed state must all match. One global
refund identity cannot be projected to two service returns.

Approval and reservation report no returned money. Only independently verified
processed evidence projects the online amount returned. Cash/manual returns
stay separate, so either order of a mixed-method return preserves the other
amount still owed. Original captured receipts/payments, applications and issued
invoices stay unchanged. Actual returns remain flagged for accountant review;
this does not decide credit-note, GST or issued-invoice treatment.

Remaining provider work before activation includes the real refund HTTP codec,
credential transport/factory, live event routing and the same exact-evidence
checks against current provider documentation. No real provider request, paid
test or activation is authorized here. Retained transport execution, benefits,
visible controls/reports, actual routed visual review and owner approval remain
unfinished. These files are new engineering after qualified source recovery.

Current local qualification: all 225 billing emulator cases pass on the current
tree in bounded disjoint batches (104 ordinary, 94 other dormant, 26 online and
one original individual-provider case). All 120 private-money rules pass.
Functions types/build pass. These are injected-port tests, not a real refund or
proof that a production HTTP provider adapter is connected.
