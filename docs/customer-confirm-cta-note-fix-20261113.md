# Customer confirm CTA + pickup-note correction (2026-11-13)

Completes two already-approved Gauri payment-UI items that the 2026-11-12 batch
(PR #23) shipped incorrectly; looks-only, no pricing/refund/policy changes.

1. **Pay CTA full width.** Approved wording: "Pay button full width (it's a small
   left pill now)". The batch reused the shared `Button` kit component, whose
   default is `alignSelf: "flex-start"` (small left pill). The confirm-page
   primary CTA in `apps/customer/src/app/(tabs)/book/confirm.tsx` now passes
   `style={{alignSelf:"stretch"}}`, rendering full-width with the approved
   label ("Pay Rs <amount> now", disabled state "Pay now").
2. **Single location note under the address box.** The approved layout was the
   address box on top with the "Check your location to see the final
   pickup/drop fee." note under it. The batch added a second copy of the note
   while `PickupOptions` already rendered the same compact-policy caption above
   the address field. The `PickupOptions` caption (its only usage is the
   confirm page) is removed, so the note appears once, under the address field.

Paths:
- `apps/customer/src/app/(tabs)/book/confirm.tsx`
- `apps/customer/src/ui/PickupOptions.tsx`
- `apps/customer/src/ui/PickupOptions.render.test.tsx` (expectation updated)
- `apps/customer/src/lib/vercel-confirm-fix-guard.test.ts` (release pin guard)
- `scripts/vercel-ignore.sh` (pinned block: parent b18d05a1, Customer only)
