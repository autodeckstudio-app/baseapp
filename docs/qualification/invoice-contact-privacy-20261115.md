# Invoice contact privacy correction - local review only

Current main f49de1d1. No production configuration, financial records, PDF worker enablement, tax, refund, role or historical-original edits.

- Customer invoice screens, print HTML and PDF no longer show the legacy proprietor/legalName or email. Seller tradeName, snapshotted address and phone remain.
- New identity form requests only seller/trade name, billing address and customer care phone. No default values and explicit verification remain. Optional legacy fields still parse on existing originals; no migration/backfill. A save uses the three shown fields for future originals only.
- Email is not mandatory under Consumer Protection General Rules2020 rule5(k): customer care number OR e-mail ID, where available. Source: https://consumeraffairs.gov.in/public/upload/files/Consumer%20Commission%20Rules%20&%20General%20Rules_1732703661.pdf .
- This is NOT a finding that AutoDeck trade name alone satisfies seller identity under rule5(a). No issuer value is filled, no final collection is performed, no PDF generation is activated. GST stays separate and off.
- Before/after use fictional local snapshots only. Actual production has no issuer configured and eight ordinary invoices, zero shared invoices as checked23:18IST. Existing originals are not rewritten. Historical already-generated external copies cannot be recalled by this patch.
