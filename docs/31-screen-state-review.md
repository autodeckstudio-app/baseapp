# Screen and state review ledger

Pending means not yet visually verified after the unified-system release. A shared token fix is not a screen-level pass. Mobile, tablet and keyboard/error/empty/loading states need separate evidence. Existing production bookings remain read-only during review.

| App | Route source | Normal mobile | Loading / empty / error | Keyboard / scaling / tablet |
| --- | --- | --- | --- | --- |
| customer | `apps/customer/src/app/(auth)/login.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(auth)/setup.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(auth)/staff.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(auth)/welcome.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/approvals/[id].tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/book/[serviceId].tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/book/confirm.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/bookings/[id].tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/bookings/index.tsx` | Pass 0890755, 390px | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/bookings/inspection.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/bookings/invoice.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/bookings/reschedule.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/cars/[id].tsx` | Pass d70de62, 390px | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/cars/index.tsx` | Pass d70de62, 390px | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/cars/sell.tsx` | Steps 1-2 pass d70de62, 390px; final review pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/catalogue/[id].tsx` | Detail SPA pass eb5008a, 390px | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/catalogue/brands.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/catalogue/index.tsx` | Pass 63cc18d, 390px; wash subgroup images checked | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/garage/[id].tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/garage/add.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/garage/index.tsx` | Pass 0890755, 390px | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/help.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/index.tsx` | Pass d70de62, 390px | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/membership/[planId].tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/membership/current.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/membership/history.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/membership/index.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/membership/purchase.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/membership/usage.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/notifications/index.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/(tabs)/profile.tsx` | Pending | Pending | Pending |
| customer | `apps/customer/src/app/index.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/attendance/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/audit/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/bookings/[id]/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/bookings/page.tsx` | Pass 63cc18d, 390px; wrapping filters checked | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/cars/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/customers/[id]/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/customers/page.tsx` | Pass 63cc18d, 390px | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/daily-close/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/dashboard/page.tsx` | Pass 0890755, 390px | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/expenses/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/gallery/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/inventory/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/invoices/[id]/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/invoices/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/jobs/[id]/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/jobs/page.tsx` | Pass 04f5256, 390px | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/memberships/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/papers/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/payments/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/pickups/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/reports/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/services/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/staff/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/stories/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/studio/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/(admin)/vehicles/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/agenda/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/audit/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/customer/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/customers/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/dashboard/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/floor/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/invoice/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/invoices/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/job/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/memberships/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/payments/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/services/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/shell/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/studio/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/team/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/design/vehicles/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/login/page.tsx` | Pending | Pending | Pending |
| admin | `apps/admin/src/app/page.tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(auth)/login.tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/account.tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/bays.tsx` | Pass 0890755, 390px | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/calendar.tsx` | Pass 0890755, 390px | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/index.tsx` | Pass 0890755, 390px | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/jobs/[id].tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/jobs/inspection/[jobId].tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/lookup/customer/[id].tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/lookup/index.tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/lookup/vehicle/[id].tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/pickups.tsx` | Pass 63cc18d, 390px; no action fired | Pending | Pending |
| studio | `apps/studio/src/app/(tabs)/walkin.tsx` | Pending | Pending | Pending |
| studio | `apps/studio/src/app/index.tsx` | Pending | Pending | Pending |

## Evidence notes
- Cars sell step 1 missing required fields and step 2 missing photo/price are blocked in-app. No photo uploads, listing submission or enquiry sent during testing. Final populated review and success states still pending.
- Admin More sheet visually inspected at 390px. Close control and Escape worked. Full keyboard focus-cycle audit still pending.
- Existing stock/design library only was changed. Listing, garage and evidence originals were not altered.
