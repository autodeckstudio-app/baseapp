# New combined checkout: whole-rupee snapshots

Version 3 rounds the final combined payable to the nearest rupee, with 50 paise up. It then rounds 20% of that payable by the same rule. The balance is the exact difference. Full payment pays that same rounded total.

Examples, in rupees:

| Exact bill | Payable | Advance | Balance |
| --- | --- | --- | --- |
| 21,089.55 | 21,090 | 4,218 | 16,872 |
| 21,092 | 21,092 | 4,218 | 16,874 |

The second example distinguishes nearest rounding from the old ceiling advance. Service lines, discounts and GST remain in paise. A signed `roundOffPaise` adjustment reconciles the immutable price snapshot, invoice, printed copy and accountant projection. It is not a tax adjustment.

Version 2 snapshots keep their stored exact totals and ceiling advances. Reading or settling them does not recalculate them under version 3. A new combined creation requires version 3; exact existing-intent replay is checked first. Nothing migrates old records.

A positive total whose rounded advance is zero cannot create a zero-amount payment hold. Its advance option is disabled; full payment remains available. A total rounded to zero uses the existing verified zero-payment booking path.

Payment, gift, wash, pickup-benefit and quote capability gates remain inactive. Local tests use demo emulators and mocked payment services. These changes do not establish real provider settlement, approved refund processing, issuer/GST identity, native-device acceptance or deployment readiness. No fee or no-show policy is changed here.
