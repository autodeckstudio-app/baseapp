# Itemized walk-in visit intake candidate

Local candidate only. Not pushed, deployed or visually approved.

## Existing routes

- Studio > Bays > New Walk-in > customer > vehicle > service > Add another service > review > Prepare estimate.
- Admin > Bookings > Walk-in estimates. Quote-only lines take office-entered quote bases through the existing tax/car-size price engine. Fixed service snapshots are not repriced here.
- Customer > Bookings > Review visit. Every independent service, amount, car and total precedes Approve all services or Decline estimate.

The existing single-service Studio start remains unchanged. Multi-service intake makes no jobs, bookings, bay reservations, invoices or payments before customer acceptance. Acceptance atomically creates independent standby jobs/bookings and one explicit physical visit. It does not mark work performed, start a service, pay or deliver the car. Quote approval uses the existing exact consult quote binding. Later extras still need separate approval.

Every estimate has an immutable revision snapshot. Customer decisions include exact revision, line order and total. Same-revision changed contents, wrong scope, wrong car type, expired offers and stale/partial reviews fail. Receipts make exact retries idempotent. A shared car lock prevents two different offers creating duplicate active visits concurrently. Customer responses require current authenticated customer ownership, not staff assertion of verbal approval.

## Qualification

- Pure validations: unknown prices are not zero, fixed free lines are supported, all money is exact paise, duplicate services/line IDs fail, no repeated transport fees.
- Emulator: exact atomic acceptance, repeated receipt, concurrent different offers, immutable same-total content swaps, independent working minutes, quote bindings, decline/no effects, own-customer read boundaries, staff quote role boundaries and current owner/car checks.
- Mounted controls: actual Studio multi-service selection and preserved single-service start; Customer exact consent, pending lock, expiry and unknown quote, account-switch late reply; Admin exact quote revision/base inputs.
- Source typechecks and full unit suites are separate from visual qualification. No claim that mounted test trees prove pixels or full routed navigation.

## Still open before release

- Shared physical bay controls are now connected in the existing Admin and Studio job routes. Same-bay compatible services can run together; compatible unfinished work moves together; incompatible unfinished work needs an explicit pause. Prior conflicting legacy bay claims need an exact previous-bay-empty review. Shared completed empty-bay release checks all attached recorded work and QC. No completion, delivery, approval or financial fact is inferred. Pure, mounted and emulator checks pass; routed pixels and floor-use review are still outstanding.
- Staff grouped reservation review is now connected and locally tested below. Transport-bearing reservations and office cancellation still retain their holds; their specialized paths must be reviewed before any provider effect. No new fee/refund policy is implied.
- The 20-item read pages now have explicit Load earlier estimates controls and stable created-time/document-ID cursors. Closing a last-row estimate does not invalidate the cursor. Office can close unused estimates, or re-offer expired exact amounts with a new immutable customer review revision. No accepted work is cancelled by this action.
- A car without a saved type needs its record corrected before this estimate path. The estimate does not silently persist a guessed size.
- Current exact offered revisions use the existing notification pipeline with one key per revision, a protected Review visit action and an exact own-estimate lookup in Bookings, including closed status. Delayed expired, replaced or answered offers do not create new notifications. Existing push enablement remains unchanged. No repeated reminder campaign is added.
- The full actual routed current/proposed three-app before/after preview with existing shells/themes/navigation is still owed. Local component renders are not that gate.
- Hosted CI and preview-before-live approval remain required. No production transactions were used as tests.

## Physical bay checkpoint

- Core: 417 tests pass, including exact physical movement and strict review parsing.
- Latest intake/physical-bay emulator: 29 pass; shared visit emulator: 37 pass.
- Admin shared bay and connected job controls: 10 mounted tests pass; Studio shared bay control: 1 passes.
- All five source type checks pass. Full unit suites passed before the final reconciliation cases; final aggregate rerun is still owed.
- Arrival notifications use the verified sign-in UID rather than assuming a customer document ID is an auth UID. Missing or conflicting identity bindings suppress the notification; a visit joined after arrival does not announce another arrival. No live notification was sent.

## Staff status visual check

Actual full-route fixtures exposed a bypass: Admin/Studio anchor badges had used job READY directly even when the server's ledger-aware member label said Check work. They now use the reviewed member label, retain Work paused, and show unknown on failed reads. Admin's aggregate tracker is explicitly labelled Visit. Studio's grouped time is labelled Service estimate, not whole-car Expected ready. Actual route regressions cover READY with missing work and a subsequent failed visit read.

Core 418, Admin unit 316 + mounted 131, Studio unit 134 + mounted 130 pass at this checkpoint. A pre-existing catalogue mounted test omitted the batch-review API mock and failed identically on the pre-visit baseline; the mock now includes that existing API. No production catalogue logic changed.

Local actual-route sample captures now exist at 320/390/1280 for all three apps using real components/themes/shells and blocked network writes. Consistent completed-service samples include recorded QC, with coverage still not confirmed. These are not live screenshots or final combined approval. Intake, remote-pin, join, handover, other entry/history/bill routes and live baseline checks still need the full review package.

## Explicit grouped reservation checkpoint

Existing Admin Job controls and Studio job details now expose Reschedule visit only for grouped unarrived booked jobs. Each independent service retains an explicit local date, time and compatible bay; no automatic service ordering is chosen. Same-bay parallel work is allowed and overlapping different-bay reservations are rejected. Exact all-member, configuration and service review hashes guard one atomic all-reservation update. Per-bay occupancy and transaction locks are checked; an exact operation receipt supports retry without a second move. Existing money, advances, credits, quotes, work and invoices are untouched.

Pending premium customer requests remain Admin-only and must be explicitly approved at their exact requested time, under the existing request freshness and category rules. The old Admin per-service Approve move links to the whole-visit review; decline is unchanged. Customer premium request and pending status paths remain, while the grouped direct-move button leads to the existing Studio contact area. Active pickup/drop plans hold rather than silently moving their reservation times.

The existing notification pipeline emits one checked revision-level message to the verified sign-in UID, without implying that every service starts at one time. Delayed obsolete revision events are suppressed. No notifications were sent live.

Local qualification: core426; Functions1573 plus1skip; Admin units317 and mounted134; Studio units134 and mounted131; Customer units1124 and mounted564 (full mounted563 before adding the final grouped-entry case, focused actual-route135 after). All five typechecks passed before the final test-only additions. New schedule emulator14 cases pass, including stale member/config/service records, races, exact pending-request approval, existing financial records unchanged and exact revision notification identity.

Customer test harness corrections only: map tests await their dynamic import before using callbacks, estimate tests freeze Date at their recorded review time instead of expiring with the wall clock, and the canonical journey AppState mock returns a real unsubscribe handle. No production map, notification or checkout behavior changed for these test fixes.

Routed sample schedule-entry/review/confirmation pixels captured at320/390/1280 with real Admin/Studio shells and network writes blocked. Mobile390 plus narrow320 and desktop1280 review/confirmation pixels were inspected; both service fields, compatible-bay choices and disabled-before-review confirmations fit. These remain local fixtures, not live baseline evidence, full navigation proof, hosted CI or the final combined user approval package. No release authority or production deployment is implied.

## Read-only itemized charge view

The same explicit visit now has a short Visit charges section in Customer booking detail, Admin job detail and Studio job detail. Each independent service is listed once, with an active-service total from the existing reviewed projection. Unknown quotes stay unknown. Cancelled services are excluded from that total without erasing or netting their cancellation charges/refunds. Original per-service price, invoices, receipts and payment actions remain unchanged. No aggregate paid balance, refund or new payment allocation is inferred.

This is progress toward the requested one itemized bill, NOT completion of a unified payable invoice. That gap remains explicit for the combined preview; the current read-only view must not be described as a new financial instrument or silently accepted as reduced scope.

Core427, Admin mounted135, Studio mounted132 pass. Customer full mounted564 pass/1 fixture failure before the final grouped-payment fixture was completed; that targeted route now passes14 and the new charges/canonical-route136 passed earlier. Types pass for core and all3 apps. Fixture-only changes supply amounts/bill metadata previously omitted by status-only route stubs. Functions unchanged since5b71782e. Combined95-case Firestore emulator regression passed before this read-only slice; this is test evidence, not production verification.

Real routed local sample charges captured at320/390/1280 with writes blocked, no page errors or horizontal overflow. Inspected all3 mobile390, Customer/Studio320 and Admin desktop1280 pixels. Studio uses the existing section surface/border language. Final live-baseline inspection, all affected entry/history/navigation captures, hosted CI and combined preview-before-live approval are still outstanding.
