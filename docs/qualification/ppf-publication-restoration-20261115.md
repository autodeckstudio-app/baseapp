# PPF publication restoration

## Verified fault

The Customer reads the published snapshot, while the Admin catalogue session reads active source records. The source contains the eight existing approved PPF enquiry brands, but the published snapshot contains only PPS. The deployed publisher bundle has an older eligibility registry missing all eight PPF brand keys. Converting explicit records into references applies that older registry again and removes the brands.

Replaying that deployed registry against the exact 58 publication source IDs reproduces the stored snapshot hash exactly:

`0e2e69b2b2f62dff69b1c24669703b8d34abc16ac7fb2a6d28307929cb3d813a`

Both stored and replayed state have 49 services and one reference. The guard produces 49 identical services and nine references, including the existing PPS reference. Rebuilding all active source records would add four unrelated services and is deliberately excluded.

## Narrow guard

- Explicit active enquiry records must pass source-record visibility and placement checks. They are then deduplicated against booking services, not filtered a second time through a bundled fallback registry.
- An explicitly supplied Customer reference list is the exact publication. Only an absent list uses the bundled fallback. An explicit empty list remains empty.
- Inactive records, blocked brands, and unknown records without explicit placement stay hidden. Enquiries never become bookable products.
- No static brand fallback is manufactured when an explicit publication removes a brand.

## Proposed live repair, not yet executed

1. Review before/after actual Customer catalogue screen at Services > Paint Protection > PPF > Full-body protection.
2. Qualify and release the narrow publisher/Customer guard. Re-read actual deployed artifacts to check parity rather than trusting a release label.
3. Re-read publication identity, hash, update time, publish lock, and each of its source IDs. Stop on any concurrent change.
4. Preserve every currently published service object and source ID. Replace only the reference set derived from those exact source records. Do not use the four unrelated active source services outside the publication.
5. Commit the replacement snapshot and a fresh publication identity/version atomically, with a repair audit receipt. Do not rewrite the old completed publication receipt or source service records.
6. Check authenticated Customer-publication readback and anonymous website projection; compare all 49 service rows, prices and reference keys. Confirm the new publication invalidates stale display reads and cold/warm caches retain the eight brands.
7. Verify the actual Customer path, not the Admin source-view. No role/account changes or real booking/payment tests.

No change to published service prices, warranty wording, issued invoices, operational grouping, PPF navigation, GST flags, payment settings or customer-facing private identity. Invoice privacy work is held separately.

## Qualification

- Core: 575 passed.
- Functions: 2049 passed, one existing skip.
- Customer: 1144 passed.
- Core, Functions and Customer typechecks passed.
- Additional real catalogue-cache regression passed: cached brands disappear under the bad fresh publication, then the repaired exact reference set survives fresh fetch, vehicle-price reads and warm reload.
- Before/after local actual catalogue screen checked at 320, 390 and 1280 pixels. Current snapshot versus references-only restoration. Theme-colored ambient stand-in; screen, cards, logos, header and bottom navigation are actual app components. These are proposed local pixels, not production proof.

Status: prepared, not pushed/deployed or applied live. Owner visual review remains required.
