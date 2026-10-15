# Server work held for the single functions deploy

Nothing here ships until the owner says the changes are done and gives an explicit yes. Client code for each item is already in
main, dark behind a flag, so it stays inert until the server half exists.

## Referral (client flag: REFERRAL_LIVE in apps/customer/src/lib/referral.ts)
Reward: the referred friend's first wash is free, once. No referrer reward.
- Store each customer's code (`referralCode`, from the same derivation as `referralCodeFor(uid)`, or generate and store; it must be unique, reject on collision).
- `createBooking`: accept optional `referralCode`. Validate: format, exists, not the booker's own code, booker has no earlier completed or active booking, code not already redeemed by this customer.
- Redeem once: mark the booking's wash line free (price is computed on the server only), record redemption `{ referrerUid, refereeUid, bookingId, at }` with a unique constraint on refereeUid.
- Only a wash service qualifies; define which services count.
- Firestore rules: customers cannot write redemption records.
- Then flip REFERRAL_LIVE and verify end to end on the TEST customer only.

## Membership wash (client flag: MEMBERSHIP_WASH_LIVE in apps/customer/src/lib/membership-wash.ts)
- `createBooking`: accept `useMembershipWash`, re-check every rule server side (active, dates, washes left, wash-eligible service, one per booking), decrement washes in the same transaction, price the wash at zero on the server.

## Reminders and live-job pushes (client: Add to calendar and push ask are in main)
- Scheduled function: send a push (and WhatsApp if enabled) 24 hours and 2 hours before a CONFIRMED booking; skip cancelled or rescheduled ones, and re-schedule when the booking time changes.
- Confirm job-stage pushes exist (confirmed, car received, in progress, ready for pickup) and respect the customer's notification setting.
- Receipt after online payment (with pay online, test mode first).

## Other held items
- GST off: branch `gst-off`, commit 079d0cc.
- Warranty seed: packages/core/src/menu.ts still carries brand-wide warranty terms; update to the per-film labels in docs/WARRANTY-CLAIMS.md.
- Catalogue cold start: `getServiceCatalogue` is slow on a cold function; consider min instances.
- Pay online, invoices and WhatsApp updates (test mode first). Live Razorpay keys through a vault link at the end, before deployment.
