# Invoice contact privacy correction - local review only

Held patch b12acbe7, now rebased on released PPF merge52c2126a. No production configuration, financial records, PDF worker enablement, tax, refund, role or historical-original edits.

- Customer invoice screens, print HTML and PDF no longer show the legacy proprietor/legalName or email. Seller tradeName, snapshotted address and phone remain.
- New identity form requests only seller/trade name, billing address and customer care phone. No default values and explicit verification remain. Optional legacy fields still parse on existing originals; no migration/backfill. A save uses the three shown fields for future originals only.
- Email is not mandatory under Consumer Protection General Rules2020 rule5(k): customer care number OR e-mail ID, where available. Source: https://consumeraffairs.gov.in/public/upload/files/Consumer%20Commission%20Rules%20&%20General%20Rules_1732703661.pdf .
- The actual enterprise certificate names AUTODECK and confirms the existing business address/phone. Rule5 requires seller name/address and customer care number or email; it does not expressly require a separate proprietor-name line. This supports the business-name presentation, not legal certification. No issuer value is filled, final collection performed or PDF generation activated. GST stays off.
- Before/after use fictional local snapshots only. Actual production has no issuer configured and eight ordinary invoices, zero shared invoices as checked23:18IST. Existing originals are not rewritten. Historical already-generated external copies cannot be recalled by this patch.

## Exact PPF-baseline qualification,16Nov
Core585; Functions2052passed/1existing skip; Admin330unit/204mounted; Core/Functions/UI/Admin/Customer/Studio types passed. Functions and Admin production builds passed. Local Expo export encountered worktree dependency-path resolution, not a source/type failure; hosted clean-checkout builds must pass before release. All issuer/PDF flags remain off. No financial/provider/testrecord invocation.
