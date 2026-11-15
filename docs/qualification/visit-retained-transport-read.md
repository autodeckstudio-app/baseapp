# Truthful retained journey projection, local only

Current Customer reads pickupRequests directly. Admin/Studio listen directly;
history is selected by DONE/DECLINED. Studio also hides requests attached to a
cancelled booking via the legacy eligibility matrix. These routes cannot show
private retained closure truth without an adapter. Faking DONE, or changing
CONFIRMED to DECLINED, would imply false physical history. Simply hiding the
request would lose an unfinished retained trip. Existing direct read/UI/mutation
paths are unchanged in this checkpoint.

`readScopedRetainedVisitTransport` is a dormant authenticated internal read seam,
not a callable or app/list importer. It checks tenant/studio/customer identity
and erasure before full original billing/cancellation/issued-charge proof. It
then validates the exact retention/current-request/closure proof. Output is an
allowlist of visit/job/request identity and physical facts only, no private
plan/hash/actor/notes, provider or funding details:

- `originalRequestStatus` preserves the actual request value.
- `physicalState` is separately open, completed, or closed_unused.
- `placement` is active for open, history for proved terminal state.
- Needed retained legs, actually stamped completed legs and explicitly reviewed
  unused legs are separate lists, never inferred from a missing stamp alone.
- An unclosed unused-leg decision stays active and explicitly requires closure,
  even if all retained legs have completed. Proved closed_unused becomes history
  with original CONFIRMED unchanged and no unused drop stamp.
- Actual completed original drop after surviving work/handover becomes completed
  history only with both real leg stamps and the real DONE state.

Errors hold the read. Missing closure/marker/invoice or changed original proof
never becomes an empty result, falsely actionable journey or terminal history.
Wrong customer/tenant/studio, Accountant and erasing customer are denied.

Twelve new emulator cases plus existing partial/closure cases pass55/55. The
existing actual surviving-work/QC/seal/handover/original-drop test also passes
with its completed/history projection assertion. Functions types/build pass;
full Functions1999pass,1skip,1same unchanged explicit staff-alert-label failure.
No app/core/UI source changed. Prior full390billing/300connected qualification
is from12981ba; five tests-only additions passed at289c6f9. Current407-case
collection is not reported as a new complete407 rerun for this unimported seam.

Real list adapters, batching/live invalidation, current status label/copy and
screen placement remain unfinished and preview-gated. The original direct-client
eligibility matrix is not relaxed and the new read state is not action authority.
No deployment, provider action, actual money, data cleanup or UI/copy application.
Hosted review unchanged; combined actual routed before/after acceptance missing.
