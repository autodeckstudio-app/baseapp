# Retained transport list integration: exact remaining work

Investigation only, not an implemented adapter, screen preview or current-live
pixel inspection. Repository checkpointf56c62d is the code baseline. No UI,
listener, backend rule, public collection or production route changed here.

## Current source paths

- Customer `ui/PickupCard.tsx` subscribes through `lib/pickup-service.ts` to one
  direct pickupRequests document. All CONFIRMED requests read as approved.
  Listener errors set request=null, and null renders nothing: missing transport
  and unavailable transport are currently indistinguishable.
- Admin `app/(admin)/pickups/page.tsx` subscribes through `lib/pickup-service.ts`
  to tenant pickupRequests and separately to a capped bookings list. Tabs/counts
  use raw REQUESTED/CONFIRMED/DONE/DECLINED. Listener error sets rows=[] with an
  alert. Booking state annotates legacy closure eligibility, not retained proof.
- Studio `app/(tabs)/pickups.tsx` subscribes to studio requests and per-booking
  changes. It filters active/history by raw status before legacy eligibility,
  so a retained request on cancelled booking is hidden from actionable lists.
  Error/loading and principal/generation guards already exist and must survive.
- All three mutation controls still call legacy updatePickupRequest, whose
  closed-booking/billed-transport guards must not be relaxed to accommodate a
  new read projection. Read state is not execution permission.

## Staleness trap

Explicit private closure currently writes closure+retention+carVisits revision,
not original pickup request or booking. carVisits/private proof collections have
no direct-client read grant (default deny). A new callable overlay fetched only
when the existing request or booking listener fires would not refresh after
closure. A fresh server result during one load is not a live lifecycle.

Do not add a staff note, fake completion or changed request status just to wake
listeners: closure binds the exact request hash. Do not expose private closure
or weaken rules to let clients subscribe to original finance evidence.

## Preferred next local path

Use the existing scoped booking as a minimal revision signal, not a second copy
of physical truth: write a bounded explicit transport-read revision atomically
with closure and bind its exact visit/request identity. No money/status/fee or
request field changes. Customer needs a scoped booking listener too; Studio's
existing per-booking listener already invalidates on any booking change. Admin
must use each visible request's actual booking rather than depend on a capped
recent-bookings list. The revision is a cache invalidator, never closure proof.
Actual disposition always comes from the authenticated full source reader.

Before choosing this field, qualify that booking source hashes/issued reads
remain unchanged and no consumer interprets it as a financial/work transition.
The actual local adapter must subscribe before its initial fetch, invalidate
while fetching, drop out-of-order results, reset on principal/tenant/studio/
booking change, unsubscribe on unmount and never retain a ready result under
another principal. Latest failed read is unavailable, not empty or history.

A visit identity must be resolved from the exact original request/booking. A
single-visit query repeated for every row cannot silently truncate list state:
use a bounded server batch that verifies each requested row, with explicit
no-retention versus unavailable distinctions and no partial green list. Do not
interpret an unavailable retained row as a normal legacy request. Lists and
counts must be derived from the same verified disposition result.

## Required qualification before visible integration

- Closure in another open surface triggers refresh even when request untouched.
- Pending closure, failed overlay, missing marker, deleted invoice and duplicate
  visits cannot disappear into empty lists or false completed history.
- Needed future drop on cancelled anchor stays visible, but legacy confirm/
  decline/DONE actions cannot become enabled through read-only placement.
- Closed-unused row moves to truthful history without DONE or a drop stamp;
  actual completed row remains distinguishable from unused closure.
- Live principal switch, request switch, unmount, overlapping loads and late
  rejected responses cannot leak or overwrite the current audience's state.
- Customer, Admin and Studio source/mounted suites plus direct-rule and server
  scope tests pass. Full affected read/write/report regression remains required.

Then capture current-live before pixels and exact navigation, build the real
routed local after pages at320/390/1280in existing shell/theme and inspect all
pixels. Keep labels short, no paragraphs, no layout redesign. Propose final
status labels/count placement/action treatment together; a test helper or this
plan is not owner visual review. No visible integration/live deployment before
that gate. Hosted r5 remains unchanged and undelivered.

Broader unsupported retained funding/final-fee/online/tax, benefit-extra slices,
provider activation and combined connected preview remain separate open work.
No owner business-policy question was found in this investigation; the next
step is engineering plus the already-required visual gate, not an invented
approval request or permission to release.

## Revision signal qualified locally

The dormant explicit unused closure transaction now writes
`transportReadRevision:{version:1,visitId,requestId,revision}` on its original
scoped booking, atomically with closure/retention/visit revision. It does not
change booking status, updatedAt, prices, refund fields or original request.
No actor, private hash, note, fee or terminal disposition is in the signal.
The private closure stores the exact revision and proof validation checks both
directions. A signal without closure, removed signal, wrong visit/request/
revision or unexpected extra fields holds reads. Exact replay writes nothing
and does not bump again. Existing closure records without this new signal are
not backfilled. No existing-client listener is modified in this checkpoint.

Seven new emulator cases pass, including equal original per-service money token,
return progress, invoice/request, scoped own-customer invoice read and physical
projection after closure. Final sibling policy/window scenarios still pass.
All414billing cases pass with complete unique-name union checked (41focused+
373others in nine disjoint batches, eight42and one37). All300connected/privacy/
Accountant/legacy-owed cases pass on this tree. Functions types/build pass; full
units1999pass,1skip,1same unchanged explicit staff-alert-label failure. No app/
core/UI source changes. This closes only the source invalidation-signal gap,
not listener delivery, batching, stale-result handling, actual mounted screens
or owner preview. Production routing/rules/activation remain unchanged.

## Exact-row authenticated source batch, dormant

`readScopedRetainedTransportBatch` now handles at most20unique exact request IDs
in one Firestore transaction. It validates every request/booking/customer and
the whole audience before private source retrieval. Grouped rows require exact
job/booking/visit/physical anchor and scope, never guessed anchors. It returns
one row per supplied ID in the same order: retained with the validated physical
allowlist, or explicit legacy only when no retained marker/evidence exists.
Missing row, bad scope, orphan private proof, signal without closure, conflicting
visit/job or changed anchor rejects the whole batch. No partial green rows,
implicit pagination, tenant-wide scan or not-found fallback is returned.
The single-visit reader was refactored to a shared transaction seam, preserving
its exact audience/source checks. No callable or app imports this batch.

Thirteen new batch cases plus existing read/signal/closure/actual original-drop
cases pass38/38. Types/build pass; full Functions1999pass,1skip,1same unchanged
alert-label failure. Prior414billing/300connected full qualification is from
e4004d3, not relabeled as a full427run. This step is source batching only.
Subscribe-before-fetch app lifecycle, signal delivery, overlapping requests,
principal switches and visible list/count integration still need mounted proof
and actual routed owner before/after. No rules/routes/UI/copy/activation changed.

## Concrete app data adapters and mounted lifecycle, inactive

Customer/Admin/Studio each now contain `retained-transport-watch.ts`, a concrete
Firebase request+booking subscription adapter, and `use-retained-transport.ts`,
an inactive-by-default mounted hook. No screen imports either. The shared core
watch lifecycle installs all subscriptions before initial batch read, collapses
synchronous initial callbacks, clears ready data immediately on invalidation,
rejects stale generations, resets on principal/row/reader changes and removes
all subscriptions on unmount. The hook gates every returned value by its exact
scope and reader, including render-before-effect changes. Null scope signs out.

Latest read/validation failure is unavailable, never a ready empty/history
result. A failed source subscription stays unavailable until resubscription,
rejecting pending successes and late events. The data adapter requires an
explicit authenticated reader and strict validator port; there is no missing
backend fallback, implicit callable, automatic activation or physical/action
truth in revision signals. Caller scope must contain verified uid/role/tenant/
studio and exact rows, not an arbitrary account label.

Eleven shared lifecycle cases and twelve mounted cases (four per real app
adapter with Firebase mocked at its boundary) pass. They prove subscription
order, booking-only closure invalidation, row/principal replacement, signout,
unmount, old success/failure, overlapping refresh, source denial, malformed
response validation and inactive default. These are mounted data-flow tests,
not live Firebase delivery or visual pixels. Full current core529pass; source
Customer1137/Admin327/Studio146pass; mounted Customer577/Admin166/Studio152pass.
All five type checks pass. Full Functions1999pass,1skip,1same unchanged explicit
staff-alert-label failure. Existing act-environment harness warnings remain.
No visible UI/layout/copy, production route or direct rule changed. Prior batch
source-focused qualification remains separate; not a new full427billing run.

Still required: strict retained batch response-contract implementation, actual
source-authenticated callable transport in a coordinated inactive release path,
request discovery/list pagination/count policy, real screen consumption and live
invalidation evidence. The injected test reader is not that transport. Actual
Customer/Admin/Studio routed before/after and owner acceptance remain missing.
No claim of finished visible integration or release permission is made.

## Exact response contract connected to source and dormant apps

`parseRetainedTransportBatch` is now shared by the actual source batch output
and each dormant app adapter's `retainedTransportBatchReader`. It accepts only
exact requested ordered rows and physical-field allowlists. Missing/extra/
duplicate/reordered identities, private fields, malformed legacy shape,
conflicting leg partitions, invalid/extra completion stamps and false terminal
states throw. Completed history requires real DONE and all completed legs;
closed_unused history preserves non-DONE status and unused unstamped legs.
Open state is active, and explicit unused closure remains separately required.
This structural contract is not source authentication, action permission or a
replacement for the server's original financial/physical proof.

Twenty-eight new core contract cases pass, with11watch cases. Each app's real
mounted hook uses the concrete validator against a valid closed-unused row,
then source leak/missing-row failures:5cases per app,15total. The38selected
source/read/signal/closure/actual-drop emulator cases pass with the server-side
validator active. Full core557pass; source Customer1137/Admin327/Studio146pass;
mounted Customer578/Admin167/Studio153pass. All five types and Functions build
pass. Full Functions1999pass,1skip,1same unchanged explicit staff-alert-label
failure. Existing harness act warnings remain. No new full427billing rerun is
claimed; prior complete414/300run remains identified above.

No authenticated callable transport, screen import, visible label/layout/count
change, direct-rule change or production activation was added. The actual
source-to-client network path, scoped request discovery/pagination, real screen
consumption and routed owner before/after still remain to connect. The real
validator replaces only the injected test validator, not the missing network
route. All deployment/provider-money/UI-copy and broader funding/tax/online/
final-fee holds remain; hosted review unchanged and undelivered.

## Coordinated local routed slice (2026-11-15, review not accepted)

The actual Customer card/booking route, Admin pickups page and Studio pickups
route now consume a demo-project/emulator-only authenticated preview callable.
A separate read-only preview entrypoint exports it; production index is unchanged.
The route returns exact batch physical allowlists plus minimal booking statuses
from one transaction. Every discovered identity is chunked at20; aggregate ready
and counts require ALL chunks. Existing scoped request snapshots are uncapped,
not a new server-paginated list. More than20 is not silently truncated. Initial
asynchronous request/booking snapshots must all settle before a network read,
preventing a startup request storm found during actual routed qualification.
All source subscriptions still precede reads; invalidation clears ready data.

Actual Firebase Auth-issued emulator tokens, Admin session-cookie exchange,
Firestore listeners and Functions HTTP transport were used on the real routes.
23 requests proved20+3 server reads, Admin All23 and truthful counts. Explicit
unused closure on the unchanged original request refreshed all three open apps:
active Needs closure became history Unused legs closed, without DONE/drop stamp.
Retained rows expose no legacy confirm/decline/DONE action. Deleting private
issued proof and invalidating scoped booking produced unavailable in all three,
with Admin dash counts, not partial/empty green. This failure proof completed in
an earlier run of the same physical transport slice.

Actual routed1280/390/320 shell, active/closed and lower-scroll screenshots are
under /downloads/autodeck-routed-retained, transferred separately as evidence.
Existing shells/components/layout remain. Proposed short labels only include
History, Needs closure, Unused legs closed, Original quote, See booking bill and
unavailable states. Existing distance/policy/refund prose is unchanged legacy
copy, NOT newly approved prose or an exception to the owner's no-paragraph gate.

Parent caught a Payment/Checking payment status row beside definite refund owed.
This was NOT accepted as transient. The preview-only read entry omitted the
already-used getCustomerJobs callable, and the synthetic jobs lacked createdAt,
so the real customer job read could not resolve. Added that existing read export
and source-authentic fixture fields before cancellation. New routed run explicitly
awaited Cancelled · Review returns, with grouped visit charges and actual offline
receipts. No production payment copy/policy was changed to hide this. Lower-scroll
pixels now show See booking bill fully above the navigation. The updated run
captured all active/closed widths but exceeded the120-second harness limit during
the separate final unavailable replay; it does NOT supersede the earlier completed
failure proof or count as a wholly completed final harness run. An upper payment
row pixel plus a shorter final end-to-end rerun remain acceptance work.

Qualification: core567; existing source Customer1137/Admin327/Studio146;
full mounted Customer579/Admin168/Studio154 pass, including actual-screen
retained placement/action/unavailable tests.44selected source/closure/batch cases
passed before the last synthetic metadata/read-export adjustment, plus the seed
reran successfully afterward. No full current433billing run claimed. Five types
passed before that final test-only metadata/read-export adjustment; Functions
rechecked at custody. Both Expo exports and actual optimized Admin build passed.
Admin build exposed a preexisting misplaced use-client directive in
DeliveryDeclaration; moved to the first line, no UI/copy change. Normal Functions
production build restored after local preview, preserving production entrypoint.
Known Functions unit alert-label failure and earlier full414/300qualification
remain distinguished. No rules change, deployment, provider activation, payment,
historical cleanup, invoice rewrite or broader funding/tax/online/final-fee grant.

This is an integrated reviewable retained-transport slice, NOT combined owner
acceptance or completion of the multi-service outcome. Preserve all wider holds.

## Settled complete routed qualification and full current regression

Follow-through completed the bounded end-to-end real-route harness twice after
settling Customer job/payment reads. The final run explicitly awaited Customer
Cancelled · Review returns, then all three booking-only unused-closure refreshes,
Admin All23 and all-three unavailable after original issued proof deletion plus
scoped invalidation.390px was the bounded rerun; prior320/1280 active/closed
screens remain separate evidence, not mislabeled as the latest full run. Quick
failure screenshot names now carry the actual390px width. Upper settled payment
and lower transport tail pixels were inspected directly: no indefinite Checking
payment status, no hidden lower payment line, no fabricated drop completion.

Full current billing433/433 passes in11disjoint batches, name-set equality
against all433collected cases proved no omissions/duplicates. Final auth-order
hardening reran all6local-route cases successfully. Connected/privacy/Accountant/
legacy-owed327/327 plus original membership-covered/noncovered-zero24/24 pass
(351total across14files, not a relabel of the old300). This caught the preview
callable's initial environment rejection preceding the accountant deny; now
standard authentication/role rejection precedes the local-environment guard.

Full Functions2000pass/1skip/1same explicit staff-alert-label failure after the
new callable was wired to standard env-gated App Check and classified. Five new
production-export/demo/actual-target boundary checks and192App Check checks also
pass197/197. This is not a claim of an additional full2005run. Five type checks
and normal production Functions build pass. Production index unchanged, preview
bundle restored away after every final run. Core567/source1137/327/146 and full
mounted579/168/154 remain qualified as stated above; no new app edits since.
The harness accepts restored generated exports under /tmp, cleans its config
and all child services, and uses sample emulator identities only. No processes
or ongoing polling remain. Latest source code is ready for custody and parent
review, not release. The earlier paragraph describing interrupted final harness
is superseded by this completed bounded run, not silently erased.

Remaining combined outcome: this is read-only retained-transport consumption for
the currently supported source slices, not operational retained-leg/closure UI,
not general partially/unfunded retained charges, online/taxed/registered issuance
or final-fee+trip allocation, and not all benefit-extra/provider flows. Needed
future drop still stays active but legacy mutation buttons remain unavailable.
No shell redesign, new prose paragraph, actual payment/refund/provider operation,
production regrouping or deployment was authorized/performed. Owner's full
combined before/after review and approval remain outstanding through parent.

Final closeout reran the full Functions unit suite INCLUDING the5boundary checks:
2005pass/1skip/1unchanged shared_visit_cancel_capture_review alert-label failure.
This supersedes the preceding explicit no-full2005claim. Normal Functions build
was restored again afterward. Source tree clean at the recorded custody commit.

## Operational staff continuation, local preview only

Staff can now Review journey on the actual Admin/Studio pickup routes, then
select a source-reviewed leg, confirm it, and use the existing transactional
progress checks. Admin can review exact retained/return/actually-returned amounts
and the unused leg, then explicitly close it. Studio receives no closure action
and shows Admin closure needed. The original writers own current scope, exact
request/bill tokens, work/payment/handover checks and atomic retry. Saved exact
commands survive a response-loss retry. No implicit refreshed confirmation.
Only the dedicated demo/emulator callable entry exposes these operations;
production index is unchanged and normal production Functions build restored.
No collection/selector expansion, provider activation, deployment or live writes.

12 operational emulator tests pass, including successful drop after actual work
and shared handover, exact replay, unfinished-work denial, stale proof and
cross-role/tenant/studio isolation. Functions full2012pass/1skip, no failure:
the old shared_visit_cancel_capture_review label gap is fixed with short status
text, without changing financial/cancellation semantics. Existing Admin168 and
Studio154 mounted tests pass. Three affected type checks pass; actual optimized
Admin and Studio web exports pass. These counts precede the final additive
return-summary projection; after that, Functions/Admin types and actual routed
staff confirmation/closure were rechecked successfully. Full445billing regression
is NOT claimed: prior433 baseline plus12new operational cases is the evidence.

Focused actual-route390 proof uses1retained request: Admin review/confirmation,
unchanged original request after closure, History1, Studio no closure action,
and actual Bookings staff-alert text. Pixels inspected, confirmation wrapping
fixed. The old complete23-row/3-app read harness remains separate evidence.
New23-row all-three operational run exceeded the120s local harness budget after
successful Admin closure and refreshed History; it is NOT a completed combined
operational3-app proof. A focused run completed instead. New320/1280 operational
pixels, routed successful pickup/drop, response-loss UI interaction coverage,
final post-summary regression and the combined owner review remain unfinished.

Broader funding/tax/registered issuer, final-fee/trip allocation, online/provider
and benefit-extra paths remain unfinished engineering/qualification, not proven
owner-only decisions. No new owner question is established. Existing source
semantics and provider holds remain in force; do not ask for approval of unbuilt
paths. The whole requested multi-service operational outcome is still open.
